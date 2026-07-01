import type {
  ShellBootstrapDenialCode,
  ShellStartupFailureClass,
  ShellStartupRuntime,
  ShellStartupState
} from "./shell-startup-state.js";

export type ShellTelemetryEventName = "session_started" | "session_bootstrap_failed";

export type ShellTelemetryPayload = Record<string, string | number | boolean | null>;

export interface ShellTelemetryEvent {
  name: ShellTelemetryEventName;
  atMs: number;
  payload: ShellTelemetryPayload;
}

export interface ShellTelemetrySink {
  emit(event: ShellTelemetryEvent): void;
}

export interface ShellTelemetryOptions {
  now?: () => number;
}

export interface ShellStartupSuccessTelemetryInput {
  runtime: ShellStartupRuntime;
}

export interface ShellStartupFailureTelemetryInput {
  runtime: ShellStartupRuntime;
  terminalState: Exclude<ShellStartupState, "idle" | "auth-ready" | "bootstrap-in-flight" | "startup-succeeded">;
  failureClass: ShellStartupFailureClass;
  denialCode?: ShellBootstrapDenialCode;
}

export class ShellTelemetryAdapter {
  private readonly now: () => number;
  private hasEmittedSessionStarted = false;

  constructor(
    private readonly sink: ShellTelemetrySink,
    options: ShellTelemetryOptions = {}
  ) {
    this.now = options.now ?? Date.now;
  }

  resetSessionStartedEmission(): void {
    this.hasEmittedSessionStarted = false;
  }

  emitSessionStarted(input: ShellStartupSuccessTelemetryInput): boolean {
    if (this.hasEmittedSessionStarted) {
      return false;
    }

    this.hasEmittedSessionStarted = true;

    this.emit("session_started", {
      terminalState: input.runtime.state,
      historyLength: input.runtime.stateHistory.length
    });

    return true;
  }

  emitSessionBootstrapFailed(input: ShellStartupFailureTelemetryInput): void {
    this.emit("session_bootstrap_failed", {
      terminalState: input.terminalState,
      failureClass: input.failureClass,
      denialCode: input.denialCode ?? null,
      historyLength: input.runtime.stateHistory.length
    });
  }

  private emit(name: ShellTelemetryEventName, payload: ShellTelemetryPayload): void {
    this.sink.emit({
      name,
      atMs: this.now(),
      payload: sanitizePayload(payload)
    });
  }
}

function sanitizePayload(payload: ShellTelemetryPayload): ShellTelemetryPayload {
  const entries = Object.entries(payload).slice(0, 8);
  const next: ShellTelemetryPayload = {};

  for (const [rawKey, value] of entries) {
    const key = sanitizeKey(rawKey);

    if (typeof value === "string") {
      next[key] = sanitizeText(value);
      continue;
    }

    if (typeof value === "number") {
      next[key] = Number.isFinite(value) ? Math.floor(value) : null;
      continue;
    }

    next[key] = value;
  }

  return next;
}

function sanitizeKey(value: string): string {
  return sanitizeText(value).replace(/[^a-z0-9_-]/g, "_");
}

function sanitizeText(value: string): string {
  return value.trim().toLowerCase().slice(0, 48);
}
