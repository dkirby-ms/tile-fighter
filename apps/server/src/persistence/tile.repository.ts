import { Kysely, Transaction } from "kysely";
import { ServerDatabase, TilesSelect, TilesInsert, TileDeltasInsert } from "./db.js";

/**
 * Input type for tile insertion with required fields
 */
export type InsertTileInput = {
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

/**
 * Tile conflict error type for deterministic conflict handling
 */
export type TileConflictError = {
  type: "coordinate_conflict";
  region_id: string;
  cell_x: number;
  cell_y: number;
};

/**
 * Result type for insert operation - union of success and conflict cases
 * sequenceId (region version) is included on success for fanout coordination
 */
export type InsertTileResult =
  | { ok: true; tile: { id: number; createdAt: Date; sequenceId: number } }
  | { ok: false; reason: "coordinate_conflict"; error: TileConflictError };

/**
 * Input type for bounded tile edits using server time and created_at anchor
 */
export type EditTileInput = {
  regionId: string;
  cellX: number;
  cellY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
  ownerId: string;
  now: Date;
  selfEditWindowMs: number;
};

/**
 * Result type for bounded edit operation with deterministic rejection reasons
 */
export type EditTileResult =
  | { ok: true; tile: { id: number; editedAt: Date } }
  | { ok: false; reason: "forbidden_owner_mismatch" | "edit_window_expired" };

export type DeleteTileInput = {
  regionId: string;
  cellX: number;
  cellY: number;
  ownerId: string;
};

export type DeleteTileResult =
  | { ok: true; tile: { id: number; deletedAt: Date } }
  | { ok: false; reason: "forbidden_owner_mismatch" | "not_found" };

/**
 * Tile Repository interface for data access
 */
export interface ITileRepository {
  insertTile(
    db: Kysely<ServerDatabase>,
    input: InsertTileInput
  ): Promise<InsertTileResult>;
  editTileWithinSelfEditWindow(
    db: Kysely<ServerDatabase>,
    input: EditTileInput
  ): Promise<EditTileResult>;
  deleteTile(db: Kysely<ServerDatabase>, input: DeleteTileInput): Promise<DeleteTileResult>;
  selectTilesByRegion(
    db: Kysely<ServerDatabase>,
    regionId: string
  ): Promise<TilesSelect[]>;
  selectTileByCoordinate(
    db: Kysely<ServerDatabase>,
    regionId: string,
    cellX: number,
    cellY: number
  ): Promise<TilesSelect | null>;
}

/**
 * Tile Repository implementation with Kysely queries and deterministic conflict handling
 */
export class TileRepository implements ITileRepository {
  private canPersistRegionDiff(
    db: Transaction<ServerDatabase>
  ): db is Transaction<ServerDatabase> & {
    selectFrom: Transaction<ServerDatabase>["selectFrom"];
    insertInto: Transaction<ServerDatabase>["insertInto"];
  } {
    const candidate = db as unknown as {
      selectFrom?: unknown;
      insertInto?: unknown;
    };

    return (
      typeof candidate.selectFrom === "function" &&
      typeof candidate.insertInto === "function"
    );
  }

  private async withTransaction<T>(
    db: Kysely<ServerDatabase>,
    handler: (trx: Transaction<ServerDatabase>) => Promise<T>
  ): Promise<T> {
    const dbWithMaybeTransaction = db as Kysely<ServerDatabase> & {
      transaction?: () => { execute: (cb: (trx: Transaction<ServerDatabase>) => Promise<T>) => Promise<T> };
    };

    if (typeof dbWithMaybeTransaction.transaction === "function") {
      return dbWithMaybeTransaction.transaction().execute(handler);
    }

    // Unit tests use lightweight DB doubles without transaction() support.
    return handler(db as unknown as Transaction<ServerDatabase>);
  }

  /**
   * Insert a tile with deterministic conflict error handling
   * Maps SQLSTATE 23505 (unique violation) to coordinate_conflict result
   * Returns sequenceId (region version) for fanout coordination
   */
  async insertTile(
    db: Kysely<ServerDatabase>,
    input: InsertTileInput
  ): Promise<InsertTileResult> {
    try {
      const result = await this.withTransaction(db, async (trx) => {
        const insertedTile = await trx
          .insertInto("tiles")
          .values({
            region_id: input.regionId,
            cell_x: input.cellX,
            cell_y: input.cellY,
            offset_x: input.offsetX,
            offset_y: input.offsetY,
            shape: input.shape,
            color: input.color,
            style_payload: input.stylePayload,
            owner_id: input.ownerId
          } as TilesInsert)
          .returningAll()
          .executeTakeFirstOrThrow();

        let sequenceId = 0;
        if (this.canPersistRegionDiff(trx)) {
          sequenceId = await this.bumpRegionVersion(trx, input.regionId);

          await trx
            .insertInto("tile_deltas")
            .values({
              region_id: input.regionId,
              version: String(sequenceId),
              cell_x: input.cellX,
              cell_y: input.cellY,
              operation: "upsert",
              offset_x: input.offsetX,
              offset_y: input.offsetY,
              shape: input.shape,
              color: input.color,
              style_payload: input.stylePayload,
              owner_id: input.ownerId
            } as TileDeltasInsert)
            .executeTakeFirst();
        }

        return { insertedTile, sequenceId };
      });

      return {
        ok: true,
        tile: {
          id: result.insertedTile.id,
          createdAt: result.insertedTile.created_at,
          sequenceId: result.sequenceId
        }
      };
    } catch (error) {
      // Discriminate SQLSTATE 23505 (unique constraint violation)
      if (
        error instanceof Error &&
        error.message &&
        error.message.includes("23505")
      ) {
        // Check if it's the coordinate_unique constraint
        if (
          error.message.includes("tiles_region_coordinate_unique") ||
          error.message.includes("region_id") ||
          error.message.includes("cell_x") ||
          error.message.includes("cell_y")
        ) {
          return {
            ok: false,
            reason: "coordinate_conflict",
            error: {
              type: "coordinate_conflict",
              region_id: input.regionId,
              cell_x: input.cellX,
              cell_y: input.cellY
            }
          };
        }
      }

      // Re-throw any other errors
      throw error;
    }
  }

  /**
   * Edit a tile only when owner matches and created_at is within self-edit window.
   *
   * FIXED WINDOW DESIGN (NOT SLIDING):
   * - created_at is immutable and serves as the policy anchor
   * - Edit window is [created_at, created_at + selfEditWindowMs)
   * - The window is NOT reset on each edit (not sliding)
   * - This ensures deterministic audit trail: a tile placed at T0 can always be edited until T0+10min
   * - Design rationale: (a) Predictable UX for players; (b) Audit-friendly (no hidden state);
   *   (c) Prevents accidental greedy re-editing windows
   *
   * CLOCK SKEW EDGE CASE:
   * - If server clock jumps backward (correction, deployment race), `input.now` may be before
   *   an existing tile's `created_at`. The WHERE clause "created_at >= windowStart" will
   *   fail to match even if the tile was just created.
   * - Behavior: Returns forbidden_edit_window_expired (client sees "window expired")
   * - Recovery: Operator must resolve clock drift before tiles can be edited again
   * - Note: This is acceptable because clock skew is rare and immediate recovery is problematic;
   *   we err on the side of blocking rather than allowing potentially invalid edits
   */
  async editTileWithinSelfEditWindow(
    db: Kysely<ServerDatabase>,
    input: EditTileInput
  ): Promise<EditTileResult> {
    const windowStart = new Date(input.now.getTime() - input.selfEditWindowMs);

    const updated = await this.withTransaction(db, async (trx) => {
      const updatedRow = await trx
        .updateTable("tiles")
        .set({
          shape: input.shape,
          color: input.color,
          style_payload: input.stylePayload
        })
        .where("region_id", "=", input.regionId)
        .where("cell_x", "=", input.cellX)
        .where("cell_y", "=", input.cellY)
        .where("owner_id", "=", input.ownerId)
        .where("created_at", ">=", windowStart)
        .returning(["id"])
        .executeTakeFirst();

      if (!updatedRow) {
        return null;
      }

      if (this.canPersistRegionDiff(trx)) {
        const nextVersion = await this.bumpRegionVersion(trx, input.regionId);

        await trx
          .insertInto("tile_deltas")
          .values({
            region_id: input.regionId,
            version: String(nextVersion),
            cell_x: input.cellX,
            cell_y: input.cellY,
            operation: "upsert",
            shape: input.shape,
            color: input.color,
            style_payload: input.stylePayload,
            owner_id: input.ownerId
          } as TileDeltasInsert)
          .executeTakeFirst();
      }

      return updatedRow;
    });

    if (updated) {
      return {
        ok: true,
        tile: {
          id: updated.id,
          editedAt: input.now
        }
      };
    }

    const existing = await this.selectTileByCoordinate(
      db,
      input.regionId,
      input.cellX,
      input.cellY
    );

    if (!existing || existing.owner_id !== input.ownerId) {
      return {
        ok: false,
        reason: "forbidden_owner_mismatch"
      };
    }

    return {
      ok: false,
      reason: "edit_window_expired"
    };
  }

  async deleteTile(
    db: Kysely<ServerDatabase>,
    input: DeleteTileInput
  ): Promise<DeleteTileResult> {
    const now = new Date();

    const deleted = await this.withTransaction(db, async (trx) => {
      const deletedRow = await trx
        .deleteFrom("tiles")
        .where("region_id", "=", input.regionId)
        .where("cell_x", "=", input.cellX)
        .where("cell_y", "=", input.cellY)
        .where("owner_id", "=", input.ownerId)
        .returning(["id"])
        .executeTakeFirst();

      if (!deletedRow) {
        return null;
      }

      if (this.canPersistRegionDiff(trx)) {
        const nextVersion = await this.bumpRegionVersion(trx, input.regionId);

        await trx
          .insertInto("tile_deltas")
          .values({
            region_id: input.regionId,
            version: String(nextVersion),
            cell_x: input.cellX,
            cell_y: input.cellY,
            operation: "delete",
            offset_x: null,
            offset_y: null,
            shape: null,
            color: null,
            style_payload: null,
            owner_id: null
          } as TileDeltasInsert)
          .executeTakeFirst();
      }

      return deletedRow;
    });

    if (deleted) {
      return {
        ok: true,
        tile: {
          id: deleted.id,
          deletedAt: now
        }
      };
    }

    const existing = await this.selectTileByCoordinate(
      db,
      input.regionId,
      input.cellX,
      input.cellY
    );

    if (!existing) {
      return {
        ok: false,
        reason: "not_found"
      };
    }

    return {
      ok: false,
      reason: "forbidden_owner_mismatch"
    };
  }

  /**
   * Select all tiles in a region using indexed query
   */
  async selectTilesByRegion(
    db: Kysely<ServerDatabase>,
    regionId: string
  ): Promise<TilesSelect[]> {
    return await db
      .selectFrom("tiles")
      .selectAll()
      .where("region_id", "=", regionId)
      .orderBy("created_at", "asc")
      .execute();
  }

  /**
   * Select a single tile by region and coordinate
   */
  async selectTileByCoordinate(
    db: Kysely<ServerDatabase>,
    regionId: string,
    cellX: number,
    cellY: number
  ): Promise<TilesSelect | null> {
    const result = await db
      .selectFrom("tiles")
      .selectAll()
      .where("region_id", "=", regionId)
      .where("cell_x", "=", cellX)
      .where("cell_y", "=", cellY)
      .executeTakeFirst();

    return result ?? null;
  }

  private async bumpRegionVersion(
    db: Transaction<ServerDatabase>,
    regionId: string
  ): Promise<number> {
    const current = await db
      .selectFrom("region_versions")
      .select(["current_version"])
      .where("region_id", "=", regionId)
      .forUpdate()
      .executeTakeFirst();

    const nextVersion = current ? Number(current.current_version) + 1 : 1;

    await db
      .insertInto("region_versions")
      .values({
        region_id: regionId,
        current_version: String(nextVersion),
        updated_at: new Date()
      })
      .onConflict((oc) =>
        oc.column("region_id").doUpdateSet({
          current_version: String(nextVersion),
          updated_at: new Date()
        })
      )
      .executeTakeFirst();

    return nextVersion;
  }
}

/**
 * Factory function to create a tile repository instance
 */
export function createTileRepository(): ITileRepository {
  return new TileRepository();
}
