export type ShellStartupState =
  | "idle"
  | "auth-ready"
  | "bootstrap-in-flight"
  | "startup-succeeded"
  | "startup-failed"
  | "interaction-required";

export type ShellStartupTransitionEvent =
  | "auth-ready"
  | "auth-failed"
  | "auth-interaction-required"
  | "bootstrap-started"
  | "bootstrap-succeeded"
  | "bootstrap-failed"
  | "reset";

export type ShellStartupFailureClass =
  | "interaction-required"
  | "token-unavailable"
  | "bootstrap-denied"
  | "bootstrap-unavailable";

export type ShellBootstrapDenialCode =
  | "bootstrap-auth-invalid"
  | "bootstrap-access-denied"
  | "bootstrap-not-available";

export type ShellStartupRuntime = {
  state: ShellStartupState;
  stateHistory: readonly ShellStartupState[];
};

export type ShellStartupSucceededResult<TBootstrapPayload> = {
  ok: true;
  terminalState: "startup-succeeded";
  runtime: ShellStartupRuntime;
  bootstrap: TBootstrapPayload;
};

export type ShellStartupFailedResult = {
  ok: false;
  terminalState: "interaction-required" | "startup-failed";
  failureClass: ShellStartupFailureClass;
  denialCode?: ShellBootstrapDenialCode;
  runtime: ShellStartupRuntime;
  errorMessage?: string;
};

export type ShellStartupResult<TBootstrapPayload> =
  | ShellStartupSucceededResult<TBootstrapPayload>
  | ShellStartupFailedResult;

export function createInitialShellStartupRuntime(): ShellStartupRuntime {
  return {
    state: "idle",
    stateHistory: ["idle"]
  };
}

export function transitionShellStartupRuntime(
  runtime: ShellStartupRuntime,
  event: ShellStartupTransitionEvent
): ShellStartupRuntime {
  const nextState = transitionShellStartupState(runtime.state, event);
  if (nextState === runtime.state) {
    return runtime;
  }

  return {
    state: nextState,
    stateHistory: [...runtime.stateHistory, nextState]
  };
}

function transitionShellStartupState(
  currentState: ShellStartupState,
  event: ShellStartupTransitionEvent
): ShellStartupState {
  if (event === "reset") {
    return "idle";
  }

  switch (currentState) {
    case "idle": {
      if (event === "auth-ready") {
        return "auth-ready";
      }

      if (event === "auth-failed") {
        return "startup-failed";
      }

      if (event === "auth-interaction-required") {
        return "interaction-required";
      }

      break;
    }
    case "auth-ready": {
      if (event === "bootstrap-started") {
        return "bootstrap-in-flight";
      }

      break;
    }
    case "bootstrap-in-flight": {
      if (event === "bootstrap-succeeded") {
        return "startup-succeeded";
      }

      if (event === "bootstrap-failed") {
        return "startup-failed";
      }

      if (event === "auth-interaction-required") {
        return "interaction-required";
      }

      break;
    }
    case "startup-succeeded":
    case "startup-failed":
    case "interaction-required": {
      break;
    }
    default: {
      break;
    }
  }

  throw new Error(`Invalid shell startup transition: ${currentState} -> ${event}`);
}
