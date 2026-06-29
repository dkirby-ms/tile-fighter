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

/**
 * Compute deterministic SHA256 hash of region tiles for integrity verification.
 * 
 * CRITICAL: The sort order MUST be stable and canonical across all environments.
 * Tiles are sorted by: cellX → cellY → offsetX → offsetY → shape → color → ownerId.
 * This ensures that two regions with identical tile state will always produce the same hash,
 * which is essential for snapshot restore verification and data integrity detection.
 * 
 * Any changes to this sort order will invalidate existing snapshots, so update carefully.
 */
export function computeRegionHash(rows: RegionHashTileRow[]): string {
  const normalized = [...rows]
    .sort((left, right) => {
      // Primary sort: spatial coordinates (cellX, then cellY)
      if (left.cellX !== right.cellX) {
        return left.cellX - right.cellX;
      }

      if (left.cellY !== right.cellY) {
        return left.cellY - right.cellY;
      }

      // Secondary sort: visual properties (offsets, shape, color)
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

      // Final sort: owner identity (ensures deterministic order even for identical visuals)
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