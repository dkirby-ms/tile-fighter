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
import { emitClientTelemetry } from "./telemetry.js";
import {
  addOptimisticTile,
  applyRealtimeDelta,
  clearOptimisticTile,
  createInitialBrowserAppState,
  isCellOccupied,
  recomputeBonds,
  selectColor,
  selectCell,
  setAccessibility,
  setOnboardingState,
  selectShape,
  setPaletteOpen,
  setPreview,
  updateViewport,
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
  void emitClientTelemetry("tutorial_started", {
    room_id: currentState.roomId,
    started_at_ms: currentState.onboarding.startedAtMs
  });

  const render = () => {
    const renderOutcome = renderBrowserAppState(currentState);
    bindBrowserRenderHandlers({
      onSelectCell: (cellX, cellY) => {
        currentState = selectCell(currentState, cellX, cellY);
        render();
      },
      onTogglePalette: () => {
        const nextPaletteState = !currentState.paletteOpen;
        currentState = setPaletteOpen(currentState, nextPaletteState);
        if (nextPaletteState) {
          void emitClientTelemetry("palette_opened", {
            room_id: currentState.roomId,
            selected_shape: currentState.palette.shape,
            selected_color: currentState.palette.color
          });
        }
        render();
      },
      onNextOnboardingStep: () => {
        if (currentState.onboarding.completed) {
          return;
        }

        const nextStep = Math.min(3, currentState.onboarding.activeStep + 1) as 1 | 2 | 3;
        currentState = setOnboardingState(currentState, {
          activeStep: nextStep
        });
        render();
      },
      onSkipOnboarding: () => {
        if (currentState.onboarding.completed) {
          return;
        }

        const completedAtMs = Date.now();
        currentState = setOnboardingState(currentState, {
          skipped: true,
          completed: true,
          completedAtMs,
          activeStep: 3
        });
        void emitClientTelemetry("tutorial_completed", {
          room_id: currentState.roomId,
          skipped: true,
          elapsed_ms: completedAtMs - currentState.onboarding.startedAtMs
        });
        render();
      },
      onSelectShape: (shape) => {
        currentState = selectShape(currentState, shape);
        void emitClientTelemetry("shape_selected", {
          room_id: currentState.roomId,
          shape
        });
        render();
      },
      onSelectColor: (color) => {
        currentState = selectColor(currentState, color);
        void emitClientTelemetry("color_selected", {
          room_id: currentState.roomId,
          color
        });
        render();
      },
      onToggleHighContrast: () => {
        const enabled = !currentState.accessibility.highContrastEnabled;
        currentState = setAccessibility(currentState, {
          highContrastEnabled: enabled
        });
        void emitClientTelemetry("a11y_mode_enabled", {
          room_id: currentState.roomId,
          mode: "high_contrast",
          enabled
        });
        render();
      },
      onToggleReducedMotion: () => {
        const enabled = !currentState.accessibility.reducedMotionEnabled;
        currentState = setAccessibility(currentState, {
          reducedMotionEnabled: enabled
        });
        void emitClientTelemetry("reduced_motion_enabled", {
          room_id: currentState.roomId,
          enabled
        });
        render();
      },
      onKeyboardMove: (deltaCellX, deltaCellY) => {
        currentState = selectCell(
          currentState,
          currentState.selectedCellX + deltaCellX,
          currentState.selectedCellY + deltaCellY
        );
        render();
      },
      onKeyboardPlace: async () => {
        void emitClientTelemetry("keyboard_placement_used", {
          room_id: currentState.roomId,
          cell_x: currentState.selectedCellX,
          cell_y: currentState.selectedCellY
        });
        await handleTilePlacement();
      },
      onHoverCell: (cellX, cellY) => {
        const blocked = isCellOccupied(currentState, cellX, cellY);
        currentState = setPreview(currentState, {
          cellX,
          cellY,
          blocked
        });
        if (!blocked) {
          void emitClientTelemetry("placement_preview_shown", {
            room_id: currentState.roomId,
            cell_x: cellX,
            cell_y: cellY,
            shape: currentState.palette.shape,
            color: currentState.palette.color
          });
        }
        render();
      },
      onClearPreview: () => {
        currentState = setPreview(currentState, undefined);
        render();
      },
      onPanBy: (deltaCellX, deltaCellY) => {
        const tileSize = Math.max(20, Math.round(56 * currentState.viewport.zoom));
        currentState = updateViewport(currentState, {
          panX: currentState.viewport.panX + deltaCellX * tileSize,
          panY: currentState.viewport.panY + deltaCellY * tileSize
        });
        void emitClientTelemetry("viewport_changed", {
          room_id: currentState.roomId,
          pan_x: currentState.viewport.panX,
          pan_y: currentState.viewport.panY,
          zoom: currentState.viewport.zoom
        });
        render();
      },
      onZoomBy: (deltaZoom) => {
        const nextZoom = clampZoom(currentState.viewport.zoom + deltaZoom);
        currentState = updateViewport(currentState, { zoom: nextZoom });
        void emitClientTelemetry("zoom_level_changed", {
          room_id: currentState.roomId,
          zoom: nextZoom
        });
        render();
      },
      onZoomReset: () => {
        currentState = updateViewport(currentState, { zoom: 1 });
        void emitClientTelemetry("zoom_level_changed", {
          room_id: currentState.roomId,
          zoom: 1
        });
        render();
      },
      getViewport: () => currentState.viewport,
      onPlaceTile: async () => {
        await handleTilePlacement();
      }
    });

    if (renderOutcome.visibleBondCount > 0) {
      void emitClientTelemetry("bond_effect_rendered", {
        room_id: currentState.roomId,
        visible_bond_count: renderOutcome.visibleBondCount,
        visible_tile_count: renderOutcome.visibleTileCount,
        culled_tile_count: renderOutcome.culledTileCount,
        zoom: currentState.viewport.zoom,
        reduced_motion: currentState.accessibility.reducedMotionEnabled
      });
    }
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

    const targetCellX = currentState.selectedCellX;
    const targetCellY = currentState.selectedCellY;
    if (isCellOccupied(currentState, targetCellX, targetCellY)) {
      currentState = withAppState(currentState, {
        placeFeedback: `Cell (${targetCellX},${targetCellY}) is occupied.`
      });
      render();
      return;
    }

    const commandId = createCommandId();
    const checksumSeed = [
      {
        regionId: env.roomId,
        cellX: targetCellX,
        cellY: targetCellY,
        offsetX: 0,
        offsetY: 0,
        shape: currentState.palette.shape,
        color: currentState.palette.color,
        stylePayload: { source: "browser-loop" },
        ownerId: "self"
      }
    ];
    const commandChecksum = await createBrowserChecksum(checksumSeed);

    currentState = addOptimisticTile(currentState, {
      cellX: targetCellX,
      cellY: targetCellY,
      shape: currentState.palette.shape,
      color: currentState.palette.color
    });
    currentState = recomputeBonds(currentState);
    currentState = withAppState(currentState, {
      placeFeedback: `Placing ${currentState.palette.shape} tile at (${targetCellX},${targetCellY})...`
    });
    render();

    const response = await placeTile(
      env,
      {
        accessToken: tokenState.accessToken
      },
      {
        commandId,
        regionId: env.roomId,
        cellX: targetCellX,
        cellY: targetCellY,
        offsetX: 0,
        offsetY: 0,
        shape: currentState.palette.shape,
        color: currentState.palette.color,
        stylePayload: {
          source: "browser-loop",
          checksum: commandChecksum
        }
      }
    );

    if (response.result.ok) {
      const placementCompletedAtMs = Date.now();
      if (!currentState.firstTilePlacedAtMs) {
        currentState = withAppState(currentState, {
          firstTilePlacedAtMs: placementCompletedAtMs
        });
        void emitClientTelemetry("first_tile_time_recorded", {
          room_id: currentState.roomId,
          elapsed_ms: placementCompletedAtMs - currentState.onboarding.startedAtMs
        });
      }

      if (!currentState.onboarding.completed) {
        currentState = setOnboardingState(currentState, {
          completed: true,
          skipped: false,
          completedAtMs: placementCompletedAtMs,
          activeStep: 3
        });
        void emitClientTelemetry("tutorial_completed", {
          room_id: currentState.roomId,
          skipped: false,
          elapsed_ms: placementCompletedAtMs - currentState.onboarding.startedAtMs
        });
      }

      currentState = withAppState(currentState, {
        placeFeedback: `Placed tile ${response.result.tileId} (status ${response.status}).`
      });
      render();
      return;
    }

    if (response.result.reason === "occupied") {
      currentState = clearOptimisticTile(currentState, targetCellX, targetCellY);
      currentState = recomputeBonds(currentState);
      currentState = withAppState(currentState, {
        placeFeedback: `Conflict at (${response.result.cell.cellX},${response.result.cell.cellY}); winner ${response.result.winner.ownerId}.`
      });
      render();
      return;
    }

    if (response.result.reason === "throttled") {
      currentState = clearOptimisticTile(currentState, targetCellX, targetCellY);
      currentState = recomputeBonds(currentState);
      currentState = withAppState(currentState, {
        placeFeedback: `Rate limited. Retry after ${response.result.retryAfterMs}ms.`
      });
      render();
      return;
    }

    currentState = clearOptimisticTile(currentState, targetCellX, targetCellY);
    currentState = recomputeBonds(currentState);
    currentState = withAppState(currentState, {
      placeFeedback: `Placement rejected: ${response.result.reason}.`
    });
    render();
  }
}

function clampZoom(value: number): number {
  return Math.min(2, Math.max(0.5, Number(value.toFixed(2))));
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
