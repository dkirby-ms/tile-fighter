import { BondOutcome, BondType, type BondNeighborhoodRecomputeResult } from "@game/shared-types";

export type BondCandidateTile = {
  regionId: string;
  cellX: number;
  cellY: number;
  color: string;
};

export type BondRecomputeInput = {
  regionId: string;
  originCellX: number;
  originCellY: number;
  tiles: BondCandidateTile[];
};

type NeighborDirection = "north" | "east" | "south" | "west";

type GridCoordinate = {
  cellX: number;
  cellY: number;
};

const ORTHOGONAL_DIRECTIONS: ReadonlyArray<{
  direction: NeighborDirection;
  deltaX: number;
  deltaY: number;
}> = [
  { direction: "north", deltaX: 0, deltaY: -1 },
  { direction: "east", deltaX: 1, deltaY: 0 },
  { direction: "south", deltaX: 0, deltaY: 1 },
  { direction: "west", deltaX: -1, deltaY: 0 }
];

function toCoordinateKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}

function canonicalEdge(
  fromCellX: number,
  fromCellY: number,
  toCellX: number,
  toCellY: number
): { fromCellX: number; fromCellY: number; toCellX: number; toCellY: number } {
  if (fromCellX < toCellX) {
    return { fromCellX, fromCellY, toCellX, toCellY };
  }

  if (fromCellX > toCellX) {
    return {
      fromCellX: toCellX,
      fromCellY: toCellY,
      toCellX: fromCellX,
      toCellY: fromCellY
    };
  }

  if (fromCellY <= toCellY) {
    return { fromCellX, fromCellY, toCellX, toCellY };
  }

  return {
    fromCellX: toCellX,
    fromCellY: toCellY,
    toCellX: fromCellX,
    toCellY: fromCellY
  };
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function deriveBondType(seedInput: string): BondType {
  const hash = stableHash(seedInput);
  const bucket = hash % 3;

  if (bucket === 0) {
    return "glow_chain";
  }

  if (bucket === 1) {
    return "blend_gradient";
  }

  return "pulse_rhythm";
}

function isTouchedCoordinate(
  coordinate: GridCoordinate,
  originCellX: number,
  originCellY: number
): boolean {
  const deltaX = Math.abs(coordinate.cellX - originCellX);
  const deltaY = Math.abs(coordinate.cellY - originCellY);
  return deltaX + deltaY <= 1;
}

export class BondEvaluatorService {
  recomputeNeighborhood(input: BondRecomputeInput): BondNeighborhoodRecomputeResult {
    const tileByCoordinate = new Map<string, BondCandidateTile>();
    for (const tile of input.tiles) {
      if (tile.regionId !== input.regionId) {
        continue;
      }
      tileByCoordinate.set(toCoordinateKey(tile.cellX, tile.cellY), tile);
    }

    const touchedCoordinates: GridCoordinate[] = [
      { cellX: input.originCellX, cellY: input.originCellY },
      { cellX: input.originCellX - 1, cellY: input.originCellY },
      { cellX: input.originCellX + 1, cellY: input.originCellY },
      { cellX: input.originCellX, cellY: input.originCellY - 1 },
      { cellX: input.originCellX, cellY: input.originCellY + 1 }
    ];

    const bondsById = new Map<string, BondOutcome>();
    let recalculatedCellCount = 0;
    let skippedCellCount = 0;

    for (const coordinate of touchedCoordinates) {
      const tile = tileByCoordinate.get(toCoordinateKey(coordinate.cellX, coordinate.cellY));
      if (!tile) {
        skippedCellCount += 1;
        continue;
      }

      recalculatedCellCount += 1;

      for (const neighbor of ORTHOGONAL_DIRECTIONS) {
        const adjacentTile = tileByCoordinate.get(
          toCoordinateKey(coordinate.cellX + neighbor.deltaX, coordinate.cellY + neighbor.deltaY)
        );

        if (!adjacentTile || adjacentTile.color !== tile.color) {
          continue;
        }

        const canonical = canonicalEdge(
          coordinate.cellX,
          coordinate.cellY,
          adjacentTile.cellX,
          adjacentTile.cellY
        );
        const bondId = `${input.regionId}:${canonical.fromCellX}:${canonical.fromCellY}:${canonical.toCellX}:${canonical.toCellY}`;

        const bondSeed = `${bondId}:${tile.color}`;

        bondsById.set(bondId, {
          bondId,
          regionId: input.regionId,
          fromCellX: canonical.fromCellX,
          fromCellY: canonical.fromCellY,
          toCellX: canonical.toCellX,
          toCellY: canonical.toCellY,
          color: tile.color,
          bondType: deriveBondType(bondSeed)
        });
      }
    }

    const bonds = Array.from(bondsById.values()).sort((left, right) => {
      if (left.fromCellX !== right.fromCellX) {
        return left.fromCellX - right.fromCellX;
      }

      if (left.fromCellY !== right.fromCellY) {
        return left.fromCellY - right.fromCellY;
      }

      if (left.toCellX !== right.toCellX) {
        return left.toCellX - right.toCellX;
      }

      if (left.toCellY !== right.toCellY) {
        return left.toCellY - right.toCellY;
      }

      return left.bondType.localeCompare(right.bondType);
    });

    const touchedCellCount = touchedCoordinates.length;
    if (recalculatedCellCount + skippedCellCount !== touchedCellCount) {
      throw new Error("Bond neighborhood recompute accounting mismatch");
    }

    const touchedBonds = bonds.filter((bond) =>
      isTouchedCoordinate({ cellX: bond.fromCellX, cellY: bond.fromCellY }, input.originCellX, input.originCellY) ||
      isTouchedCoordinate({ cellX: bond.toCellX, cellY: bond.toCellY }, input.originCellX, input.originCellY)
    );

    return {
      regionId: input.regionId,
      originCellX: input.originCellX,
      originCellY: input.originCellY,
      touchedCellCount,
      recalculatedCellCount,
      skippedCellCount,
      bondCount: touchedBonds.length,
      bonds: touchedBonds
    };
  }
}

export function createBondEvaluatorService(): BondEvaluatorService {
  return new BondEvaluatorService();
}
