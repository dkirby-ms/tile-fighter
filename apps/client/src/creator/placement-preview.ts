import type { CreatorToolState } from "./tool-state.js";

export type PlacementPreviewStatus = "ready" | "blocked" | "invalid-input";

export interface PlacementOccupancyCell {
  cellX: number;
  cellY: number;
}

export interface PlacementPreviewResult {
  status: PlacementPreviewStatus;
  targetCell: PlacementOccupancyCell | null;
  reasons: readonly string[];
}

export interface PlacementPreviewBoundaryState {
  status: PlacementPreviewStatus;
  targetCellKey: string | null;
}

function buildCellKey(cellX: number, cellY: number): string {
  return `${cellX},${cellY}`;
}

function isValidCellCoordinate(value: number): boolean {
  return Number.isInteger(value);
}

function isValidOccupancyCell(value: PlacementOccupancyCell): boolean {
  return isValidCellCoordinate(value.cellX) && isValidCellCoordinate(value.cellY);
}

export function deriveOccupancyLookup(
  occupiedCells: readonly PlacementOccupancyCell[]
): ReadonlySet<string> {
  const occupied = new Set<string>();

  for (const cell of occupiedCells) {
    if (!isValidOccupancyCell(cell)) {
      continue;
    }

    occupied.add(buildCellKey(cell.cellX, cell.cellY));
  }

  return occupied;
}

export function derivePlacementPreview(
  toolState: CreatorToolState,
  occupiedCells: readonly PlacementOccupancyCell[] | ReadonlySet<string>
): PlacementPreviewResult {
  const reasons: string[] = [];

  const targetCell = toolState.hoveredTargetCell;
  const hasValidTargetCell = targetCell !== null && isValidOccupancyCell(targetCell);
  if (!hasValidTargetCell) {
    reasons.push("invalid-target-cell");
  }

  const selectedShape = toolState.selectedShape;
  if (
    !selectedShape ||
    selectedShape.trim().length === 0 ||
    !toolState.allowedShapes.includes(selectedShape)
  ) {
    reasons.push("invalid-shape");
  }

  const selectedColor = toolState.selectedColor;
  if (
    !selectedColor ||
    selectedColor.trim().length === 0 ||
    !toolState.allowedColors.includes(selectedColor)
  ) {
    reasons.push("invalid-color");
  }

  if (reasons.length > 0) {
    return {
      status: "invalid-input",
      targetCell: targetCell ?? null,
      reasons
    };
  }

  const occupiedLookup: ReadonlySet<string> =
    occupiedCells instanceof Set
      ? occupiedCells
      : deriveOccupancyLookup(occupiedCells as readonly PlacementOccupancyCell[]);
  const readyTargetCell = targetCell as PlacementOccupancyCell;
  const isOccupied = occupiedLookup.has(buildCellKey(readyTargetCell.cellX, readyTargetCell.cellY));

  if (toolState.isPreviewBlocked || isOccupied) {
    return {
      status: "blocked",
      targetCell: readyTargetCell,
      reasons: ["occupied-target-cell"]
    };
  }

  return {
    status: "ready",
    targetCell: readyTargetCell,
    reasons: []
  };
}

export function derivePlacementPreviewBoundaryState(
  preview: PlacementPreviewResult
): PlacementPreviewBoundaryState {
  return {
    status: preview.status,
    targetCellKey:
      preview.targetCell !== null
        ? buildCellKey(preview.targetCell.cellX, preview.targetCell.cellY)
        : null
  };
}

export function shouldEmitPlacementPreviewShown(
  previous: PlacementPreviewBoundaryState | null,
  next: PlacementPreviewBoundaryState
): boolean {
  if (next.targetCellKey === null) {
    return false;
  }

  if (previous === null) {
    return true;
  }

  return previous.status !== next.status || previous.targetCellKey !== next.targetCellKey;
}