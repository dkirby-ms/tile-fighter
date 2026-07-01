export type CreatorTelemetryEventName =
  | "palette_opened"
  | "shape_selected"
  | "color_selected"
  | "placement_preview_shown";

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

const MAX_LABEL_LENGTH = 32;

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
