import type { BrowserRuntimeEnv } from "./env.js";
import type { BootstrapPayload } from "../session/bootstrap-store.js";
import type { TilePlaceResult } from "@game/shared-types";

export interface ApiHealthResult {
  readonly ok: boolean;
  readonly status: number;
}

export type ApiRequestContext = {
  accessToken: string;
};

export type TilePlacementRequest = {
  commandId: string;
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
};

export type TilePlacementResponse = {
  status: number;
  result: TilePlaceResult;
};

export async function probeApi(_env: BrowserRuntimeEnv): Promise<ApiHealthResult> {
  const response = await fetch(`${_env.apiBaseUrl}/healthz`, {
    method: "GET"
  });

  return {
    ok: response.ok,
    status: response.status
  };
}

export async function fetchSessionBootstrap(
  env: BrowserRuntimeEnv,
  requestContext: ApiRequestContext
): Promise<BootstrapPayload> {
  const response = await fetch(env.bootstrapEndpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${requestContext.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Session bootstrap failed with status ${response.status}`);
  }

  return (await response.json()) as BootstrapPayload;
}

export async function placeTile(
  env: BrowserRuntimeEnv,
  requestContext: ApiRequestContext,
  request: TilePlacementRequest
): Promise<TilePlacementResponse> {
  const response = await fetch(env.placeTileEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requestContext.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  return {
    status: response.status,
    result: (await response.json()) as TilePlaceResult
  };
}
