export interface CameraBounds {
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
}

export interface CameraZoomBounds {
  minZoom: number;
  maxZoom: number;
}

export interface CameraState {
  centerCellX: number;
  centerCellY: number;
  zoom: number;
  bounds: CameraBounds;
  zoomBounds: CameraZoomBounds;
}

export interface CameraTransitionBoundary {
  viewportChanged: boolean;
  zoomLevelChanged: boolean;
}

export interface CameraStateTransition {
  state: CameraState;
  boundary: CameraTransitionBoundary;
}

export type CameraAction =
  | { type: "camera/panned"; deltaCellX: number; deltaCellY: number }
  | { type: "camera/centerSet"; centerCellX: number; centerCellY: number }
  | { type: "camera/zoomSet"; zoom: number }
  | { type: "camera/zoomAdjusted"; deltaZoom: number };

export interface CreateInitialCameraStateInput {
  centerCellX: number;
  centerCellY: number;
  zoom: number;
  bounds: CameraBounds;
  zoomBounds: CameraZoomBounds;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function toSafeFiniteNumber(value: number, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue);
}

export function normalizeCameraBounds(bounds: CameraBounds): CameraBounds {
  const minCellX = Math.floor(toSafeFiniteNumber(bounds.minCellX, 0));
  const maxCellX = Math.floor(toSafeFiniteNumber(bounds.maxCellX, minCellX));
  const minCellY = Math.floor(toSafeFiniteNumber(bounds.minCellY, 0));
  const maxCellY = Math.floor(toSafeFiniteNumber(bounds.maxCellY, minCellY));

  return {
    minCellX: Math.min(minCellX, maxCellX),
    maxCellX: Math.max(minCellX, maxCellX),
    minCellY: Math.min(minCellY, maxCellY),
    maxCellY: Math.max(minCellY, maxCellY)
  };
}

export function deriveCameraBoundsFromMap(bounds: CameraBounds): CameraBounds {
  return normalizeCameraBounds(bounds);
}

export function normalizeCameraZoomBounds(zoomBounds: CameraZoomBounds): CameraZoomBounds {
  const minZoom = toSafeFiniteNumber(zoomBounds.minZoom, 0.1);
  const maxZoom = toSafeFiniteNumber(zoomBounds.maxZoom, minZoom);

  return {
    minZoom: Math.max(0.0001, Math.min(minZoom, maxZoom)),
    maxZoom: Math.max(0.0001, Math.max(minZoom, maxZoom))
  };
}

export function clampCameraZoom(zoom: number, zoomBounds: CameraZoomBounds): number {
  const normalizedZoomBounds = normalizeCameraZoomBounds(zoomBounds);
  return clamp(toSafeFiniteNumber(zoom, normalizedZoomBounds.minZoom), normalizedZoomBounds.minZoom, normalizedZoomBounds.maxZoom);
}

export function clampCameraCenter(
  centerCellX: number,
  centerCellY: number,
  bounds: CameraBounds
): { centerCellX: number; centerCellY: number } {
  const normalizedBounds = normalizeCameraBounds(bounds);

  return {
    centerCellX: clamp(
      toSafeFiniteNumber(centerCellX, normalizedBounds.minCellX),
      normalizedBounds.minCellX,
      normalizedBounds.maxCellX
    ),
    centerCellY: clamp(
      toSafeFiniteNumber(centerCellY, normalizedBounds.minCellY),
      normalizedBounds.minCellY,
      normalizedBounds.maxCellY
    )
  };
}

export function clampCameraState(state: CameraState): CameraState {
  const bounds = normalizeCameraBounds(state.bounds);
  const zoomBounds = normalizeCameraZoomBounds(state.zoomBounds);
  const center = clampCameraCenter(state.centerCellX, state.centerCellY, bounds);

  return {
    centerCellX: center.centerCellX,
    centerCellY: center.centerCellY,
    zoom: clampCameraZoom(state.zoom, zoomBounds),
    bounds,
    zoomBounds
  };
}

export function createInitialCameraState(input: CreateInitialCameraStateInput): CameraState {
  return clampCameraState({
    centerCellX: input.centerCellX,
    centerCellY: input.centerCellY,
    zoom: input.zoom,
    bounds: input.bounds,
    zoomBounds: input.zoomBounds
  });
}

export function deriveCameraTransitionBoundary(
  previous: CameraState,
  next: CameraState
): CameraTransitionBoundary {
  const zoomLevelChanged = previous.zoom !== next.zoom;
  const viewportChanged =
    zoomLevelChanged ||
    previous.centerCellX !== next.centerCellX ||
    previous.centerCellY !== next.centerCellY;

  return {
    viewportChanged,
    zoomLevelChanged
  };
}

export function reduceCameraStateWithBoundary(
  state: CameraState,
  action: CameraAction
): CameraStateTransition {
  const nextState = reduceCameraState(state, action);
  return {
    state: nextState,
    boundary: deriveCameraTransitionBoundary(state, nextState)
  };
}

export function reduceCameraState(state: CameraState, action: CameraAction): CameraState {
  switch (action.type) {
    case "camera/panned": {
      if (!isFiniteNumber(action.deltaCellX) || !isFiniteNumber(action.deltaCellY)) {
        return state;
      }

      return clampCameraState({
        ...state,
        centerCellX: state.centerCellX + action.deltaCellX,
        centerCellY: state.centerCellY + action.deltaCellY
      });
    }
    case "camera/centerSet": {
      if (!isFiniteNumber(action.centerCellX) || !isFiniteNumber(action.centerCellY)) {
        return state;
      }

      return clampCameraState({
        ...state,
        centerCellX: action.centerCellX,
        centerCellY: action.centerCellY
      });
    }
    case "camera/zoomSet": {
      if (!isFiniteNumber(action.zoom)) {
        return state;
      }

      return clampCameraState({
        ...state,
        zoom: action.zoom
      });
    }
    case "camera/zoomAdjusted": {
      if (!isFiniteNumber(action.deltaZoom)) {
        return state;
      }

      return clampCameraState({
        ...state,
        zoom: state.zoom + action.deltaZoom
      });
    }
    default:
      return state;
  }
}