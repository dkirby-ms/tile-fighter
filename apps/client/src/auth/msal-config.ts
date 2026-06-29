import { Configuration } from "@azure/msal-browser";

export type ExternalIdClientConfig = {
  authority: string;
  clientId: string;
  redirectUri: string;
  knownAuthorities: string[];
  apiScope: string;
};

export function buildMsalConfiguration(config: ExternalIdClientConfig): Configuration {
  return {
    auth: {
      authority: config.authority,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      knownAuthorities: config.knownAuthorities
    },
    cache: {
      cacheLocation: "sessionStorage"
    }
  };
}

export function buildApiScopes(config: ExternalIdClientConfig): string[] {
  return [config.apiScope];
}
