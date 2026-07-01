import {
  TILE_PLACE_COMMAND_ID_MAX_LENGTH,
  TILE_PLACE_COMMAND_ID_MIN_LENGTH,
  TILE_PLACE_COMMAND_ID_PATTERN,
  type TilePlaceCommand
} from "@game/shared-types";

const DEFAULT_MAX_ABS_CELL_COORDINATE = 1_000_000;
const DEFAULT_OFFSET_MIN = -1;
const DEFAULT_OFFSET_MAX = 1;
const DEFAULT_MAX_REGION_ID_LENGTH = 64;
const DEFAULT_MAX_SHAPE_LENGTH = 32;
const DEFAULT_MAX_COLOR_LENGTH = 32;
const DEFAULT_MAX_STYLE_PROPERTIES = 16;
const DEFAULT_MAX_STYLE_ARRAY_LENGTH = 16;
const DEFAULT_MAX_STYLE_DEPTH = 3;
const DEFAULT_MAX_STYLE_STRING_LENGTH = 128;

const placementCommandIdRegex = new RegExp(TILE_PLACE_COMMAND_ID_PATTERN);
const simpleStyleKeyRegex = /^[A-Za-z0-9_-]{1,40}$/;

export type PlacementInputIssueCode =
  | "invalid-command-id"
  | "invalid-region-id"
  | "invalid-shape"
  | "invalid-color"
  | "invalid-cell"
  | "invalid-offset"
  | "invalid-style-payload";

export interface PlacementInputIssue {
  code: PlacementInputIssueCode;
  detail: string;
}

export interface PlacementSubmitInput {
  commandId?: string;
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
}

export interface PlacementInputOptions {
  readonly allowedShapes?: readonly string[];
  readonly allowedColors?: readonly string[];
  readonly maxAbsCellCoordinate?: number;
  readonly offsetMin?: number;
  readonly offsetMax?: number;
  readonly maxRegionIdLength?: number;
  readonly maxShapeLength?: number;
  readonly maxColorLength?: number;
  readonly maxStyleProperties?: number;
  readonly maxStyleArrayLength?: number;
  readonly maxStyleDepth?: number;
  readonly maxStyleStringLength?: number;
  readonly createCommandId?: () => string;
}

export type PlacementInputSanitizeResult =
  | {
      ok: true;
      command: TilePlaceCommand;
    }
  | {
      ok: false;
      issues: readonly PlacementInputIssue[];
    };

interface RequiredPlacementInputOptions {
  allowedShapes: readonly string[];
  allowedColors: readonly string[];
  maxAbsCellCoordinate: number;
  offsetMin: number;
  offsetMax: number;
  maxRegionIdLength: number;
  maxShapeLength: number;
  maxColorLength: number;
  maxStyleProperties: number;
  maxStyleArrayLength: number;
  maxStyleDepth: number;
  maxStyleStringLength: number;
  createCommandId: () => string;
}

export function isValidPlacementCommandId(commandId: string): boolean {
  return (
    commandId.length >= TILE_PLACE_COMMAND_ID_MIN_LENGTH &&
    commandId.length <= TILE_PLACE_COMMAND_ID_MAX_LENGTH &&
    placementCommandIdRegex.test(commandId)
  );
}

export function createPlacementCommandId(now = Date.now(), randomSuffix = randomBase62(10)): string {
  const normalizedNow = Math.max(0, Math.floor(now));
  const base = `${normalizedNow.toString(36)}_${randomSuffix}`;

  if (base.length >= TILE_PLACE_COMMAND_ID_MIN_LENGTH && isValidPlacementCommandId(base)) {
    return base;
  }

  const padded = `${base}_${"x".repeat(TILE_PLACE_COMMAND_ID_MIN_LENGTH)}`.slice(
    0,
    TILE_PLACE_COMMAND_ID_MIN_LENGTH
  );
  return padded.replace(/[^A-Za-z0-9_-]/g, "x");
}

export function sanitizePlacementSubmitInput(
  input: PlacementSubmitInput,
  options: PlacementInputOptions = {}
): PlacementInputSanitizeResult {
  const resolved = resolvePlacementInputOptions(options);
  const issues: PlacementInputIssue[] = [];

  const regionId = normalizeSimpleString(input.regionId);
  if (regionId.length === 0 || regionId.length > resolved.maxRegionIdLength) {
    issues.push({
      code: "invalid-region-id",
      detail: "regionId must be a non-empty string within length bounds"
    });
  }

  const shape = normalizeSimpleString(input.shape);
  const allowedShapeSet = new Set(resolved.allowedShapes.map((value) => value.trim()));
  const shapeAllowed =
    shape.length > 0 &&
    shape.length <= resolved.maxShapeLength &&
    (allowedShapeSet.size === 0 || allowedShapeSet.has(shape));
  if (!shapeAllowed) {
    issues.push({
      code: "invalid-shape",
      detail: "shape must be allowed and within configured bounds"
    });
  }

  const color = normalizeSimpleString(input.color);
  const allowedColorSet = new Set(resolved.allowedColors.map((value) => value.trim()));
  const colorAllowed =
    color.length > 0 &&
    color.length <= resolved.maxColorLength &&
    (allowedColorSet.size === 0 || allowedColorSet.has(color));
  if (!colorAllowed) {
    issues.push({
      code: "invalid-color",
      detail: "color must be allowed and within configured bounds"
    });
  }

  const isCellValid =
    Number.isInteger(input.cellX) &&
    Number.isInteger(input.cellY) &&
    Math.abs(input.cellX) <= resolved.maxAbsCellCoordinate &&
    Math.abs(input.cellY) <= resolved.maxAbsCellCoordinate;
  if (!isCellValid) {
    issues.push({
      code: "invalid-cell",
      detail: "cell coordinates must be bounded integers"
    });
  }

  const isOffsetValid =
    Number.isFinite(input.offsetX) &&
    Number.isFinite(input.offsetY) &&
    input.offsetX >= resolved.offsetMin &&
    input.offsetX <= resolved.offsetMax &&
    input.offsetY >= resolved.offsetMin &&
    input.offsetY <= resolved.offsetMax;
  if (!isOffsetValid) {
    issues.push({
      code: "invalid-offset",
      detail: "offset values must be finite numbers within configured bounds"
    });
  }

  const sanitizedStylePayload = sanitizeStylePayload(input.stylePayload, resolved);
  if (!sanitizedStylePayload.ok) {
    issues.push({
      code: "invalid-style-payload",
      detail: sanitizedStylePayload.reason
    });
  }

  const providedCommandId = typeof input.commandId === "string" ? input.commandId.trim() : "";
  const commandId = providedCommandId.length > 0 ? providedCommandId : resolved.createCommandId();
  if (!isValidPlacementCommandId(commandId)) {
    issues.push({
      code: "invalid-command-id",
      detail: "commandId must satisfy shared tile place command identity constraints"
    });
  }

  if (issues.length > 0 || !sanitizedStylePayload.ok) {
    return {
      ok: false,
      issues
    };
  }

  return {
    ok: true,
    command: {
      commandId,
      regionId,
      cellX: input.cellX,
      cellY: input.cellY,
      offsetX: input.offsetX,
      offsetY: input.offsetY,
      shape,
      color,
      stylePayload: sanitizedStylePayload.value
    }
  };
}

function resolvePlacementInputOptions(options: PlacementInputOptions): RequiredPlacementInputOptions {
  return {
    allowedShapes: options.allowedShapes ?? [],
    allowedColors: options.allowedColors ?? [],
    maxAbsCellCoordinate: options.maxAbsCellCoordinate ?? DEFAULT_MAX_ABS_CELL_COORDINATE,
    offsetMin: options.offsetMin ?? DEFAULT_OFFSET_MIN,
    offsetMax: options.offsetMax ?? DEFAULT_OFFSET_MAX,
    maxRegionIdLength: options.maxRegionIdLength ?? DEFAULT_MAX_REGION_ID_LENGTH,
    maxShapeLength: options.maxShapeLength ?? DEFAULT_MAX_SHAPE_LENGTH,
    maxColorLength: options.maxColorLength ?? DEFAULT_MAX_COLOR_LENGTH,
    maxStyleProperties: options.maxStyleProperties ?? DEFAULT_MAX_STYLE_PROPERTIES,
    maxStyleArrayLength: options.maxStyleArrayLength ?? DEFAULT_MAX_STYLE_ARRAY_LENGTH,
    maxStyleDepth: options.maxStyleDepth ?? DEFAULT_MAX_STYLE_DEPTH,
    maxStyleStringLength: options.maxStyleStringLength ?? DEFAULT_MAX_STYLE_STRING_LENGTH,
    createCommandId: options.createCommandId ?? (() => createPlacementCommandId())
  };
}

function normalizeSimpleString(value: string): string {
  return value.trim();
}

function randomBase62(length: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let output = "";

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      output += alphabet[byte % alphabet.length];
    }
    return output;
  }

  for (let index = 0; index < length; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return output;
}

type StyleSanitizeResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: string };

function sanitizeStylePayload(
  payload: unknown,
  options: RequiredPlacementInputOptions
): StyleSanitizeResult {
  return sanitizeStyleValue(payload, options, 0, { propertyCount: 0 });
}

function sanitizeStyleValue(
  value: unknown,
  options: RequiredPlacementInputOptions,
  depth: number,
  counters: { propertyCount: number }
): StyleSanitizeResult {
  if (depth > options.maxStyleDepth) {
    return { ok: false, reason: "stylePayload exceeds max depth" };
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.length <= options.maxStyleStringLength)
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return { ok: false, reason: "stylePayload number values must be finite" };
    }
    return { ok: true, value };
  }

  if (typeof value === "string") {
    return { ok: false, reason: "stylePayload string value exceeds max length" };
  }

  if (Array.isArray(value)) {
    if (value.length > options.maxStyleArrayLength) {
      return { ok: false, reason: "stylePayload array exceeds max length" };
    }

    const sanitizedArray: unknown[] = [];
    for (const item of value) {
      const child = sanitizeStyleValue(item, options, depth + 1, counters);
      if (!child.ok) {
        return child;
      }
      sanitizedArray.push(child.value);
    }

    return { ok: true, value: sanitizedArray };
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > options.maxStyleProperties) {
      return { ok: false, reason: "stylePayload object exceeds max property count" };
    }

    const sanitizedObject: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      counters.propertyCount += 1;
      if (counters.propertyCount > options.maxStyleProperties) {
        return { ok: false, reason: "stylePayload exceeds max total property count" };
      }

      if (!simpleStyleKeyRegex.test(key)) {
        return { ok: false, reason: `stylePayload key '${key}' is not allowed` };
      }

      const child = sanitizeStyleValue(entryValue, options, depth + 1, counters);
      if (!child.ok) {
        return child;
      }

      sanitizedObject[key] = child.value;
    }

    return { ok: true, value: sanitizedObject };
  }

  return { ok: false, reason: "stylePayload contains unsupported value type" };
}
