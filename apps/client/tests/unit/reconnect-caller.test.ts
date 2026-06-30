import { describe, expect, it, vi } from "vitest";
import {
  reconnectSession,
  ReconnectCallerError
} from "../../src/session/reconnect-caller.js";
import type { ExternalIdSessionStateMachine } from "../../src/auth/external-id-session.js";
import type { AcquireTokenResult } from "../../src/auth/external-id-session.js";

const ENDPOINT = "https://api.example.com/api/session/reconnect";
const ROOM_ID = "arena-1";
const RECONNECT_TOKEN = "reconnect-token-abc";

function makeMockAuth(
  overrides: Partial<ExternalIdSessionStateMachine> = {}
): ExternalIdSessionStateMachine {
  return {
    acquireTokenReadyState: vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "access-token-abc"
    })),
    beginInteractiveAuth: vi.fn(async () => undefined),
    handleBootstrapUnauthorizedReacquire: vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "refreshed-token-abc"
    })),
    completeBootstrap: vi.fn(),
    getState: vi.fn(() => "token-ready" as const),
    triggerInteractiveRecovery: vi.fn(async () => undefined),
    ...overrides
  } as unknown as ExternalIdSessionStateMachine;
}

describe("reconnectSession", () => {
  it("returns reconnect payload on success", async () => {
    const auth = makeMockAuth();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            roomId: ROOM_ID,
            sessionId: "s-1",
            checkpointId: "c-1",
            replay: {
              sinceVersion: 5,
              currentVersion: 7,
              deltaCount: 2,
              deltas: []
            },
            checksum: {
              scope: "full_region_canonical",
              serverChecksum: "abc"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await reconnectSession(auth, ENDPOINT, ROOM_ID, RECONNECT_TOKEN);

    expect(result.ok).toBe(true);
    expect(result.roomId).toBe(ROOM_ID);
    vi.unstubAllGlobals();
  });

  it("classifies 410 as stale-session", async () => {
    const auth = makeMockAuth();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 410 })));

    await expect(reconnectSession(auth, ENDPOINT, ROOM_ID, RECONNECT_TOKEN)).rejects.toMatchObject(
      {
        failureClass: "stale-session"
      }
    );

    vi.unstubAllGlobals();
  });

  it("retries on 401 and succeeds", async () => {
    const auth = makeMockAuth();
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount += 1;
        if (callCount === 1) {
          return new Response(null, { status: 401 });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            roomId: ROOM_ID,
            sessionId: "s-2",
            checkpointId: "c-2",
            replay: {
              sinceVersion: 0,
              currentVersion: 0,
              deltaCount: 0,
              deltas: []
            },
            checksum: {
              scope: "full_region_canonical",
              serverChecksum: "hash"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const result = await reconnectSession(auth, ENDPOINT, ROOM_ID, RECONNECT_TOKEN);

    expect(result.sessionId).toBe("s-2");
    expect(auth.handleBootstrapUnauthorizedReacquire).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("throws reauth-required when retry token state is not token-ready", async () => {
    const auth = makeMockAuth({
      handleBootstrapUnauthorizedReacquire: vi.fn(async (): Promise<AcquireTokenResult> => ({
        state: "interaction-required",
        reasonClass: "unauthorized"
      }))
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    await expect(reconnectSession(auth, ENDPOINT, ROOM_ID, RECONNECT_TOKEN)).rejects.toMatchObject(
      {
        failureClass: "reauth-required"
      }
    );

    expect(auth.beginInteractiveAuth).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("throws for forbidden status", async () => {
    const auth = makeMockAuth();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));

    await expect(reconnectSession(auth, ENDPOINT, ROOM_ID, RECONNECT_TOKEN)).rejects.toMatchObject(
      {
        failureClass: "forbidden"
      }
    );

    vi.unstubAllGlobals();
  });

  it("throws interactive required when token acquisition requires interaction", async () => {
    const auth = makeMockAuth({
      acquireTokenReadyState: vi.fn(async (): Promise<AcquireTokenResult> => ({
        state: "interaction-required",
        reasonClass: "interaction-required"
      }))
    });

    vi.stubGlobal("fetch", vi.fn());

    await expect(reconnectSession(auth, ENDPOINT, ROOM_ID, RECONNECT_TOKEN)).rejects.toBeInstanceOf(
      ReconnectCallerError
    );
    expect(auth.beginInteractiveAuth).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
