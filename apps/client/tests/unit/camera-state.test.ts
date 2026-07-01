import { describe, expect, it } from "vitest";
import {
  createInitialCameraState,
  deriveCameraTransitionBoundary,
  reduceCameraState,
  reduceCameraStateWithBoundary,
  type CameraAction,
  type CameraState
} from "../../src/navigation/camera-state.js";

function makeState(): CameraState {
  return createInitialCameraState({
    centerCellX: 10,
    centerCellY: 10,
    zoom: 1,
    bounds: {
      minCellX: 0,
      maxCellX: 100,
      minCellY: 0,
      maxCellY: 100
    },
    zoomBounds: {
      minZoom: 0.5,
      maxZoom: 4
    }
  });
}

function applySequence(initial: CameraState, actions: readonly CameraAction[]): CameraState {
  return actions.reduce((state, action) => reduceCameraState(state, action), initial);
}

describe("camera-state", () => {
  it("is deterministic for identical action sequences", () => {
    const actions: CameraAction[] = [
      { type: "camera/panned", deltaCellX: 3.5, deltaCellY: -2.5 },
      { type: "camera/zoomAdjusted", deltaZoom: 0.25 },
      { type: "camera/panned", deltaCellX: 1000, deltaCellY: 0 },
      { type: "camera/zoomSet", zoom: 9 }
    ];

    const finalA = applySequence(makeState(), actions);
    const finalB = applySequence(makeState(), actions);

    expect(finalA).toEqual(finalB);
  });

  it("clamps zoom floor and ceiling", () => {
    const state = makeState();

    const belowFloor = reduceCameraState(state, { type: "camera/zoomSet", zoom: 0.1 });
    const aboveCeiling = reduceCameraState(state, { type: "camera/zoomSet", zoom: 20 });

    expect(belowFloor.zoom).toBe(0.5);
    expect(aboveCeiling.zoom).toBe(4);
  });

  it("clamps camera center to configured bounds", () => {
    const state = makeState();

    const moved = reduceCameraState(state, {
      type: "camera/centerSet",
      centerCellX: -10,
      centerCellY: 999
    });

    expect(moved.centerCellX).toBe(0);
    expect(moved.centerCellY).toBe(100);
  });

  it("ignores invalid non-finite action payloads", () => {
    const state = makeState();
    const withBadPan = reduceCameraState(state, {
      type: "camera/panned",
      deltaCellX: Number.NaN,
      deltaCellY: 2
    });
    const withBadZoom = reduceCameraState(state, {
      type: "camera/zoomAdjusted",
      deltaZoom: Number.POSITIVE_INFINITY
    });

    expect(withBadPan).toEqual(state);
    expect(withBadZoom).toEqual(state);
  });

  it("derives deterministic boundary metadata for pan and zoom transitions", () => {
    const state = makeState();

    const panned = reduceCameraStateWithBoundary(state, {
      type: "camera/panned",
      deltaCellX: 2,
      deltaCellY: 0
    });
    expect(panned.boundary.viewportChanged).toBe(true);
    expect(panned.boundary.zoomLevelChanged).toBe(false);

    const zoomed = reduceCameraStateWithBoundary(state, {
      type: "camera/zoomAdjusted",
      deltaZoom: 0.5
    });
    expect(zoomed.boundary.viewportChanged).toBe(true);
    expect(zoomed.boundary.zoomLevelChanged).toBe(true);
  });

  it("reports no transition boundary for no-op state changes", () => {
    const state = makeState();
    const next = reduceCameraState(state, {
      type: "camera/centerSet",
      centerCellX: state.centerCellX,
      centerCellY: state.centerCellY
    });

    const boundary = deriveCameraTransitionBoundary(state, next);
    expect(boundary).toEqual({
      viewportChanged: false,
      zoomLevelChanged: false
    });
  });
});