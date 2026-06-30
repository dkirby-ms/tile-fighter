import { Kysely } from "kysely";
import { ServerDatabase, TileDeltasSelect } from "./db.js";

export type ViewportBounds = {
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
};

export type GetTileDeltasSinceInput = {
  regionId: string;
  sinceVersion: number;
  viewport: ViewportBounds;
};

export interface IRegionDiffRepository {
  getCurrentRegionVersion(db: Kysely<ServerDatabase>, regionId: string): Promise<number>;
  getTileDeltasSince(
    db: Kysely<ServerDatabase>,
    input: GetTileDeltasSinceInput
  ): Promise<TileDeltasSelect[]>;
  getMinimumProtectedVersion(db: Kysely<ServerDatabase>, regionId: string): Promise<number | null>;
  getRetainedTileDeltasSince(
    db: Kysely<ServerDatabase>,
    input: GetTileDeltasSinceInput,
    minimumProtectedVersion: number | null
  ): Promise<TileDeltasSelect[]>;
  deleteExpiredTileDeltas(
    db: Kysely<ServerDatabase>,
    input: { regionId: string; expiresBefore: Date; minimumProtectedVersion: number | null }
  ): Promise<number>;
}

export class RegionDiffRepository implements IRegionDiffRepository {
  async getCurrentRegionVersion(db: Kysely<ServerDatabase>, regionId: string): Promise<number> {
    const row = await db
      .selectFrom("region_versions")
      .select(["current_version"])
      .where("region_id", "=", regionId)
      .executeTakeFirst();

    if (!row) {
      return 0;
    }

    return Number(row.current_version);
  }

  async getTileDeltasSince(
    db: Kysely<ServerDatabase>,
    input: GetTileDeltasSinceInput
  ): Promise<TileDeltasSelect[]> {
    return await db
      .selectFrom("tile_deltas")
      .selectAll()
      .where("region_id", "=", input.regionId)
      .where("version", ">", String(input.sinceVersion))
      .where("cell_x", ">=", input.viewport.minCellX)
      .where("cell_x", "<=", input.viewport.maxCellX)
      .where("cell_y", ">=", input.viewport.minCellY)
      .where("cell_y", "<=", input.viewport.maxCellY)
      .orderBy("version", "asc")
      .orderBy("id", "asc")
      .execute();
  }

  async getMinimumProtectedVersion(
    db: Kysely<ServerDatabase>,
    regionId: string
  ): Promise<number | null> {
    const row = await db
      .selectFrom("session_checkpoints")
      .select(({ fn }) => [fn.min("last_confirmed_version").as("min_version")])
      .where("region_id", "=", regionId)
      .where("archived_at", "is", null)
      .executeTakeFirst();

    if (!row || row.min_version === null) {
      return null;
    }

    return Number(row.min_version);
  }

  async getRetainedTileDeltasSince(
    db: Kysely<ServerDatabase>,
    input: GetTileDeltasSinceInput,
    minimumProtectedVersion: number | null
  ): Promise<TileDeltasSelect[]> {
    const effectiveSinceVersion =
      minimumProtectedVersion === null
        ? input.sinceVersion
        : Math.max(input.sinceVersion, minimumProtectedVersion - 1);

    return await this.getTileDeltasSince(db, {
      ...input,
      sinceVersion: effectiveSinceVersion
    });
  }

  async deleteExpiredTileDeltas(
    db: Kysely<ServerDatabase>,
    input: { regionId: string; expiresBefore: Date; minimumProtectedVersion: number | null }
  ): Promise<number> {
    let query = db
      .deleteFrom("tile_deltas")
      .where("region_id", "=", input.regionId)
      .where("ttl_expires_at", "is not", null)
      .where("ttl_expires_at", "<", input.expiresBefore);

    if (input.minimumProtectedVersion !== null) {
      query = query.where("version", "<", String(input.minimumProtectedVersion));
    }

    const deleted = await query.returning(["id"]).execute();
    return deleted.length;
  }
}

export function createRegionDiffRepository(): IRegionDiffRepository {
  return new RegionDiffRepository();
}
