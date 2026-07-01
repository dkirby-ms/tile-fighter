import type { TilePlaceResult } from "@game/shared-types";
import {
  sanitizePlacementSubmitInput,
  type PlacementInputOptions,
  type PlacementSubmitInput
} from "./placement-input.js";

export type PlacementCallerFailureClass = "terminal" | "retryable";

export interface PlacementCallerFailure {
  class: PlacementCallerFailureClass;
  code:
    | "invalid_input"
    | "occupied"
    | "command_payload_mismatch"
    | "throttled"
    | "unauthorized"
    | "forbidden"
    | "request_failed"
    | "network_error";
  status?: number;
  message: string;
  retryAfterMs?: number;
  issues?: readonly { code: string; detail: string }[];
}

export type PlacementSubmitResult =
  | {
      ok: true;
      commandId: string;
      status: 201;
      result: Extract<TilePlaceResult, { ok: true }>;
    }
  | {
      ok: false;
      commandId: string | null;
      failure: PlacementCallerFailure;
      response?: TilePlaceResult;
    };

export interface PlacementCallerDependencies {
  fetchImpl?: typeof fetch;
}

export interface PlacementCallerOptions {
  input?: PlacementInputOptions;
}

export async function placeTile(
  endpoint: string,
  input: PlacementSubmitInput,
  options: PlacementCallerOptions = {},
  dependencies: PlacementCallerDependencies = {}
): Promise<PlacementSubmitResult> {
  const sanitizeResult = sanitizePlacementSubmitInput(input, options.input);
  if (!sanitizeResult.ok) {
    return {
      ok: false,
      commandId: typeof input.commandId === "string" ? input.commandId.trim() || null : null,
      failure: {
        class: "terminal",
        code: "invalid_input",
        message: "Placement input validation failed",
        issues: sanitizeResult.issues
      }
    };
  }

  const command = sanitizeResult.command;
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
  } catch (error) {
    return {
      ok: false,
      commandId: command.commandId,
      failure: {
        class: "retryable",
        code: "network_error",
        message: error instanceof Error ? error.message : "Network request failed"
      }
    };
  }

  if (response.ok) {
    const body = (await response.json()) as TilePlaceResult;
    if (body.ok) {
      return {
        ok: true,
        commandId: command.commandId,
        status: response.status as 201,
        result: body
      };
    }

    // Defensive fallback if server returns success HTTP with failure body.
    return {
      ok: false,
      commandId: command.commandId,
      response: body,
      failure: {
        class: "terminal",
        code: "request_failed",
        status: response.status,
        message: "Unexpected placement response payload"
      }
    };
  }

  const parsedBody = await parseTilePlaceFailure(response);
  return mapFailure(response.status, command.commandId, parsedBody);
}

async function parseTilePlaceFailure(response: Response): Promise<TilePlaceResult | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    const parsed = (await response.json()) as unknown;
    if (isTilePlaceResult(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function mapFailure(
  status: number,
  commandId: string,
  response: TilePlaceResult | null
): PlacementSubmitResult {
  if (response && !response.ok) {
    if (response.reason === "occupied") {
      return {
        ok: false,
        commandId,
        response,
        failure: {
          class: "terminal",
          code: "occupied",
          status,
          message: "Placement target is already occupied"
        }
      };
    }

    if (response.reason === "command_payload_mismatch") {
      return {
        ok: false,
        commandId,
        response,
        failure: {
          class: "terminal",
          code: "command_payload_mismatch",
          status,
          message: "Placement command payload does not match prior command identity"
        }
      };
    }

    if (response.reason === "throttled") {
      return {
        ok: false,
        commandId,
        response,
        failure: {
          class: "retryable",
          code: "throttled",
          status,
          retryAfterMs: response.retryAfterMs,
          message: "Placement submission throttled"
        }
      };
    }
  }

  if (status === 401) {
    return {
      ok: false,
      commandId,
      failure: {
        class: "retryable",
        code: "unauthorized",
        status,
        message: "Unauthorized placement request"
      }
    };
  }

  if (status === 403) {
    return {
      ok: false,
      commandId,
      failure: {
        class: "terminal",
        code: "forbidden",
        status,
        message: "Forbidden placement request"
      }
    };
  }

  if (status >= 500) {
    return {
      ok: false,
      commandId,
      failure: {
        class: "retryable",
        code: "request_failed",
        status,
        message: "Placement request failed due to server error"
      }
    };
  }

  return {
    ok: false,
    commandId,
    failure: {
      class: "terminal",
      code: "request_failed",
      status,
      message: "Placement request failed"
    }
  };
}

function isTilePlaceResult(value: unknown): value is TilePlaceResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  const parsed = value as { ok: unknown; reason?: unknown };
  if (parsed.ok === true) {
    return true;
  }

  return (
    parsed.ok === false &&
    (parsed.reason === "occupied" ||
      parsed.reason === "command_payload_mismatch" ||
      parsed.reason === "throttled")
  );
}
