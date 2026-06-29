import crypto from "node:crypto";

export type RegionHashTileRow = {
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
  ownerId: string;
};

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function normalizeJsonValue(value: unknown): JsonLike {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry));
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const sortedEntries = Object.keys(objectValue)
      .sort()
      .map((key) => [key, normalizeJsonValue(objectValue[key])] as const);

    return Object.fromEntries(sortedEntries);
  }

  return String(value);
}

export function computeRegionHash(rows: RegionHashTileRow[]): string {
  const normalized = [...rows]
    .sort((left, right) => {
      if (left.cellX !== right.cellX) {
        return left.cellX - right.cellX;
      }

      if (left.cellY !== right.cellY) {
        return left.cellY - right.cellY;
      }

      if (left.offsetX !== right.offsetX) {
        return left.offsetX - right.offsetX;
      }

      if (left.offsetY !== right.offsetY) {
        return left.offsetY - right.offsetY;
      }

      if (left.shape !== right.shape) {
        return left.shape.localeCompare(right.shape);
      }

      if (left.color !== right.color) {
        return left.color.localeCompare(right.color);
      }

      return left.ownerId.localeCompare(right.ownerId);
    })
    .map((row) => ({
      regionId: row.regionId,
      cellX: row.cellX,
      cellY: row.cellY,
      offsetX: row.offsetX,
      offsetY: row.offsetY,
      shape: row.shape,
      color: row.color,
      stylePayload: normalizeJsonValue(row.stylePayload),
      ownerId: row.ownerId
    }));

  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}