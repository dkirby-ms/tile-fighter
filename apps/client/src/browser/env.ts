export interface BrowserRuntimeEnv {
  readonly apiBaseUrl: string;
  readonly roomWsUrl: string;
  readonly roomId: string;
  readonly bootstrapEndpoint: string;
  readonly joinTokenEndpoint: string;
  readonly placeTileEndpoint: string;
  readonly msalAuthority: string;
  readonly msalClientId: string;
  readonly msalRedirectUri: string;
  readonly msalKnownAuthority: string;
  readonly msalApiScope: string;
}

const DEFAULT_API_BASE_URL = "http://localhost:3000";
const DEFAULT_ROOM_WS_URL = "ws://localhost:3000";
const DEFAULT_ROOM_ID = "arena";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function readStringFromGlobalThis(key: string): string | undefined {
  const candidate = Reflect.get(globalThis, key);
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

function readStringFromImportMetaEnv(key: string): string | undefined {
  const envCandidate = (import.meta as { env?: Record<string, unknown> }).env;
  const value = envCandidate ? envCandidate[key] : undefined;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readRuntimeString(key: string): string | undefined {
  return readStringFromGlobalThis(key) ?? readStringFromImportMetaEnv(key);
}

function asApiUrlPath(baseUrl: string, path: string): string {
  return `${trimTrailingSlash(baseUrl)}${path}`;
}

export function getBrowserRuntimeEnv(): BrowserRuntimeEnv {
  const apiBaseUrl =
    readRuntimeString("__APP_API_BASE_URL__") ?? readRuntimeString("VITE_APP_API_BASE_URL") ?? DEFAULT_API_BASE_URL;
  const roomWsUrl =
    readRuntimeString("__APP_ROOM_WS_URL__") ?? readRuntimeString("VITE_APP_ROOM_WS_URL") ?? DEFAULT_ROOM_WS_URL;
  const roomId =
    readRuntimeString("__APP_ROOM_ID__") ?? readRuntimeString("VITE_APP_ROOM_ID") ?? DEFAULT_ROOM_ID;
  const msalAuthority =
    readRuntimeString("__APP_MSAL_AUTHORITY__") ?? readRuntimeString("VITE_APP_MSAL_AUTHORITY") ?? "";
  const msalClientId =
    readRuntimeString("__APP_MSAL_CLIENT_ID__") ?? readRuntimeString("VITE_APP_MSAL_CLIENT_ID") ?? "";
  const msalRedirectUri =
    readRuntimeString("__APP_MSAL_REDIRECT_URI__") ??
    readRuntimeString("VITE_APP_MSAL_REDIRECT_URI") ??
    globalThis.location?.origin ??
    "";
  const msalKnownAuthority =
    readRuntimeString("__APP_MSAL_KNOWN_AUTHORITY__") ??
    readRuntimeString("VITE_APP_MSAL_KNOWN_AUTHORITY") ??
    "";
  const msalApiScope =
    readRuntimeString("__APP_MSAL_API_SCOPE__") ?? readRuntimeString("VITE_APP_MSAL_API_SCOPE") ?? "";

  return {
    apiBaseUrl,
    roomWsUrl,
    roomId,
    bootstrapEndpoint: asApiUrlPath(apiBaseUrl, "/api/session/bootstrap"),
    joinTokenEndpoint: asApiUrlPath(apiBaseUrl, "/api/session/join-token"),
    placeTileEndpoint: asApiUrlPath(apiBaseUrl, "/api/tiles/place"),
    msalAuthority,
    msalClientId,
    msalRedirectUri,
    msalKnownAuthority,
    msalApiScope
  };
}
