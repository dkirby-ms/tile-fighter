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
 * Tile Repository interface for data access
 */
export interface ITileRepository {
  insertTile(
    db: Kysely<ServerDatabase>,
    input: InsertTileInput
  ): Promise<InsertTileResult>;
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
