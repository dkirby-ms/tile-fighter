import { describe, expect, it } from "vitest";
import {
  CreatorTelemetryAdapter,
  derivePlacementPreview,
  derivePlacementPreviewBoundaryState,
  type CreatorTelemetryEvent,
  reduceCreatorToolStateWithMeta,
  shouldEmitPlacementPreviewShown,
  type CreatorToolState
} from "../../src/index.js";

function apply(
  state: CreatorToolState,
  action: Parameters<typeof reduceCreatorToolStateWithMeta>[1],
  telemetry: CreatorTelemetryAdapter
): CreatorToolState {
  const transition = reduceCreatorToolStateWithMeta(state, action);
  for (const meta of transition.metadata) {
    telemetry.emitTransition({
      actionType: action.type,
      paletteVisible: transition.state.paletteVisible,
      selectedShape: transition.state.selectedShape,
      selectedColor: transition.state.selectedColor
    });
  }
  return transition.state;
}

describe("E5-S1 placement flow integration", () => {
  it("emits required transition and preview telemetry once per deterministic boundary", () => {
    const events: CreatorTelemetryEvent[] = [];
    const telemetry = new CreatorTelemetryAdapter(
      {
        emit: (event) => events.push(event)
      },
      { now: () => 123 }
    );

    let state: CreatorToolState = {
      paletteVisible: false,
      selectedShape: null,
      selectedColor: null,
      hoveredTargetCell: null,
      isPreviewBlocked: false,
      optimisticPlacementStatus: "idle",
      pendingPlacement: null,
      allowedShapes: ["square", "triangle"],
      allowedColors: ["red", "blue"]
    };

    state = apply(state, { type: "creator/paletteOpened" }, telemetry);
    state = apply(state, { type: "creator/shapeSelected", shape: "square" }, telemetry);
    state = apply(state, { type: "creator/colorSelected", color: "red" }, telemetry);
    state = apply(state, { type: "creator/hoverTargetSet", targetCell: { cellX: 4, cellY: 7 } }, telemetry);

    const preview = derivePlacementPreview(state, []);
    const boundary = derivePlacementPreviewBoundaryState(preview);
    if (shouldEmitPlacementPreviewShown(null, boundary) && preview.targetCell) {
      telemetry.emitPlacementPreviewShown({
        status: preview.status,
        blocked: preview.status === "blocked",
        cellX: preview.targetCell.cellX,
        cellY: preview.targetCell.cellY
      });
    }

    const names = events.map((event) => event.name);
    expect(names).toEqual([
      "palette_opened",
      "shape_selected",
      "color_selected",
      "placement_preview_shown"
    ]);

    expect(events[3]?.payload).toEqual({
      status: "ready",
      blocked: false,
      cellx: 4,
      celly: 7
    });
  });

  it("uses ack-preferred optimistic clear policy by command match", () => {
    const initial: CreatorToolState = {
      paletteVisible: true,
      selectedShape: "square",
      selectedColor: "red",
      hoveredTargetCell: { cellX: 8, cellY: 2 },
      isPreviewBlocked: false,
      optimisticPlacementStatus: "idle",
      pendingPlacement: null,
      allowedShapes: ["square"],
      allowedColors: ["red"]
    };

    const started = reduceCreatorToolStateWithMeta(initial, {
      type: "creator/optimisticPlacementStarted",
      pending: {
        commandId: "cmd_ack_123456789",
        targetCell: { cellX: 8, cellY: 2 }
      }
    }).state;

    const ackCleared = reduceCreatorToolStateWithMeta(started, {
      type: "creator/optimisticPlacementAckObserved",
      commandId: "cmd_ack_123456789"
    }).state;

    expect(ackCleared.optimisticPlacementStatus).toBe("idle");
    expect(ackCleared.pendingPlacement).toBeNull();

    const idempotentAfterAck = reduceCreatorToolStateWithMeta(ackCleared, {
      type: "creator/optimisticPlacementTerminalFailed",
      commandId: "cmd_ack_123456789"
    }).state;

    expect(idempotentAfterAck).toEqual(ackCleared);
  });
});
