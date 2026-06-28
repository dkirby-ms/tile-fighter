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

  constructor(
    private readonly app: PublicClientApplication,
    private readonly clientConfig: ExternalIdClientConfig
  ) {}

  async acquireTokenReadyState(): Promise<AcquireTokenResult> {
    const account = this.app.getActiveAccount() ?? this.app.getAllAccounts()[0] ?? null;
    if (!account) {
      return {
        state: "interaction-required",
        reasonClass: "interaction-required"
      };
    }

    const silentRequest: SilentRequest = {
      account,
      scopes: buildApiScopes(this.clientConfig)
    };

    try {
      const result = await this.app.acquireTokenSilent(silentRequest);
      return {
        state: "token-ready",
        accessToken: result.accessToken
      };
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return {
          state: "interaction-required",
          reasonClass: "interaction-required"
        };
      }

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

    if (result?.account) {
      this.app.setActiveAccount(result.account);
    }
  }
}
