export type BondType = "glow-chain" | "blend-gradient" | "pulse-rhythm";

export type BondEvaluationTile = {
  cellX: number;
  cellY: number;
  color: string;
};

const ORTHOGONAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

function compareTiles(a: BondEvaluationTile, b: BondEvaluationTile): number {
  if (a.cellY !== b.cellY) {
    return a.cellY - b.cellY;
  }

  if (a.cellX !== b.cellX) {
    return a.cellX - b.cellX;
  }

  return a.color.localeCompare(b.color);
}

function isValidTile(tile: BondEvaluationTile): boolean {
  return Number.isInteger(tile.cellX) && Number.isInteger(tile.cellY) && tile.color.length > 0;
}

function toTileMap(
  tiles: readonly BondEvaluationTile[]
): Map<string, BondEvaluationTile> {
  const map = new Map<string, BondEvaluationTile>();

  for (const tile of tiles) {
    map.set(`${tile.cellX}:${tile.cellY}`, tile);
  }

  return map;
}

function getOrthogonalNeighbors(
  placedTile: BondEvaluationTile,
  tileMap: ReadonlyMap<string, BondEvaluationTile>
): BondEvaluationTile[] {
  const neighbors: BondEvaluationTile[] = [];

  for (const [offsetX, offsetY] of ORTHOGONAL_OFFSETS) {
    const neighbor = tileMap.get(`${placedTile.cellX + offsetX}:${placedTile.cellY + offsetY}`);
    if (neighbor) {
      neighbors.push(neighbor);
    }
  }

  return neighbors;
}

function hasPulseRhythmPattern(
  placedTile: BondEvaluationTile,
  tileMap: ReadonlyMap<string, BondEvaluationTile>
): boolean {
  const left = tileMap.get(`${placedTile.cellX - 1}:${placedTile.cellY}`);
  const right = tileMap.get(`${placedTile.cellX + 1}:${placedTile.cellY}`);

  if (left && right && left.color === right.color && left.color !== placedTile.color) {
    return true;
  }

  const up = tileMap.get(`${placedTile.cellX}:${placedTile.cellY - 1}`);
  const down = tileMap.get(`${placedTile.cellX}:${placedTile.cellY + 1}`);

  return Boolean(up && down && up.color === down.color && up.color !== placedTile.color);
}

export function evaluateBondType(
  placedTile: BondEvaluationTile,
  localWindow: readonly BondEvaluationTile[]
): BondType | null {
  if (!isValidTile(placedTile)) {
    return null;
  }

  const canonicalWindow = localWindow
    .filter((tile) =>
      isValidTile(tile) && !(tile.cellX === placedTile.cellX && tile.cellY === placedTile.cellY)
    )
    .slice()
    .sort(compareTiles);

  const tileMap = toTileMap(canonicalWindow);
  const orthogonalNeighbors = getOrthogonalNeighbors(placedTile, tileMap);

  if (orthogonalNeighbors.some((neighbor) => neighbor.color === placedTile.color)) {
    return "glow-chain";
  }

  if (hasPulseRhythmPattern(placedTile, tileMap)) {
    return "pulse-rhythm";
  }

  const distinctColors = new Set<string>([placedTile.color]);
  for (const neighbor of orthogonalNeighbors) {
    distinctColors.add(neighbor.color);
  }

  if (
    orthogonalNeighbors.some((neighbor) => neighbor.color !== placedTile.color) &&
    distinctColors.size === 2
  ) {
    return "blend-gradient";
  }

  return null;
}
