import { Kysely, Transaction } from "kysely";
import {
  ServerDatabase,
  TilesSelect,
  TilesInsert,
  TileDeltasInsert,
  PlacementCommandsInsert,
  PlacementCommandsSelect,
  PlacementCommandsUpdate
} from "./db.js";
import { hashPlacementCommandPayload } from "../domain/combat-simulation.service.js";
import { TelemetrySink } from "../telemetry/telemetry-sink.js";

/**
 * Input type for tile insertion with required fields
 */
export type InsertTileInput = {
  commandId?: string;
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
  winner_owner_id?: string;
  winner_tile_id?: number;
  winner_resolved_at?: Date;
};

type PlacementReplaySnapshot = {
  ok: true;
  tileId: number;
  createdAt: string;
};

type PlacementOccupiedSnapshot = {
  ok: false;
  reason: "occupied";
  commandId: string;
  regionId: string;
  cell: {
    cellX: number;
    cellY: number;
  };
  winner: {
    ownerId: string;
    tileId: number;
    resolvedAt: string;
  };
};

type PlacementMismatchSnapshot = {
  ok: false;
  reason: "command_payload_mismatch";
  commandId: string;
  regionId: string;
};

type PlacementCommandResponseSnapshot =
  | PlacementReplaySnapshot
  | PlacementOccupiedSnapshot
  | PlacementMismatchSnapshot;

type PlacementCommandOutcome = "applied" | "occupied";

/**
 * Result type for insert operation - union of success and conflict cases
 * sequenceId (region version) is included on success for fanout coordination
 */
export type InsertTileResult =
  | {
      ok: true;
      tile: { id: number; createdAt: Date; sequenceId: number };
      replayed: boolean;
    }
  | {
      ok: false;
      reason: "coordinate_conflict";
      replayed: boolean;
      commandId: string;
      regionId: string;
      error: TileConflictError;
    }
  | {
      ok: false;
      reason: "command_payload_mismatch";
      replayed: boolean;
      commandId: string;
      regionId: string;
    };

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
  private readonly replayWindowSeconds: number;
  private readonly telemetrySink: TelemetrySink | null;

  constructor(options?: { replayWindowSeconds?: number; telemetrySink?: TelemetrySink | null }) {
    this.replayWindowSeconds = options?.replayWindowSeconds ?? 900;
    this.telemetrySink = options?.telemetrySink ?? null;
  }

  private resolveCommandId(input: InsertTileInput): string {
    if (input.commandId && input.commandId.trim().length > 0) {
      return input.commandId;
    }

    return `legacy-${input.ownerId}-${input.regionId}-${input.cellX}-${input.cellY}`;
  }

  private supportsPlacementLedger(
    db: Transaction<ServerDatabase>
  ): db is Transaction<ServerDatabase> & {
    selectFrom: Transaction<ServerDatabase>["selectFrom"];
    insertInto: Transaction<ServerDatabase>["insertInto"];
    updateTable: Transaction<ServerDatabase>["updateTable"];
  } {
    const candidate = db as unknown as {
      selectFrom?: unknown;
      insertInto?: unknown;
      updateTable?: unknown;
    };

    return (
      typeof candidate.selectFrom === "function" &&
      typeof candidate.insertInto === "function" &&
      typeof candidate.updateTable === "function"
    );
  }

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
    const now = new Date();
    const commandId = this.resolveCommandId(input);
    const requestHash = hashPlacementCommandPayload({
      regionId: input.regionId,
      actorId: input.ownerId,
      commandId,
      cellX: input.cellX,
      cellY: input.cellY,
      offsetX: input.offsetX,
      offsetY: input.offsetY,
      shape: input.shape,
      color: input.color,
      stylePayload: input.stylePayload
    });

    return this.withTransaction(db, async (trx) => {
      if (!this.supportsPlacementLedger(trx)) {
        return this.insertTileLegacy(trx, input);
      }

      const existing = await trx
        .selectFrom("placement_commands")
        .selectAll()
        .where("region_id", "=", input.regionId)
        .where("actor_id", "=", input.ownerId)
        .where("command_id", "=", commandId)
        .forUpdate()
        .executeTakeFirst();

      if (existing && existing.expires_at > now) {
        if (existing.request_hash !== requestHash) {
          const mismatchResult: InsertTileResult = {
            ok: false,
            reason: "command_payload_mismatch",
            replayed: false,
            commandId,
            regionId: input.regionId
          };
          return mismatchResult;
        }

        return this.mapLedgerReplay(existing);
      }

      if (existing && existing.expires_at <= now) {
        // Expired command identities must not replay stale responses.
        await trx
          .updateTable("placement_commands")
          .set(this.buildPendingLedgerUpdate(input, commandId, requestHash, now))
          .where("region_id", "=", input.regionId)
          .where("actor_id", "=", input.ownerId)
          .where("command_id", "=", commandId)
          .executeTakeFirst();
      }

      if (!existing) {
        await trx
          .insertInto("placement_commands")
          .values(this.buildPendingLedgerInsert(input, commandId, requestHash, now))
          .executeTakeFirst();
      }

      try {
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

        const snapshot: PlacementReplaySnapshot = {
          ok: true,
          tileId: insertedTile.id,
          createdAt: insertedTile.created_at.toISOString()
        };

        await this.updateLedgerOutcome(trx, {
          input,
          commandId,
          requestHash,
          now,
          outcome: "applied",
          responseSnapshot: snapshot,
          winnerOwnerId: null,
          winnerTileId: null,
          winnerResolvedAt: null
        });

        return {
          ok: true,
          replayed: false,
          tile: {
            id: insertedTile.id,
            createdAt: insertedTile.created_at,
            sequenceId
          }
        };
      } catch (error) {
        if (this.isCoordinateConflict(error)) {
          const winnerTile = await trx
            .selectFrom("tiles")
            .select(["id", "owner_id", "created_at"])
            .where("region_id", "=", input.regionId)
            .where("cell_x", "=", input.cellX)
            .where("cell_y", "=", input.cellY)
            .executeTakeFirst();

          const winnerOwnerId = winnerTile?.owner_id ?? "unknown";
          const winnerTileId = winnerTile?.id ?? 0;
          const winnerResolvedAt = winnerTile?.created_at ?? now;

          await this.telemetrySink?.emitPlacementConflictDetected({
            regionId: input.regionId,
            commandId,
            actorId: input.ownerId,
            cellX: input.cellX,
            cellY: input.cellY,
            winnerOwnerId,
            winnerTileId
          });

          const snapshot: PlacementOccupiedSnapshot = {
            ok: false,
            reason: "occupied",
            commandId,
            regionId: input.regionId,
            cell: {
              cellX: input.cellX,
              cellY: input.cellY
            },
            winner: {
              ownerId: winnerOwnerId,
              tileId: winnerTileId,
              resolvedAt: winnerResolvedAt.toISOString()
            }
          };

          await this.updateLedgerOutcome(trx, {
            input,
            commandId,
            requestHash,
            now,
            outcome: "occupied",
            responseSnapshot: snapshot,
            winnerOwnerId,
            winnerTileId,
            winnerResolvedAt
          });

          await this.telemetrySink?.emitPlacementConflictResolved({
            regionId: input.regionId,
            commandId,
            actorId: input.ownerId,
            cellX: input.cellX,
            cellY: input.cellY,
            outcome: "occupied",
            replayed: false,
            winnerOwnerId,
            winnerTileId,
            winnerResolvedAt: winnerResolvedAt.toISOString()
          });

          return {
            ok: false,
            reason: "coordinate_conflict",
            replayed: false,
            commandId,
            regionId: input.regionId,
            error: {
              type: "coordinate_conflict",
              region_id: input.regionId,
              cell_x: input.cellX,
              cell_y: input.cellY,
              winner_owner_id: winnerOwnerId,
              winner_tile_id: winnerTileId,
              winner_resolved_at: winnerResolvedAt
            }
          };
        }

        throw error;
      }
    });
  }

  private async insertTileLegacy(
    trx: Transaction<ServerDatabase>,
    input: InsertTileInput
  ): Promise<InsertTileResult> {
    try {
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

      return {
        ok: true,
        replayed: false,
        tile: {
          id: insertedTile.id,
          createdAt: insertedTile.created_at,
          sequenceId: 0
        }
      };
    } catch (error) {
      if (this.isCoordinateConflict(error)) {
        const commandId = this.resolveCommandId(input);
        return {
          ok: false,
          reason: "coordinate_conflict",
          replayed: false,
          commandId,
          regionId: input.regionId,
          error: {
            type: "coordinate_conflict",
            region_id: input.regionId,
            cell_x: input.cellX,
            cell_y: input.cellY
          }
        };
      }

      throw error;
    }
  }

  private async mapLedgerReplay(existing: PlacementCommandsSelect): Promise<InsertTileResult> {
    const snapshot = existing.response_snapshot as PlacementCommandResponseSnapshot;

    if (existing.outcome === "applied" && snapshot.ok === true) {
      return {
        ok: true,
        replayed: true,
        tile: {
          id: snapshot.tileId,
          createdAt: new Date(snapshot.createdAt),
          sequenceId: 0
        }
      };
    }

    if (existing.outcome === "occupied" && snapshot.ok === false && snapshot.reason === "occupied") {
      await this.telemetrySink?.emitPlacementConflictResolved({
        regionId: snapshot.regionId,
        commandId: snapshot.commandId,
        actorId: existing.actor_id,
        cellX: snapshot.cell.cellX,
        cellY: snapshot.cell.cellY,
        outcome: "occupied",
        replayed: true,
        winnerOwnerId: snapshot.winner.ownerId,
        winnerTileId: snapshot.winner.tileId,
        winnerResolvedAt: snapshot.winner.resolvedAt
      });

      return {
        ok: false,
        reason: "coordinate_conflict",
        replayed: true,
        commandId: snapshot.commandId,
        regionId: snapshot.regionId,
        error: {
          type: "coordinate_conflict",
          region_id: snapshot.regionId,
          cell_x: snapshot.cell.cellX,
          cell_y: snapshot.cell.cellY,
          winner_owner_id: snapshot.winner.ownerId,
          winner_tile_id: snapshot.winner.tileId,
          winner_resolved_at: new Date(snapshot.winner.resolvedAt)
        }
      };
    }

    return {
      ok: false,
      reason: "command_payload_mismatch",
      replayed: false,
      commandId: existing.command_id,
      regionId: existing.region_id
    };
  }

  private buildPendingLedgerInsert(
    input: InsertTileInput,
    commandId: string,
    requestHash: string,
    now: Date
  ): PlacementCommandsInsert {
    const expiresAt = new Date(now.getTime() + this.replayWindowSeconds * 1000);

    return {
      region_id: input.regionId,
      actor_id: input.ownerId,
      command_id: commandId,
      request_hash: requestHash,
      outcome: "pending",
      response_snapshot: {
        ok: false,
        reason: "command_payload_mismatch",
        commandId,
        regionId: input.regionId
      },
      winner_owner_id: null,
      winner_tile_id: null,
      winner_resolved_at: null,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now
    };
  }

  private buildPendingLedgerUpdate(
    input: InsertTileInput,
    commandId: string,
    requestHash: string,
    now: Date
  ): PlacementCommandsUpdate {
    const expiresAt = new Date(now.getTime() + this.replayWindowSeconds * 1000);

    return {
      request_hash: requestHash,
      outcome: "pending",
      response_snapshot: {
        ok: false,
        reason: "command_payload_mismatch",
        commandId,
        regionId: input.regionId
      },
      winner_owner_id: null,
      winner_tile_id: null,
      winner_resolved_at: null,
      expires_at: expiresAt,
      updated_at: now
    };
  }

  private async updateLedgerOutcome(
    db: Transaction<ServerDatabase>,
    args: {
      input: InsertTileInput;
      commandId: string;
      requestHash: string;
      now: Date;
      outcome: PlacementCommandOutcome;
      responseSnapshot: PlacementCommandResponseSnapshot;
      winnerOwnerId: string | null;
      winnerTileId: number | null;
      winnerResolvedAt: Date | null;
    }
  ): Promise<void> {
    const expiresAt = new Date(args.now.getTime() + this.replayWindowSeconds * 1000);

    await db
      .updateTable("placement_commands")
      .set({
        request_hash: args.requestHash,
        outcome: args.outcome,
        response_snapshot: args.responseSnapshot,
        winner_owner_id: args.winnerOwnerId,
        winner_tile_id: args.winnerTileId,
        winner_resolved_at: args.winnerResolvedAt,
        expires_at: expiresAt,
        updated_at: args.now
      })
      .where("region_id", "=", args.input.regionId)
      .where("actor_id", "=", args.input.ownerId)
        .where("command_id", "=", args.commandId)
      .executeTakeFirst();
  }

  private isCoordinateConflict(error: unknown): boolean {
    if (!(error instanceof Error) || !error.message || !error.message.includes("23505")) {
      return false;
    }

    return (
      error.message.includes("tiles_region_coordinate_unique") ||
      error.message.includes("region_id") ||
      error.message.includes("cell_x") ||
      error.message.includes("cell_y")
    );
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
export function createTileRepository(options?: {
  replayWindowSeconds?: number;
  telemetrySink?: TelemetrySink | null;
}): ITileRepository {
  return new TileRepository(options);
}
