import { Kysely, PostgresDialect, sql, Selectable, Insertable, Updateable } from "kysely";
import { Pool } from "pg";
import { readinessSql } from "@game/shared-persistence";

type MatchEventsTable = {
  id: number;
  room_id: string;
  tick: number;
  payload: unknown;
  created_at: Date;
};

type TilesTable = {
  id: number;
  region_id: string;
  cell_x: number;
  cell_y: number;
  offset_x: number;
  offset_y: number;
  shape: string;
  color: string;
  style_payload: unknown;
  owner_id: string;
  created_at: Date;
};

type RegionSnapshotsTable = {
  snapshot_id: string;
  region_id: string;
  created_by: string;
  tile_count: number;
  expected_hash: string;
  created_at: Date;
};

type RegionSnapshotTilesTable = {
  snapshot_id: string;
  region_id: string;
  cell_x: number;
  cell_y: number;
  offset_x: number;
  offset_y: number;
  shape: string;
  color: string;
  style_payload: unknown;
  owner_id: string;
};

export type ServerDatabase = {
  match_events: MatchEventsTable;
  tiles: TilesTable;
  region_snapshots: RegionSnapshotsTable;
  region_snapshot_tiles: RegionSnapshotTilesTable;
};

export type TilesSelect = Selectable<TilesTable>;
export type TilesInsert = Insertable<TilesTable>;
export type TilesUpdate = Updateable<TilesTable>;
export type RegionSnapshotsSelect = Selectable<RegionSnapshotsTable>;
export type RegionSnapshotsInsert = Insertable<RegionSnapshotsTable>;
export type RegionSnapshotTilesSelect = Selectable<RegionSnapshotTilesTable>;
export type RegionSnapshotTilesInsert = Insertable<RegionSnapshotTilesTable>;

export type DatabaseRuntime = {
  db: Kysely<ServerDatabase>;
  pool: Pool;
};

export function createDatabaseRuntime(connectionString: string): DatabaseRuntime {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });

  const db = new Kysely<ServerDatabase>({
    dialect: new PostgresDialect({ pool })
  });

  return { db, pool };
}

export async function verifyDatabaseConnectivity(db: Kysely<ServerDatabase>): Promise<void> {
  await sql.raw(readinessSql).execute(db);
}

export async function closeDatabaseRuntime(runtime: DatabaseRuntime): Promise<void> {
  await runtime.db.destroy();
}