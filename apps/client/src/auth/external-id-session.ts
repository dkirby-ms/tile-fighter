import {
  AuthenticationResult,
  InteractionRequiredAuthError,
  PublicClientApplication,
  RedirectRequest,
  SilentRequest
} from "@azure/msal-browser";
import { buildApiScopes, ExternalIdClientConfig } from "./msal-config.js";

export type AuthState =
  | "signed-out"
  | "acquiring-token-silently"
  | "interaction-required"
  | "token-ready"
  | "bootstrap-in-flight"
  | "bootstrap-failed";

export type AcquireTokenResult = {
  state: AuthState;
  accessToken?: string;
  reasonClass?: "interaction-required" | "transient-idp" | "unauthorized";
};

const MAX_UNAUTHORIZED_RETRY = 1;

export class ExternalIdSessionStateMachine {
  private unauthorizedRetryCount = 0;
  private _state: AuthState = "signed-out";

  constructor(
    private readonly app: PublicClientApplication,
    private readonly clientConfig: ExternalIdClientConfig
  ) {}

  getState(): AuthState {
    return this._state;
  }

  async acquireTokenReadyState(): Promise<AcquireTokenResult> {
    const account = this.app.getActiveAccount() ?? this.app.getAllAccounts()[0] ?? null;
    if (!account) {
      this._state = "interaction-required";
      return {
        state: "interaction-required",
        reasonClass: "interaction-required"
      };
    }

    this._state = "acquiring-token-silently";

    const silentRequest: SilentRequest = {
      account,
      scopes: buildApiScopes(this.clientConfig)
    };

    try {
      const result = await this.app.acquireTokenSilent(silentRequest);
      this._state = "token-ready";
      return {
        state: "token-ready",
        accessToken: result.accessToken
      };
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        this._state = "interaction-required";
        return {
          state: "interaction-required",
          reasonClass: "interaction-required"
        };
      }

      this._state = "bootstrap-failed";
      return {
        state: "bootstrap-failed",
        reasonClass: "transient-idp"
      };
    }
  }

  async beginInteractiveAuth(): Promise<void> {
    const request: RedirectRequest = {
      scopes: buildApiScopes(this.clientConfig)
    };

    await this.app.acquireTokenRedirect(request);
  }

  async triggerInteractiveRecovery(): Promise<void> {
    this._state = "interaction-required";
    await this.beginInteractiveAuth();
  }

  async handleBootstrapUnauthorizedReacquire(): Promise<AcquireTokenResult> {
    if (this.unauthorizedRetryCount >= MAX_UNAUTHORIZED_RETRY) {
      return {
        state: "interaction-required",
        reasonClass: "unauthorized"
      };
    }

    this.unauthorizedRetryCount += 1;
    return await this.acquireTokenReadyState();
  }

  completeBootstrap(result: AuthenticationResult | null): void {
    this.unauthorizedRetryCount = 0;
    this._state = "token-ready";

    if (result?.account) {
      this.app.setActiveAccount(result.account);
    }
  }
}
