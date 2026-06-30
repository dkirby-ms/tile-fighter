import { Kysely } from "kysely";
import {
  ServerDatabase,
  SessionCheckpointsInsert,
  SessionCheckpointsSelect,
  SessionCheckpointsUpdate
} from "./db.js";

export type CreateSessionCheckpointInput = {
  playerIdentity: string;
  regionId: string;
  sessionId: string;
  roomId: string;
  lastConfirmedVersion?: number;
  clientChecksum?: string | null;
  serverChecksum?: string | null;
};

export type MarkCheckpointStaleInput = {
  checkpointId: string;
  staleSinceAt: Date;
  graceExpiresAt: Date;
};

export type RestoreCheckpointInput = {
  checkpointId: string;
  updatedAt?: Date;
};

export type UpdateCheckpointProgressInput = {
  checkpointId: string;
  lastConfirmedVersion: number;
  clientChecksum?: string | null;
  serverChecksum?: string | null;
  updatedAt?: Date;
};

export type ArchiveCheckpointInput = {
  checkpointId: string;
  archivedAt: Date;
};

export interface ISessionCheckpointRepository {
  createCheckpoint(
    db: Kysely<ServerDatabase>,
    input: CreateSessionCheckpointInput
  ): Promise<SessionCheckpointsSelect>;
  getActiveCheckpointByPlayerRegion(
    db: Kysely<ServerDatabase>,
    playerIdentity: string,
    regionId: string
  ): Promise<SessionCheckpointsSelect | null>;
  getCheckpointBySessionId(
    db: Kysely<ServerDatabase>,
    sessionId: string
  ): Promise<SessionCheckpointsSelect | null>;
  getStaleCheckpointBySessionId(
    db: Kysely<ServerDatabase>,
    sessionId: string
  ): Promise<SessionCheckpointsSelect | null>;
  markCheckpointStale(
    db: Kysely<ServerDatabase>,
    input: MarkCheckpointStaleInput
  ): Promise<SessionCheckpointsSelect | null>;
  restoreCheckpoint(
    db: Kysely<ServerDatabase>,
    input: RestoreCheckpointInput
  ): Promise<SessionCheckpointsSelect | null>;
  updateCheckpointProgress(
    db: Kysely<ServerDatabase>,
    input: UpdateCheckpointProgressInput
  ): Promise<SessionCheckpointsSelect | null>;
  archiveCheckpoint(
    db: Kysely<ServerDatabase>,
    input: ArchiveCheckpointInput
  ): Promise<SessionCheckpointsSelect | null>;
  archiveExpiredStaleCheckpoints(
    db: Kysely<ServerDatabase>,
    now: Date
  ): Promise<number>;
  getMinimumProtectedVersion(db: Kysely<ServerDatabase>, regionId: string): Promise<number | null>;
}

export class SessionCheckpointRepository implements ISessionCheckpointRepository {
  async createCheckpoint(
    db: Kysely<ServerDatabase>,
    input: CreateSessionCheckpointInput
  ): Promise<SessionCheckpointsSelect> {
    return await db
      .insertInto("session_checkpoints")
      .values({
        player_identity: input.playerIdentity,
        region_id: input.regionId,
        session_id: input.sessionId,
        room_id: input.roomId,
        last_confirmed_version: String(input.lastConfirmedVersion ?? 0),
        client_checksum: input.clientChecksum ?? null,
        server_checksum: input.serverChecksum ?? null
      } as SessionCheckpointsInsert)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async getActiveCheckpointByPlayerRegion(
    db: Kysely<ServerDatabase>,
    playerIdentity: string,
    regionId: string
  ): Promise<SessionCheckpointsSelect | null> {
    const row = await db
      .selectFrom("session_checkpoints")
      .selectAll()
      .where("player_identity", "=", playerIdentity)
      .where("region_id", "=", regionId)
      .where("archived_at", "is", null)
      .executeTakeFirst();

    return row ?? null;
  }

  async getCheckpointBySessionId(
    db: Kysely<ServerDatabase>,
    sessionId: string
  ): Promise<SessionCheckpointsSelect | null> {
    const row = await db
      .selectFrom("session_checkpoints")
      .selectAll()
      .where("session_id", "=", sessionId)
      .where("archived_at", "is", null)
      .executeTakeFirst();

    return row ?? null;
  }

  async getStaleCheckpointBySessionId(
    db: Kysely<ServerDatabase>,
    sessionId: string
  ): Promise<SessionCheckpointsSelect | null> {
    const row = await db
      .selectFrom("session_checkpoints")
      .selectAll()
      .where("session_id", "=", sessionId)
      .where("stale", "=", true)
      .where("archived_at", "is", null)
      .executeTakeFirst();

    return row ?? null;
  }

  async markCheckpointStale(
    db: Kysely<ServerDatabase>,
    input: MarkCheckpointStaleInput
  ): Promise<SessionCheckpointsSelect | null> {
    return await db
      .updateTable("session_checkpoints")
      .set({
        stale: true,
        stale_since_at: input.staleSinceAt,
        grace_expires_at: input.graceExpiresAt,
        updated_at: input.staleSinceAt
      } as SessionCheckpointsUpdate)
      .where("checkpoint_id", "=", input.checkpointId)
      .where("archived_at", "is", null)
      .returningAll()
      .executeTakeFirst() ?? null;
  }

  async restoreCheckpoint(
    db: Kysely<ServerDatabase>,
    input: RestoreCheckpointInput
  ): Promise<SessionCheckpointsSelect | null> {
    const updatedAt = input.updatedAt ?? new Date();

    return await db
      .updateTable("session_checkpoints")
      .set({
        stale: false,
        stale_since_at: null,
        grace_expires_at: null,
        updated_at: updatedAt
      } as SessionCheckpointsUpdate)
      .where("checkpoint_id", "=", input.checkpointId)
      .where("archived_at", "is", null)
      .returningAll()
      .executeTakeFirst() ?? null;
  }

  async updateCheckpointProgress(
    db: Kysely<ServerDatabase>,
    input: UpdateCheckpointProgressInput
  ): Promise<SessionCheckpointsSelect | null> {
    const updatedAt = input.updatedAt ?? new Date();

    return await db
      .updateTable("session_checkpoints")
      .set({
        last_confirmed_version: String(input.lastConfirmedVersion),
        client_checksum: input.clientChecksum,
        server_checksum: input.serverChecksum,
        updated_at: updatedAt
      } as SessionCheckpointsUpdate)
      .where("checkpoint_id", "=", input.checkpointId)
      .where("archived_at", "is", null)
      .returningAll()
      .executeTakeFirst() ?? null;
  }

  async archiveCheckpoint(
    db: Kysely<ServerDatabase>,
    input: ArchiveCheckpointInput
  ): Promise<SessionCheckpointsSelect | null> {
    return await db
      .updateTable("session_checkpoints")
      .set({
        archived_at: input.archivedAt,
        stale: false,
        stale_since_at: null,
        grace_expires_at: null,
        updated_at: input.archivedAt
      } as SessionCheckpointsUpdate)
      .where("checkpoint_id", "=", input.checkpointId)
      .where("archived_at", "is", null)
      .returningAll()
      .executeTakeFirst() ?? null;
  }

  async archiveExpiredStaleCheckpoints(
    db: Kysely<ServerDatabase>,
    now: Date
  ): Promise<number> {
    const rows = await db
      .updateTable("session_checkpoints")
      .set({
        archived_at: now,
        stale: false,
        updated_at: now
      } as SessionCheckpointsUpdate)
      .where("stale", "=", true)
      .where("archived_at", "is", null)
      .where("grace_expires_at", "<", now)
      .returning(["checkpoint_id"])
      .execute();

    return rows.length;
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
}

export function createSessionCheckpointRepository(): ISessionCheckpointRepository {
  return new SessionCheckpointRepository();
}
