import { afterEach, describe, expect, it, vi } from "vitest";
import { startShellSession, type AcquireTokenResult } from "../../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("E1-S1 open-shell smoke", () => {
  it("starts shell session successfully and returns startup-succeeded terminal outcome", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "token-1"
    }));
    const bootstrap = vi.fn(async () => ({
      subject: "user-1",
      tenantScopedSubject: "tenant-user-1",
      tenantId: "tenant-1",
      issuer: "https://issuer.example.com",
      serverTime: new Date().toISOString(),
      shellInit: {
        bootstrapState: "token-ready" as const,
        retryPolicy: {
          maxBootstrap401Retry: 1 as const,
          interactiveAuthRequiredAfterRetry: true as const
        }
      }
    }));

    const result = await startShellSession({
      authSession: { acquireTokenReadyState },
      bootstrapStore: { bootstrap }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.terminalState).toBe("startup-succeeded");
    expect(result.runtime.stateHistory).toEqual([
      "idle",
      "auth-ready",
      "bootstrap-in-flight",
      "startup-succeeded"
    ]);
  });
});