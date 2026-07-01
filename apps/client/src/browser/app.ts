import { PublicClientApplication, type AuthenticationResult } from "@azure/msal-browser";
import { getJoinToken } from "../auth/join-token-caller.js";
import {
  ExternalIdSessionStateMachine,
  type AcquireTokenResult
} from "../auth/external-id-session.js";
import {
  buildApiScopes,
  buildMsalConfiguration,
  type ExternalIdClientConfig
} from "../auth/msal-config.js";
import { SessionBootstrapStore } from "../session/bootstrap-store.js";
import { createBrowserChecksum } from "../session/replay-checksum.js";
import { fetchSessionBootstrap, placeTile, probeApi } from "./api.js";
import { getBrowserRuntimeEnv } from "./env.js";
import { bindBrowserRenderHandlers, renderBrowserAppState } from "./render.js";
import { connectRoom, joinArenaRoom } from "./room.js";
import {
  applyRealtimeDelta,
  createInitialBrowserAppState,
  selectCell,
  withAppState,
  type BrowserAppState
} from "./state.js";

function createCommandId(): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `browser-${Date.now().toString(36)}-${random}`;
}

function isSpaClientTypeMismatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("AADSTS9002326");
}

export async function startBrowserApp(): Promise<void> {
  const env = getBrowserRuntimeEnv();
  let currentState: BrowserAppState = withAppState(createInitialBrowserAppState(), {
    roomId: env.roomId,
    status: "auth-preflight",
    message: "Checking auth configuration before startup."
  });

  const render = () => {
    renderBrowserAppState(currentState);
    bindBrowserRenderHandlers({
      onSelectCell: (cellX, cellY) => {
        currentState = selectCell(currentState, cellX, cellY);
        render();
      },
      onPlaceTile: async () => {
        await handleTilePlacement();
      }
    });
  };

  render();

  const msalConfigResult = buildClientConfigFromEnv(env);
  if (!msalConfigResult.ok) {
    currentState = withAppState(currentState, {
      status: "error",
      message: "Auth preflight failed.",
      guidance: msalConfigResult.message
    });
    render();
    return;
  }

  const msalApp = new PublicClientApplication(buildMsalConfiguration(msalConfigResult.value));
  const authSession = new ExternalIdSessionStateMachine(msalApp, msalConfigResult.value);
  let redirectResult: AuthenticationResult | null = null;
  let tokenState: AcquireTokenResult;

  try {
    await msalApp.initialize();
    redirectResult = await msalApp.handleRedirectPromise();
    if (redirectResult?.account) {
      msalApp.setActiveAccount(redirectResult.account);
    }
    tokenState = await authSession.acquireTokenReadyState();
  } catch (error) {
    currentState = withAppState(currentState, {
      status: "error",
      message: "Auth token exchange failed.",
      guidance: isSpaClientTypeMismatch(error)
        ? "AADSTS9002326 detected. Configure VITE_APP_MSAL_CLIENT_ID as a Single-page application in Entra and add http://localhost:5173 as an SPA redirect URI."
        : `MSAL startup failed: ${(error as Error).message}`
    });
    render();
    return;
  }

  if (tokenState.state === "interaction-required" || !tokenState.accessToken) {
    currentState = withAppState(currentState, {
      status: "error",
      message: "Interactive sign-in required before gameplay calls.",
      guidance:
        "Sign in with the configured Entra External ID app. If this keeps failing, verify VITE_APP_MSAL_* values and server ENTRA_* environment settings."
    });
    render();
    await authSession.beginInteractiveAuth();
    return;
  }

  authSession.completeBootstrap(redirectResult as AuthenticationResult | null);
  currentState = withAppState(currentState, {
    tokenReady: true,
    status: "bootstrapping",
    message: "Auth token acquired. Probing API and loading bootstrap."
  });
  render();

  const bootstrapStore = new SessionBootstrapStore(authSession, env.bootstrapEndpoint);

  try {
    const [apiProbe, roomConnection] = await Promise.all([probeApi(env), connectRoom(env)]);
    await fetchSessionBootstrap(env, { accessToken: tokenState.accessToken });
    await bootstrapStore.bootstrap();

    const joinToken = await getJoinToken(authSession, env.joinTokenEndpoint, env.roomId);

    currentState = withAppState(currentState, {
      bootstrapReady: true,
      status: "joining-room",
      message: `Bootstrap ready (api ${apiProbe.status}, ws ${roomConnection.connected ? "ok" : "pending"}). Joining room.`
    });
    render();

    const roomSession = await joinArenaRoom(env, joinToken.joinToken, {
      onJoined: (joinedPayload) => {
        currentState = withAppState(currentState, {
          roomJoined: true,
          roomId: joinedPayload.roomId,
          status: "ready",
          message: `Joined room ${joinedPayload.roomId}. Place a tile to exercise the loop.`
        });
        render();
      },
      onDelta: (deltaPayload) => {
        currentState = applyRealtimeDelta(currentState, deltaPayload);
        render();
      },
      onRoomLeave: (code) => {
        currentState = withAppState(currentState, {
          roomJoined: false,
          status: "error",
          message: `Room connection closed with code ${code}.`,
          guidance: "Restart the browser app and ensure the local server is running."
        });
        render();
      }
    });

    currentState = withAppState(currentState, {
      roomJoined: true,
      roomSessionId: roomSession.sessionId,
      roomId: roomSession.roomId,
      status: "ready",
      message: `Joined room ${roomSession.roomId}. Use Place Tile to call /api/tiles/place.`
    });
    render();
  } catch (error) {
    currentState = withAppState(currentState, {
      status: "error",
      message: `Startup orchestration failed: ${(error as Error).message}`,
      guidance:
        "Validate ENTRA_*/VITE_APP_MSAL_* values and ensure npm run -w @game/server dev is running before retrying."
    });
    render();
  }

  async function handleTilePlacement(): Promise<void> {
    if (!currentState.roomJoined || !tokenState.accessToken) {
      currentState = withAppState(currentState, {
        placeFeedback: "Room is not ready yet. Wait for join to complete."
      });
      render();
      return;
    }

    const commandId = createCommandId();
    const checksumSeed = [
      {
        regionId: env.roomId,
        cellX: currentState.selectedCellX,
        cellY: currentState.selectedCellY,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "orange",
        stylePayload: { source: "browser-loop" },
        ownerId: "self"
      }
    ];
    const commandChecksum = await createBrowserChecksum(checksumSeed);

    const response = await placeTile(
      env,
      {
        accessToken: tokenState.accessToken
      },
      {
        commandId,
        regionId: env.roomId,
        cellX: currentState.selectedCellX,
        cellY: currentState.selectedCellY,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "orange",
        stylePayload: {
          source: "browser-loop",
          checksum: commandChecksum
        }
      }
    );

    if (response.result.ok) {
      currentState = withAppState(currentState, {
        placeFeedback: `Placed tile ${response.result.tileId} (status ${response.status}).`
      });
      render();
      return;
    }

    if (response.result.reason === "occupied") {
      currentState = withAppState(currentState, {
        placeFeedback: `Conflict at (${response.result.cell.cellX},${response.result.cell.cellY}); winner ${response.result.winner.ownerId}.`
      });
      render();
      return;
    }

    if (response.result.reason === "throttled") {
      currentState = withAppState(currentState, {
        placeFeedback: `Rate limited. Retry after ${response.result.retryAfterMs}ms.`
      });
      render();
      return;
    }

    currentState = withAppState(currentState, {
      placeFeedback: `Placement rejected: ${response.result.reason}.`
    });
    render();
  }
}

function buildClientConfigFromEnv(env: ReturnType<typeof getBrowserRuntimeEnv>):
  | { ok: true; value: ExternalIdClientConfig }
  | { ok: false; message: string } {
  if (!env.msalAuthority || !env.msalClientId || !env.msalKnownAuthority || !env.msalApiScope) {
    return {
      ok: false,
      message:
        "Missing auth config. Set VITE_APP_MSAL_AUTHORITY, VITE_APP_MSAL_CLIENT_ID, VITE_APP_MSAL_KNOWN_AUTHORITY, and VITE_APP_MSAL_API_SCOPE for local startup."
    };
  }

  const config: ExternalIdClientConfig = {
    authority: env.msalAuthority,
    clientId: env.msalClientId,
    redirectUri: env.msalRedirectUri,
    knownAuthorities: [env.msalKnownAuthority],
    apiScope: env.msalApiScope
  };

  const scopes = buildApiScopes(config);
  const primaryScope = scopes[0];
  if (!primaryScope || primaryScope.length === 0) {
    return {
      ok: false,
      message: "MSAL API scope is empty. Set VITE_APP_MSAL_API_SCOPE to a valid API scope."
    };
  }

  return {
    ok: true,
    value: config
  };
}
