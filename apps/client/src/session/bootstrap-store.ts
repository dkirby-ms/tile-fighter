import { ExternalIdSessionStateMachine } from "../auth/external-id-session.js";

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

    if (tokenState.state === "interaction-required") {
      await this.authSession.beginInteractiveAuth();
      throw new Error("Interactive authentication required");
    }

    if (tokenState.state !== "token-ready" || !tokenState.accessToken) {
      throw new Error(`Token acquisition failed: ${tokenState.reasonClass ?? "unknown"}`);
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
        throw new Error("Interactive authentication required after bootstrap unauthorized");
      }

      const retryResponse = await fetch(this.bootstrapEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${retryTokenState.accessToken}`
        }
      });

      if (!retryResponse.ok) {
        throw new Error(`Session bootstrap failed after retry with status ${retryResponse.status}`);
      }

      return (await retryResponse.json()) as BootstrapPayload;
    }

    if (!response.ok) {
      throw new Error(`Session bootstrap failed with status ${response.status}`);
    }

    return (await response.json()) as BootstrapPayload;
  }
}
