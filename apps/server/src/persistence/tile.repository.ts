import { Kysely } from "kysely";
import { ServerDatabase, TilesSelect, TilesInsert } from "./db.js";

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
 */
export type InsertTileResult =
  | { ok: true; tile: { id: number; createdAt: Date } }
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
  /**
   * Insert a tile with deterministic conflict error handling
   * Maps SQLSTATE 23505 (unique violation) to coordinate_conflict result
   */
  async insertTile(
    db: Kysely<ServerDatabase>,
    input: InsertTileInput
  ): Promise<InsertTileResult> {
    try {
      const result = await db
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

      return {
        ok: true,
        tile: {
          id: result.id,
          createdAt: result.created_at
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
   * created_at remains the policy anchor and is never updated.
   */
  async editTileWithinSelfEditWindow(
    db: Kysely<ServerDatabase>,
    input: EditTileInput
  ): Promise<EditTileResult> {
    const windowStart = new Date(input.now.getTime() - input.selfEditWindowMs);

    const updated = await db
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
}

/**
 * Factory function to create a tile repository instance
 */
export function createTileRepository(): ITileRepository {
  return new TileRepository();
}
