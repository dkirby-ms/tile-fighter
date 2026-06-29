import { describe, expect, it, vi } from "vitest";
import { ExternalIdSessionStateMachine } from "../../src/auth/external-id-session.js";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import type { PublicClientApplication } from "@azure/msal-browser";
import type { ExternalIdClientConfig } from "../../src/auth/msal-config.js";

const CLIENT_CONFIG: ExternalIdClientConfig = {
  authority: "https://login.microsoftonline.com/tenant-a",
  clientId: "client-id-abc",
  redirectUri: "http://localhost:3000",
  knownAuthorities: ["login.microsoftonline.com"],
  apiScope: "api://tile-fighter-server/.default"
};

function makeMockApp(overrides: Partial<PublicClientApplication> = {}): PublicClientApplication {
  return {
    getActiveAccount: vi.fn(() => ({ homeAccountId: "user-1", environment: "login.microsoftonline.com", tenantId: "tenant-a", username: "user@example.com", localAccountId: "local-1" })),
    getAllAccounts: vi.fn(() => []),
    acquireTokenSilent: vi.fn(async () => ({ accessToken: "access-token-abc" })),
    acquireTokenRedirect: vi.fn(async () => undefined),
    setActiveAccount: vi.fn(),
    ...overrides
  } as unknown as PublicClientApplication;
}

describe("ExternalIdSessionStateMachine state transitions", () => {
  it("starts in signed-out state", () => {
    const app = makeMockApp({ getActiveAccount: vi.fn(() => null), getAllAccounts: vi.fn(() => []) });
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);
    expect(sm.getState()).toBe("signed-out");
  });

  it("transitions: signed-out → bootstrap-in-flight → token-ready on silent success", async () => {
    const app = makeMockApp();
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    expect(sm.getState()).toBe("signed-out");

    const statesDuringAcquire: string[] = [];
    const originalAcquire = (app as PublicClientApplication & { acquireTokenSilent: ReturnType<typeof vi.fn> }).acquireTokenSilent;
    vi.mocked(app.acquireTokenSilent).mockImplementationOnce(async (req) => {
      statesDuringAcquire.push(sm.getState());
      return originalAcquire(req);
    });

    const result = await sm.acquireTokenReadyState();

    expect(statesDuringAcquire).toContain("bootstrap-in-flight");
    expect(result.state).toBe("token-ready");
    expect(result.accessToken).toBe("access-token-abc");
    expect(sm.getState()).toBe("token-ready");
  });

  it("transitions: bootstrap-in-flight → interaction-required on InteractionRequiredAuthError", async () => {
    const app = makeMockApp({
      acquireTokenSilent: vi.fn(async () => {
        throw new InteractionRequiredAuthError("interaction_required");
      })
    });
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    const result = await sm.acquireTokenReadyState();

    expect(result.state).toBe("interaction-required");
    expect(result.reasonClass).toBe("interaction-required");
    expect(sm.getState()).toBe("interaction-required");
  });

  it("transitions: bootstrap-in-flight → bootstrap-failed on transient error", async () => {
    const app = makeMockApp({
      acquireTokenSilent: vi.fn(async () => {
        throw new Error("transient IDP error");
      })
    });
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    const result = await sm.acquireTokenReadyState();

    expect(result.state).toBe("bootstrap-failed");
    expect(result.reasonClass).toBe("transient-idp");
    expect(sm.getState()).toBe("bootstrap-failed");
  });

  it("transitions: interaction-required when no account is found", async () => {
    const app = makeMockApp({
      getActiveAccount: vi.fn(() => null),
      getAllAccounts: vi.fn(() => [])
    });
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    const result = await sm.acquireTokenReadyState();

    expect(result.state).toBe("interaction-required");
    expect(sm.getState()).toBe("interaction-required");
  });

  it("bootstrap-failed → interaction-required recovery via triggerInteractiveRecovery", async () => {
    const app = makeMockApp({
      acquireTokenSilent: vi.fn(async () => {
        throw new Error("transient error");
      })
    });
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    await sm.acquireTokenReadyState();
    expect(sm.getState()).toBe("bootstrap-failed");

    await sm.triggerInteractiveRecovery();

    expect(app.acquireTokenRedirect).toHaveBeenCalledOnce();
  });

  it("completeBootstrap resets unauthorized retry count and sets token-ready state", () => {
    const account = { homeAccountId: "user-1", environment: "login.microsoftonline.com", tenantId: "tenant-a", username: "user@example.com", localAccountId: "local-1" };
    const app = makeMockApp();
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    sm.completeBootstrap({ account } as never);

    expect(sm.getState()).toBe("token-ready");
    expect(app.setActiveAccount).toHaveBeenCalledWith(account);
  });

  it("handleBootstrapUnauthorizedReacquire reacquires token and returns token-ready", async () => {
    const app = makeMockApp();
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    const result = await sm.handleBootstrapUnauthorizedReacquire();

    expect(result.state).toBe("token-ready");
    expect(result.accessToken).toBe("access-token-abc");
  });

  it("handleBootstrapUnauthorizedReacquire returns interaction-required after max retries", async () => {
    const app = makeMockApp();
    const sm = new ExternalIdSessionStateMachine(app, CLIENT_CONFIG);

    await sm.handleBootstrapUnauthorizedReacquire();
    const result = await sm.handleBootstrapUnauthorizedReacquire();

    expect(result.state).toBe("interaction-required");
    expect(result.reasonClass).toBe("unauthorized");
  });
});
