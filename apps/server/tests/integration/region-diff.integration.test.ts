import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import {
  closeDatabaseRuntime,
  createDatabaseRuntime,
  DatabaseRuntime,
  ServerDatabase
} from "../../src/persistence/db.js";
import { createTileRepository } from "../../src/persistence/tile.repository.js";
import { createRegionDiffRepository } from "../../src/persistence/region-diff.repository.js";
import { createRegionDiffService } from "../../src/domain/region-diff.service.js";

describe("Region diff integration", () => {
  const testDbConnectionString =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/tile_fighter_test";

  let runtime: DatabaseRuntime | null = null;
  let db: Kysely<ServerDatabase> | null = null;
  let testsCanRun = true;

  beforeAll(async () => {
    try {
      runtime = createDatabaseRuntime(testDbConnectionString);
      db = runtime.db;
      await db.selectFrom("tiles").selectAll().limit(1).execute();
    } catch (error) {
      testsCanRun = false;
      console.warn(
        "Skipping region diff integration tests: database not available",
        error instanceof Error ? error.message : error
      );
    }
  });

  afterAll(async () => {
    if (runtime) {
      await closeDatabaseRuntime(runtime);
    }
  });

  beforeEach(async () => {
    if (!testsCanRun || !db) {
      return;
    }

    await db.deleteFrom("tile_deltas").execute();
    await db.deleteFrom("region_versions").execute();
    await db.deleteFrom("tiles").execute();
  });

  function createApp(authEnabled = true) {
    const telemetrySink = {
      emit: vi.fn(async () => undefined),
      emitTileDiffRequested: vi.fn(async () => undefined),
      emitTileDiffReturned: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const authService = {
      verifyAccessToken: vi.fn(async () => {
        if (!authEnabled) {
          throw new Error("unauthorized");
        }

        return {
          subject: "player-1",
          tenantScopedSubject: "tenant-a|player-1",
          issuer: "https://issuer.example",
          audience: "api://tile-fighter-server",
          tenantId: "tenant-a",
          tokenVersion: "2.0",
          expiresAt: 1_900_000_000
        };
      }),
      issueJoinToken: vi.fn()
    };

    const lifecycleService = new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });

    const tileRepository = createTileRepository();
    const regionDiffService = createRegionDiffService({
      db: db!,
      repository: createRegionDiffRepository(),
      telemetrySink
    });

    return createHttpApp({
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
      db: db!,
      tileRepository,
      regionDiffService
    });
  }

  async function placeTile(input: { cellX: number; cellY: number; color: string }) {
    const result = await createTileRepository().insertTile(db!, {
      regionId: "region-diff-a",
      cellX: input.cellX,
      cellY: input.cellY,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: input.color,
      stylePayload: { source: "test" },
      ownerId: "tenant-a|player-1"
    });

    if (!result.ok) {
      throw new Error("fixture insert failed");
    }
  }

  it.skipIf(!testsCanRun || !db)("returns 401 when Authorization header is missing", async () => {
    const app = createApp();

    const response = await request(app).post("/api/regions/diff").send({
      regionId: "region-diff-a",
      sinceVersion: 0,
      viewport: {
        minCellX: 0,
        maxCellX: 10,
        minCellY: 0,
        maxCellY: 10
      }
    });

    expect(response.status).toBe(401);
  });

  it.skipIf(!testsCanRun || !db)("returns 400 for malformed payload", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/regions/diff")
      .set("Authorization", "Bearer valid-token")
      .send({
        regionId: "region-diff-a",
        sinceVersion: -1,
        viewport: {
          minCellX: 5,
          maxCellX: 1,
          minCellY: 0,
          maxCellY: 10
        }
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid region diff request" });
  });

  it.skipIf(!testsCanRun || !db)("returns empty diff when client is unchanged", async () => {
    const app = createApp();

    await placeTile({ cellX: 1, cellY: 1, color: "red" });
    await placeTile({ cellX: 2, cellY: 2, color: "green" });

    const response = await request(app)
      .post("/api/regions/diff")
      .set("Authorization", "Bearer valid-token")
      .send({
        regionId: "region-diff-a",
        sinceVersion: 2,
        viewport: {
          minCellX: 0,
          maxCellX: 10,
          minCellY: 0,
          maxCellY: 10
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.currentVersion).toBe(2);
    expect(response.body.nextSinceVersion).toBe(2);
    expect(response.body.isEmpty).toBe(true);
    expect(response.body.tiles).toEqual([]);
    expect(response.body.truncated).toBe(false);
  });

  it.skipIf(!testsCanRun || !db)("returns stale latest-wins compacted diff and truncates by maxTiles", async () => {
    const app = createApp();

    await placeTile({ cellX: 1, cellY: 1, color: "red" });
    await placeTile({ cellX: 2, cellY: 2, color: "green" });
    const editResult = await createTileRepository().editTileWithinSelfEditWindow(db!, {
      regionId: "region-diff-a",
      cellX: 1,
      cellY: 1,
      shape: "triangle",
      color: "blue",
      stylePayload: { source: "edit" },
      ownerId: "tenant-a|player-1",
      now: new Date(Date.now() + 60_000),
      selfEditWindowMs: 10 * 60 * 1000
    });
    expect(editResult.ok).toBe(true);
    await placeTile({ cellX: 3, cellY: 3, color: "orange" });

    const response = await request(app)
      .post("/api/regions/diff")
      .set("Authorization", "Bearer valid-token")
      .send({
        regionId: "region-diff-a",
        sinceVersion: 0,
        viewport: {
          minCellX: 0,
          maxCellX: 10,
          minCellY: 0,
          maxCellY: 10
        },
        maxTiles: 2
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.currentVersion).toBe(4);
    expect(response.body.truncated).toBe(true);
    expect(response.body.tiles).toHaveLength(2);
    expect(response.body.tiles[0]).toEqual(
      expect.objectContaining({
        cellX: 2,
        cellY: 2,
        version: 2,
        color: "green"
      })
    );
    expect(response.body.tiles[1]).toEqual(
      expect.objectContaining({
        cellX: 1,
        cellY: 1,
        version: 3,
        color: "blue",
        shape: "triangle"
      })
    );
    expect(response.body.nextSinceVersion).toBe(3);
    expect(response.body.metadata).toEqual({
      viewport: {
        minCellX: 0,
        maxCellX: 10,
        minCellY: 0,
        maxCellY: 10
      },
      maxTiles: 2,
      returnedTileCount: 2
    });
  });
});