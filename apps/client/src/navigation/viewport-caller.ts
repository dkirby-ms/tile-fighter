import {
  DEFAULT_REGION_DIFF_POLICY,
  type RegionDiffLimits,
  type RegionDiffRequest,
  type RegionDiffResponse,
  type RegionDiffViewport
} from "@game/shared-types";
import { type CameraBounds } from "./camera-state.js";
import { normalizeViewportToPolicy } from "./viewport-math.js";

export interface QueueViewportDiffInput {
  sinceVersion: number;
  viewport: RegionDiffViewport;
  bounds: CameraBounds;
  maxTiles?: number;
}

export interface ViewportCallerError {
  status?: number;
  message: string;
}

export interface ViewportDiffCallerObservers {
  onResponse?: (
    response: RegionDiffResponse,
    context: {
      sequence: number;
      request: RegionDiffRequest;
    }
  ) => void;
  onError?: (
    error: ViewportCallerError,
    context: {
      sequence: number;
      request: RegionDiffRequest;
    }
  ) => void;
}

export interface CreateViewportDiffCallerOptions {
  endpoint: string;
  regionId: string;
  debounceMs?: number;
  limits?: RegionDiffLimits;
}

export interface ViewportDiffCallerDependencies {
  fetchImpl?: typeof fetch;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

export interface ViewportDiffCaller {
  queue(input: QueueViewportDiffInput): void;
  flushNow(): Promise<void>;
  dispose(): void;
}

interface PendingViewportRequest {
  sequence: number;
  request: RegionDiffRequest;
}

function toPositiveIntegerOr(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeSinceVersion(sinceVersion: number): number {
  if (!Number.isFinite(sinceVersion)) {
    return 0;
  }

  return Math.max(0, Math.floor(sinceVersion));
}

function normalizeMaxTiles(maxTiles: number | undefined, limits: RegionDiffLimits): number {
  const fallback = toPositiveIntegerOr(limits.defaultMaxTiles, 1);
  const normalized = toPositiveIntegerOr(maxTiles, fallback);
  return Math.min(normalized, toPositiveIntegerOr(limits.maxTilesPerRequest, fallback));
}

function toViewportCallerError(response: Response): ViewportCallerError {
  return {
    status: response.status,
    message: `Viewport diff request failed with status ${response.status}`
  };
}

function isRegionDiffResponse(value: unknown): value is RegionDiffResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const parsed = value as { ok?: unknown; tiles?: unknown; metadata?: unknown };
  return parsed.ok === true && Array.isArray(parsed.tiles) && typeof parsed.metadata === "object";
}

export function createViewportDiffCaller(
  options: CreateViewportDiffCallerOptions,
  observers: ViewportDiffCallerObservers = {},
  dependencies: ViewportDiffCallerDependencies = {}
): ViewportDiffCaller {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const setTimeoutImpl = dependencies.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = dependencies.clearTimeoutImpl ?? clearTimeout;
  const limits = options.limits ?? DEFAULT_REGION_DIFF_POLICY.limits;
  const debounceMs = Math.max(0, Math.floor(options.debounceMs ?? 60));

  let disposed = false;
  let sequence = 0;
  let latestQueuedSequence = 0;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: PendingViewportRequest | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
  };

  const scheduleFlush = (): void => {
    if (disposed) {
      return;
    }

    clearTimer();
    timer = setTimeoutImpl(() => {
      timer = null;
      void dispatchPending();
    }, debounceMs);
  };

  const dispatchPending = async (): Promise<void> => {
    if (disposed || inFlight || pending === null) {
      return;
    }

    const nextRequest = pending;
    pending = null;
    inFlight = true;

    try {
      const response = await fetchImpl(options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(nextRequest.request)
      });

      if (!response.ok) {
        observers.onError?.(toViewportCallerError(response), {
          sequence: nextRequest.sequence,
          request: nextRequest.request
        });
        return;
      }

      const parsed = (await response.json()) as unknown;
      if (!isRegionDiffResponse(parsed)) {
        observers.onError?.(
          {
            message: "Viewport diff response payload was invalid"
          },
          {
            sequence: nextRequest.sequence,
            request: nextRequest.request
          }
        );
        return;
      }

      if (nextRequest.sequence === latestQueuedSequence) {
        observers.onResponse?.(parsed, {
          sequence: nextRequest.sequence,
          request: nextRequest.request
        });
      }
    } catch (error) {
      observers.onError?.(
        {
          message: error instanceof Error ? error.message : "Viewport diff request failed"
        },
        {
          sequence: nextRequest.sequence,
          request: nextRequest.request
        }
      );
    } finally {
      inFlight = false;
      if (pending !== null) {
        scheduleFlush();
      }
    }
  };

  return {
    queue(input: QueueViewportDiffInput): void {
      if (disposed) {
        return;
      }

      const normalizedRequest: RegionDiffRequest = {
        regionId: options.regionId,
        sinceVersion: normalizeSinceVersion(input.sinceVersion),
        viewport: normalizeViewportToPolicy(input.viewport, input.bounds, limits),
        maxTiles: normalizeMaxTiles(input.maxTiles, limits)
      };

      sequence += 1;
      latestQueuedSequence = sequence;
      pending = {
        sequence,
        request: normalizedRequest
      };

      scheduleFlush();
    },
    async flushNow(): Promise<void> {
      clearTimer();
      await dispatchPending();
    },
    dispose(): void {
      disposed = true;
      clearTimer();
      pending = null;
    }
  };
}