import type { RealtimeDeltaPayload } from "../session/realtime-delta-handler.js";
import type {
  BondOutcome,
  ClientPaletteSelection,
  ClientViewportState
} from "@game/shared-types";

export interface BrowserTileProjection {
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  ownerId: string;
  version: number;
  optimistic?: boolean;
}

export interface BrowserPreviewState {
  cellX: number;
  cellY: number;
  blocked: boolean;
}

export interface BrowserAccessibilityState {
  highContrastEnabled: boolean;
  reducedMotionEnabled: boolean;
}

export interface BrowserOnboardingState {
  startedAtMs: number;
  completedAtMs?: number;
  skipped: boolean;
  activeStep: 1 | 2 | 3;
  completed: boolean;
}

export type BrowserLoopStage =
  | "idle"
  | "auth-preflight"
  | "bootstrapping"
  | "joining-room"
  | "ready"
  | "error";

export interface BrowserAppState {
  readonly status: BrowserLoopStage;
  readonly message: string;
  readonly guidance?: string;
  readonly tokenReady: boolean;
  readonly bootstrapReady: boolean;
  readonly roomJoined: boolean;
  readonly roomSessionId?: string;
  readonly roomId: string;
  readonly selectedCellX: number;
  readonly selectedCellY: number;
  readonly paletteOpen: boolean;
  readonly palette: ClientPaletteSelection;
  readonly preview?: BrowserPreviewState;
  readonly viewport: ClientViewportState;
  readonly bonds: Record<string, BondOutcome>;
  readonly optimisticTileKeys: readonly string[];
  readonly accessibility: BrowserAccessibilityState;
  readonly onboarding: BrowserOnboardingState;
  readonly firstTilePlacedAtMs?: number;
  readonly placeFeedback?: string;
  readonly tiles: Record<string, BrowserTileProjection>;
  readonly lastAppliedSequenceId?: string;
}

export type ViewportTileBounds = {
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
};

export function createInitialBrowserAppState(): BrowserAppState {
  return {
    status: "idle",
    message: "Client scaffold is running.",
    tokenReady: false,
    bootstrapReady: false,
    roomJoined: false,
    roomId: "arena",
    selectedCellX: 0,
    selectedCellY: 0,
    paletteOpen: false,
    palette: {
      shape: "square",
      color: "orange"
    },
    viewport: {
      panX: 0,
      panY: 0,
      zoom: 1,
      canvasWidth: 960,
      canvasHeight: 640
    },
    bonds: {},
    optimisticTileKeys: [],
    accessibility: {
      highContrastEnabled: false,
      reducedMotionEnabled: false
    },
    onboarding: {
      startedAtMs: Date.now(),
      skipped: false,
      activeStep: 1,
      completed: false
    },
    tiles: {}
  };
}

export function withAppState(
  state: BrowserAppState,
  patch: Partial<BrowserAppState>
): BrowserAppState {
  return {
    ...state,
    ...patch
  };
}

export function selectCell(state: BrowserAppState, cellX: number, cellY: number): BrowserAppState {
  return withAppState(state, {
    selectedCellX: cellX,
    selectedCellY: cellY
  });
}

export function setPaletteOpen(state: BrowserAppState, paletteOpen: boolean): BrowserAppState {
  return withAppState(state, { paletteOpen });
}

export function selectShape(state: BrowserAppState, shape: string): BrowserAppState {
  return withAppState(state, {
    palette: {
      ...state.palette,
      shape
    }
  });
}

export function selectColor(state: BrowserAppState, color: string): BrowserAppState {
  return withAppState(state, {
    palette: {
      ...state.palette,
      color
    }
  });
}

export function setPreview(
  state: BrowserAppState,
  preview: BrowserPreviewState | undefined
): BrowserAppState {
  if (preview) {
    return withAppState(state, { preview });
  }

  const { preview: _preview, ...nextState } = state;
  void _preview;
  return nextState;
}

export function updateViewport(
  state: BrowserAppState,
  patch: Partial<ClientViewportState>
): BrowserAppState {
  return withAppState(state, {
    viewport: {
      ...state.viewport,
      ...patch
    }
  });
}

export function setAccessibility(
  state: BrowserAppState,
  patch: Partial<BrowserAccessibilityState>
): BrowserAppState {
  return withAppState(state, {
    accessibility: {
      ...state.accessibility,
      ...patch
    }
  });
}

export function setOnboardingState(
  state: BrowserAppState,
  patch: Partial<BrowserOnboardingState>
): BrowserAppState {
  return withAppState(state, {
    onboarding: {
      ...state.onboarding,
      ...patch
    }
  });
}

export function addOptimisticTile(state: BrowserAppState, input: {
  cellX: number;
  cellY: number;
  shape: string;
  color: string;
}): BrowserAppState {
  const key = tileKey(input.cellX, input.cellY);
  return withAppState(state, {
    tiles: {
      ...state.tiles,
      [key]: {
        cellX: input.cellX,
        cellY: input.cellY,
        offsetX: 0,
        offsetY: 0,
        shape: input.shape,
        color: input.color,
        ownerId: "self",
        version: Number.MAX_SAFE_INTEGER,
        optimistic: true
      }
    },
    optimisticTileKeys: state.optimisticTileKeys.includes(key)
      ? state.optimisticTileKeys
      : [...state.optimisticTileKeys, key]
  });
}

export function clearOptimisticTile(state: BrowserAppState, cellX: number, cellY: number): BrowserAppState {
  const key = tileKey(cellX, cellY);
  const isOptimistic = state.optimisticTileKeys.includes(key);
  if (!isOptimistic) {
    return state;
  }

  const nextTiles = { ...state.tiles };
  const tile = nextTiles[key];
  if (tile?.optimistic) {
    delete nextTiles[key];
  }

  return withAppState(state, {
    tiles: nextTiles,
    optimisticTileKeys: state.optimisticTileKeys.filter((tileKeyValue) => tileKeyValue !== key)
  });
}

export function applyRealtimeDelta(
  state: BrowserAppState,
  payload: RealtimeDeltaPayload
): BrowserAppState {
  const key = tileKey(payload.cellX, payload.cellY);
  const nextTiles = {
    ...state.tiles,
    [key]: {
      cellX: payload.cellX,
      cellY: payload.cellY,
      offsetX: payload.offsetX,
      offsetY: payload.offsetY,
      shape: payload.shape,
      color: payload.color,
      ownerId: payload.ownerId,
      version: Number.parseInt(payload.sequenceId, 10) || 0,
      optimistic: false
    }
  };

  const nextState = withAppState(state, {
    tiles: nextTiles,
    lastAppliedSequenceId: payload.sequenceId,
    message: `Applied delta ${payload.sequenceId} (${payload.cellX},${payload.cellY})`,
    optimisticTileKeys: state.optimisticTileKeys.filter((keyValue) => keyValue !== key)
  });

  return recomputeBonds(nextState);
}

export function recomputeBonds(state: BrowserAppState): BrowserAppState {
  const tiles = Object.values(state.tiles).filter((tile) => !tile.optimistic);
  const tileByCoordinate = new Map<string, BrowserTileProjection>();
  for (const tile of tiles) {
    tileByCoordinate.set(tileKey(tile.cellX, tile.cellY), tile);
  }

  const bondById: Record<string, BondOutcome> = {};
  for (const tile of tiles) {
    const neighbors = [
      { cellX: tile.cellX + 1, cellY: tile.cellY },
      { cellX: tile.cellX, cellY: tile.cellY + 1 }
    ];

    for (const neighborCoordinate of neighbors) {
      const neighbor = tileByCoordinate.get(tileKey(neighborCoordinate.cellX, neighborCoordinate.cellY));
      if (!neighbor || neighbor.color !== tile.color) {
        continue;
      }

      const canonical = canonicalEdge(tile.cellX, tile.cellY, neighbor.cellX, neighbor.cellY);
      const fromCellX = canonical.fromCellX;
      const fromCellY = canonical.fromCellY;
      const toCellX = canonical.toCellX;
      const toCellY = canonical.toCellY;

      const bondId = `${state.roomId}:${fromCellX}:${fromCellY}:${toCellX}:${toCellY}`;
      const bondSeed = `${bondId}:${tile.color}`;
      const bucket = stableHash(bondSeed) % 3;
      const bondType = bucket === 0
        ? "glow_chain"
        : bucket === 1
          ? "blend_gradient"
          : "pulse_rhythm";

      bondById[bondId] = {
        bondId,
        regionId: state.roomId,
        fromCellX,
        fromCellY,
        toCellX,
        toCellY,
        color: tile.color,
        bondType
      };
    }
  }

  return withAppState(state, {
    bonds: bondById
  });
}

export function computeViewportTileBounds(state: BrowserAppState): ViewportTileBounds {
  const { canvasWidth, canvasHeight, panX, panY, zoom } = state.viewport;
  const tileSize = Math.max(20, Math.round(56 * zoom));
  const halfWidthTiles = Math.ceil(canvasWidth / tileSize / 2) + 1;
  const halfHeightTiles = Math.ceil(canvasHeight / tileSize / 2) + 1;

  const centerCellX = Math.round(panX / tileSize);
  const centerCellY = Math.round(panY / tileSize);

  return {
    minCellX: centerCellX - halfWidthTiles,
    maxCellX: centerCellX + halfWidthTiles,
    minCellY: centerCellY - halfHeightTiles,
    maxCellY: centerCellY + halfHeightTiles
  };
}

export function isCellOccupied(state: BrowserAppState, cellX: number, cellY: number): boolean {
  return Boolean(state.tiles[tileKey(cellX, cellY)]);
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
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

function tileKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}
