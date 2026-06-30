import { ExternalIdSessionStateMachine } from "../auth/external-id-session.js";

export type ReplayDelta = {
  cellX: number;
  cellY: number;
  version: number;
  operation: string;
  offsetX: number | null;
  offsetY: number | null;
  shape: string | null;
  color: string | null;
  stylePayload: unknown | null;
  ownerId: string | null;
};

export type ReconnectResponse = {
  ok: true;
  roomId: string;
  sessionId: string;
  checkpointId: string;
  replay: {
    sinceVersion: number;
    currentVersion: number;
    deltaCount: number;
    deltas: ReplayDelta[];
  };
  checksum: {
    scope: "full_region_canonical";
    serverChecksum: string;
  };
};

export type ReconnectFailureClass =
  | "reauth-required"
  | "stale-session"
  | "forbidden"
  | "rate-limited"
  | "request-failed";

export class ReconnectCallerError extends Error {
  constructor(
    readonly failureClass: ReconnectFailureClass,
    message: string
  ) {
    super(message);
    this.name = "ReconnectCallerError";
  }
}

export async function reconnectSession(
  authSession: ExternalIdSessionStateMachine,
  reconnectEndpoint: string,
  roomId: string,
  reconnectToken: string
): Promise<ReconnectResponse> {
  const tokenState = await authSession.acquireTokenReadyState();

  if (tokenState.state === "interaction-required") {
    await authSession.beginInteractiveAuth();
    throw new ReconnectCallerError("reauth-required", "Interactive authentication required");
  }

  if (tokenState.state !== "token-ready" || !tokenState.accessToken) {
    throw new ReconnectCallerError(
      "reauth-required",
      `Token acquisition failed: ${tokenState.reasonClass ?? "unknown"}`
    );
  }

  const response = await fetch(reconnectEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenState.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ roomId, reconnectToken })
  });

  if (response.status === 401) {
    const retryTokenState = await authSession.handleBootstrapUnauthorizedReacquire();

    if (retryTokenState.state !== "token-ready" || !retryTokenState.accessToken) {
      await authSession.beginInteractiveAuth();
      throw new ReconnectCallerError(
        "reauth-required",
        "Interactive authentication required after reconnect unauthorized"
      );
    }

    const retryResponse = await fetch(reconnectEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retryTokenState.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ roomId, reconnectToken })
    });

    if (!retryResponse.ok) {
      throw mapReconnectFailure(retryResponse.status, true);
    }

    return (await retryResponse.json()) as ReconnectResponse;
  }

  if (!response.ok) {
    throw mapReconnectFailure(response.status, false);
  }

  return (await response.json()) as ReconnectResponse;
}

function mapReconnectFailure(status: number, afterRetry: boolean): ReconnectCallerError {
  if (status === 401) {
    return new ReconnectCallerError(
      "reauth-required",
      afterRetry
        ? "Reconnect request failed after retry with status 401"
        : "Reconnect request failed with status 401"
    );
  }

  if (status === 403) {
    return new ReconnectCallerError(
      "forbidden",
      afterRetry
        ? "Reconnect request failed after retry with status 403"
        : "Reconnect request failed with status 403"
    );
  }

  if (status === 404 || status === 410) {
    return new ReconnectCallerError(
      "stale-session",
      afterRetry
        ? `Reconnect request failed after retry with status ${status}`
        : `Reconnect request failed with status ${status}`
    );
  }

  if (status === 429) {
    return new ReconnectCallerError(
      "rate-limited",
      afterRetry
        ? "Reconnect request failed after retry with status 429"
        : "Reconnect request failed with status 429"
    );
  }

  return new ReconnectCallerError(
    "request-failed",
    afterRetry
      ? `Reconnect request failed after retry with status ${status}`
      : `Reconnect request failed with status ${status}`
  );
}
