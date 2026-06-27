import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { readinessSql } from "@game/shared-persistence";

type MatchEventsTable = {
  id: number;
  room_id: string;
  tick: number;
  payload: unknown;
  created_at: Date;
};

export type ServerDatabase = {
  match_events: MatchEventsTable;
};

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