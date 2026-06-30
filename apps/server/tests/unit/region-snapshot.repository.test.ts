import { describe, expect, it, vi } from "vitest";
import {
  CreateRegionSnapshotInput,
  RegionSnapshotRepository
} from "../../src/persistence/region-snapshot.repository.js";
import { ServerDatabase } from "../../src/persistence/db.js";
import { Kysely } from "kysely";

describe("RegionSnapshotRepository", () => {
  const repository = new RegionSnapshotRepository();

  describe("createSnapshot", () => {
    it("should insert metadata and payload rows in a transaction", async () => {
      const insertedSnapshot = {
        snapshot_id: "snap-1",
        region_id: "region-a",
        created_by: "operator-1",
        tile_count: 1,
        expected_hash: "abc123",
        created_at: new Date("2026-06-29T12:00:00Z")
      };

      const trx = {
        insertInto: vi.fn((table: string) => {
          if (table === "region_snapshots") {
            return {
              values: vi.fn().mockReturnValue({
                returningAll: vi.fn().mockReturnValue({
                  executeTakeFirstOrThrow: vi.fn().mockResolvedValue(insertedSnapshot)
                })
              })
            };
          }

          if (table === "region_snapshot_tiles") {
            return {
              values: vi.fn().mockReturnValue({
                execute: vi.fn().mockResolvedValue(undefined)
              })
            };
          }

          throw new Error(`unexpected table ${table}`);
        })
      };

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          execute: async (fn: (t: typeof trx) => Promise<unknown>) => await fn(trx)
        })
      } as unknown as Kysely<ServerDatabase>;

      const input: CreateRegionSnapshotInput = {
        snapshotId: "snap-1",
        regionId: "region-a",
        createdBy: "operator-1",
        expectedHash: "abc123",
        tiles: [
          {
            regionId: "region-a",
            cellX: 3,
            cellY: 4,
            offsetX: 0,
            offsetY: 0,
            shape: "square",
            color: "blue",
            stylePayload: { border: "thin" },
            ownerId: "owner-1"
          }
        ]
      };

      const result = await repository.createSnapshot(mockDb, input);

      expect(result.snapshot_id).toBe("snap-1");
      expect(result.tile_count).toBe(1);
      expect(trx.insertInto).toHaveBeenCalledWith("region_snapshots");
      expect(trx.insertInto).toHaveBeenCalledWith("region_snapshot_tiles");
    });
  });

  describe("getLatestSnapshotForRegion", () => {
    it("should return latest snapshot and deterministically ordered payload tiles", async () => {
      const snapshot = {
        snapshot_id: "snap-2",
        region_id: "region-a",
        created_by: "operator-1",
        tile_count: 2,
        expected_hash: "hash-2",
        created_at: new Date("2026-06-29T12:02:00Z")
      };

      const tiles = [
        {
          snapshot_id: "snap-2",
          region_id: "region-a",
          cell_x: 1,
          cell_y: 1,
          offset_x: 0,
          offset_y: 0,
          shape: "square",
          color: "red",
          style_payload: {},
          owner_id: "owner-1"
        },
        {
          snapshot_id: "snap-2",
          region_id: "region-a",
          cell_x: 2,
          cell_y: 2,
          offset_x: 0,
          offset_y: 0,
          shape: "circle",
          color: "green",
          style_payload: {},
          owner_id: "owner-2"
        }
      ];

      const mockDb = {
        selectFrom: vi.fn((table: string) => {
          if (table === "region_snapshots") {
            return {
              selectAll: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      executeTakeFirst: vi.fn().mockResolvedValue(snapshot)
                    })
                  })
                })
              })
            };
          }

          if (table === "region_snapshot_tiles") {
            return {
              selectAll: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      execute: vi.fn().mockResolvedValue(tiles)
                    })
                  })
                })
              })
            };
          }

          throw new Error(`unexpected table ${table}`);
        })
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.getLatestSnapshotForRegion(mockDb, "region-a");

      expect(result).not.toBeNull();
      expect(result?.snapshot.snapshot_id).toBe("snap-2");
      expect(result?.tiles).toHaveLength(2);
      expect(mockDb.selectFrom).toHaveBeenCalledWith("region_snapshots");
      expect(mockDb.selectFrom).toHaveBeenCalledWith("region_snapshot_tiles");
    });

    it("should return null when no snapshot exists for region", async () => {
      const mockDb = {
        selectFrom: vi.fn(() => ({
          selectAll: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  executeTakeFirst: vi.fn().mockResolvedValue(undefined)
                })
              })
            })
          })
        }))
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.getLatestSnapshotForRegion(mockDb, "missing-region");
      expect(result).toBeNull();
    });
  });

  describe("restoreRegionFromSnapshot", () => {
    it("should transactionally replace tiles for target region using snapshot rows", async () => {
      const snapshotTiles = [
        {
          snapshot_id: "snap-3",
          region_id: "region-r",
          cell_x: 7,
          cell_y: 8,
          offset_x: 0,
          offset_y: 0,
          shape: "square",
          color: "cyan",
          style_payload: {},
          owner_id: "owner-r"
        }
      ];

      const restoredTiles = [
        {
          id: 501,
          region_id: "region-r",
          cell_x: 7,
          cell_y: 8,
          offset_x: 0,
          offset_y: 0,
          shape: "square",
          color: "cyan",
          style_payload: {},
          owner_id: "owner-r",
          created_at: new Date("2026-06-29T12:03:00Z")
        }
      ];

      const trx = {
        selectFrom: vi.fn((table: string) => {
          if (table === "region_snapshot_tiles") {
            return {
              selectAll: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      orderBy: vi.fn().mockReturnValue({
                        execute: vi.fn().mockResolvedValue(snapshotTiles)
                      })
                    })
                  })
                })
              })
            };
          }

          if (table === "tiles") {
            return {
              selectAll: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      execute: vi.fn().mockResolvedValue(restoredTiles)
                    })
                  })
                })
              })
            };
          }

          throw new Error(`unexpected table ${table}`);
        }),
        deleteFrom: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined)
          })
        }),
        insertInto: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(undefined)
          })
        })
      };

      const mockDb = {
        transaction: vi.fn().mockReturnValue({
          execute: async (fn: (t: typeof trx) => Promise<unknown>) => await fn(trx)
        })
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.restoreRegionFromSnapshot(mockDb, "snap-3", "region-r");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(501);
      expect(trx.deleteFrom).toHaveBeenCalledWith("tiles");
      expect(trx.insertInto).toHaveBeenCalledWith("tiles");
    });
  });
});
