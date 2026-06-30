import { Kysely } from "kysely";
import { ServerDatabase, TileDeltasSelect } from "../persistence/db.js";
import { IRegionDiffRepository, ViewportBounds } from "../persistence/region-diff.repository.js";
import { TelemetrySink } from "../telemetry/telemetry-sink.js";

export type RegionDiffServiceDependencies = {
  db: Kysely<ServerDatabase>;
  repository: IRegionDiffRepository;
  telemetrySink: TelemetrySink;
  now?: () => number;
};

export type GetRegionDiffInput = {
  regionId: string;
  sinceVersion: number;
  viewport: ViewportBounds;
  maxTiles: number;
};

export type RegionDiffTileDelta = {
  cellX: number;
  cellY: number;
  version: number;
  operation: string;
  offsetX: number | null;
  offsetY: number | null;
  shape: string | null;
  color: string | null;
  stylePayload: unknown | null;
  ownerId: string | null;
};

export type GetRegionDiffResult = {
  ok: true;
  regionId: string;
  sinceVersion: number;
  currentVersion: number;
  nextSinceVersion: number;
  isEmpty: boolean;
  tiles: RegionDiffTileDelta[];
  truncated: boolean;
};

export type GetReplayDiffInput = {
  regionId: string;
  sinceVersion: number;
};

export type GetReplayDiffResult = {
  ok: true;
  regionId: string;
  sinceVersion: number;
  currentVersion: number;
  tiles: RegionDiffTileDelta[];
};

function getViewportArea(viewport: ViewportBounds): number {
  const width = Math.max(0, viewport.maxCellX - viewport.minCellX + 1);
  const height = Math.max(0, viewport.maxCellY - viewport.minCellY + 1);
  return width * height;
}

function mapDelta(delta: TileDeltasSelect): RegionDiffTileDelta {
  return {
    cellX: delta.cell_x,
    cellY: delta.cell_y,
    version: Number(delta.version),
    operation: delta.operation,
    offsetX: delta.offset_x,
    offsetY: delta.offset_y,
    shape: delta.shape,
    color: delta.color,
    stylePayload: delta.style_payload,
    ownerId: delta.owner_id
  };
}

/**
 * Compacts deltas to latest version per coordinate, filtering out delete operations.
 *
 * DELETE SEMANTICS (Latest-Wins, Deletes Filtered):
 * - For each coordinate (cellX, cellY), keeps only the latest delta
 * - If the latest delta is a delete operation, the entire coordinate is OMITTED from result
 * - Rationale: Diffs represent "live state" not "all history"
 *   (a) Cleaner for clients: no null fields to interpret
 *   (b) More intuitive: client sees exactly what exists now
 *   (c) Prevents "never placed" vs "deleted" ambiguity
 * - Stale clients see only live tiles; deletes are implicit (absence = deleted or never existed)
 * - If client needs explicit delete notification, that's a separate concern (e.g., tombstone tracking)
 */
function compactLatestByCoordinate(deltas: TileDeltasSelect[]): RegionDiffTileDelta[] {
  const latestByCoordinate = new Map<string, RegionDiffTileDelta>();

  for (const delta of deltas) {
    const key = `${delta.cell_x}:${delta.cell_y}`;
    latestByCoordinate.set(key, mapDelta(delta));
  }

  // Filter out delete operations: only return live tiles
  return Array.from(latestByCoordinate.values())
    .filter((delta) => delta.operation !== "delete")
    .sort((left, right) => {
      if (left.version !== right.version) {
        return left.version - right.version;
      }

      if (left.cellX !== right.cellX) {
        return left.cellX - right.cellX;
      }

      if (left.cellY !== right.cellY) {
        return left.cellY - right.cellY;
      }

      return left.operation.localeCompare(right.operation);
    });
}

export class RegionDiffService {
  private readonly now: () => number;

  constructor(private readonly dependencies: RegionDiffServiceDependencies) {
    this.now = dependencies.now ?? (() => Date.now());
  }

  async getRegionDiff(input: GetRegionDiffInput): Promise<GetRegionDiffResult> {
    const startMs = this.now();
    const viewportArea = getViewportArea(input.viewport);

    await this.dependencies.telemetrySink.emitTileDiffRequested(
      input.regionId,
      input.sinceVersion,
      null,
      viewportArea
    );

    const currentVersion = await this.dependencies.repository.getCurrentRegionVersion(
      this.dependencies.db,
      input.regionId
    );

    if (input.sinceVersion >= currentVersion) {
      const durationMs = Math.max(0, this.now() - startMs);

      await this.dependencies.telemetrySink.emitTileDiffReturned(
        input.regionId,
        input.sinceVersion,
        currentVersion,
        viewportArea,
        0,
        false,
        durationMs
      );

      return {
        ok: true,
        regionId: input.regionId,
        sinceVersion: input.sinceVersion,
        currentVersion,
        nextSinceVersion: currentVersion,
        isEmpty: true,
        tiles: [],
        truncated: false
      };
    }

    const deltas = await this.dependencies.repository.getTileDeltasSince(this.dependencies.db, {
      regionId: input.regionId,
      sinceVersion: input.sinceVersion,
      viewport: input.viewport
    });

    const compacted = compactLatestByCoordinate(deltas);
    const truncated = compacted.length > input.maxTiles;
    const tiles = truncated ? compacted.slice(0, input.maxTiles) : compacted;
    const lastTile = tiles.at(-1);
    const nextSinceVersion = lastTile ? lastTile.version : currentVersion;
    const durationMs = Math.max(0, this.now() - startMs);

    await this.dependencies.telemetrySink.emitTileDiffReturned(
      input.regionId,
      input.sinceVersion,
      currentVersion,
      viewportArea,
      tiles.length,
      truncated,
      durationMs
    );

    return {
      ok: true,
      regionId: input.regionId,
      sinceVersion: input.sinceVersion,
      currentVersion,
      nextSinceVersion,
      isEmpty: tiles.length === 0,
      tiles,
      truncated
    };
  }

  async getReplayDiff(input: GetReplayDiffInput): Promise<GetReplayDiffResult> {
    const currentVersion = await this.dependencies.repository.getCurrentRegionVersion(
      this.dependencies.db,
      input.regionId
    );

    const replayViewport = {
      minCellX: Number.MIN_SAFE_INTEGER,
      maxCellX: Number.MAX_SAFE_INTEGER,
      minCellY: Number.MIN_SAFE_INTEGER,
      maxCellY: Number.MAX_SAFE_INTEGER
    };

    const deltas = await this.dependencies.repository.getTileDeltasSince(this.dependencies.db, {
      regionId: input.regionId,
      sinceVersion: input.sinceVersion,
      viewport: replayViewport
    });

    return {
      ok: true,
      regionId: input.regionId,
      sinceVersion: input.sinceVersion,
      currentVersion,
      tiles: deltas.map((delta) => mapDelta(delta))
    };
  }
}

export function createRegionDiffService(
  dependencies: RegionDiffServiceDependencies
): RegionDiffService {
  return new RegionDiffService(dependencies);
}