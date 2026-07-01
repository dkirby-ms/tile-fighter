import { describe, expect, it } from "vitest";
import { evaluateBondType, type BondEvaluationTile } from "@game/shared-types";

function tile(cellX: number, cellY: number, color: string): BondEvaluationTile {
  return { cellX, cellY, color };
}

describe("bonding evaluator", () => {
  it("returns glow-chain when an orthogonal same-color neighbor exists", () => {
    const placed = tile(10, 10, "cyan");
    const localWindow = [
      tile(11, 10, "cyan"),
      tile(10, 11, "magenta")
    ];

    const result = evaluateBondType(placed, localWindow);

    expect(result).toBe("glow-chain");
  });

  it("returns blend-gradient for exactly two colors across orthogonal neighbors", () => {
    const placed = tile(4, 4, "orange");
    const localWindow = [
      tile(3, 4, "teal"),
      tile(4, 3, "teal"),
      tile(5, 5, "teal")
    ];

    const result = evaluateBondType(placed, localWindow);

    expect(result).toBe("blend-gradient");
  });

  it("returns pulse-rhythm for alternating pair patterns", () => {
    const placed = tile(8, 8, "amber");
    const localWindow = [
      tile(7, 8, "violet"),
      tile(9, 8, "violet")
    ];

    const result = evaluateBondType(placed, localWindow);

    expect(result).toBe("pulse-rhythm");
  });

  it("is deterministic under equivalent reorderings", () => {
    const placed = tile(20, 30, "red");
    const canonicalWindow = [
      tile(19, 30, "blue"),
      tile(21, 30, "blue"),
      tile(20, 29, "green"),
      tile(20, 31, "green")
    ];

    const baseline = evaluateBondType(placed, canonicalWindow);
    expect(baseline).toBe("pulse-rhythm");

    const permutations: BondEvaluationTile[][] = [
      [canonicalWindow[3], canonicalWindow[2], canonicalWindow[1], canonicalWindow[0]],
      [canonicalWindow[1], canonicalWindow[3], canonicalWindow[0], canonicalWindow[2]],
      [canonicalWindow[2], canonicalWindow[0], canonicalWindow[3], canonicalWindow[1]],
      [canonicalWindow[0], canonicalWindow[2], canonicalWindow[1], canonicalWindow[3]],
      [canonicalWindow[1], canonicalWindow[0], canonicalWindow[2], canonicalWindow[3]],
      [canonicalWindow[3], canonicalWindow[1], canonicalWindow[2], canonicalWindow[0]]
    ];

    for (const localWindow of permutations) {
      expect(evaluateBondType(placed, localWindow)).toBe(baseline);
    }
  });
});
