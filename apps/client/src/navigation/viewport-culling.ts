import { type RegionDiffViewport } from "@game/shared-types";

export interface TileBounds {
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
}

export interface CullableTile {
  cellX: number;
  cellY: number;
  spanWidth?: number;
  spanHeight?: number;
}

function toFiniteInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeViewport(viewport: RegionDiffViewport): TileBounds {
  const minCellX = toFiniteInteger(viewport.minCellX, 0);
  const maxCellX = toFiniteInteger(viewport.maxCellX, minCellX);
  const minCellY = toFiniteInteger(viewport.minCellY, 0);
  const maxCellY = toFiniteInteger(viewport.maxCellY, minCellY);

  return {
    minCellX: Math.min(minCellX, maxCellX),
    maxCellX: Math.max(minCellX, maxCellX),
    minCellY: Math.min(minCellY, maxCellY),
    maxCellY: Math.max(minCellY, maxCellY)
  };
}

function normalizeTileBounds(tile: CullableTile): TileBounds {
  const cellX = toFiniteInteger(tile.cellX, 0);
  const cellY = toFiniteInteger(tile.cellY, 0);
  const width = Math.max(1, toFiniteInteger(tile.spanWidth ?? 1, 1));
  const height = Math.max(1, toFiniteInteger(tile.spanHeight ?? 1, 1));

  return {
    minCellX: cellX,
    maxCellX: cellX + width - 1,
    minCellY: cellY,
    maxCellY: cellY + height - 1
  };
}

function intersects(left: TileBounds, right: TileBounds): boolean {
  return (
    left.minCellX <= right.maxCellX &&
    left.maxCellX >= right.minCellX &&
    left.minCellY <= right.maxCellY &&
    left.maxCellY >= right.minCellY
  );
}

export function deriveVisibleTiles<TTile extends CullableTile>(
  tiles: readonly TTile[],
  viewport: RegionDiffViewport
): TTile[] {
  const normalizedViewport = normalizeViewport(viewport);
  return tiles.filter((tile) => intersects(normalizeTileBounds(tile), normalizedViewport));
}