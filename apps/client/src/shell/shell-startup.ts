import type {
  AcquireTokenResult,
  ExternalIdSessionStateMachine
} from "../auth/external-id-session.js";
import {
  BootstrapStoreError,
  type BootstrapPayload
} from "../session/bootstrap-store.js";
import {
  createInitialShellStartupRuntime,
  transitionShellStartupRuntime,
  type ShellBootstrapDenialCode,
  type ShellStartupResult,
  type ShellStartupRuntime
} from "./shell-startup-state.js";
import { ShellTelemetryAdapter, type ShellTelemetrySink } from "./shell-telemetry.js";

type StartupAuthFailedResult = {
  failureClass: "interaction-required" | "token-unavailable";
  terminalState: "interaction-required" | "startup-failed";
  errorMessage?: string;
  denialCode?: ShellBootstrapDenialCode;
};

type StartupBootstrapFailedResult = {
  failureClass: "interaction-required" | "bootstrap-denied" | "bootstrap-unavailable";
  terminalState: "interaction-required" | "startup-failed";
  errorMessage?: string;
  denialCode?: ShellBootstrapDenialCode;
};

export type ShellStartupDependencies<TBootstrapPayload extends BootstrapPayload = BootstrapPayload> = {
  authSession: Pick<ExternalIdSessionStateMachine, "acquireTokenReadyState">;
  bootstrapStore: { bootstrap: () => Promise<TBootstrapPayload> };
  telemetrySink?: ShellTelemetrySink;
};

export class ShellStartupOrchestrator<TBootstrapPayload extends BootstrapPayload = BootstrapPayload> {
  private runtime: ShellStartupRuntime = createInitialShellStartupRuntime();
  private readonly telemetry?: ShellTelemetryAdapter;

  constructor(private readonly dependencies: ShellStartupDependencies<TBootstrapPayload>) {
    if (dependencies.telemetrySink) {
      this.telemetry = new ShellTelemetryAdapter(dependencies.telemetrySink);
    }
  }

  getRuntime(): ShellStartupRuntime {
    return this.runtime;
  }

  reset(): ShellStartupRuntime {
    this.runtime = transitionShellStartupRuntime(this.runtime, "reset");
    this.telemetry?.resetSessionStartedEmission();
    return this.runtime;
  }

  async start(): Promise<ShellStartupResult<TBootstrapPayload>> {
    if (this.runtime.state !== "idle") {
      this.runtime = transitionShellStartupRuntime(this.runtime, "reset");
    }

    const authState = await this.dependencies.authSession.acquireTokenReadyState();
    const authFailure = mapAuthFailure(authState);

    if (authFailure) {
      this.runtime = transitionShellStartupRuntime(
        this.runtime,
        authFailure.terminalState === "interaction-required"
          ? "auth-interaction-required"
          : "auth-failed"
      );

      this.telemetry?.emitSessionBootstrapFailed({
        runtime: this.runtime,
        terminalState: authFailure.terminalState,
        failureClass: authFailure.failureClass,
        ...(authFailure.denialCode ? { denialCode: authFailure.denialCode } : {})
      });

      return {
        ok: false,
        terminalState: authFailure.terminalState,
        failureClass: authFailure.failureClass,
        ...(authFailure.denialCode ? { denialCode: authFailure.denialCode } : {}),
        runtime: this.runtime,
        ...(authFailure.errorMessage ? { errorMessage: authFailure.errorMessage } : {})
      };
    }

    this.runtime = transitionShellStartupRuntime(this.runtime, "auth-ready");
    this.runtime = transitionShellStartupRuntime(this.runtime, "bootstrap-started");

    try {
      const bootstrap = await this.dependencies.bootstrapStore.bootstrap();
      this.runtime = transitionShellStartupRuntime(this.runtime, "bootstrap-succeeded");
      this.telemetry?.emitSessionStarted({ runtime: this.runtime });

      return {
        ok: true,
        terminalState: "startup-succeeded",
        runtime: this.runtime,
        bootstrap
      };
    } catch (error) {
      const bootstrapFailure = mapBootstrapFailure(error);

      this.runtime = transitionShellStartupRuntime(
        this.runtime,
        bootstrapFailure.terminalState === "interaction-required"
          ? "auth-interaction-required"
          : "bootstrap-failed"
      );

      this.telemetry?.emitSessionBootstrapFailed({
        runtime: this.runtime,
        terminalState: bootstrapFailure.terminalState,
        failureClass: bootstrapFailure.failureClass,
        ...(bootstrapFailure.denialCode ? { denialCode: bootstrapFailure.denialCode } : {})
      });

      return {
        ok: false,
        terminalState: bootstrapFailure.terminalState,
        failureClass: bootstrapFailure.failureClass,
        ...(bootstrapFailure.denialCode ? { denialCode: bootstrapFailure.denialCode } : {}),
        runtime: this.runtime,
        ...(bootstrapFailure.errorMessage ? { errorMessage: bootstrapFailure.errorMessage } : {})
      };
    }
  }
}

export async function startShellSession<TBootstrapPayload extends BootstrapPayload = BootstrapPayload>(
  dependencies: ShellStartupDependencies<TBootstrapPayload>
): Promise<ShellStartupResult<TBootstrapPayload>> {
  const orchestrator = new ShellStartupOrchestrator(dependencies);
  return await orchestrator.start();
}

function mapAuthFailure(result: AcquireTokenResult): StartupAuthFailedResult | null {
  if (result.state === "token-ready") {
    return null;
  }

  if (result.state === "interaction-required") {
    return {
      failureClass: "interaction-required",
      terminalState: "interaction-required",
      errorMessage: "Interactive authentication required"
    };
  }

  return {
    failureClass: "token-unavailable",
    terminalState: "startup-failed",
    errorMessage: `Token acquisition failed: ${result.reasonClass ?? "unknown"}`
  };
}

function mapBootstrapFailure(error: unknown): StartupBootstrapFailedResult {
  if (error instanceof BootstrapStoreError) {
    if (error.errorClass === "interaction-required") {
      return {
        terminalState: "interaction-required",
        failureClass: "interaction-required",
        errorMessage: error.message
      };
    }

    if (error.errorClass === "denied") {
      return {
        terminalState: "startup-failed",
        failureClass: "bootstrap-denied",
        denialCode: mapDenialCode(error.denialCode),
        errorMessage: error.message
      };
    }

    return {
      terminalState: "startup-failed",
      failureClass: "bootstrap-unavailable",
      errorMessage: error.message
    };
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.toLowerCase().includes("interactive authentication required")) {
    return {
      terminalState: "interaction-required",
      failureClass: "interaction-required",
      errorMessage
    };
  }

  return {
    terminalState: "startup-failed",
    failureClass: "bootstrap-unavailable",
    errorMessage
  };
}

function mapDenialCode(denialCode: BootstrapStoreError["denialCode"]): ShellBootstrapDenialCode {
  switch (denialCode) {
    case "auth-invalid":
      return "bootstrap-auth-invalid";
    case "access-denied":
      return "bootstrap-access-denied";
    case "not-available":
      return "bootstrap-not-available";
    default:
      return "bootstrap-access-denied";
  }
}
