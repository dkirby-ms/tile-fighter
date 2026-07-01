export type CreatorTelemetryEventName =
  | "palette_opened"
  | "shape_selected"
  | "color_selected"
  | "placement_preview_shown"
  | "viewport_changed"
  | "zoom_level_changed";

export interface CreatorTelemetryEvent {
  name: CreatorTelemetryEventName;
  atMs: number;
  payload: Record<string, string | number | boolean | null>;
}

export interface CreatorTelemetrySink {
  emit(event: CreatorTelemetryEvent): void;
}

export interface CreatorTelemetryOptions {
  now?: () => number;
}

export interface PlacementPreviewShownEventInput {
  status: "ready" | "blocked" | "invalid-input";
  cellX: number | null;
  cellY: number | null;
  blocked: boolean;
}

export interface CreatorTransitionTelemetryInput {
  actionType: string;
  paletteVisible: boolean;
  selectedShape: string | null;
  selectedColor: string | null;
}

export interface ViewportChangedTelemetryInput {
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
  area: number;
}

export interface ZoomLevelChangedTelemetryInput {
  zoom: number;
}

export interface CameraTelemetryBoundaryInput {
  viewportChanged: boolean;
  zoomLevelChanged: boolean;
  viewport: ViewportChangedTelemetryInput;
  zoom: ZoomLevelChangedTelemetryInput;
}

const MAX_LABEL_LENGTH = 32;
const MIN_CELL_COORDINATE = -100_000;
const MAX_CELL_COORDINATE = 100_000;
const MAX_VIEWPORT_AREA = 1_000_000;
const MIN_ZOOM = 0.0001;
const MAX_ZOOM = 1_000;

export class CreatorTelemetryAdapter {
  private readonly now: () => number;

  constructor(
    private readonly sink: CreatorTelemetrySink,
    options: CreatorTelemetryOptions = {}
  ) {
    this.now = options.now ?? Date.now;
  }

  emitPaletteOpened(): void {
    this.emit("palette_opened", {});
  }

  emitShapeSelected(shape: string): void {
    this.emit("shape_selected", {
      shape: sanitizeLabel(shape)
    });
  }

  emitColorSelected(color: string): void {
    this.emit("color_selected", {
      color: sanitizeLabel(color)
    });
  }

  emitPlacementPreviewShown(input: PlacementPreviewShownEventInput): void {
    this.emit("placement_preview_shown", {
      status: input.status,
      blocked: input.blocked,
      cellX: input.cellX,
      cellY: input.cellY
    });
  }

  emitViewportChanged(input: ViewportChangedTelemetryInput): void {
    this.emit("viewport_changed", {
      minCellX: sanitizeCellCoordinate(input.minCellX),
      maxCellX: sanitizeCellCoordinate(input.maxCellX),
      minCellY: sanitizeCellCoordinate(input.minCellY),
      maxCellY: sanitizeCellCoordinate(input.maxCellY),
      area: sanitizeViewportArea(input.area)
    });
  }

  emitZoomLevelChanged(input: ZoomLevelChangedTelemetryInput): void {
    this.emit("zoom_level_changed", {
      zoom: sanitizeZoom(input.zoom)
    });
  }

  emitCameraTelemetryBoundary(input: CameraTelemetryBoundaryInput): void {
    if (input.viewportChanged) {
      this.emitViewportChanged(input.viewport);
    }

    if (input.zoomLevelChanged) {
      this.emitZoomLevelChanged(input.zoom);
    }
  }

  emitTransition(input: CreatorTransitionTelemetryInput): void {
    switch (input.actionType) {
      case "creator/paletteOpened": {
        this.emitPaletteOpened();
        return;
      }
      case "creator/shapeSelected": {
        if (input.selectedShape) {
          this.emitShapeSelected(input.selectedShape);
        }
        return;
      }
      case "creator/colorSelected": {
        if (input.selectedColor) {
          this.emitColorSelected(input.selectedColor);
        }
        return;
      }
      default:
        return;
    }
  }

  private emit(
    name: CreatorTelemetryEventName,
    payload: Record<string, string | number | boolean | null>
  ): void {
    this.sink.emit({
      name,
      atMs: this.now(),
      payload: sanitizePayload(payload)
    });
  }
}

function sanitizeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length <= MAX_LABEL_LENGTH) {
    return normalized;
  }

  return normalized.slice(0, MAX_LABEL_LENGTH);
}

function sanitizePayload(
  payload: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  const entries = Object.entries(payload).slice(0, 8);
  const next: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of entries) {
    const sanitizedKey = sanitizeLabel(key).replace(/[^a-z0-9_-]/g, "_");

    if (typeof value === "string") {
      next[sanitizedKey] = sanitizeLabel(value);
      continue;
    }

    if (typeof value === "number") {
      next[sanitizedKey] = Number.isFinite(value) ? value : null;
      continue;
    }

    next[sanitizedKey] = value;
  }

  return next;
}

function sanitizeCellCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(MIN_CELL_COORDINATE, Math.min(MAX_CELL_COORDINATE, Math.floor(value)));
}

function sanitizeViewportArea(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(1, Math.min(MAX_VIEWPORT_AREA, Math.floor(value)));
}

function sanitizeZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  return Math.round(clamped * 1_000) / 1_000;
}
