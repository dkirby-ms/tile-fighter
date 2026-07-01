import { describe, expect, it, vi } from "vitest";
import {
  createInitialCameraState,
  createViewportDiffCaller,
  deriveViewportArea,
  deriveViewportFromCamera,
  deriveVisibleTiles,
  reduceCameraStateWithBoundary,
  type CreatorTelemetryEvent,
  CreatorTelemetryAdapter
} from "../../src/index.js";
import { DEFAULT_REGION_DIFF_POLICY, type RegionDiffResponse } from "@game/shared-types";

function makeDiffResponse(viewport: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number }): RegionDiffResponse {
  return {
    ok: true,
    regionId: "arena-1",
    sinceVersion: 0,
    currentVersion: 5,
    nextSinceVersion: 6,
    isEmpty: false,
    truncated: false,
    tiles: [
      {
        cellX: viewport.minCellX,
        cellY: viewport.minCellY,
        version: 5,
        operation: "upsert",
        offsetX: null,
        offsetY: null,
        shape: "square",
        color: "red",
        stylePayload: null,
        ownerId: null
      },
      {
        cellX: viewport.maxCellX,
        cellY: viewport.maxCellY,
        version: 5,
        operation: "upsert",
        offsetX: null,
        offsetY: null,
        shape: "square",
        color: "blue",
        stylePayload: null,
        ownerId: null
      }
    ],
    metadata: {
      viewport,
      maxTiles: DEFAULT_REGION_DIFF_POLICY.limits.defaultMaxTiles,
      returnedTileCount: 2,
      policy: DEFAULT_REGION_DIFF_POLICY
    }
  };
}

describe("E5-S2 pan/zoom/culling integration flow", () => {
  it("moves camera, emits deterministic telemetry, requests bounded viewport, and updates visible set deterministically", async () => {
    vi.useFakeTimers();

    const telemetryEvents: CreatorTelemetryEvent[] = [];
    const telemetry = new CreatorTelemetryAdapter(
      {
        emit: (event) => telemetryEvents.push(event)
      },
      { now: () => 42 }
    );

    let camera = createInitialCameraState({
      centerCellX: 50,
      centerCellY: 50,
      zoom: 1,
      bounds: {
        minCellX: 0,
        maxCellX: 200,
        minCellY: 0,
        maxCellY: 200
      },
      zoomBounds: {
        minZoom: 0.5,
        maxZoom: 4
      }
    });

    const fetchImpl = vi.fn(async (_endpoint: string, init: RequestInit | undefined) => {
      const request = JSON.parse(String(init?.body)) as { viewport: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number } };
      return new Response(JSON.stringify(makeDiffResponse(request.viewport)), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    let latestResponse: RegionDiffResponse | null = null;
    const caller = createViewportDiffCaller(
      {
        endpoint: "https://example.test/api/regions/diff",
        regionId: "arena-1",
        debounceMs: 0
      },
      {
        onResponse: (response) => {
          latestResponse = response;
        }
      },
      { fetchImpl }
    );

    const panTransition = reduceCameraStateWithBoundary(camera, {
      type: "camera/panned",
      deltaCellX: 20,
      deltaCellY: -10
    });
    camera = panTransition.state;

    const zoomTransition = reduceCameraStateWithBoundary(camera, {
      type: "camera/zoomAdjusted",
      deltaZoom: 0.75
    });
    camera = zoomTransition.state;

    const viewport = deriveViewportFromCamera({
      camera,
      viewWidthCells: 80,
      viewHeightCells: 40
    });

    telemetry.emitCameraTelemetryBoundary({
      viewportChanged: panTransition.boundary.viewportChanged,
      zoomLevelChanged: panTransition.boundary.zoomLevelChanged,
      viewport: {
        ...viewport,
        area: deriveViewportArea(viewport)
      },
      zoom: {
        zoom: panTransition.state.zoom
      }
    });

    telemetry.emitCameraTelemetryBoundary({
      viewportChanged: zoomTransition.boundary.viewportChanged,
      zoomLevelChanged: zoomTransition.boundary.zoomLevelChanged,
      viewport: {
        ...viewport,
        area: deriveViewportArea(viewport)
      },
      zoom: {
        zoom: zoomTransition.state.zoom
      }
    });

    caller.queue({
      sinceVersion: 0,
      viewport,
      bounds: camera.bounds
    });

    await vi.runAllTimersAsync();
    await caller.flushNow();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      viewport: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number };
    };
    const requestedArea =
      (body.viewport.maxCellX - body.viewport.minCellX + 1) *
      (body.viewport.maxCellY - body.viewport.minCellY + 1);

    expect(requestedArea).toBeLessThanOrEqual(DEFAULT_REGION_DIFF_POLICY.limits.maxViewportArea);
    expect(body.viewport.minCellX).toBeGreaterThanOrEqual(camera.bounds.minCellX);
    expect(body.viewport.maxCellX).toBeLessThanOrEqual(camera.bounds.maxCellX);
    expect(body.viewport.minCellY).toBeGreaterThanOrEqual(camera.bounds.minCellY);
    expect(body.viewport.maxCellY).toBeLessThanOrEqual(camera.bounds.maxCellY);

    expect(latestResponse).not.toBeNull();
    const firstVisible = deriveVisibleTiles(latestResponse?.tiles ?? [], viewport);
    const secondVisible = deriveVisibleTiles(latestResponse?.tiles ?? [], viewport);

    expect(firstVisible).toEqual(secondVisible);

    const eventNames = telemetryEvents.map((event) => event.name);
    expect(eventNames).toEqual(["viewport_changed", "viewport_changed", "zoom_level_changed"]);

    caller.dispose();
    vi.useRealTimers();
  });
});
