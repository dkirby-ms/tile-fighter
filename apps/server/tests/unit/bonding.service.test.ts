import { describe, expect, it } from "vitest";
import { BondEvaluatorService } from "../../src/domain/bond-evaluator.service.js";

describe("BondEvaluatorService bonding", () => {
  it("returns deterministic bond types for repeated neighborhood recompute input", () => {
    const service = new BondEvaluatorService();

    const tiles = [
      { regionId: "arena-main", cellX: 0, cellY: 0, color: "red" },
      { regionId: "arena-main", cellX: 1, cellY: 0, color: "red" },
      { regionId: "arena-main", cellX: 0, cellY: 1, color: "red" },
      { regionId: "arena-main", cellX: 4, cellY: 4, color: "blue" }
    ];

    const first = service.recomputeNeighborhood({
      regionId: "arena-main",
      originCellX: 0,
      originCellY: 0,
      tiles
    });

    const second = service.recomputeNeighborhood({
      regionId: "arena-main",
      originCellX: 0,
      originCellY: 0,
      tiles
    });

    expect(second).toEqual(first);
    expect(first.bondCount).toBeGreaterThan(0);
    expect(new Set(first.bonds.map((bond) => bond.bondType)).size).toBeGreaterThanOrEqual(1);
  });

  it("canonicalizes bond identifiers for symmetric adjacency", () => {
    const service = new BondEvaluatorService();

    const tiles = [
      { regionId: "arena-main", cellX: 5, cellY: 7, color: "green" },
      { regionId: "arena-main", cellX: 6, cellY: 7, color: "green" }
    ];

    const recompute = service.recomputeNeighborhood({
      regionId: "arena-main",
      originCellX: 5,
      originCellY: 7,
      tiles
    });

    expect(recompute.bonds).toHaveLength(1);
    expect(recompute.bonds[0]?.bondId).toBe("arena-main:5:7:6:7");
  });
});
