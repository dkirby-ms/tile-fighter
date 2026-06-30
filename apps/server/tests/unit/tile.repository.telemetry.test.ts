import { describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { TileRepository } from "../../src/persistence/tile.repository.js";
import { ServerDatabase } from "../../src/persistence/db.js";

describe("TileRepository telemetry conflict emission", () => {
  it("emits placement_conflict_detected and placement_conflict_resolved once for fresh conflict", async () => {
    const telemetrySink = {
      emitPlacementConflictDetected: vi.fn(async () => undefined),
      emitPlacementConflictResolved: vi.fn(async () => undefined)
    };

    const now = new Date("2026-06-30T12:00:00.000Z");

    const trx = {
      selectFrom: vi.fn((table: string) => {
        if (table === "placement_commands") {
          return {
            selectAll: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            forUpdate: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn(async () => undefined)
          };
        }

        if (table === "tiles") {
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn(async () => ({
              id: 7001,
              owner_id: "tenant-a|winner",
              created_at: now
            }))
          };
        }

        if (table === "region_versions") {
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            forUpdate: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn(async () => undefined)
          };
        }

        return {
          selectAll: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn(async () => undefined)
        };
      }),
      insertInto: vi.fn((table: string) => {
        if (table === "placement_commands") {
          return {
            values: vi.fn(() => ({
              executeTakeFirst: vi.fn(async () => undefined)
            }))
          };
        }

        if (table === "tiles") {
          return {
            values: vi.fn(() => ({
              returningAll: vi.fn(() => ({
                executeTakeFirstOrThrow: vi.fn(async () => {
                  throw new Error(
                    'duplicate key value violates unique constraint "tiles_region_coordinate_unique" (SQLSTATE 23505)'
                  );
                })
              }))
            }))
          };
        }

        if (table === "region_versions" || table === "tile_deltas") {
          return {
            values: vi.fn(() => ({
              onConflict: vi.fn(() => ({ executeTakeFirst: vi.fn(async () => undefined) })),
              executeTakeFirst: vi.fn(async () => undefined)
            }))
          };
        }

        return {
          values: vi.fn(() => ({ executeTakeFirst: vi.fn(async () => undefined) }))
        };
      }),
      updateTable: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn(async () => undefined)
        }))
      }))
    };

    const db = {
      selectFrom: vi.fn((table: string) => {
        if (table === "tiles") {
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn(async () => ({
              id: 7001,
              owner_id: "tenant-a|winner",
              created_at: now
            }))
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          executeTakeFirst: vi.fn(async () => undefined)
        };
      }),
      transaction: () => ({
        execute: async <T>(callback: (trxArg: typeof trx) => Promise<T>) => callback(trx)
      })
    } as unknown as Kysely<ServerDatabase>;

    const repository = new TileRepository({
      telemetrySink: telemetrySink as never
    });

    const result = await repository.insertTile(db, {
      commandId: "cmd_telemetry_conflict_001",
      regionId: "telemetry-region",
      cellX: 9,
      cellY: 9,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "orange",
      stylePayload: { telemetry: true },
      ownerId: "tenant-a|loser"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("coordinate_conflict");
      expect(result.error.winner_owner_id).toBe("tenant-a|winner");
      expect(result.error.winner_tile_id).toBe(7001);
    }

    expect(telemetrySink.emitPlacementConflictDetected).toHaveBeenCalledTimes(1);
    expect(telemetrySink.emitPlacementConflictResolved).toHaveBeenCalledTimes(1);
  });
});
