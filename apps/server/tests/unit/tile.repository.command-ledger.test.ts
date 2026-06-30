import { describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { TileRepository } from "../../src/persistence/tile.repository.js";
import { ServerDatabase } from "../../src/persistence/db.js";
import { hashPlacementCommandPayload } from "../../src/domain/combat-simulation.service.js";

type PlacementCommandRow = {
  region_id: string;
  actor_id: string;
  command_id: string;
  request_hash: string;
  outcome: string;
  response_snapshot: unknown;
  winner_owner_id: string | null;
  winner_tile_id: number | null;
  winner_resolved_at: Date | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
};

type MockLedgerState = {
  placementCommand: PlacementCommandRow | null;
  winnerTile: { id: number; owner_id: string; created_at: Date } | null;
  tileInsertMode: "conflict" | "success";
  tileInsertCount: number;
  placementCommandInsertCount: number;
  placementCommandUpdateCount: number;
};

function createLedgerDb(state: MockLedgerState): Kysely<ServerDatabase> {
  const chain = {
    where: vi.fn(function () {
      return this;
    }),
    forUpdate: vi.fn(function () {
      return this;
    }),
    selectAll: vi.fn(function () {
      return this;
    }),
    select: vi.fn(function () {
      return this;
    }),
    returningAll: vi.fn(function () {
      return this;
    }),
    returning: vi.fn(function () {
      return this;
    }),
    onConflict: vi.fn(function () {
      return this;
    })
  };

  // Main db-level selectFrom for winner tile queries outside transaction
  const dbSelectFrom = vi.fn((table: string) => {
    if (table === "tiles") {
      return {
        ...chain,
        executeTakeFirst: vi.fn(async () => state.winnerTile ?? undefined)
      };
    }
    return {
      ...chain,
      executeTakeFirst: vi.fn(async () => undefined)
    };
  });

  const trx = {
    selectFrom: vi.fn((table: string) => {
      if (table === "placement_commands") {
        return {
          ...chain,
          executeTakeFirst: vi.fn(async () => state.placementCommand ?? undefined)
        };
      }

      if (table === "tiles") {
        return {
          ...chain,
          executeTakeFirst: vi.fn(async () => state.winnerTile ?? undefined)
        };
      }

      if (table === "region_versions") {
        return {
          ...chain,
          executeTakeFirst: vi.fn(async () => undefined)
        };
      }

      return {
        ...chain,
        executeTakeFirst: vi.fn(async () => undefined)
      };
    }),
    insertInto: vi.fn((table: string) => {
      if (table === "placement_commands") {
        return {
          values: vi.fn((values: PlacementCommandRow) => {
            state.placementCommandInsertCount += 1;
            state.placementCommand = {
              ...values
            };
            return {
              executeTakeFirst: vi.fn(async () => undefined)
            };
          })
        };
      }

      if (table === "tiles") {
        return {
          values: vi.fn(() => {
            return {
              returningAll: vi.fn(() => {
                return {
                  executeTakeFirstOrThrow: vi.fn(async () => {
                    state.tileInsertCount += 1;
                    if (state.tileInsertMode === "conflict") {
                      throw new Error(
                        'duplicate key value violates unique constraint "tiles_region_coordinate_unique" (SQLSTATE 23505)'
                      );
                    }

                    return {
                      id: 501,
                      created_at: new Date("2026-06-30T12:00:00.000Z")
                    };
                  })
                };
              })
            };
          })
        };
      }

      if (table === "tile_deltas" || table === "region_versions") {
        return {
          values: vi.fn(() => {
            return {
              onConflict: vi.fn(() => {
                return {
                  executeTakeFirst: vi.fn(async () => undefined)
                };
              }),
              executeTakeFirst: vi.fn(async () => undefined)
            };
          })
        };
      }

      return {
        values: vi.fn(() => {
          return {
            executeTakeFirst: vi.fn(async () => undefined)
          };
        })
      };
    }),
    updateTable: vi.fn((table: string) => {
      if (table === "placement_commands") {
        return {
          set: vi.fn((values: Partial<PlacementCommandRow>) => {
            state.placementCommandUpdateCount += 1;
            state.placementCommand = {
              ...(state.placementCommand as PlacementCommandRow),
              ...values
            };
            return {
              where: vi.fn(function () {
                return this;
              }),
              executeTakeFirst: vi.fn(async () => undefined)
            };
          })
        };
      }

      return {
        set: vi.fn(() => {
          return {
            where: vi.fn(function () {
              return this;
            }),
            executeTakeFirst: vi.fn(async () => undefined)
          };
        })
      };
    })
  };

  return {
    selectFrom: dbSelectFrom,
    transaction: () => ({
      execute: async <T>(callback: (trxArg: typeof trx) => Promise<T>) => callback(trx)
    })
  } as unknown as Kysely<ServerDatabase>;
}

describe("TileRepository command ledger", () => {
  it("replays a previously applied command without duplicate side effects", async () => {
    const repository = new TileRepository();

    const result = await (repository as unknown as {
      mapLedgerReplay: (existing: Record<string, unknown>) => Promise<{
        ok: boolean;
        replayed: boolean;
        tile?: { id: number };
      }>;
    }).mapLedgerReplay({
      id: 1,
      region_id: "arena-1",
      actor_id: "tenant-a|player-1",
      command_id: "cmd_replay_applied_0001",
      request_hash: "hash",
      outcome: "applied",
      response_snapshot: {
        ok: true,
        tileId: 901,
        createdAt: "2026-06-30T12:00:00.000Z"
      },
      winner_owner_id: null,
      winner_tile_id: null,
      winner_resolved_at: null,
      expires_at: new Date("2099-01-01T00:00:00.000Z"),
      created_at: new Date("2026-06-30T12:00:00.000Z"),
      updated_at: new Date("2026-06-30T12:00:00.000Z")
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.replayed).toBe(true);
      expect(result.tile.id).toBe(901);
    }

  });

  it("returns deterministic command_payload_mismatch for reused commandId with different payload", async () => {
    const mismatchInput = {
      commandId: "cmd_payload_mismatch_01",
      regionId: "arena-1",
      cellX: 30,
      cellY: 40,
      offsetX: 0,
      offsetY: 0,
      shape: "triangle",
      color: "amber",
      stylePayload: { size: "different" },
      ownerId: "tenant-a|player-2"
    };
    const storedHash = `${hashPlacementCommandPayload({
      regionId: mismatchInput.regionId,
      actorId: mismatchInput.ownerId,
      commandId: mismatchInput.commandId,
      cellX: mismatchInput.cellX,
      cellY: mismatchInput.cellY,
      offsetX: mismatchInput.offsetX,
      offsetY: mismatchInput.offsetY,
      shape: mismatchInput.shape,
      color: mismatchInput.color,
      stylePayload: { style: "baseline" }
    })}-different`;

    const db = {
      transaction: () => ({
        execute: async <T>(callback: (trxArg: Record<string, unknown>) => Promise<T>) =>
          callback({
            selectFrom: () => ({
              selectAll: () => ({
                where: () => ({
                  where: () => ({
                    where: () => ({
                      forUpdate: () => ({
                        executeTakeFirst: async () => ({
                          id: 10,
                          region_id: mismatchInput.regionId,
                          actor_id: mismatchInput.ownerId,
                          command_id: mismatchInput.commandId,
                          request_hash: storedHash,
                          outcome: "applied",
                          response_snapshot: {
                            ok: true,
                            tileId: 902,
                            createdAt: "2026-06-30T12:00:00.000Z"
                          },
                          winner_owner_id: null,
                          winner_tile_id: null,
                          winner_resolved_at: null,
                          expires_at: new Date("2099-01-01T00:00:00.000Z"),
                          created_at: new Date("2026-06-30T12:00:00.000Z"),
                          updated_at: new Date("2026-06-30T12:00:00.000Z")
                        })
                      })
                    })
                  })
                })
              })
            }),
            insertInto: vi.fn(() => {
              throw new Error("insertInto should not be called for payload mismatch branch");
            }),
            updateTable: vi.fn(() => {
              throw new Error("updateTable should not be called for payload mismatch branch");
            })
          })
      })
    } as unknown as Kysely<ServerDatabase>;

    const repository = new TileRepository();

    const result = await repository.insertTile(db, mismatchInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("command_payload_mismatch");
      expect(result.commandId).toBe("cmd_payload_mismatch_01");
      expect(result.regionId).toBe("arena-1");
    }

  });

  it("returns deterministic coordinate_conflict winner metadata for fresh contention", async () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    const telemetrySink = {
      emitPlacementConflictDetected: vi.fn(async () => undefined),
      emitPlacementConflictResolved: vi.fn(async () => undefined)
    };

    const state: MockLedgerState = {
      placementCommand: null,
      winnerTile: {
        id: 777,
        owner_id: "tenant-a|winner",
        created_at: now
      },
      tileInsertMode: "conflict",
      tileInsertCount: 0,
      placementCommandInsertCount: 0,
      placementCommandUpdateCount: 0
    };

    const db = createLedgerDb(state);
    const repository = new TileRepository({
      telemetrySink: telemetrySink as never
    });

    const result = await repository.insertTile(db, {
      commandId: "cmd_conflict_winner_001",
      regionId: "arena-2",
      cellX: 6,
      cellY: 9,
      offsetX: 0,
      offsetY: 0,
      shape: "diamond",
      color: "blue",
      stylePayload: { phase: 4 },
      ownerId: "tenant-a|loser"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("coordinate_conflict");
      expect(result.commandId).toBe("cmd_conflict_winner_001");
      expect(result.error.winner_owner_id).toBe("tenant-a|winner");
      expect(result.error.winner_tile_id).toBe(777);
    }

    expect(state.placementCommandInsertCount).toBe(1);
    expect(state.placementCommandUpdateCount).toBe(1);
    expect(telemetrySink.emitPlacementConflictDetected).toHaveBeenCalledTimes(1);
    expect(telemetrySink.emitPlacementConflictResolved).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate tile side effects when a conflict commandId is retried", async () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    const telemetrySink = {
      emitPlacementConflictDetected: vi.fn(async () => undefined),
      emitPlacementConflictResolved: vi.fn(async () => undefined)
    };

    const state: MockLedgerState = {
      placementCommand: null,
      winnerTile: {
        id: 888,
        owner_id: "tenant-a|winner",
        created_at: now
      },
      tileInsertMode: "conflict",
      tileInsertCount: 0,
      placementCommandInsertCount: 0,
      placementCommandUpdateCount: 0
    };

    const db = createLedgerDb(state);
    const repository = new TileRepository({
      telemetrySink: telemetrySink as never
    });

    const first = await repository.insertTile(db, {
      commandId: "cmd_retry_occupied_0001",
      regionId: "arena-3",
      cellX: 1,
      cellY: 1,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "red",
      stylePayload: { hotspot: true },
      ownerId: "tenant-a|loser"
    });

    const second = await repository.insertTile(db, {
      commandId: "cmd_retry_occupied_0001",
      regionId: "arena-3",
      cellX: 1,
      cellY: 1,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "red",
      stylePayload: { hotspot: true },
      ownerId: "tenant-a|loser"
    });

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.replayed).toBe(true);
      expect(second.reason).toBe("coordinate_conflict");
      expect(second.error.winner_owner_id).toBe("tenant-a|winner");
      expect(second.error.winner_tile_id).toBe(888);
    }

    expect(state.tileInsertCount).toBe(1);
    expect(state.placementCommandInsertCount).toBe(1);
    expect(state.placementCommandUpdateCount).toBe(1);
    expect(telemetrySink.emitPlacementConflictDetected).toHaveBeenCalledTimes(1);
  });
});
