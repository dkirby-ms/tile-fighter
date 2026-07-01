import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createInitialCameraState,
  deriveViewportFromCamera,
  reduceCameraState
} from "../../src/index.js";

interface E5S2PerfArtifact {
  scenarioId: "e5-s2-pan-zoom-budget";
  timestamp: string;
  environment: {
    runClass: "local" | "ci";
    iterations: number;
  };
  metrics: {
    avgFrameTimeMs: number;
    estimatedFps: number;
    memoryDeltaBytes: number;
  };
  budgets: {
    minEstimatedFps: number;
    maxMemoryDeltaBytes: number;
  };
  budgetStatus: {
    fpsPassed: boolean;
    memoryPassed: boolean;
    allPassed: boolean;
  };
}

const PERF_ARTIFACT_PATH = process.env.E5_S2_PERF_ARTIFACT_PATH ?? "apps/server/artifacts/e5-s2-pan-zoom-budget.json";
const ITERATIONS = 500;
const MIN_ESTIMATED_FPS = 30;
const MAX_MEMORY_DELTA_BYTES = 8_000_000;

function getHeapUsed(): number {
  if (typeof process.memoryUsage !== "function") {
    return 0;
  }

  return process.memoryUsage().heapUsed;
}

function writeArtifact(artifact: E5S2PerfArtifact): void {
  mkdirSync(dirname(PERF_ARTIFACT_PATH), { recursive: true });
  writeFileSync(PERF_ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

describe("E5-S2 perf artifact", () => {
  it("generates fps/memory evidence for pan/zoom viewport updates", () => {
    let camera = createInitialCameraState({
      centerCellX: 100,
      centerCellY: 100,
      zoom: 1,
      bounds: {
        minCellX: 0,
        maxCellX: 500,
        minCellY: 0,
        maxCellY: 500
      },
      zoomBounds: {
        minZoom: 0.5,
        maxZoom: 4
      }
    });

    const heapBefore = getHeapUsed();
    const startedAt = performance.now();

    for (let index = 0; index < ITERATIONS; index += 1) {
      const panDelta = index % 2 === 0 ? 1 : -1;
      camera = reduceCameraState(camera, {
        type: "camera/panned",
        deltaCellX: panDelta,
        deltaCellY: panDelta
      });

      camera = reduceCameraState(camera, {
        type: "camera/zoomAdjusted",
        deltaZoom: index % 4 === 0 ? 0.01 : -0.01
      });

      deriveViewportFromCamera({
        camera,
        viewWidthCells: 80,
        viewHeightCells: 40
      });
    }

    const elapsedMs = Math.max(1, performance.now() - startedAt);
    const avgFrameTimeMs = elapsedMs / ITERATIONS;
    const estimatedFps = 1_000 / avgFrameTimeMs;
    const heapAfter = getHeapUsed();
    const memoryDeltaBytes = Math.max(0, heapAfter - heapBefore);

    const artifact: E5S2PerfArtifact = {
      scenarioId: "e5-s2-pan-zoom-budget",
      timestamp: new Date().toISOString(),
      environment: {
        runClass: process.env.CI ? "ci" : "local",
        iterations: ITERATIONS
      },
      metrics: {
        avgFrameTimeMs,
        estimatedFps,
        memoryDeltaBytes
      },
      budgets: {
        minEstimatedFps: MIN_ESTIMATED_FPS,
        maxMemoryDeltaBytes: MAX_MEMORY_DELTA_BYTES
      },
      budgetStatus: {
        fpsPassed: estimatedFps >= MIN_ESTIMATED_FPS,
        memoryPassed: memoryDeltaBytes <= MAX_MEMORY_DELTA_BYTES,
        allPassed: estimatedFps >= MIN_ESTIMATED_FPS && memoryDeltaBytes <= MAX_MEMORY_DELTA_BYTES
      }
    };

    writeArtifact(artifact);

    expect(artifact.metrics.estimatedFps).toBeGreaterThanOrEqual(MIN_ESTIMATED_FPS);
    expect(artifact.metrics.memoryDeltaBytes).toBeLessThanOrEqual(MAX_MEMORY_DELTA_BYTES);
  });
});
