import { describe, expect, it, vi } from "vitest";
import {
  createInitialCameraState,
  createViewportDiffCaller,
  deriveViewportFromCamera,
  reduceCameraStateWithBoundary,
  type CreatorTelemetryEvent,
  CreatorTelemetryAdapter
} from "../../src/index.js";

describe("E2-S4 x E5-S2 compatibility", () => {
  it("preserves deterministic no-op telemetry semantics and latest-wins viewport caller behavior", async () => {
    vi.useFakeTimers();

    const events: CreatorTelemetryEvent[] = [];
    const telemetry = new CreatorTelemetryAdapter(
      {
        emit: (event) => events.push(event)
      },
      { now: () => 100 }
    );

    const initialCamera = createInitialCameraState({
      centerCellX: 25,
      centerCellY: 25,
      zoom: 1,
      bounds: {
        minCellX: 0,
        maxCellX: 100,
        minCellY: 0,
        maxCellY: 100
      },
      zoomBounds: {
        minZoom: 0.5,
        maxZoom: 3
      }
    });

    const noopCenter = reduceCameraStateWithBoundary(initialCamera, {
      type: "camera/centerSet",
      centerCellX: initialCamera.centerCellX,
      centerCellY: initialCamera.centerCellY
    });

    const noopZoom = reduceCameraStateWithBoundary(initialCamera, {
      type: "camera/zoomSet",
      zoom: initialCamera.zoom
    });

    const baseViewport = deriveViewportFromCamera({
      camera: initialCamera,
      viewWidthCells: 20,
      viewHeightCells: 20
    });

    telemetry.emitCameraTelemetryBoundary({
      viewportChanged: noopCenter.boundary.viewportChanged,
      zoomLevelChanged: noopCenter.boundary.zoomLevelChanged,
      viewport: {
        ...baseViewport,
        area: 400
      },
      zoom: { zoom: noopCenter.state.zoom }
    });

    telemetry.emitCameraTelemetryBoundary({
      viewportChanged: noopZoom.boundary.viewportChanged,
      zoomLevelChanged: noopZoom.boundary.zoomLevelChanged,
      viewport: {
        ...baseViewport,
        area: 400
      },
      zoom: { zoom: noopZoom.state.zoom }
    });

    expect(events).toEqual([]);

    const fetchImpl = vi.fn(async (_endpoint: string, init: RequestInit | undefined) => {
      const body = JSON.parse(String(init?.body)) as { sinceVersion: number };
      return new Response(
        JSON.stringify({
          ok: true,
          regionId: "arena-1",
          sinceVersion: body.sinceVersion,
          currentVersion: body.sinceVersion + 1,
          nextSinceVersion: body.sinceVersion + 2,
          isEmpty: true,
          truncated: false,
          tiles: [],
          metadata: {
            viewport: baseViewport,
            maxTiles: 500,
            returnedTileCount: 0,
            policy: {
              limits: {
                maxViewportArea: 10000,
                maxTilesPerRequest: 1000,
                defaultMaxTiles: 500
              },
              deleteSemantics: "upsert_only",
              requiresRegionMembership: true
            }
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    const responses: number[] = [];
    const caller = createViewportDiffCaller(
      {
        endpoint: "https://example.test/api/regions/diff",
        regionId: "arena-1",
        debounceMs: 5
      },
      {
        onResponse: (_response, context) => {
          responses.push(context.request.sinceVersion);
        }
      },
      { fetchImpl }
    );

    caller.queue({
      sinceVersion: 1,
      viewport: baseViewport,
      bounds: initialCamera.bounds
    });
    caller.queue({
      sinceVersion: 2,
      viewport: baseViewport,
      bounds: initialCamera.bounds
    });

    await vi.advanceTimersByTimeAsync(5);
    await caller.flushNow();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(responses).toEqual([2]);

    caller.dispose();
    vi.useRealTimers();
  });
});
