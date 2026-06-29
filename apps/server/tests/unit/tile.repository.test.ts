import { describe, expect, it, vi } from "vitest";
import { TileRepository, InsertTileInput } from "../../src/persistence/tile.repository.js";
import { ServerDatabase } from "../../src/persistence/db.js";
import { Kysely } from "kysely";

describe("TileRepository", () => {
  const repository = new TileRepository();

  describe("insertTile", () => {
    it("should return successful result with id and createdAt on valid insert", async () => {
      const mockDb = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
          id: 1,
          created_at: new Date("2026-06-29T12:00:00Z"),
          region_id: "region-1",
          cell_x: 0,
          cell_y: 0,
          offset_x: 0.0,
          offset_y: 0.0,
          shape: "square",
          color: "red",
          style_payload: {},
          owner_id: "owner-1"
        })
      } as unknown as Kysely<ServerDatabase>;

      const input: InsertTileInput = {
        regionId: "region-1",
        cellX: 0,
        cellY: 0,
        offsetX: 0.0,
        offsetY: 0.0,
        shape: "square",
        color: "red",
        stylePayload: {},
        ownerId: "owner-1"
      };

      const result = await repository.insertTile(mockDb, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tile.id).toBe(1);
        expect(result.tile.createdAt).toEqual(new Date("2026-06-29T12:00:00Z"));
      }
    });

    it("should return coordinate_conflict on unique constraint violation (23505)", async () => {
      const conflictError = new Error("duplicate key value violates unique constraint \"tiles_region_coordinate_unique\" (SQLSTATE 23505)");

      const mockDb = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockRejectedValue(conflictError)
      } as unknown as Kysely<ServerDatabase>;

      const input: InsertTileInput = {
        regionId: "region-1",
        cellX: 5,
        cellY: 10,
        offsetX: 0.1,
        offsetY: 0.2,
        shape: "triangle",
        color: "blue",
        stylePayload: { pattern: "stripes" },
        ownerId: "owner-2"
      };

      const result = await repository.insertTile(mockDb, input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("coordinate_conflict");
        expect(result.error.type).toBe("coordinate_conflict");
        expect(result.error.region_id).toBe("region-1");
        expect(result.error.cell_x).toBe(5);
        expect(result.error.cell_y).toBe(10);
      }
    });

    it("should detect conflict by region_id, cell_x, cell_y in error message", async () => {
      const conflictError = new Error("Error: region_id (SQLSTATE 23505)");

      const mockDb = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockRejectedValue(conflictError)
      } as unknown as Kysely<ServerDatabase>;

      const input: InsertTileInput = {
        regionId: "region-2",
        cellX: 1,
        cellY: 2,
        offsetX: -0.3,
        offsetY: 0.0,
        shape: "circle",
        color: "green",
        stylePayload: null,
        ownerId: "owner-3"
      };

      const result = await repository.insertTile(mockDb, input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("coordinate_conflict");
      }
    });

    it("should re-throw non-constraint errors", async () => {
      const otherError = new Error("Some other database error");

      const mockDb = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockRejectedValue(otherError)
      } as unknown as Kysely<ServerDatabase>;

      const input: InsertTileInput = {
        regionId: "region-1",
        cellX: 0,
        cellY: 0,
        offsetX: 0.0,
        offsetY: 0.0,
        shape: "square",
        color: "red",
        stylePayload: {},
        ownerId: "owner-1"
      };

      await expect(repository.insertTile(mockDb, input)).rejects.toThrow("Some other database error");
    });

    it("should validate offset values are within range [-0.49, 0.49]", async () => {
      // This test verifies that the repository accepts valid offset values
      const mockDb = {
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returningAll: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
          id: 42,
          created_at: new Date(),
          region_id: "region-1",
          cell_x: 0,
          cell_y: 0,
          offset_x: -0.49,
          offset_y: 0.49,
          shape: "square",
          color: "red",
          style_payload: {},
          owner_id: "owner-1"
        })
      } as unknown as Kysely<ServerDatabase>;

      const input: InsertTileInput = {
        regionId: "region-1",
        cellX: 0,
        cellY: 0,
        offsetX: -0.49,
        offsetY: 0.49,
        shape: "square",
        color: "red",
        stylePayload: {},
        ownerId: "owner-1"
      };

      const result = await repository.insertTile(mockDb, input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tile.id).toBe(42);
      }
    });
  });

  describe("selectTilesByRegion", () => {
    it("should return array of tiles in region", async () => {
      const tiles = [
        {
          id: 1,
          region_id: "region-1",
          cell_x: 0,
          cell_y: 0,
          offset_x: 0.0,
          offset_y: 0.0,
          shape: "square",
          color: "red",
          style_payload: {},
          owner_id: "owner-1",
          created_at: new Date("2026-06-29T12:00:00Z")
        },
        {
          id: 2,
          region_id: "region-1",
          cell_x: 1,
          cell_y: 1,
          offset_x: 0.1,
          offset_y: 0.1,
          shape: "circle",
          color: "blue",
          style_payload: { size: "large" },
          owner_id: "owner-2",
          created_at: new Date("2026-06-29T12:01:00Z")
        }
      ];

      const mockDb = {
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(tiles)
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.selectTilesByRegion(mockDb, "region-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[0].region_id).toBe("region-1");
      expect(result[1].region_id).toBe("region-1");
    });

    it("should return empty array for region with no tiles", async () => {
      const mockDb = {
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([])
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.selectTilesByRegion(mockDb, "empty-region");

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("selectTileByCoordinate", () => {
    it("should return tile at specific coordinate", async () => {
      const tile = {
        id: 5,
        region_id: "region-1",
        cell_x: 2,
        cell_y: 3,
        offset_x: 0.25,
        offset_y: -0.1,
        shape: "rectangle",
        color: "green",
        style_payload: { pattern: "dots" },
        owner_id: "owner-4",
        created_at: new Date("2026-06-29T13:00:00Z")
      };

      const mockDb = {
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(tile)
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.selectTileByCoordinate(mockDb, "region-1", 2, 3);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(5);
      expect(result?.cell_x).toBe(2);
      expect(result?.cell_y).toBe(3);
    });

    it("should return null when no tile at coordinate", async () => {
      const mockDb = {
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined)
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.selectTileByCoordinate(mockDb, "region-1", 10, 20);

      expect(result).toBeNull();
    });

    it("should search by region, cellX, and cellY independently", async () => {
      const tile = {
        id: 10,
        region_id: "region-2",
        cell_x: 0,
        cell_y: 0,
        offset_x: 0.0,
        offset_y: 0.0,
        shape: "square",
        color: "yellow",
        style_payload: {},
        owner_id: "owner-5",
        created_at: new Date()
      };

      const mockDb = {
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(tile)
      } as unknown as Kysely<ServerDatabase>;

      // Search in different region and coordinates
      const result = await repository.selectTileByCoordinate(mockDb, "region-2", 0, 0);

      expect(result).not.toBeNull();
      expect(result?.region_id).toBe("region-2");
      expect(result?.cell_x).toBe(0);
      expect(result?.cell_y).toBe(0);
    });
  });

  describe("editTileWithinSelfEditWindow", () => {
    it("should return success when owner matches and tile is within self-edit window", async () => {
      const now = new Date("2026-06-29T12:10:00.000Z");

      const mockDb = {
        updateTable: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ id: 77 })
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.editTileWithinSelfEditWindow(mockDb, {
        regionId: "region-1",
        cellX: 1,
        cellY: 2,
        shape: "triangle",
        color: "blue",
        stylePayload: { pattern: "dots" },
        ownerId: "owner-1",
        now,
        selfEditWindowMs: 10 * 60 * 1000
      });

      expect(result).toEqual({
        ok: true,
        tile: {
          id: 77,
          editedAt: now
        }
      });
    });

    it("should return forbidden_owner_mismatch when existing tile belongs to another owner", async () => {
      const now = new Date("2026-06-29T12:10:00.000Z");

      const mockDb = {
        updateTable: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        executeTakeFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 99,
            region_id: "region-1",
            cell_x: 1,
            cell_y: 2,
            offset_x: 0,
            offset_y: 0,
            shape: "square",
            color: "red",
            style_payload: {},
            owner_id: "different-owner",
            created_at: new Date("2026-06-29T12:00:00.000Z")
          }),
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis()
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.editTileWithinSelfEditWindow(mockDb, {
        regionId: "region-1",
        cellX: 1,
        cellY: 2,
        shape: "triangle",
        color: "blue",
        stylePayload: { pattern: "dots" },
        ownerId: "owner-1",
        now,
        selfEditWindowMs: 10 * 60 * 1000
      });

      expect(result).toEqual({
        ok: false,
        reason: "forbidden_owner_mismatch"
      });
    });

    it("should return edit_window_expired when owner matches but created_at is outside window", async () => {
      const now = new Date("2026-06-29T12:20:00.000Z");

      const mockDb = {
        updateTable: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        executeTakeFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 100,
            region_id: "region-1",
            cell_x: 5,
            cell_y: 6,
            offset_x: 0,
            offset_y: 0,
            shape: "square",
            color: "red",
            style_payload: {},
            owner_id: "owner-1",
            created_at: new Date("2026-06-29T12:00:00.000Z")
          }),
        selectFrom: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis()
      } as unknown as Kysely<ServerDatabase>;

      const result = await repository.editTileWithinSelfEditWindow(mockDb, {
        regionId: "region-1",
        cellX: 5,
        cellY: 6,
        shape: "triangle",
        color: "blue",
        stylePayload: { pattern: "dots" },
        ownerId: "owner-1",
        now,
        selfEditWindowMs: 10 * 60 * 1000
      });

      expect(result).toEqual({
        ok: false,
        reason: "edit_window_expired"
      });
    });

    it("should include created_at >= windowStart boundary predicate in update query", async () => {
      const now = new Date("2026-06-29T12:10:00.000Z");
      const where = vi.fn().mockReturnThis();

      const mockDb = {
        updateTable: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where,
        returning: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ id: 1 })
      } as unknown as Kysely<ServerDatabase>;

      await repository.editTileWithinSelfEditWindow(mockDb, {
        regionId: "region-1",
        cellX: 0,
        cellY: 0,
        shape: "square",
        color: "red",
        stylePayload: {},
        ownerId: "owner-1",
        now,
        selfEditWindowMs: 10 * 60 * 1000
      });

      const expectedWindowStart = new Date("2026-06-29T12:00:00.000Z");
      expect(where).toHaveBeenCalledWith("created_at", ">=", expectedWindowStart);
    });
  });
});
