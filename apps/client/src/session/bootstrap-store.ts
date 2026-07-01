import {
  type AcquireTokenResult,
  ExternalIdSessionStateMachine
} from "../auth/external-id-session.js";

export type BootstrapPayload = {
  subject: string;
  tenantScopedSubject: string;
  tenantId?: string;
  issuer: string;
  serverTime: string;
  shellInit: {
    bootstrapState: "token-ready";
    retryPolicy: {
      maxBootstrap401Retry: 1;
      interactiveAuthRequiredAfterRetry: true;
    };
  };
};

export type ReconnectContext = {
  tenantScopedSubject: string;
  roomId: string;
  reconnectToken: string;
  checkpointVersion: number;
  savedAtMs: number;
};

export type BootstrapErrorClass = "interaction-required" | "denied" | "unavailable";

export type BootstrapDenialCode = "auth-invalid" | "access-denied" | "not-available";

export class BootstrapStoreError extends Error {
  constructor(
    readonly errorClass: BootstrapErrorClass,
    message: string,
    readonly statusCode?: number,
    readonly denialCode?: BootstrapDenialCode
  ) {
    super(message);
    this.name = "BootstrapStoreError";
  }
}

export class SessionBootstrapStore {
  private reconnectContext: ReconnectContext | null = null;

  constructor(
    private readonly authSession: ExternalIdSessionStateMachine,
    private readonly bootstrapEndpoint: string
  ) {}

  setReconnectContext(context: ReconnectContext): void {
    this.reconnectContext = {
      ...context,
      savedAtMs: context.savedAtMs
    };
  }

  getReconnectContext(): ReconnectContext | null {
    return this.reconnectContext ? { ...this.reconnectContext } : null;
  }

  clearReconnectContext(): void {
    this.reconnectContext = null;
  }

  async bootstrap(): Promise<BootstrapPayload> {
    const tokenState = await this.authSession.acquireTokenReadyState();
    return await this.bootstrapWithTokenReadyState(tokenState);
  }

  async bootstrapWithTokenReadyState(tokenState: AcquireTokenResult): Promise<BootstrapPayload> {

    if (tokenState.state === "interaction-required") {
      await this.authSession.beginInteractiveAuth();
      throw new BootstrapStoreError("interaction-required", "Interactive authentication required");
    }

    if (tokenState.state !== "token-ready" || !tokenState.accessToken) {
      throw new BootstrapStoreError(
        "unavailable",
        `Token acquisition failed: ${tokenState.reasonClass ?? "unknown"}`
      );
    }

    const response = await fetch(this.bootstrapEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenState.accessToken}`
      }
    });

    if (response.status === 401) {
      const retryTokenState = await this.authSession.handleBootstrapUnauthorizedReacquire();
      if (retryTokenState.state !== "token-ready" || !retryTokenState.accessToken) {
        await this.authSession.beginInteractiveAuth();
        throw new BootstrapStoreError(
          "interaction-required",
          "Interactive authentication required after bootstrap unauthorized"
        );
      }

      const retryResponse = await fetch(this.bootstrapEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${retryTokenState.accessToken}`
        }
      });

      if (!retryResponse.ok) {
        throw createBootstrapResponseError(retryResponse.status, true);
      }

      return (await retryResponse.json()) as BootstrapPayload;
    }

    if (!response.ok) {
      throw createBootstrapResponseError(response.status, false);
    }

    return (await response.json()) as BootstrapPayload;
  }
}

function createBootstrapResponseError(statusCode: number, afterRetry: boolean): BootstrapStoreError {
  if (statusCode === 401 || statusCode === 403) {
    return new BootstrapStoreError(
      "denied",
      afterRetry
        ? `Session bootstrap denied after retry with status ${statusCode}`
        : `Session bootstrap denied with status ${statusCode}`,
      statusCode,
      statusCode === 401 ? "auth-invalid" : "access-denied"
    );
  }

  if (statusCode === 404 || statusCode === 410) {
    return new BootstrapStoreError(
      "denied",
      afterRetry
        ? `Session bootstrap denied after retry with status ${statusCode}`
        : `Session bootstrap denied with status ${statusCode}`,
      statusCode,
      "not-available"
    );
  }

  return new BootstrapStoreError(
    "unavailable",
    afterRetry
      ? `Session bootstrap unavailable after retry with status ${statusCode}`
      : `Session bootstrap unavailable with status ${statusCode}`,
    statusCode
  );
}
