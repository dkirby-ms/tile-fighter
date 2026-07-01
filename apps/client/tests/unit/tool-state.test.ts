import { describe, expect, it } from "vitest";
import {
  createInitialCreatorToolState,
  reduceCreatorToolState,
  reduceCreatorToolStateWithMeta,
  type CreatorToolState
} from "../../src/creator/tool-state.js";

function applyActions(
  state: CreatorToolState,
  actions: Parameters<typeof reduceCreatorToolState>[1][]
): CreatorToolState {
  return actions.reduce((current, action) => reduceCreatorToolState(current, action), state);
}

describe("creator tool-state reducer", () => {
  it("applies deterministic palette open/close/toggle transitions", () => {
    const initial = createInitialCreatorToolState();

    const opened = reduceCreatorToolState(initial, { type: "creator/paletteOpened" });
    expect(opened.paletteVisible).toBe(true);

    const closed = reduceCreatorToolState(opened, { type: "creator/paletteClosed" });
    expect(closed.paletteVisible).toBe(false);

    const toggled = reduceCreatorToolState(closed, { type: "creator/paletteToggled" });
    expect(toggled.paletteVisible).toBe(true);

    const toggledAgain = reduceCreatorToolState(toggled, { type: "creator/paletteToggled" });
    expect(toggledAgain.paletteVisible).toBe(false);
  });

  it("applies shape and color selections only when values are allowed", () => {
    const initial = createInitialCreatorToolState({
      shapes: ["square", "triangle"],
      colors: ["red", "blue"]
    });

    const selected = applyActions(initial, [
      { type: "creator/shapeSelected", shape: "square" },
      { type: "creator/colorSelected", color: "blue" }
    ]);

    expect(selected.selectedShape).toBe("square");
    expect(selected.selectedColor).toBe("blue");

    const unchanged = applyActions(selected, [
      { type: "creator/shapeSelected", shape: "hexagon" },
      { type: "creator/colorSelected", color: "purple" }
    ]);

    expect(unchanged).toEqual(selected);
  });

  it("updates and clears hover target with integer coordinate validation", () => {
    const initial = createInitialCreatorToolState();

    const hovered = reduceCreatorToolState(initial, {
      type: "creator/hoverTargetSet",
      targetCell: { cellX: 5, cellY: 9 }
    });
    expect(hovered.hoveredTargetCell).toEqual({ cellX: 5, cellY: 9 });

    const invalidHover = reduceCreatorToolState(hovered, {
      type: "creator/hoverTargetSet",
      targetCell: { cellX: 1.25, cellY: 9 }
    });
    expect(invalidHover.hoveredTargetCell).toBeNull();

    const cleared = reduceCreatorToolState(hovered, { type: "creator/hoverTargetCleared" });
    expect(cleared.hoveredTargetCell).toBeNull();
  });

  it("applies preview blocked flag deterministically", () => {
    const initial = createInitialCreatorToolState();

    const blocked = reduceCreatorToolState(initial, {
      type: "creator/previewBlockedSet",
      isBlocked: true
    });
    expect(blocked.isPreviewBlocked).toBe(true);

    const unblocked = reduceCreatorToolState(blocked, {
      type: "creator/previewBlockedSet",
      isBlocked: false
    });
    expect(unblocked.isPreviewBlocked).toBe(false);
  });

  it("tracks optimistic placement pending state and clears it", () => {
    const initial = createInitialCreatorToolState();

    const pending = reduceCreatorToolState(initial, {
      type: "creator/optimisticPlacementStarted",
      pending: {
        commandId: "cmd_1234567890",
        targetCell: { cellX: 2, cellY: 3 }
      }
    });

    expect(pending.optimisticPlacementStatus).toBe("pending");
    expect(pending.pendingPlacement).toEqual({
      commandId: "cmd_1234567890",
      targetCell: { cellX: 2, cellY: 3 },
      awaitingAck: true
    });

    const cleared = reduceCreatorToolState(pending, {
      type: "creator/optimisticPlacementCleared"
    });
    expect(cleared.optimisticPlacementStatus).toBe("idle");
    expect(cleared.pendingPlacement).toBeNull();
  });

  it("rejects invalid optimistic pending input", () => {
    const initial = createInitialCreatorToolState();

    const invalidCommand = reduceCreatorToolState(initial, {
      type: "creator/optimisticPlacementStarted",
      pending: {
        commandId: "   ",
        targetCell: { cellX: 1, cellY: 2 }
      }
    });
    expect(invalidCommand).toEqual(initial);

    const invalidCell = reduceCreatorToolState(initial, {
      type: "creator/optimisticPlacementStarted",
      pending: {
        commandId: "cmd_abc",
        targetCell: { cellX: 1.5, cellY: 2 }
      }
    });
    expect(invalidCell).toEqual(initial);
  });

  it("supports ack-preferred clear and command-id matching semantics", () => {
    const started = reduceCreatorToolState(createInitialCreatorToolState(), {
      type: "creator/optimisticPlacementStarted",
      pending: {
        commandId: "cmd_match_123456",
        targetCell: { cellX: 8, cellY: 9 }
      }
    });

    const unchanged = reduceCreatorToolState(started, {
      type: "creator/optimisticPlacementAckObserved",
      commandId: "cmd_other_123456"
    });
    expect(unchanged).toEqual(started);

    const cleared = reduceCreatorToolState(started, {
      type: "creator/optimisticPlacementAckObserved",
      commandId: "cmd_match_123456"
    });
    expect(cleared.optimisticPlacementStatus).toBe("idle");
    expect(cleared.pendingPlacement).toBeNull();
  });

  it("clears pending placement on terminal failure for matching command", () => {
    const started = reduceCreatorToolState(createInitialCreatorToolState(), {
      type: "creator/optimisticPlacementStarted",
      pending: {
        commandId: "cmd_terminal_1234",
        targetCell: { cellX: 4, cellY: 5 }
      }
    });

    const cleared = reduceCreatorToolState(started, {
      type: "creator/optimisticPlacementTerminalFailed",
      commandId: "cmd_terminal_1234"
    });

    expect(cleared.optimisticPlacementStatus).toBe("idle");
    expect(cleared.pendingPlacement).toBeNull();
  });

  it("emits deterministic transition metadata for telemetry hooks", () => {
    const initial = createInitialCreatorToolState();

    const opened = reduceCreatorToolStateWithMeta(initial, {
      type: "creator/paletteOpened"
    });
    expect(opened.metadata).toEqual([{ event: "palette_opened" }]);

    const shape = reduceCreatorToolStateWithMeta(opened.state, {
      type: "creator/shapeSelected",
      shape: "square"
    });
    expect(shape.metadata).toEqual([{ event: "shape_selected" }]);

    const color = reduceCreatorToolStateWithMeta(shape.state, {
      type: "creator/colorSelected",
      color: "red"
    });
    expect(color.metadata).toEqual([{ event: "color_selected" }]);
  });

  it("reconfigures palette and clears selections when no longer valid", () => {
    const initial = applyActions(createInitialCreatorToolState(), [
      { type: "creator/shapeSelected", shape: "square" },
      { type: "creator/colorSelected", color: "red" }
    ]);

    const reconfigured = reduceCreatorToolState(initial, {
      type: "creator/paletteConfigured",
      palette: {
        shapes: ["triangle"],
        colors: ["blue"]
      }
    });

    expect(reconfigured.allowedShapes).toEqual(["triangle"]);
    expect(reconfigured.allowedColors).toEqual(["blue"]);
    expect(reconfigured.selectedShape).toBeNull();
    expect(reconfigured.selectedColor).toBeNull();
  });
});