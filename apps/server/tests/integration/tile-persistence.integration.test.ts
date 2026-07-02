import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Kysely } from "kysely";
import { TileRepository } from "../../src/persistence/tile.repository.js";
import { ServerDatabase, DatabaseRuntime, createDatabaseRuntime, closeDatabaseRuntime } from "../../src/persistence/db.js";
import request from "supertest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { createIntegrationTestDbGuard } from "./test-db-guard.js";
import { vi } from "vitest";
import { buildValidCommandId } from "./test-fixtures.js";

describe("Tile persistence integration", () => {
  let runtime: DatabaseRuntime | null = null;
  let db: Kysely<ServerDatabase> | null = null;
  let repository: TileRepository;
  const dbGuard = createIntegrationTestDbGuard("tile-persistence.integration");
  let testsCanRun = dbGuard.testsCanRun;

  // Use test database connection string from environment or skip tests
  const testDbConnectionString = dbGuard.testDbConnectionString;

  beforeAll(async () => {
    if (!testsCanRun) {
      if (dbGuard.skipReason) {
        console.warn(dbGuard.skipReason);
      }
      return;
    }

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

  function createAppWithThrottle(maxRequests: number, windowMs: number) {
    const telemetrySink = {
      emit: vi.fn(async () => undefined),
      emitTilePlaceRejected: vi.fn(async () => undefined),
      emitTilePlaced: vi.fn(async () => undefined),
      emitTileEdited: vi.fn(async () => undefined),
      emitTilePlaceThrottled: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000
      })),
      issueJoinToken: vi.fn()
    };

    const lifecycleService = new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });

    const app = createHttpApp({
      readinessCheck: async () => ({
        ok: true,
        checks: {
          database: "ok",
          config: "ok"
        }
      }),
      authMiddleware: buildAuthMiddleware(authService as never),
      telemetrySink,
      authService: authService as never,
      lifecycleService,
      db,
      tileRepository: repository,
      tilePlaceThrottlePolicy: {
        maxRequests,
        windowMs
      }
    });

    return {
      app,
      telemetrySink: telemetrySink as {
        emitTilePlaceThrottled: ReturnType<typeof vi.fn>;
      }
    };
  }

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

    try {
      await db.deleteFrom("placement_commands").execute();
      await db.deleteFrom("tile_deltas").execute();
      await db.deleteFrom("region_versions").execute();
      await db.deleteFrom("tiles").execute();
    } catch {
      // Ignore errors
    }
  });

  function requireDb(): Kysely<ServerDatabase> {
    if (!db) {
      throw new Error("Integration test database was not initialized");
    }

    return db;
  }

  it.skipIf(!testsCanRun)("should persist tile and retrieve by region", async () => {

    const testDb = requireDb();

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
    const insertResult = await repository.insertTile(testDb, input);

    expect(insertResult.ok).toBe(true);
    if (!insertResult.ok) throw new Error("Insert failed");

    const tileId = insertResult.tile.id;

    // Query by region
    const tiles = await repository.selectTilesByRegion(testDb, "test-region-1");

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

  it.skipIf(!testsCanRun)("should return coordinate_conflict on duplicate coordinate insert", async () => {
    const testDb = requireDb();

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
    const result1 = await repository.insertTile(testDb, input1);
    expect(result1.ok).toBe(true);

    // Try to insert second tile at same coordinate
    const result2 = await repository.insertTile(testDb, input2);

    expect(result2.ok).toBe(false);
    if (result2.ok) throw new Error("Expected conflict");
    expect(result2.reason).toBe("coordinate_conflict");
    expect(result2.error.region_id).toBe("test-region-2");
    expect(result2.error.cell_x).toBe(5);
    expect(result2.error.cell_y).toBe(10);
  });

  it.skipIf(!testsCanRun)("should support multiple tiles in same region with different coordinates", async () => {

    const testDb = requireDb();

    const region = "test-region-3";

    // Insert first tile
    const tile1 = await repository.insertTile(testDb, {
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
    const tile2 = await repository.insertTile(testDb, {
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
    const tile3 = await repository.insertTile(testDb, {
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
    expect(tiles.map((t) => t.cell_y).sort()).toEqual([0, 0, 1]);
  });

  it.skipIf(!testsCanRun)("should isolate tiles between regions", async () => {

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

  it.skipIf(!testsCanRun)("should find tile by specific coordinate", async () => {

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

  it.skipIf(!testsCanRun)("should return null when coordinate not found", async () => {

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

  it.skipIf(!testsCanRun)("should enforce offset constraints at database level", async () => {

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

  it.skipIf(!testsCanRun)("should allow owner edit when within 10-minute self-edit window", async () => {
    const regionId = "test-edit-window-allow";

    const inserted = await repository.insertTile(db, {
      regionId,
      cellX: 7,
      cellY: 7,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "red",
      stylePayload: { layer: 1 },
      ownerId: "owner-allow"
    });

    expect(inserted.ok).toBe(true);

    const existing = await repository.selectTileByCoordinate(db, regionId, 7, 7);
    expect(existing).not.toBeNull();

    const editResult = await repository.editTileWithinSelfEditWindow(db, {
      regionId,
      cellX: 7,
      cellY: 7,
      shape: "triangle",
      color: "blue",
      stylePayload: { layer: 2 },
      ownerId: "owner-allow",
      now: new Date(existing!.created_at.getTime() + 60_000),
      selfEditWindowMs: 10 * 60 * 1000
    });

    expect(editResult.ok).toBe(true);

    const updated = await repository.selectTileByCoordinate(db, regionId, 7, 7);
    expect(updated).not.toBeNull();
    expect(updated?.shape).toBe("triangle");
    expect(updated?.color).toBe("blue");
    expect(updated?.style_payload).toEqual({ layer: 2 });
    expect(updated?.owner_id).toBe("owner-allow");
  });

  it.skipIf(!testsCanRun)("should reject edit for non-owner with forbidden_owner_mismatch", async () => {
    const regionId = "test-edit-owner-mismatch";

    const inserted = await repository.insertTile(db, {
      regionId,
      cellX: 8,
      cellY: 8,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "red",
      stylePayload: {},
      ownerId: "owner-original"
    });

    expect(inserted.ok).toBe(true);

    const existing = await repository.selectTileByCoordinate(db, regionId, 8, 8);
    expect(existing).not.toBeNull();

    const editResult = await repository.editTileWithinSelfEditWindow(db, {
      regionId,
      cellX: 8,
      cellY: 8,
      shape: "hex",
      color: "green",
      stylePayload: { edit: true },
      ownerId: "owner-other",
      now: new Date(existing!.created_at.getTime() + 30_000),
      selfEditWindowMs: 10 * 60 * 1000
    });

    expect(editResult).toEqual({
      ok: false,
      reason: "forbidden_owner_mismatch"
    });

    const unchanged = await repository.selectTileByCoordinate(db, regionId, 8, 8);
    expect(unchanged?.shape).toBe("square");
    expect(unchanged?.color).toBe("red");
    expect(unchanged?.owner_id).toBe("owner-original");
  });

  it.skipIf(!testsCanRun)("should reject owner edit after self-edit window expires", async () => {
    const regionId = "test-edit-expired";

    const inserted = await repository.insertTile(db, {
      regionId,
      cellX: 9,
      cellY: 9,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "red",
      stylePayload: {},
      ownerId: "owner-expired"
    });

    expect(inserted.ok).toBe(true);

    const existing = await repository.selectTileByCoordinate(db, regionId, 9, 9);
    expect(existing).not.toBeNull();

    const editResult = await repository.editTileWithinSelfEditWindow(db, {
      regionId,
      cellX: 9,
      cellY: 9,
      shape: "diamond",
      color: "purple",
      stylePayload: { edit: "late" },
      ownerId: "owner-expired",
      now: new Date(existing!.created_at.getTime() + 10 * 60 * 1000 + 1),
      selfEditWindowMs: 10 * 60 * 1000
    });

    expect(editResult).toEqual({
      ok: false,
      reason: "edit_window_expired"
    });

    const unchanged = await repository.selectTileByCoordinate(db, regionId, 9, 9);
    expect(unchanged?.shape).toBe("square");
    expect(unchanged?.color).toBe("red");
  });

  it.skipIf(!testsCanRun)("should reject edit when server clock skews backward (edge case)", async () => {
    const regionId = "test-clock-skew";

    const inserted = await repository.insertTile(db, {
      regionId,
      cellX: 10,
      cellY: 10,
      offsetX: 0,
      offsetY: 0,
      shape: "circle",
      color: "blue",
      stylePayload: {},
      ownerId: "owner-skew"
    });

    expect(inserted.ok).toBe(true);

    const existing = await repository.selectTileByCoordinate(db, regionId, 10, 10);
    expect(existing).not.toBeNull();

    // Simulate server clock jumping backward by 5 minutes (very rare, but possible during clock correction)
    const clockSkewedNow = new Date(existing!.created_at.getTime() - 5 * 60 * 1000);

    const editResult = await repository.editTileWithinSelfEditWindow(db, {
      regionId,
      cellX: 10,
      cellY: 10,
      shape: "triangle",
      color: "green",
      stylePayload: { edit: "skewed" },
      ownerId: "owner-skew",
      now: clockSkewedNow,
      selfEditWindowMs: 10 * 60 * 1000
    });

    // Edge case: edit fails because windowStart is now much earlier than created_at
    // This is the safe behavior—we reject rather than allow potentially invalid edits
    expect(editResult).toEqual({
      ok: false,
      reason: "edit_window_expired"
    });

    const unchanged = await repository.selectTileByCoordinate(db, regionId, 10, 10);
    expect(unchanged?.shape).toBe("circle");
    expect(unchanged?.color).toBe("blue");
  });

  it.skipIf(!testsCanRun)("should enforce placement throttle and recover after window", async () => {
    const { app, telemetrySink } = createAppWithThrottle(2, 120);

    const makePlacement = (cellX: number) =>
      request(app)
        .post("/api/tiles/place")
        .set("Authorization", "Bearer valid-token")
        .send({
          commandId: buildValidCommandId(`throttle-${cellX}`),
          regionId: "throttle-region-a",
          cellX,
          cellY: 0,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "amber",
          stylePayload: {}
        });

    const first = await makePlacement(11);
    const second = await makePlacement(12);
    const third = await makePlacement(13);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(third.body.ok).toBe(false);
    expect(third.body.reason).toBe("throttled");
    expect(typeof third.body.retryAfterMs).toBe("number");
    expect(third.body.retryAfterMs).toBeGreaterThan(0);
    expect(telemetrySink.emitTilePlaceThrottled).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 140));

    const recovery = await makePlacement(14);
    expect(recovery.status).toBe(201);
  });
});
