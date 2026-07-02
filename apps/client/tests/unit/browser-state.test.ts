import { describe, expect, it } from "vitest";
import {
  addOptimisticTile,
  applyRealtimeDelta,
  computeViewportTileBounds,
  createInitialBrowserAppState,
  recomputeBonds,
  updateViewport,
  withAppState
} from "../../src/browser/state.js";

describe("browser state projection", () => {
  it("applies delta deterministically and clears optimistic key on ack", () => {
    let state = createInitialBrowserAppState();
    state = addOptimisticTile(state, {
      cellX: 1,
      cellY: 2,
      shape: "square",
      color: "orange"
    });

    expect(state.optimisticTileKeys).toContain("1:2");

    state = applyRealtimeDelta(state, {
      sequenceId: "101",
      regionId: "arena",
      cellX: 1,
      cellY: 2,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "orange",
      stylePayload: {},
      ownerId: "self",
      sentAt: new Date().toISOString(),
      retransmitAttempt: 0
    });

    expect(state.optimisticTileKeys).not.toContain("1:2");
    expect(state.tiles["1:2"]?.optimistic).toBe(false);
    expect(state.lastAppliedSequenceId).toBe("101");
  });

  it("computes deterministic bond ids and bond types from adjacent matching tiles", () => {
    let state = createInitialBrowserAppState();
    state = applyRealtimeDelta(state, {
      sequenceId: "1",
      regionId: "arena",
      cellX: 0,
      cellY: 0,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "blue",
      stylePayload: {},
      ownerId: "a",
      sentAt: new Date().toISOString(),
      retransmitAttempt: 0
    });
    state = applyRealtimeDelta(state, {
      sequenceId: "2",
      regionId: "arena",
      cellX: 1,
      cellY: 0,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "blue",
      stylePayload: {},
      ownerId: "b",
      sentAt: new Date().toISOString(),
      retransmitAttempt: 0
    });

    const bondIds = Object.keys(state.bonds);
    expect(bondIds).toHaveLength(1);

    const bond = state.bonds[bondIds[0] as string];
    expect(bond?.bondId).toBe("arena:0:0:1:0");
    expect(["glow_chain", "blend_gradient", "pulse_rhythm"]).toContain(bond?.bondType);
  });

  it("viewport bounds respond to pan and zoom deterministically", () => {
    let state = createInitialBrowserAppState();
    const defaultBounds = computeViewportTileBounds(state);

    state = updateViewport(state, {
      panX: 224,
      panY: -112,
      zoom: 2
    });
    const movedBounds = computeViewportTileBounds(state);

    expect(movedBounds.minCellX).toBeGreaterThan(defaultBounds.minCellX);
    expect(movedBounds.maxCellY).toBeLessThan(defaultBounds.maxCellY);
  });

  it("does not create bonds against optimistic-only tiles", () => {
    let state = createInitialBrowserAppState();
    state = withAppState(state, {
      tiles: {
        "0:0": {
          cellX: 0,
          cellY: 0,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "teal",
          ownerId: "owner-a",
          version: 1,
          optimistic: false
        },
        "1:0": {
          cellX: 1,
          cellY: 0,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "teal",
          ownerId: "owner-self",
          version: Number.MAX_SAFE_INTEGER,
          optimistic: true
        }
      }
    });

    state = recomputeBonds(state);
    expect(Object.keys(state.bonds)).toHaveLength(0);
  });
});
