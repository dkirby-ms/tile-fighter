import { describe, expect, it, vi } from "vitest";
import { sendHeartbeat } from "../../src/session/heartbeat-caller.js";
import type { ExternalIdSessionStateMachine } from "../../src/auth/external-id-session.js";
import type { AcquireTokenResult } from "../../src/auth/external-id-session.js";

const ENDPOINT = "https://api.example.com/api/session/heartbeat";
const ROOM_ID = "arena-1";

function makeMockAuth(overrides: Partial<ExternalIdSessionStateMachine> = {}): ExternalIdSessionStateMachine {
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

describe("sendHeartbeat", () => {
  it("attaches bearer token to Authorization header", async () => {
    const auth = makeMockAuth();
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ accepted: true, roomId: ROOM_ID }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchSpy);

    await sendHeartbeat(auth, ENDPOINT, ROOM_ID);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer access-token-abc");

    vi.unstubAllGlobals();
  });

  it("returns the heartbeat response on success", async () => {
    const auth = makeMockAuth();
    const expected = { accepted: true, roomId: ROOM_ID };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(expected), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await sendHeartbeat(auth, ENDPOINT, ROOM_ID);

    expect(result).toEqual(expected);
    vi.unstubAllGlobals();
  });

  it("retries silently on 401 and succeeds", async () => {
    const auth = makeMockAuth();
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(null, { status: 401 });
      }
      return new Response(JSON.stringify({ accepted: true, roomId: ROOM_ID }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const result = await sendHeartbeat(auth, ENDPOINT, ROOM_ID);

    expect(result.accepted).toBe(true);
    expect(auth.handleBootstrapUnauthorizedReacquire).toHaveBeenCalledOnce();
    const [, retryInit] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[1] as [string, RequestInit];
    expect((retryInit.headers as Record<string, string>)["Authorization"]).toBe("Bearer refreshed-token-abc");

    vi.unstubAllGlobals();
  });

  it("triggers interactive auth when retry token state is not token-ready", async () => {
    const auth = makeMockAuth({
      handleBootstrapUnauthorizedReacquire: vi.fn(async (): Promise<AcquireTokenResult> => ({
        state: "interaction-required",
        reasonClass: "unauthorized"
      }))
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    await expect(sendHeartbeat(auth, ENDPOINT, ROOM_ID)).rejects.toThrow("Interactive authentication required after heartbeat unauthorized");
    expect(auth.beginInteractiveAuth).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it("throws when retry response is not ok", async () => {
    const auth = makeMockAuth();
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      callCount += 1;
      return new Response(null, { status: callCount === 1 ? 401 : 503 });
    }));

    await expect(sendHeartbeat(auth, ENDPOINT, ROOM_ID)).rejects.toThrow("Heartbeat request failed after retry with status 503");
    vi.unstubAllGlobals();
  });

  it("throws on 403 Forbidden without retry", async () => {
    const auth = makeMockAuth();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));

    await expect(sendHeartbeat(auth, ENDPOINT, ROOM_ID)).rejects.toThrow("Heartbeat request failed with status 403");
    expect(auth.handleBootstrapUnauthorizedReacquire).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("throws on 503 without retry", async () => {
    const auth = makeMockAuth();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));

    await expect(sendHeartbeat(auth, ENDPOINT, ROOM_ID)).rejects.toThrow("Heartbeat request failed with status 503");
    vi.unstubAllGlobals();
  });

  it("triggers interactive auth when token acquisition requires interaction", async () => {
    const auth = makeMockAuth({
      acquireTokenReadyState: vi.fn(async (): Promise<AcquireTokenResult> => ({
        state: "interaction-required",
        reasonClass: "interaction-required"
      }))
    });
    vi.stubGlobal("fetch", vi.fn());

    await expect(sendHeartbeat(auth, ENDPOINT, ROOM_ID)).rejects.toThrow("Interactive authentication required");
    expect(auth.beginInteractiveAuth).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("throws when token state is not token-ready on initial acquire", async () => {
    const auth = makeMockAuth({
      acquireTokenReadyState: vi.fn(async (): Promise<AcquireTokenResult> => ({
        state: "bootstrap-failed",
        reasonClass: "transient-idp"
      }))
    });
    vi.stubGlobal("fetch", vi.fn());

    await expect(sendHeartbeat(auth, ENDPOINT, ROOM_ID)).rejects.toThrow("Token acquisition failed: transient-idp");
    vi.unstubAllGlobals();
  });
});
