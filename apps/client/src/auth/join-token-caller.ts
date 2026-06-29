import { ExternalIdSessionStateMachine } from "./external-id-session.js";

export type JoinTokenResponse = {
  roomId: string;
  joinToken: string;
};

export async function getJoinToken(
  authSession: ExternalIdSessionStateMachine,
  joinTokenEndpoint: string,
  roomId: string
): Promise<JoinTokenResponse> {
  const tokenState = await authSession.acquireTokenReadyState();

  if (tokenState.state === "interaction-required") {
    await authSession.beginInteractiveAuth();
    throw new Error("Interactive authentication required");
  }

  if (tokenState.state !== "token-ready" || !tokenState.accessToken) {
    throw new Error(`Token acquisition failed: ${tokenState.reasonClass ?? "unknown"}`);
  }

  const response = await fetch(joinTokenEndpoint, {
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
      throw new Error("Interactive authentication required after join-token unauthorized");
    }

    const retryResponse = await fetch(joinTokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retryTokenState.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ roomId })
    });

    if (!retryResponse.ok) {
      throw new Error(`Join-token request failed after retry with status ${retryResponse.status}`);
    }

    return (await retryResponse.json()) as JoinTokenResponse;
  }

  if (!response.ok) {
    throw new Error(`Join-token request failed with status ${response.status}`);
  }

  return (await response.json()) as JoinTokenResponse;
}
