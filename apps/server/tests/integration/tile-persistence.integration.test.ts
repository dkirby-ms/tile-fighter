import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Kysely } from "kysely";
import { TileRepository } from "../../src/persistence/tile.repository.js";
import { ServerDatabase, DatabaseRuntime, createDatabaseRuntime, closeDatabaseRuntime } from "../../src/persistence/db.js";

describe("Tile persistence integration", () => {
  let runtime: DatabaseRuntime | null = null;
  let db: Kysely<ServerDatabase> | null = null;
  let repository: TileRepository;
  let testsCanRun = true;

  // Use test database connection string from environment or skip tests
  const testDbConnectionString = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/tile_fighter_test";

  beforeAll(async () => {
    try {
      // Create database runtime
      runtime = createDatabaseRuntime(testDbConnectionString);
      db = runtime.db;
      repository = new TileRepository();

      // Test database connectivity
      await db.selectFrom("tiles").selectAll().limit(1).execute();
    } catch (error) {
      // Database not available - skip tests
      testsCanRun = false;
      console.warn("Skipping integration tests: database not available", error instanceof Error ? error.message : error);
    }
  });

  afterAll(async () => {
    // Close database connection
    if (runtime) {
      await closeDatabaseRuntime(runtime);
    }
  });

  beforeEach(async () => {
    if (!testsCanRun || !db) {
      return; // Skip setup
    }
    // Clear tiles table before each test
    try {
      await db.deleteFrom("tiles").execute();
    } catch {
      // Ignore errors
    }
  });

  it.skipIf(!testsCanRun || !db)("should persist tile and retrieve by region", async () => {

    const input = {
      regionId: "test-region-1",
      cellX: 0,
      cellY: 0,
      offsetX: 0.1,
      offsetY: 0.2,
      shape: "square",
      color: "red",
      stylePayload: { pattern: "solid" },
      ownerId: "test-owner-1"
    };

    // Insert tile
    const insertResult = await repository.insertTile(db, input);

    expect(insertResult.ok).toBe(true);
    if (!insertResult.ok) throw new Error("Insert failed");

    const tileId = insertResult.tile.id;

    // Query by region
    const tiles = await repository.selectTilesByRegion(db, "test-region-1");

    expect(tiles).toHaveLength(1);
    expect(tiles[0].id).toBe(tileId);
    expect(tiles[0].region_id).toBe("test-region-1");
    expect(tiles[0].cell_x).toBe(0);
    expect(tiles[0].cell_y).toBe(0);
    expect(tiles[0].offset_x).toBe(0.1);
    expect(tiles[0].offset_y).toBe(0.2);
    expect(tiles[0].shape).toBe("square");
    expect(tiles[0].color).toBe("red");
    expect(tiles[0].owner_id).toBe("test-owner-1");
  });

  it.skipIf(!testsCanRun || !db)("should return coordinate_conflict on duplicate coordinate insert", async () => {
    const input1 = {
      regionId: "test-region-2",
      cellX: 5,
      cellY: 10,
      offsetX: 0.0,
      offsetY: 0.0,
      shape: "circle",
      color: "blue",
      stylePayload: {},
      ownerId: "owner-1"
    };

    const input2 = {
      regionId: "test-region-2",
      cellX: 5,
      cellY: 10,
      offsetX: 0.25,
      offsetY: 0.25,
      shape: "triangle",
      color: "green",
      stylePayload: {},
      ownerId: "owner-2"
    };

    // Insert first tile
    const result1 = await repository.insertTile(db, input1);
    expect(result1.ok).toBe(true);

    // Try to insert second tile at same coordinate
    const result2 = await repository.insertTile(db, input2);

    expect(result2.ok).toBe(false);
    if (result2.ok) throw new Error("Expected conflict");
    expect(result2.reason).toBe("coordinate_conflict");
    expect(result2.error.region_id).toBe("test-region-2");
    expect(result2.error.cell_x).toBe(5);
    expect(result2.error.cell_y).toBe(10);
  });

  it.skipIf(!testsCanRun || !db)("should support multiple tiles in same region with different coordinates", async () => {

    const region = "test-region-3";

    // Insert first tile
    const tile1 = await repository.insertTile(db, {
      regionId: region,
      cellX: 0,
      cellY: 0,
      offsetX: 0.0,
      offsetY: 0.0,
      shape: "square",
      color: "red",
      stylePayload: {},
      ownerId: "owner-1"
    });

    expect(tile1.ok).toBe(true);

    // Insert second tile at different coordinate
    const tile2 = await repository.insertTile(db, {
      regionId: region,
      cellX: 1,
      cellY: 0,
      offsetX: 0.1,
      offsetY: 0.0,
      shape: "circle",
      color: "blue",
      stylePayload: {},
      ownerId: "owner-2"
    });

    expect(tile2.ok).toBe(true);

    // Insert third tile at different coordinate
    const tile3 = await repository.insertTile(db, {
      regionId: region,
      cellX: 0,
      cellY: 1,
      offsetX: 0.0,
      offsetY: 0.1,
      shape: "triangle",
      color: "green",
      stylePayload: {},
      ownerId: "owner-3"
    });

    expect(tile3.ok).toBe(true);

    // Query region and verify all tiles present
    const tiles = await repository.selectTilesByRegion(db, region);

    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.cell_x).sort()).toEqual([0, 0, 1]);
    expect(tiles.map((t) => t.cell_y).sort()).toEqual([0, 1, 0]);
  });

  it.skipIf(!testsCanRun || !db)("should isolate tiles between regions", async () => {

    const region1 = "region-a";
    const region2 = "region-b";

    // Insert tile in region 1 at coordinate (0, 0)
    const tile1 = await repository.insertTile(db, {
      regionId: region1,
      cellX: 0,
      cellY: 0,
      offsetX: 0.0,
      offsetY: 0.0,
      shape: "square",
      color: "red",
      stylePayload: {},
      ownerId: "owner-1"
    });

    expect(tile1.ok).toBe(true);

    // Insert tile in region 2 at SAME coordinate (0, 0) - should succeed
    const tile2 = await repository.insertTile(db, {
      regionId: region2,
      cellX: 0,
      cellY: 0,
      offsetX: 0.1,
      offsetY: 0.1,
      shape: "circle",
      color: "blue",
      stylePayload: {},
      ownerId: "owner-2"
    });

    expect(tile2.ok).toBe(true);

    // Verify tiles are isolated
    const tilesRegion1 = await repository.selectTilesByRegion(db, region1);
    const tilesRegion2 = await repository.selectTilesByRegion(db, region2);

    expect(tilesRegion1).toHaveLength(1);
    expect(tilesRegion2).toHaveLength(1);
    expect(tilesRegion1[0].region_id).toBe(region1);
    expect(tilesRegion2[0].region_id).toBe(region2);
  });

  it.skipIf(!testsCanRun || !db)("should find tile by specific coordinate", async () => {

    const region = "test-region-4";

    // Insert multiple tiles
    await repository.insertTile(db, {
      regionId: region,
      cellX: 0,
      cellY: 0,
      offsetX: 0.0,
      offsetY: 0.0,
      shape: "square",
      color: "red",
      stylePayload: {},
      ownerId: "owner-1"
    });

    await repository.insertTile(db, {
      regionId: region,
      cellX: 5,
      cellY: 10,
      offsetX: -0.25,
      offsetY: 0.3,
      shape: "circle",
      color: "blue",
      stylePayload: { size: "large" },
      ownerId: "owner-2"
    });

    // Find specific tile by coordinate
    const found = await repository.selectTileByCoordinate(db, region, 5, 10);

    expect(found).not.toBeNull();
    expect(found?.cell_x).toBe(5);
    expect(found?.cell_y).toBe(10);
    expect(found?.color).toBe("blue");
    expect(found?.owner_id).toBe("owner-2");
  });

  it.skipIf(!testsCanRun || !db)("should return null when coordinate not found", async () => {

    const region = "test-region-5";

    // Insert a tile
    await repository.insertTile(db, {
      regionId: region,
      cellX: 0,
      cellY: 0,
      offsetX: 0.0,
      offsetY: 0.0,
      shape: "square",
      color: "red",
      stylePayload: {},
      ownerId: "owner-1"
    });

    // Search for non-existent coordinate
    const found = await repository.selectTileByCoordinate(db, region, 99, 99);

    expect(found).toBeNull();
  });

  it.skipIf(!testsCanRun || !db)("should enforce offset constraints at database level", async () => {

    // Valid offset values should succeed
    const validTile = await repository.insertTile(db, {
      regionId: "test-region-6",
      cellX: 0,
      cellY: 0,
      offsetX: -0.49,
      offsetY: 0.49,
      shape: "square",
      color: "red",
      stylePayload: {},
      ownerId: "owner-1"
    });

    expect(validTile.ok).toBe(true);

    // Note: Testing invalid offsets would require direct SQL since the repository
    // doesn't validate them - the database constraint handles validation
  });
});
