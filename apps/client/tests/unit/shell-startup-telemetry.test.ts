import { describe, expect, it, vi } from "vitest";
import type { AcquireTokenResult } from "../../src/auth/external-id-session.js";
import {
  BootstrapStoreError,
  type BootstrapPayload
} from "../../src/session/bootstrap-store.js";
import { ShellStartupOrchestrator } from "../../src/shell/shell-startup.js";
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

describe("Shell startup telemetry", () => {
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
  });

  it("emits session_started again after reset", async () => {
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

    await orchestrator.start();
    orchestrator.reset();
    await orchestrator.start();

    expect(events.filter((event) => event.name === "session_started")).toHaveLength(2);
  });

  it("maps denied bootstrap failures to non-leaky startup failure and telemetry", async () => {
    const acquireTokenReadyState = vi.fn(async (): Promise<AcquireTokenResult> => ({
      state: "token-ready",
      accessToken: "token-1"
    }));
    const bootstrap = vi.fn(async () => {
      throw new BootstrapStoreError("denied", "Session bootstrap denied with status 403", 403, "access-denied");
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

    expect(result.terminalState).toBe("startup-failed");
    expect(result.failureClass).toBe("bootstrap-denied");
    expect(result.denialCode).toBe("bootstrap-access-denied");

    const failedEvents = events.filter((event) => event.name === "session_bootstrap_failed");
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].payload).toMatchObject({
      terminalstate: "startup-failed",
      failureclass: "bootstrap-denied",
      denialcode: "bootstrap-access-denied"
    });
  });
});
