import { describe, expect, it } from "vitest";
import { DEFAULT_REGION_DIFF_POLICY } from "@game/shared-types";
import { createInitialCameraState } from "../../src/navigation/camera-state.js";
import {
  deriveViewportArea,
  deriveViewportFromCamera,
  normalizeViewportToPolicy
} from "../../src/navigation/viewport-math.js";

describe("viewport-math", () => {
  it("derives a viewport that stays within camera bounds", () => {
    const camera = createInitialCameraState({
      centerCellX: 0,
      centerCellY: 0,
      zoom: 1,
      bounds: {
        minCellX: 0,
        maxCellX: 40,
        minCellY: 0,
        maxCellY: 20
      },
      zoomBounds: {
        minZoom: 0.5,
        maxZoom: 4
      }
    });

    const viewport = deriveViewportFromCamera({
      camera,
      viewWidthCells: 15,
      viewHeightCells: 9
    });

    expect(viewport.minCellX).toBeGreaterThanOrEqual(camera.bounds.minCellX);
    expect(viewport.maxCellX).toBeLessThanOrEqual(camera.bounds.maxCellX);
    expect(viewport.minCellY).toBeGreaterThanOrEqual(camera.bounds.minCellY);
    expect(viewport.maxCellY).toBeLessThanOrEqual(camera.bounds.maxCellY);
  });

  it("normalizes viewport dimensions to shared maxViewportArea policy", () => {
    const viewport = normalizeViewportToPolicy(
      {
        minCellX: 0,
        maxCellX: 1000,
        minCellY: 0,
        maxCellY: 1000
      },
      {
        minCellX: 0,
        maxCellX: 1000,
        minCellY: 0,
        maxCellY: 1000
      }
    );

    expect(deriveViewportArea(viewport)).toBeLessThanOrEqual(
      DEFAULT_REGION_DIFF_POLICY.limits.maxViewportArea
    );
  });

  it("is deterministic for repeated derivation inputs", () => {
    const camera = createInitialCameraState({
      centerCellX: 12,
      centerCellY: 16,
      zoom: 2,
      bounds: {
        minCellX: 0,
        maxCellX: 512,
        minCellY: 0,
        maxCellY: 512
      },
      zoomBounds: {
        minZoom: 0.25,
        maxZoom: 8
      }
    });

    const a = deriveViewportFromCamera({
      camera,
      viewWidthCells: 120,
      viewHeightCells: 90
    });
    const b = deriveViewportFromCamera({
      camera,
      viewWidthCells: 120,
      viewHeightCells: 90
    });

    expect(a).toEqual(b);
  });
});