import type { RealtimeDeltaPayload } from "../session/realtime-delta-handler.js";

export interface BrowserTileProjection {
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  ownerId: string;
  version: number;
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
  readonly placeFeedback?: string;
  readonly tiles: Record<string, BrowserTileProjection>;
  readonly lastAppliedSequenceId?: string;
}

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
      version: Number.parseInt(payload.sequenceId, 10) || 0
    }
  };

  return withAppState(state, {
    tiles: nextTiles,
    lastAppliedSequenceId: payload.sequenceId,
    message: `Applied delta ${payload.sequenceId} (${payload.cellX},${payload.cellY})`
  });
}

function tileKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}
