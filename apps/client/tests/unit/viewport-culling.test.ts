import { describe, expect, it } from "vitest";
import { deriveVisibleTiles } from "../../src/navigation/viewport-culling.js";

describe("viewport-culling", () => {
  it("excludes tiles fully outside viewport", () => {
    const tiles = [
      { id: "inside", cellX: 5, cellY: 5 },
      { id: "outside-left", cellX: -1, cellY: 5 },
      { id: "outside-bottom", cellX: 5, cellY: 20 }
    ] as const;

    const visible = deriveVisibleTiles(tiles, {
      minCellX: 0,
      maxCellX: 10,
      minCellY: 0,
      maxCellY: 10
    });

    expect(visible.map((tile) => tile.id)).toEqual(["inside"]);
  });

  it("includes tiles intersecting viewport edges", () => {
    const tiles = [
      { id: "edge-touch", cellX: 10, cellY: 0 },
      { id: "spanning", cellX: 9, cellY: 9, spanWidth: 2, spanHeight: 2 },
      { id: "outside", cellX: 11, cellY: 11 }
    ] as const;

    const visible = deriveVisibleTiles(tiles, {
      minCellX: 0,
      maxCellX: 10,
      minCellY: 0,
      maxCellY: 10
    });

    expect(visible.map((tile) => tile.id)).toEqual(["edge-touch", "spanning"]);
  });

  it("is deterministic across repeated runs", () => {
    const tiles = [
      { id: "a", cellX: 1, cellY: 1 },
      { id: "b", cellX: 8, cellY: 8, spanWidth: 3, spanHeight: 3 },
      { id: "c", cellX: 20, cellY: 20 }
    ] as const;
    const viewport = {
      minCellX: 0,
      maxCellX: 10,
      minCellY: 0,
      maxCellY: 10
    };

    const first = deriveVisibleTiles(tiles, viewport);
    const second = deriveVisibleTiles(tiles, viewport);

    expect(first).toEqual(second);
  });
});