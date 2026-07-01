import { describe, expect, it } from "vitest";
import {
  derivePlacementPreviewBoundaryState,
  deriveOccupancyLookup,
  derivePlacementPreview,
  shouldEmitPlacementPreviewShown
} from "../../src/creator/placement-preview.js";
import { createInitialCreatorToolState, reduceCreatorToolState } from "../../src/creator/tool-state.js";

function makeReadyState() {
  const initial = createInitialCreatorToolState();

  return reduceCreatorToolState(
    reduceCreatorToolState(
      reduceCreatorToolState(initial, { type: "creator/shapeSelected", shape: "square" }),
      { type: "creator/colorSelected", color: "red" }
    ),
    { type: "creator/hoverTargetSet", targetCell: { cellX: 4, cellY: 7 } }
  );
}

describe("placement preview evaluator", () => {
  it("returns ready for valid input when target is not occupied", () => {
    const state = makeReadyState();

    const result = derivePlacementPreview(state, [{ cellX: 9, cellY: 9 }]);

    expect(result.status).toBe("ready");
    expect(result.targetCell).toEqual({ cellX: 4, cellY: 7 });
    expect(result.reasons).toEqual([]);
  });

  it("returns blocked when hovered target is occupied", () => {
    const state = makeReadyState();

    const result = derivePlacementPreview(state, [{ cellX: 4, cellY: 7 }]);

    expect(result.status).toBe("blocked");
    expect(result.reasons).toEqual(["occupied-target-cell"]);
  });

  it("returns blocked when state is explicitly marked blocked", () => {
    const state = reduceCreatorToolState(makeReadyState(), {
      type: "creator/previewBlockedSet",
      isBlocked: true
    });

    const result = derivePlacementPreview(state, []);

    expect(result.status).toBe("blocked");
    expect(result.reasons).toEqual(["occupied-target-cell"]);
  });

  it("returns invalid-input when shape/color/target are not valid", () => {
    const initial = createInitialCreatorToolState();

    const result = derivePlacementPreview(initial, []);

    expect(result.status).toBe("invalid-input");
    expect(result.reasons).toContain("invalid-target-cell");
    expect(result.reasons).toContain("invalid-shape");
    expect(result.reasons).toContain("invalid-color");
  });

  it("returns invalid-input when selected values are outside allowed palette", () => {
    const state = {
      ...makeReadyState(),
      selectedShape: "hexagon",
      selectedColor: "purple"
    };

    const result = derivePlacementPreview(state, []);

    expect(result.status).toBe("invalid-input");
    expect(result.reasons).toContain("invalid-shape");
    expect(result.reasons).toContain("invalid-color");
  });

  it("accepts precomputed occupancy lookup set", () => {
    const state = makeReadyState();
    const occupied = deriveOccupancyLookup([{ cellX: 4, cellY: 7 }]);

    const result = derivePlacementPreview(state, occupied);

    expect(result.status).toBe("blocked");
  });

  it("derives occupancy lookup with dedupe and invalid coordinate filtering", () => {
    const lookup = deriveOccupancyLookup([
      { cellX: 1, cellY: 2 },
      { cellX: 1, cellY: 2 },
      { cellX: 3.1, cellY: 4 }
    ]);

    expect(lookup.has("1,2")).toBe(true);
    expect(lookup.size).toBe(1);
  });

  it("emits placement_preview_shown only on deterministic boundary changes", () => {
    const state = makeReadyState();

    const previewA = derivePlacementPreview(state, []);
    const boundaryA = derivePlacementPreviewBoundaryState(previewA);
    expect(shouldEmitPlacementPreviewShown(null, boundaryA)).toBe(true);

    const previewA2 = derivePlacementPreview(state, []);
    const boundaryA2 = derivePlacementPreviewBoundaryState(previewA2);
    expect(shouldEmitPlacementPreviewShown(boundaryA, boundaryA2)).toBe(false);

    const blockedPreview = derivePlacementPreview(state, [{ cellX: 4, cellY: 7 }]);
    const blockedBoundary = derivePlacementPreviewBoundaryState(blockedPreview);
    expect(shouldEmitPlacementPreviewShown(boundaryA, blockedBoundary)).toBe(true);
  });
});