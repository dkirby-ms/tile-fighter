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
}

export function createRegionDiffRepository(): IRegionDiffRepository {
  return new RegionDiffRepository();
}
