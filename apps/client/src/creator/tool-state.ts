export interface CreatorTargetCell {
  cellX: number;
  cellY: number;
}

export interface PendingPlacementInfo {
  commandId: string;
  targetCell: CreatorTargetCell;
  awaitingAck: boolean;
}

export type OptimisticPlacementStatus = "idle" | "pending";

export interface CreatorToolState {
  paletteVisible: boolean;
  selectedShape: string | null;
  selectedColor: string | null;
  hoveredTargetCell: CreatorTargetCell | null;
  isPreviewBlocked: boolean;
  optimisticPlacementStatus: OptimisticPlacementStatus;
  pendingPlacement: PendingPlacementInfo | null;
  allowedShapes: readonly string[];
  allowedColors: readonly string[];
}

export interface CreatorToolTransitionMeta {
  event:
    | "palette_opened"
    | "shape_selected"
    | "color_selected"
    | "optimistic_started"
    | "optimistic_cleared_ack"
    | "optimistic_cleared_terminal"
    | "optimistic_cleared_manual";
  commandId?: string;
  reason?: "ack" | "terminal" | "manual";
}

export interface CreatorToolTransitionResult {
  state: CreatorToolState;
  changed: boolean;
  metadata: readonly CreatorToolTransitionMeta[];
}

export interface CreatorPaletteConfig {
  readonly shapes: readonly string[];
  readonly colors: readonly string[];
}

export const DEFAULT_CREATOR_PALETTE: CreatorPaletteConfig = {
  shapes: ["square", "circle", "triangle", "diamond"],
  colors: ["red", "blue", "green", "yellow"]
};

export type CreatorToolStateAction =
  | { type: "creator/paletteOpened" }
  | { type: "creator/paletteClosed" }
  | { type: "creator/paletteToggled" }
  | { type: "creator/paletteConfigured"; palette: CreatorPaletteConfig }
  | { type: "creator/shapeSelected"; shape: string }
  | { type: "creator/colorSelected"; color: string }
  | { type: "creator/hoverTargetSet"; targetCell: CreatorTargetCell }
  | { type: "creator/hoverTargetCleared" }
  | { type: "creator/previewBlockedSet"; isBlocked: boolean }
  | {
      type: "creator/optimisticPlacementStarted";
      pending: Omit<PendingPlacementInfo, "awaitingAck"> & { awaitingAck?: boolean };
    }
  | { type: "creator/optimisticPlacementAckObserved"; commandId: string }
  | { type: "creator/optimisticPlacementTerminalFailed"; commandId: string }
  | { type: "creator/optimisticPlacementCleared" };

function sanitizePalette(values: readonly string[]): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      continue;
    }

    unique.add(normalized);
  }

  return [...unique];
}

function normalizePaletteConfig(input: CreatorPaletteConfig): CreatorPaletteConfig {
  const shapes = sanitizePalette(input.shapes);
  const colors = sanitizePalette(input.colors);

  return {
    shapes,
    colors
  };
}

function isValidTargetCell(targetCell: CreatorTargetCell): boolean {
  return Number.isInteger(targetCell.cellX) && Number.isInteger(targetCell.cellY);
}

function isValidCommandId(commandId: string): boolean {
  return commandId.trim().length > 0;
}

export function createInitialCreatorToolState(
  palette: CreatorPaletteConfig = DEFAULT_CREATOR_PALETTE
): CreatorToolState {
  const normalizedPalette = normalizePaletteConfig(palette);

  return {
    paletteVisible: false,
    selectedShape: null,
    selectedColor: null,
    hoveredTargetCell: null,
    isPreviewBlocked: false,
    optimisticPlacementStatus: "idle",
    pendingPlacement: null,
    allowedShapes: normalizedPalette.shapes,
    allowedColors: normalizedPalette.colors
  };
}

export function reduceCreatorToolState(
  state: CreatorToolState,
  action: CreatorToolStateAction
): CreatorToolState {
  return reduceCreatorToolStateWithMeta(state, action).state;
}

export function reduceCreatorToolStateWithMeta(
  state: CreatorToolState,
  action: CreatorToolStateAction
): CreatorToolTransitionResult {
  let nextState = state;
  const metadata: CreatorToolTransitionMeta[] = [];

  switch (action.type) {
    case "creator/paletteOpened": {
      nextState = {
        ...state,
        paletteVisible: true
      };
      if (!state.paletteVisible) {
        metadata.push({ event: "palette_opened" });
      }
      break;
    }
    case "creator/paletteClosed": {
      nextState = {
        ...state,
        paletteVisible: false
      };
      break;
    }
    case "creator/paletteToggled": {
      nextState = {
        ...state,
        paletteVisible: !state.paletteVisible
      };
      if (!state.paletteVisible) {
        metadata.push({ event: "palette_opened" });
      }
      break;
    }
    case "creator/paletteConfigured": {
      const nextPalette = normalizePaletteConfig(action.palette);
      const selectedShape =
        state.selectedShape !== null && nextPalette.shapes.includes(state.selectedShape)
          ? state.selectedShape
          : null;
      const selectedColor =
        state.selectedColor !== null && nextPalette.colors.includes(state.selectedColor)
          ? state.selectedColor
          : null;

      nextState = {
        ...state,
        selectedShape,
        selectedColor,
        allowedShapes: nextPalette.shapes,
        allowedColors: nextPalette.colors
      };
      break;
    }
    case "creator/shapeSelected": {
      const shape = action.shape.trim();
      if (shape.length === 0 || !state.allowedShapes.includes(shape)) {
        nextState = state;
        break;
      }

      nextState = {
        ...state,
        selectedShape: shape
      };
      if (state.selectedShape !== shape) {
        metadata.push({ event: "shape_selected" });
      }
      break;
    }
    case "creator/colorSelected": {
      const color = action.color.trim();
      if (color.length === 0 || !state.allowedColors.includes(color)) {
        nextState = state;
        break;
      }

      nextState = {
        ...state,
        selectedColor: color
      };
      if (state.selectedColor !== color) {
        metadata.push({ event: "color_selected" });
      }
      break;
    }
    case "creator/hoverTargetSet": {
      if (!isValidTargetCell(action.targetCell)) {
        nextState = {
          ...state,
          hoveredTargetCell: null
        };
        break;
      }

      nextState = {
        ...state,
        hoveredTargetCell: {
          cellX: action.targetCell.cellX,
          cellY: action.targetCell.cellY
        }
      };
      break;
    }
    case "creator/hoverTargetCleared": {
      nextState = {
        ...state,
        hoveredTargetCell: null
      };
      break;
    }
    case "creator/previewBlockedSet": {
      nextState = {
        ...state,
        isPreviewBlocked: action.isBlocked
      };
      break;
    }
    case "creator/optimisticPlacementStarted": {
      if (!isValidCommandId(action.pending.commandId) || !isValidTargetCell(action.pending.targetCell)) {
        nextState = state;
        break;
      }

      nextState = {
        ...state,
        optimisticPlacementStatus: "pending",
        pendingPlacement: {
          commandId: action.pending.commandId.trim(),
          targetCell: {
            cellX: action.pending.targetCell.cellX,
            cellY: action.pending.targetCell.cellY
          },
          awaitingAck: action.pending.awaitingAck ?? true
        }
      };
      metadata.push({
        event: "optimistic_started",
        commandId: action.pending.commandId.trim()
      });
      break;
    }
    case "creator/optimisticPlacementAckObserved": {
      if (!isValidCommandId(action.commandId)) {
        nextState = state;
        break;
      }

      const commandId = action.commandId.trim();
      if (!state.pendingPlacement || state.pendingPlacement.commandId !== commandId) {
        nextState = state;
        break;
      }

      nextState = {
        ...state,
        optimisticPlacementStatus: "idle",
        pendingPlacement: null
      };
      metadata.push({
        event: "optimistic_cleared_ack",
        commandId,
        reason: "ack"
      });
      break;
    }
    case "creator/optimisticPlacementTerminalFailed": {
      if (!isValidCommandId(action.commandId)) {
        nextState = state;
        break;
      }

      const commandId = action.commandId.trim();
      if (!state.pendingPlacement || state.pendingPlacement.commandId !== commandId) {
        nextState = state;
        break;
      }

      nextState = {
        ...state,
        optimisticPlacementStatus: "idle",
        pendingPlacement: null
      };
      metadata.push({
        event: "optimistic_cleared_terminal",
        commandId,
        reason: "terminal"
      });
      break;
    }
    case "creator/optimisticPlacementCleared": {
      nextState = {
        ...state,
        optimisticPlacementStatus: "idle",
        pendingPlacement: null
      };
      if (state.pendingPlacement) {
        metadata.push({
          event: "optimistic_cleared_manual",
          commandId: state.pendingPlacement.commandId,
          reason: "manual"
        });
      }
      break;
    }
  }

  return {
    state: nextState,
    changed: nextState !== state,
    metadata
  };
}