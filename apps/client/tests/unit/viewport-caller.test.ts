import { describe, expect, it, vi } from "vitest";
import { DEFAULT_REGION_DIFF_POLICY, type RegionDiffResponse } from "@game/shared-types";
import { createViewportDiffCaller } from "../../src/navigation/viewport-caller.js";

function createDiffResponse(viewport: {
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
}): RegionDiffResponse {
  return {
    ok: true,
    regionId: "arena-1",
    sinceVersion: 0,
    currentVersion: 5,
    nextSinceVersion: 6,
    isEmpty: false,
    truncated: false,
    tiles: [],
    metadata: {
      viewport,
      maxTiles: DEFAULT_REGION_DIFF_POLICY.limits.defaultMaxTiles,
      returnedTileCount: 0,
      policy: DEFAULT_REGION_DIFF_POLICY
    }
  };
}

describe("viewport-caller", () => {
  it("debounces burst queue calls into a single request", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(async (_endpoint: string, init: RequestInit | undefined) => {
      const body = JSON.parse(String(init?.body)) as { viewport: { minCellX: number } };
      return new Response(JSON.stringify(createDiffResponse(body.viewport)), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    const onResponse = vi.fn();

    const caller = createViewportDiffCaller(
      {
        endpoint: "https://example.test/api/regions/diff",
        regionId: "arena-1",
        debounceMs: 20
      },
      { onResponse },
      { fetchImpl }
    );

    caller.queue({
      sinceVersion: 0,
      viewport: { minCellX: 0, maxCellX: 10, minCellY: 0, maxCellY: 10 },
      bounds: { minCellX: 0, maxCellX: 500, minCellY: 0, maxCellY: 500 }
    });
    caller.queue({
      sinceVersion: 1,
      viewport: { minCellX: 5, maxCellX: 15, minCellY: 5, maxCellY: 15 },
      bounds: { minCellX: 0, maxCellX: 500, minCellY: 0, maxCellY: 500 }
    });
    caller.queue({
      sinceVersion: 2,
      viewport: { minCellX: 10, maxCellX: 20, minCellY: 10, maxCellY: 20 },
      bounds: { minCellX: 0, maxCellX: 500, minCellY: 0, maxCellY: 500 }
    });

    await vi.advanceTimersByTimeAsync(20);
    await caller.flushNow();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      sinceVersion: number;
      viewport: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number };
    };
    expect(body.sinceVersion).toBe(2);
    expect(body.viewport).toEqual({ minCellX: 10, maxCellX: 20, minCellY: 10, maxCellY: 20 });
    expect(onResponse).toHaveBeenCalledTimes(1);

    caller.dispose();
    vi.useRealTimers();
  });

  it("coalesces while request is in flight and sends only latest pending request", async () => {
    vi.useFakeTimers();

    let releaseFirst: (() => void) | null = null;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          if (fetchImpl.mock.calls.length === 1) {
            releaseFirst = () => {
              resolve(
                new Response(JSON.stringify(createDiffResponse({ minCellX: 0, maxCellX: 5, minCellY: 0, maxCellY: 5 })), {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
                })
              );
            };
            return;
          }

          resolve(
            new Response(JSON.stringify(createDiffResponse({ minCellX: 20, maxCellX: 25, minCellY: 20, maxCellY: 25 })), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        })
    );

    const caller = createViewportDiffCaller(
      {
        endpoint: "https://example.test/api/regions/diff",
        regionId: "arena-1",
        debounceMs: 1
      },
      {},
      { fetchImpl }
    );

    caller.queue({
      sinceVersion: 0,
      viewport: { minCellX: 0, maxCellX: 5, minCellY: 0, maxCellY: 5 },
      bounds: { minCellX: 0, maxCellX: 500, minCellY: 0, maxCellY: 500 }
    });
    await vi.advanceTimersByTimeAsync(1);

    caller.queue({
      sinceVersion: 1,
      viewport: { minCellX: 10, maxCellX: 15, minCellY: 10, maxCellY: 15 },
      bounds: { minCellX: 0, maxCellX: 500, minCellY: 0, maxCellY: 500 }
    });
    caller.queue({
      sinceVersion: 2,
      viewport: { minCellX: 20, maxCellX: 25, minCellY: 20, maxCellY: 25 },
      bounds: { minCellX: 0, maxCellX: 500, minCellY: 0, maxCellY: 500 }
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    releaseFirst?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1);
    await caller.flushNow();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    const secondBody = JSON.parse(String(secondInit.body)) as {
      sinceVersion: number;
      viewport: { minCellX: number };
    };
    expect(secondBody.sinceVersion).toBe(2);
    expect(secondBody.viewport.minCellX).toBe(20);

    caller.dispose();
    vi.useRealTimers();
  });

  it("applies latest-wins for response handling", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(async (_endpoint: string, init: RequestInit | undefined) => {
      const body = JSON.parse(String(init?.body)) as { sinceVersion: number; viewport: RegionDiffResponse["metadata"]["viewport"] };
      return new Response(JSON.stringify(createDiffResponse(body.viewport)), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    const onResponse = vi.fn();
    const caller = createViewportDiffCaller(
      {
        endpoint: "https://example.test/api/regions/diff",
        regionId: "arena-1",
        debounceMs: 20
      },
      { onResponse },
      { fetchImpl }
    );

    caller.queue({
      sinceVersion: 1,
      viewport: { minCellX: 0, maxCellX: 5, minCellY: 0, maxCellY: 5 },
      bounds: { minCellX: 0, maxCellX: 100, minCellY: 0, maxCellY: 100 }
    });
    caller.queue({
      sinceVersion: 2,
      viewport: { minCellX: 50, maxCellX: 55, minCellY: 50, maxCellY: 55 },
      bounds: { minCellX: 0, maxCellX: 100, minCellY: 0, maxCellY: 100 }
    });

    await vi.advanceTimersByTimeAsync(20);
    await caller.flushNow();

    expect(onResponse).toHaveBeenCalledTimes(1);
    const [response, context] = onResponse.mock.calls[0] as [
      RegionDiffResponse,
      { sequence: number; request: { sinceVersion: number } }
    ];
    expect(context.sequence).toBe(2);
    expect(context.request.sinceVersion).toBe(2);
    expect(response.metadata.viewport.minCellX).toBe(50);

    caller.dispose();
    vi.useRealTimers();
  });

  it("bounds outgoing requests via viewport policy math", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(createDiffResponse({ minCellX: 0, maxCellX: 99, minCellY: 0, maxCellY: 99 })), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const caller = createViewportDiffCaller(
      {
        endpoint: "https://example.test/api/regions/diff",
        regionId: "arena-1",
        debounceMs: 0
      },
      {},
      { fetchImpl }
    );

    caller.queue({
      sinceVersion: -10,
      viewport: { minCellX: -1000, maxCellX: 1000, minCellY: -1000, maxCellY: 1000 },
      bounds: { minCellX: 0, maxCellX: 200, minCellY: 0, maxCellY: 200 },
      maxTiles: 999_999
    });
    await caller.flushNow();

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      sinceVersion: number;
      viewport: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number };
      maxTiles: number;
    };

    const area = (body.viewport.maxCellX - body.viewport.minCellX + 1) * (body.viewport.maxCellY - body.viewport.minCellY + 1);
    expect(body.sinceVersion).toBe(0);
    expect(body.viewport.minCellX).toBeGreaterThanOrEqual(0);
    expect(body.viewport.minCellY).toBeGreaterThanOrEqual(0);
    expect(area).toBeLessThanOrEqual(DEFAULT_REGION_DIFF_POLICY.limits.maxViewportArea);
    expect(body.maxTiles).toBeLessThanOrEqual(DEFAULT_REGION_DIFF_POLICY.limits.maxTilesPerRequest);

    caller.dispose();
  });
});