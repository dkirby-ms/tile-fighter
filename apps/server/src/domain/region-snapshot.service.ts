import crypto from "node:crypto";
import { Kysely } from "kysely";
import { ServerDatabase, TilesSelect } from "../persistence/db.js";
import {
  IRegionSnapshotRepository,
  SnapshotTileRow
} from "../persistence/region-snapshot.repository.js";
import { TelemetrySink } from "../telemetry/telemetry-sink.js";
import { computeRegionHash } from "./region-hash.js";

export type RegionSnapshotServiceDependencies = {
  db: Kysely<ServerDatabase>;
  repository: IRegionSnapshotRepository;
  telemetrySink: TelemetrySink;
  now?: () => number;
};

export type CreateSnapshotInput = {
  regionId: string;
  actorId: string;
};

export type CreateSnapshotResult = {
  snapshotId: string;
  expectedHash: string;
  tileCount: number;
};

export type RestoreLatestInput = {
  regionId: string;
  actorId: string;
};

export type RestoreLatestResult = {
  snapshotId: string;
  expectedHash: string;
  actualHash: string;
  restoredTileCount: number;
};

export class RegionSnapshotNotFoundError extends Error {
  constructor(regionId: string) {
    super(`No snapshot available for region '${regionId}'`);
    this.name = "RegionSnapshotNotFoundError";
  }
}

export class RegionSnapshotHashMismatchError extends Error {
  constructor(snapshotId: string, expectedHash: string, actualHash: string) {
    super(
      `Snapshot hash mismatch for snapshot '${snapshotId}': expected '${expectedHash}', got '${actualHash}'`
    );
    this.name = "RegionSnapshotHashMismatchError";
  }
}

function mapTileRow(row: TilesSelect): SnapshotTileRow {
  return {
    regionId: row.region_id,
    cellX: row.cell_x,
    cellY: row.cell_y,
    offsetX: row.offset_x,
    offsetY: row.offset_y,
    shape: row.shape,
    color: row.color,
    stylePayload: row.style_payload,
    ownerId: row.owner_id
  };
}

export class RegionSnapshotService {
  private readonly now: () => number;

  constructor(private readonly dependencies: RegionSnapshotServiceDependencies) {
    this.now = dependencies.now ?? (() => Date.now());
  }

  async createSnapshot(input: CreateSnapshotInput): Promise<CreateSnapshotResult> {
    const regionTiles = await this.dependencies.db
      .selectFrom("tiles")
      .selectAll()
      .where("region_id", "=", input.regionId)
      .orderBy("cell_x", "asc")
      .orderBy("cell_y", "asc")
      .execute();

    const snapshotTiles = regionTiles.map((tile) => mapTileRow(tile));
    const expectedHash = computeRegionHash(snapshotTiles);
    const snapshotId = crypto.randomUUID();

    await this.dependencies.repository.createSnapshot(this.dependencies.db, {
      snapshotId,
      regionId: input.regionId,
      createdBy: input.actorId,
      expectedHash,
      tiles: snapshotTiles
    });

    await this.dependencies.telemetrySink.emitSnapshotCreated(
      input.regionId,
      snapshotId,
      snapshotTiles.length,
      expectedHash
    );

    return {
      snapshotId,
      expectedHash,
      tileCount: snapshotTiles.length
    };
  }

  async restoreLatest(input: RestoreLatestInput): Promise<RestoreLatestResult> {
    const restoreStartMs = this.now();
    const latestSnapshot = await this.dependencies.repository.getLatestSnapshotForRegion(
      this.dependencies.db,
      input.regionId
    );

    if (!latestSnapshot) {
      throw new RegionSnapshotNotFoundError(input.regionId);
    }

    await this.dependencies.telemetrySink.emitSnapshotRestoreStarted(
      input.regionId,
      latestSnapshot.snapshot.snapshot_id,
      latestSnapshot.snapshot.tile_count,
      latestSnapshot.snapshot.expected_hash
    );

    const restoredTiles = await this.dependencies.repository.restoreRegionFromSnapshot(
      this.dependencies.db,
      latestSnapshot.snapshot.snapshot_id,
      input.regionId
    );

    const actualHash = computeRegionHash(restoredTiles.map((tile) => mapTileRow(tile)));
    const durationMs = Math.max(0, this.now() - restoreStartMs);

    await this.dependencies.telemetrySink.emitSnapshotRestoreCompleted(
      input.regionId,
      latestSnapshot.snapshot.snapshot_id,
      restoredTiles.length,
      latestSnapshot.snapshot.expected_hash,
      actualHash,
      durationMs
    );

    if (actualHash !== latestSnapshot.snapshot.expected_hash) {
      throw new RegionSnapshotHashMismatchError(
        latestSnapshot.snapshot.snapshot_id,
        latestSnapshot.snapshot.expected_hash,
        actualHash
      );
    }

    return {
      snapshotId: latestSnapshot.snapshot.snapshot_id,
      expectedHash: latestSnapshot.snapshot.expected_hash,
      actualHash,
      restoredTileCount: restoredTiles.length
    };
  }
}

export function createRegionSnapshotService(
  dependencies: RegionSnapshotServiceDependencies
): RegionSnapshotService {
  return new RegionSnapshotService(dependencies);
}