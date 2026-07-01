import type { ReplayDelta } from "./reconnect-caller.js";

export type ReplayTileState = {
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

export type ReplayChecksumInput = {
  regionId: string;
  initialTiles: ReplayTileState[];
  deltas: ReplayDelta[];
  expectedScope: "full_region_canonical";
  serverChecksum: string;
};

export type ReplayChecksumResult = {
  match: boolean;
  checksumScope: "full_region_canonical";
  serverChecksum: string;
  clientChecksum: string;
  appliedVersion: number;
  tileCount: number;
};

export class ReplayChecksumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayChecksumError";
  }
}

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

export function applyReplayAndValidateChecksum(input: ReplayChecksumInput): ReplayChecksumResult {
  if (input.expectedScope !== "full_region_canonical") {
    throw new ReplayChecksumError(`Unsupported checksum scope: ${input.expectedScope}`);
  }

  const tiles = new Map<string, ReplayTileState>();

  for (const tile of input.initialTiles) {
    tiles.set(tileKey(tile.cellX, tile.cellY), {
      regionId: input.regionId,
      cellX: tile.cellX,
      cellY: tile.cellY,
      offsetX: tile.offsetX,
      offsetY: tile.offsetY,
      shape: tile.shape,
      color: tile.color,
      stylePayload: tile.stylePayload,
      ownerId: tile.ownerId
    });
  }

  let appliedVersion = 0;

  for (const delta of input.deltas) {
    appliedVersion = Math.max(appliedVersion, delta.version);
    const key = tileKey(delta.cellX, delta.cellY);

    if (delta.operation === "delete") {
      tiles.delete(key);
      continue;
    }

    if (!isUpsertDelta(delta)) {
      throw new ReplayChecksumError(
        `Invalid replay delta at version ${delta.version}: missing upsert payload`
      );
    }

    tiles.set(key, {
      regionId: input.regionId,
      cellX: delta.cellX,
      cellY: delta.cellY,
      offsetX: delta.offsetX,
      offsetY: delta.offsetY,
      shape: delta.shape,
      color: delta.color,
      stylePayload: delta.stylePayload,
      ownerId: delta.ownerId
    });
  }

  const tileRows = [...tiles.values()];
  const clientChecksum = computeFullRegionCanonicalChecksum(tileRows);

  return {
    match: clientChecksum === input.serverChecksum,
    checksumScope: input.expectedScope,
    serverChecksum: input.serverChecksum,
    clientChecksum,
    appliedVersion,
    tileCount: tileRows.length
  };
}

export function computeFullRegionCanonicalChecksum(rows: ReplayTileState[]): string {
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

  const json = JSON.stringify(normalized);
  return createDeterministicHash(json);
}

export async function createBrowserChecksum(rows: ReplayTileState[]): Promise<string> {
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

  const payload = JSON.stringify(normalized);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const data = new TextEncoder().encode(payload);
    const digest = await subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }

  return createDeterministicHash(payload);
}

function isUpsertDelta(delta: ReplayDelta): delta is ReplayDelta & {
  operation: "upsert";
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  ownerId: string;
} {
  return (
    delta.operation === "upsert" &&
    typeof delta.offsetX === "number" &&
    typeof delta.offsetY === "number" &&
    typeof delta.shape === "string" &&
    typeof delta.color === "string" &&
    typeof delta.ownerId === "string"
  );
}

function tileKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}

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

function createDeterministicHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
