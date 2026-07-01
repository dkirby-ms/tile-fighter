import { describe, expect, it, vi, afterEach } from "vitest";
import type { PublicClientApplication } from "@azure/msal-browser";
import { ExternalIdSessionStateMachine, SessionBootstrapStore, ShellStartupOrchestrator } from "../../src/index.js";
import type { AcquireTokenResult, ExternalIdClientConfig } from "../../src/index.js";

const CLIENT_CONFIG: ExternalIdClientConfig = {
  authority: "https://login.microsoftonline.com/tenant-a",
  clientId: "client-id-abc",
  redirectUri: "http://localhost:3000",
  knownAuthorities: ["login.microsoftonline.com"],
  apiScope: "api://tile-fighter-server/.default"
};

function makeMockApp(overrides: Partial<PublicClientApplication> = {}): PublicClientApplication {
  return {
    getActiveAccount: vi.fn(() => ({
      homeAccountId: "user-1",
      environment: "login.microsoftonline.com",
      tenantId: "tenant-a",
      username: "user@example.com",
      localAccountId: "local-1"
    })),
    getAllAccounts: vi.fn(() => []),
    acquireTokenSilent: vi.fn(async (): Promise<{ accessToken: string }> => ({ accessToken: "access-token-abc" })),
    acquireTokenRedirect: vi.fn(async () => undefined),
    setActiveAccount: vi.fn(),
    ...overrides
  } as unknown as PublicClientApplication;
}

function makeStoreWithFetch(fetchImpl: typeof fetch): SessionBootstrapStore {
  const app = makeMockApp();
  const auth = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);
  globalThis.fetch = fetchImpl;
  return new SessionBootstrapStore(auth, "https://api.example.com/session/bootstrap");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shell startup bootstrap integration", () => {
  it("runs auth-ready to bootstrap success with deterministic terminal state", async () => {
    const store = makeStoreWithFetch(async () =>
      new Response(
        JSON.stringify({
          subject: "user-1",
          tenantScopedSubject: "tenant-user-1",
          tenantId: "tenant-a",
          issuer: "https://issuer.example.com",
          serverTime: new Date().toISOString(),
          shellInit: {
            bootstrapState: "token-ready",
            retryPolicy: {
              maxBootstrap401Retry: 1,
              interactiveAuthRequiredAfterRetry: true
            }
          }
        }),
        { status: 200 }
      )
    );

    const authState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "access-token-abc"
    }));

    const orchestrator = new ShellStartupOrchestrator({
      authSession: { acquireTokenReadyState: authState },
      bootstrapStore: store
    });

    const result = await orchestrator.start();

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
    expect(result.bootstrap.subject).toBe("user-1");
  });

  it("maps denied bootstrap response to non-leaky startup denial category", async () => {
    const store = makeStoreWithFetch(async () =>
      new Response(JSON.stringify({ code: "forbidden" }), { status: 403 })
    );

    const authState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "access-token-abc"
    }));

    const orchestrator = new ShellStartupOrchestrator({
      authSession: { acquireTokenReadyState: authState },
      bootstrapStore: store
    });

    const result = await orchestrator.start();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.terminalState).toBe("startup-failed");
    expect(result.failureClass).toBe("bootstrap-denied");
    expect(result.denialCode).toBe("bootstrap-access-denied");
    expect(result.runtime.state).toBe("startup-failed");
  });
});