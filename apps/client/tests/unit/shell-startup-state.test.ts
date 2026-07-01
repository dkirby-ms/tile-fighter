import { describe, expect, it, vi } from "vitest";
import type { AcquireTokenResult } from "../../src/auth/external-id-session.js";
import type { BootstrapPayload } from "../../src/session/bootstrap-store.js";
import {
  createInitialShellStartupRuntime,
  transitionShellStartupRuntime
} from "../../src/shell/shell-startup-state.js";
import {
  ShellStartupOrchestrator,
  startShellSession
} from "../../src/shell/shell-startup.js";

describe("shell-startup-state transitions", () => {
  it("transitions through auth-ready to bootstrap-in-flight and startup-succeeded", () => {
    const initial = createInitialShellStartupRuntime();
    const authReady = transitionShellStartupRuntime(initial, "auth-ready");
    const bootstrapInFlight = transitionShellStartupRuntime(authReady, "bootstrap-started");
    const succeeded = transitionShellStartupRuntime(bootstrapInFlight, "bootstrap-succeeded");

    expect(initial.state).toBe("idle");
    expect(bootstrapInFlight.state).toBe("bootstrap-in-flight");
    expect(succeeded.state).toBe("startup-succeeded");
    expect(succeeded.stateHistory).toEqual([
      "idle",
      "auth-ready",
      "bootstrap-in-flight",
      "startup-succeeded"
    ]);
  });

  it("supports reset from terminal states", () => {
    const failed = transitionShellStartupRuntime(
      transitionShellStartupRuntime(createInitialShellStartupRuntime(), "auth-failed"),
      "reset"
    );

    expect(failed.state).toBe("idle");
    expect(failed.stateHistory).toEqual(["idle", "startup-failed", "idle"]);
  });

  it("throws for invalid transitions", () => {
    expect(() =>
      transitionShellStartupRuntime(createInitialShellStartupRuntime(), "bootstrap-started")
    ).toThrow("Invalid shell startup transition");
  });
});

describe("ShellStartupOrchestrator", () => {
  function makeBootstrapPayload(): BootstrapPayload {
    return {
      subject: "user-1",
      tenantScopedSubject: "tenant-user-1",
      tenantId: "tenant-1",
      issuer: "https://issuer.example.com",
      serverTime: new Date().toISOString(),
      shellInit: {
        bootstrapState: "token-ready",
        retryPolicy: {
          maxBootstrap401Retry: 1,
          interactiveAuthRequiredAfterRetry: true
        }
      }
    };
  }

  it("returns startup success with deterministic runtime history", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "token-1"
    }));
    const bootstrap = vi.fn(async (): Promise<BootstrapPayload> => makeBootstrapPayload());

    const orchestrator = new ShellStartupOrchestrator({
      authSession: { acquireTokenReadyState },
      bootstrapStore: { bootstrap }
    });

    const result = await orchestrator.start();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.terminalState).toBe("startup-succeeded");
    expect(result.runtime.state).toBe("startup-succeeded");
    expect(result.runtime.stateHistory).toEqual([
      "idle",
      "auth-ready",
      "bootstrap-in-flight",
      "startup-succeeded"
    ]);
    expect(bootstrap).toHaveBeenCalledOnce();
  });

  it("returns interaction-required terminal outcome when auth needs interaction", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "interaction-required",
      reasonClass: "interaction-required"
    }));
    const bootstrap = vi.fn();

    const result = await startShellSession({
      authSession: { acquireTokenReadyState },
      bootstrapStore: { bootstrap }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.terminalState).toBe("interaction-required");
    expect(result.failureClass).toBe("interaction-required");
    expect(result.runtime.stateHistory).toEqual(["idle", "interaction-required"]);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it("returns startup-failed outcome when bootstrap throws non-interaction error", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "token-1"
    }));
    const bootstrap = vi.fn(async () => {
      throw new Error("Session bootstrap failed with status 503");
    });

    const orchestrator = new ShellStartupOrchestrator({
      authSession: { acquireTokenReadyState },
      bootstrapStore: { bootstrap }
    });

    const result = await orchestrator.start();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.terminalState).toBe("startup-failed");
    expect(result.failureClass).toBe("bootstrap-unavailable");
    expect(result.runtime.stateHistory).toEqual([
      "idle",
      "auth-ready",
      "bootstrap-in-flight",
      "startup-failed"
    ]);
  });

  it("returns interaction-required when bootstrap throws interactive auth error", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "token-1"
    }));
    const bootstrap = vi.fn(async () => {
      throw new Error("Interactive authentication required after bootstrap unauthorized");
    });

    const orchestrator = new ShellStartupOrchestrator({
      authSession: { acquireTokenReadyState },
      bootstrapStore: { bootstrap }
    });

    const result = await orchestrator.start();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.terminalState).toBe("interaction-required");
    expect(result.failureClass).toBe("interaction-required");
    expect(result.runtime.stateHistory).toEqual([
      "idle",
      "auth-ready",
      "bootstrap-in-flight",
      "interaction-required"
    ]);
  });
});
