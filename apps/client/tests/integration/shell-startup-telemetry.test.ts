import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellStartupOrchestrator } from "../../src/shell/shell-startup.js";
import type { AcquireTokenResult } from "../../src/auth/external-id-session.js";
import { BootstrapStoreError, type BootstrapPayload } from "../../src/session/bootstrap-store.js";
import type { ShellTelemetryEvent } from "../../src/shell/shell-telemetry.js";

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shell startup telemetry integration", () => {
  it("emits session_started once for repeated successful starts", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "token-1"
    }));
    const bootstrap = vi.fn(async (): Promise<BootstrapPayload> => makeBootstrapPayload());
    const events: ShellTelemetryEvent[] = [];

    const orchestrator = new ShellStartupOrchestrator({
      authSession: { acquireTokenReadyState },
      bootstrapStore: { bootstrap },
      telemetrySink: {
        emit(event) {
          events.push(event);
        }
      }
    });

    const first = await orchestrator.start();
    const second = await orchestrator.start();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(events.filter((event) => event.name === "session_started")).toHaveLength(1);
    expect(events.filter((event) => event.name === "session_bootstrap_failed")).toHaveLength(0);
  });

  it("emits session_bootstrap_failed on terminal bootstrap failure", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "token-1"
    }));
    const bootstrap = vi.fn(async () => {
      throw new BootstrapStoreError("denied", "Session bootstrap denied with status 410", 410, "not-available");
    });
    const events: ShellTelemetryEvent[] = [];

    const orchestrator = new ShellStartupOrchestrator({
      authSession: { acquireTokenReadyState },
      bootstrapStore: { bootstrap },
      telemetrySink: {
        emit(event) {
          events.push(event);
        }
      }
    });

    const result = await orchestrator.start();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.failureClass).toBe("bootstrap-denied");
    expect(result.denialCode).toBe("bootstrap-not-available");
    expect(events.filter((event) => event.name === "session_started")).toHaveLength(0);

    const failureEvents = events.filter((event) => event.name === "session_bootstrap_failed");
    expect(failureEvents).toHaveLength(1);
    expect(failureEvents[0].payload).toMatchObject({
      terminalstate: "startup-failed",
      failureclass: "bootstrap-denied",
      denialcode: "bootstrap-not-available"
    });
  });
});