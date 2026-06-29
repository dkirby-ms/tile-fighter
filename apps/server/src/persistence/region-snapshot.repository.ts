import { Kysely, Transaction } from "kysely";
import {
  RegionSnapshotTilesInsert,
  RegionSnapshotTilesSelect,
  RegionSnapshotsInsert,
  RegionSnapshotsSelect,
  ServerDatabase,
  TilesInsert,
  TilesSelect
} from "./db.js";

export type SnapshotTileRow = {
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

export type CreateRegionSnapshotInput = {
  snapshotId: string;
  regionId: string;
  createdBy: string;
  expectedHash: string;
  tiles: SnapshotTileRow[];
};

export type RegionSnapshotWithTiles = {
  snapshot: RegionSnapshotsSelect;
  tiles: RegionSnapshotTilesSelect[];
};

export interface IRegionSnapshotRepository {
  createSnapshot(
    db: Kysely<ServerDatabase>,
    input: CreateRegionSnapshotInput
  ): Promise<RegionSnapshotsSelect>;
  getLatestSnapshotForRegion(
    db: Kysely<ServerDatabase>,
    regionId: string
  ): Promise<RegionSnapshotWithTiles | null>;
  restoreRegionFromSnapshot(
    db: Kysely<ServerDatabase>,
    snapshotId: string,
    regionId: string
  ): Promise<TilesSelect[]>;
}

export class RegionSnapshotRepository implements IRegionSnapshotRepository {
  async createSnapshot(
    db: Kysely<ServerDatabase>,
    input: CreateRegionSnapshotInput
  ): Promise<RegionSnapshotsSelect> {
    return await db.transaction().execute(async (trx) => {
      const snapshotRow = await trx
        .insertInto("region_snapshots")
        .values({
          snapshot_id: input.snapshotId,
          region_id: input.regionId,
          created_by: input.createdBy,
          tile_count: input.tiles.length,
          expected_hash: input.expectedHash
        } as RegionSnapshotsInsert)
        .returningAll()
        .executeTakeFirstOrThrow();

      if (input.tiles.length > 0) {
        const payloadRows: RegionSnapshotTilesInsert[] = input.tiles.map((tile) => ({
          snapshot_id: input.snapshotId,
          region_id: tile.regionId,
          cell_x: tile.cellX,
          cell_y: tile.cellY,
          offset_x: tile.offsetX,
          offset_y: tile.offsetY,
          shape: tile.shape,
          color: tile.color,
          style_payload: tile.stylePayload,
          owner_id: tile.ownerId
        }));

        await trx.insertInto("region_snapshot_tiles").values(payloadRows).execute();
      }

      return snapshotRow;
    });
  }

  async getLatestSnapshotForRegion(
    db: Kysely<ServerDatabase>,
    regionId: string
  ): Promise<RegionSnapshotWithTiles | null> {
    const snapshot = await db
      .selectFrom("region_snapshots")
      .selectAll()
      .where("region_id", "=", regionId)
      .orderBy("created_at", "desc")
      .orderBy("snapshot_id", "desc")
      .executeTakeFirst();

    if (!snapshot) {
      return null;
    }

    const tiles = await db
      .selectFrom("region_snapshot_tiles")
      .selectAll()
      .where("snapshot_id", "=", snapshot.snapshot_id)
      .orderBy("cell_x", "asc")
      .orderBy("cell_y", "asc")
      .execute();

    return { snapshot, tiles };
  }

  async restoreRegionFromSnapshot(
    db: Kysely<ServerDatabase>,
    snapshotId: string,
    regionId: string
  ): Promise<TilesSelect[]> {
    return await db.transaction().execute(async (trx) => {
      const snapshotTiles = await trx
        .selectFrom("region_snapshot_tiles")
        .selectAll()
        .where("snapshot_id", "=", snapshotId)
        .where("region_id", "=", regionId)
        .orderBy("cell_x", "asc")
        .orderBy("cell_y", "asc")
        .execute();

      await trx.deleteFrom("tiles").where("region_id", "=", regionId).execute();

      if (snapshotTiles.length > 0) {
        const restoreRows = snapshotTiles.map((tile) => ({
          region_id: tile.region_id,
          cell_x: tile.cell_x,
          cell_y: tile.cell_y,
          offset_x: tile.offset_x,
          offset_y: tile.offset_y,
          shape: tile.shape,
          color: tile.color,
          style_payload: tile.style_payload,
          owner_id: tile.owner_id
        } as TilesInsert));

        await trx.insertInto("tiles").values(restoreRows).execute();
      }

      return await this.selectTilesForRegion(trx, regionId);
    });
  }

  private async selectTilesForRegion(
    db: Kysely<ServerDatabase> | Transaction<ServerDatabase>,
    regionId: string
  ): Promise<TilesSelect[]> {
    return await db
      .selectFrom("tiles")
      .selectAll()
      .where("region_id", "=", regionId)
      .orderBy("cell_x", "asc")
      .orderBy("cell_y", "asc")
      .execute();
  }
}

export function createRegionSnapshotRepository(): IRegionSnapshotRepository {
  return new RegionSnapshotRepository();
}
