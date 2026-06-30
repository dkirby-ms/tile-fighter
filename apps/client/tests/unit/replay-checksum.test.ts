import { describe, expect, it } from "vitest";
import {
  applyReplayAndValidateChecksum,
  computeFullRegionCanonicalChecksum,
  ReplayChecksumError,
  type ReplayTileState
} from "../../src/session/replay-checksum.js";
import type { ReplayDelta } from "../../src/session/reconnect-caller.js";

const REGION_ID = "arena";

describe("replay-checksum", () => {
  it("applies ordered replay deltas and matches full-region canonical checksum", () => {
    const initialTiles: ReplayTileState[] = [
      {
        regionId: REGION_ID,
        cellX: 0,
        cellY: 0,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "red",
        stylePayload: { z: 2, a: 1 },
        ownerId: "p1"
      }
    ];

    const deltas: ReplayDelta[] = [
      {
        cellX: 1,
        cellY: 0,
        version: 6,
        operation: "upsert",
        offsetX: 0.1,
        offsetY: 0.2,
        shape: "diamond",
        color: "blue",
        stylePayload: { b: 2, a: 1 },
        ownerId: "p2"
      },
      {
        cellX: 0,
        cellY: 0,
        version: 7,
        operation: "delete",
        offsetX: null,
        offsetY: null,
        shape: null,
        color: null,
        stylePayload: null,
        ownerId: null
      }
    ];

    const expectedTiles: ReplayTileState[] = [
      {
        regionId: REGION_ID,
        cellX: 1,
        cellY: 0,
        offsetX: 0.1,
        offsetY: 0.2,
        shape: "diamond",
        color: "blue",
        stylePayload: { a: 1, b: 2 },
        ownerId: "p2"
      }
    ];

    const serverChecksum = computeFullRegionCanonicalChecksum(expectedTiles);

    const result = applyReplayAndValidateChecksum({
      regionId: REGION_ID,
      initialTiles,
      deltas,
      expectedScope: "full_region_canonical",
      serverChecksum
    });

    expect(result.match).toBe(true);
    expect(result.clientChecksum).toBe(serverChecksum);
    expect(result.tileCount).toBe(1);
    expect(result.appliedVersion).toBe(7);
  });

  it("detects checksum mismatch after replay apply", () => {
    const initialTiles: ReplayTileState[] = [];
    const deltas: ReplayDelta[] = [
      {
        cellX: 2,
        cellY: 2,
        version: 10,
        operation: "upsert",
        offsetX: 0,
        offsetY: 0,
        shape: "triangle",
        color: "green",
        stylePayload: { glow: true },
        ownerId: "p3"
      }
    ];

    const result = applyReplayAndValidateChecksum({
      regionId: REGION_ID,
      initialTiles,
      deltas,
      expectedScope: "full_region_canonical",
      serverChecksum: "deadbeef"
    });

    expect(result.match).toBe(false);
    expect(result.clientChecksum).not.toBe("deadbeef");
  });

  it("throws on invalid upsert payload", () => {
    const deltas: ReplayDelta[] = [
      {
        cellX: 3,
        cellY: 4,
        version: 2,
        operation: "upsert",
        offsetX: null,
        offsetY: 0,
        shape: "circle",
        color: "yellow",
        stylePayload: null,
        ownerId: "p4"
      }
    ];

    expect(() =>
      applyReplayAndValidateChecksum({
        regionId: REGION_ID,
        initialTiles: [],
        deltas,
        expectedScope: "full_region_canonical",
        serverChecksum: "any"
      })
    ).toThrow(ReplayChecksumError);
  });

  it("is deterministic for different input orderings", () => {
    const rowsA: ReplayTileState[] = [
      {
        regionId: REGION_ID,
        cellX: 2,
        cellY: 1,
        offsetX: 0,
        offsetY: 0,
        shape: "hex",
        color: "white",
        stylePayload: { y: 2, x: 1 },
        ownerId: "p9"
      },
      {
        regionId: REGION_ID,
        cellX: 1,
        cellY: 1,
        offsetX: 0,
        offsetY: 0,
        shape: "hex",
        color: "white",
        stylePayload: { x: 1, y: 2 },
        ownerId: "p8"
      }
    ];

    const rowsB = [rowsA[1], rowsA[0]];

    expect(computeFullRegionCanonicalChecksum(rowsA)).toBe(
      computeFullRegionCanonicalChecksum(rowsB)
    );
  });
});
