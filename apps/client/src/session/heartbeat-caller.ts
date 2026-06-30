import { ExternalIdSessionStateMachine } from "../auth/external-id-session.js";

export type HeartbeatResponse = {
  accepted: boolean;
  roomId: string;
  reconnectToken?: string | null;
};

export function getReconnectTokenFromHeartbeat(response: HeartbeatResponse): string | null {
  return typeof response.reconnectToken === "string" && response.reconnectToken.length > 0
    ? response.reconnectToken
    : null;
}

export async function sendHeartbeat(
  authSession: ExternalIdSessionStateMachine,
  heartbeatEndpoint: string,
  roomId: string
): Promise<HeartbeatResponse> {
  const tokenState = await authSession.acquireTokenReadyState();

  if (tokenState.state === "interaction-required") {
    await authSession.beginInteractiveAuth();
    throw new Error("Interactive authentication required");
  }

  if (tokenState.state !== "token-ready" || !tokenState.accessToken) {
    throw new Error(`Token acquisition failed: ${tokenState.reasonClass ?? "unknown"}`);
  }

  const response = await fetch(heartbeatEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenState.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ roomId })
  });

  if (response.status === 401) {
    const retryTokenState = await authSession.handleBootstrapUnauthorizedReacquire();

    if (retryTokenState.state !== "token-ready" || !retryTokenState.accessToken) {
      await authSession.beginInteractiveAuth();
      throw new Error("Interactive authentication required after heartbeat unauthorized");
    }

    const retryResponse = await fetch(heartbeatEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retryTokenState.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ roomId })
    });

    if (!retryResponse.ok) {
      throw new Error(`Heartbeat request failed after retry with status ${retryResponse.status}`);
    }

    return (await retryResponse.json()) as HeartbeatResponse;
  }

  if (!response.ok) {
    throw new Error(`Heartbeat request failed with status ${response.status}`);
  }

  return (await response.json()) as HeartbeatResponse;
}
