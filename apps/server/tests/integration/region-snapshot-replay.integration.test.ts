import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import {
  closeDatabaseRuntime,
  createDatabaseRuntime,
  DatabaseRuntime
} from "../../src/persistence/db.js";
import {
  RegionSnapshotHashMismatchError,
  RegionSnapshotNotFoundError,
  RegionSnapshotService
} from "../../src/domain/region-snapshot.service.js";
import { createRegionSnapshotRepository } from "../../src/persistence/region-snapshot.repository.js";
import { computeRegionHash } from "../../src/domain/region-hash.js";

describe("Region snapshot replay integration", () => {
  function createLifecycleService(telemetrySink: TelemetrySink): SessionLifecycleService {
    return new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });
  }

  function createApp(options?: {
    roles?: string[];
    createSnapshotImpl?: ReturnType<typeof vi.fn>;
    restoreLatestImpl?: ReturnType<typeof vi.fn>;
  }) {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000,
        roles: options?.roles
      })),
      issueJoinToken: vi.fn()
    };

    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const regionSnapshotService = {
      createSnapshot:
        options?.createSnapshotImpl ??
        vi.fn(async () => ({
          snapshotId: "snapshot-1",
          expectedHash: "hash-1",
          tileCount: 2
        })),
      restoreLatest:
        options?.restoreLatestImpl ??
        vi.fn(async () => ({
          snapshotId: "snapshot-1",
          expectedHash: "hash-1",
          actualHash: "hash-1",
          restoredTileCount: 2
        }))
    };

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
      lifecycleService: createLifecycleService(telemetrySink),
      checkpointService: {
        issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token"),
        resolveReconnect: vi.fn(async () => ({ ok: false, reason: "checkpoint_not_found" }))
      } as never,
      regionSnapshotService: regionSnapshotService as never
    });

    return { app, regionSnapshotService };
  }

  it("creates a snapshot for authenticated caller", async () => {
    const { app, regionSnapshotService } = createApp({ roles: ["operator"] });

    const response = await request(app)
      .post("/api/admin/snapshots/create")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "region-1" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      snapshotId: "snapshot-1",
      expectedHash: "hash-1",
      tileCount: 2
    });
    expect(regionSnapshotService.createSnapshot).toHaveBeenCalledWith({
      regionId: "region-1",
      actorId: "tenant-a|player-1"
    });
  });

  it("requires regionId when creating a snapshot", async () => {
    const { app } = createApp({ roles: ["operator"] });

    const response = await request(app)
      .post("/api/admin/snapshots/create")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("regionId is required");
  });

  it("forbids restore for non-operator caller", async () => {
    const { app, regionSnapshotService } = createApp({ roles: ["player"] });

    const response = await request(app)
      .post("/api/admin/snapshots/restore-latest")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "region-1" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Forbidden");
    expect(regionSnapshotService.restoreLatest).not.toHaveBeenCalled();
  });

  it("allows restore for operator caller", async () => {
    const { app, regionSnapshotService } = createApp({ roles: ["operator"] });

    const response = await request(app)
      .post("/api/admin/snapshots/restore-latest")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "region-2" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      snapshotId: "snapshot-1",
      expectedHash: "hash-1",
      actualHash: "hash-1",
      restoredTileCount: 2
    });
    expect(regionSnapshotService.restoreLatest).toHaveBeenCalledWith({
      regionId: "region-2",
      actorId: "tenant-a|player-1"
    });
  });

  it("returns not found when restore has no snapshot", async () => {
    const { app } = createApp({
      roles: ["operator"],
      restoreLatestImpl: vi.fn(async () => {
        throw new RegionSnapshotNotFoundError("region-missing");
      })
    });

    const response = await request(app)
      .post("/api/admin/snapshots/restore-latest")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "region-missing" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Snapshot not found");
  });

  it("returns conflict when restore hash verification fails", async () => {
    const { app } = createApp({
      roles: ["operator"],
      restoreLatestImpl: vi.fn(async () => {
        throw new RegionSnapshotHashMismatchError("snapshot-2", "expected", "actual");
      })
    });

    const response = await request(app)
      .post("/api/admin/snapshots/restore-latest")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "region-3" });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Snapshot hash mismatch");
  });
});

describe("Region snapshot replay lifecycle integration (db-backed)", () => {
  const testDbConnectionString =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/tile_fighter_test";

  let runtime: DatabaseRuntime | null = null;
  let service: RegionSnapshotService | null = null;
  let testsCanRun = true;

  function createTelemetrySink(): TelemetrySink {
    return {
      emit: vi.fn(async () => undefined),
      emitSnapshotCreated: vi.fn(async () => undefined),
      emitSnapshotRestoreStarted: vi.fn(async () => undefined),
      emitSnapshotRestoreCompleted: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;
  }

  async function clearSnapshotFixtures(db: DatabaseRuntime["db"]) {
    await db.deleteFrom("region_snapshot_tiles").execute();
    await db.deleteFrom("region_snapshots").execute();
    await db.deleteFrom("tiles").execute();
  }

  async function insertTile(
    db: DatabaseRuntime["db"],
    input: {
      regionId: string;
      cellX: number;
      cellY: number;
      offsetX: number;
      offsetY: number;
      shape: string;
      color: string;
      stylePayload: unknown;
      ownerId: string;
    }
  ) {
    await db
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
      })
      .execute();
  }

  async function computeHashForRegion(
    db: DatabaseRuntime["db"],
    regionId: string
  ): Promise<string> {
    // CRITICAL: Must match createSnapshot sort order for consistent hash.
    // Sort by (cell_x, cell_y, id) to ensure deterministic ordering.
    const rows = await db
      .selectFrom("tiles")
      .selectAll()
      .where("region_id", "=", regionId)
      .orderBy("cell_x", "asc")
      .orderBy("cell_y", "asc")
      .orderBy("id", "asc")  // Secondary sort to guarantee determinism
      .execute();

    return computeRegionHash(
      rows.map((row) => ({
        regionId: row.region_id,
        cellX: row.cell_x,
        cellY: row.cell_y,
        offsetX: row.offset_x,
        offsetY: row.offset_y,
        shape: row.shape,
        color: row.color,
        stylePayload: row.style_payload,
        ownerId: row.owner_id
      }))
    );
  }

  beforeAll(async () => {
    try {
      runtime = createDatabaseRuntime(testDbConnectionString);
      await runtime.db.selectFrom("tiles").select("id").limit(1).execute();

      service = new RegionSnapshotService({
        db: runtime.db,
        repository: createRegionSnapshotRepository(),
        telemetrySink: createTelemetrySink()
      });
    } catch (error) {
      testsCanRun = false;
      if (runtime) {
        await closeDatabaseRuntime(runtime);
        runtime = null;
      }
      console.warn(
        "Skipping region snapshot lifecycle integration tests: database not available",
        error instanceof Error ? error.message : error
      );
    }
  });

  beforeEach(async () => {
    if (!testsCanRun || !runtime) {
      return;
    }

    await clearSnapshotFixtures(runtime.db);
  });

  afterAll(async () => {
    if (runtime) {
      try {
        await clearSnapshotFixtures(runtime.db);
      } catch {
        // Ignore cleanup failures in unavailable-db environments.
      }
      await closeDatabaseRuntime(runtime);
    }
  });

  it("restores from latest snapshot and replaces drifted region contents", async () => {
      if (!testsCanRun || !runtime || !service) {
        return;
      }

      const db = runtime.db;
      const regionId = "replay-region-main";
      const actorId = "tenant-a|operator-1";

      await insertTile(db, {
        regionId,
        cellX: 0,
        cellY: 0,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "blue",
        stylePayload: { brush: "thin" },
        ownerId: "owner-a"
      });
      await insertTile(db, {
        regionId,
        cellX: 1,
        cellY: 0,
        offsetX: 0.1,
        offsetY: 0,
        shape: "triangle",
        color: "green",
        stylePayload: { glow: true },
        ownerId: "owner-b"
      });

      const firstSnapshot = await service.createSnapshot({ regionId, actorId });

      await db.deleteFrom("tiles").where("region_id", "=", regionId).execute();
      await insertTile(db, {
        regionId,
        cellX: 3,
        cellY: 3,
        offsetX: 0,
        offsetY: 0,
        shape: "hex",
        color: "red",
        stylePayload: { variant: 2 },
        ownerId: "owner-c"
      });

      const latestSnapshot = await service.createSnapshot({ regionId, actorId });

      await db
        .updateTable("region_snapshots")
        .set({ created_at: new Date("2026-06-29T00:00:00.000Z") })
        .where("snapshot_id", "=", firstSnapshot.snapshotId)
        .execute();
      await db
        .updateTable("region_snapshots")
        .set({ created_at: new Date("2026-06-29T00:01:00.000Z") })
        .where("snapshot_id", "=", latestSnapshot.snapshotId)
        .execute();

      await db.deleteFrom("tiles").where("region_id", "=", regionId).execute();
      await insertTile(db, {
        regionId,
        cellX: 9,
        cellY: 9,
        offsetX: 0,
        offsetY: 0,
        shape: "diamond",
        color: "black",
        stylePayload: { drift: true },
        ownerId: "owner-z"
      });

      const unrelatedRegion = "replay-region-untouched";
      await insertTile(db, {
        regionId: unrelatedRegion,
        cellX: 5,
        cellY: 5,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "yellow",
        stylePayload: {},
        ownerId: "owner-unrelated"
      });

      const restoreResult = await service.restoreLatest({ regionId, actorId });

      expect(restoreResult.snapshotId).toBe(latestSnapshot.snapshotId);
      expect(restoreResult.expectedHash).toBe(latestSnapshot.expectedHash);
      expect(restoreResult.actualHash).toBe(latestSnapshot.expectedHash);
      expect(restoreResult.restoredTileCount).toBe(1);

      const finalRows = await db
        .selectFrom("tiles")
        .selectAll()
        .where("region_id", "=", regionId)
        .orderBy("cell_x", "asc")
        .orderBy("cell_y", "asc")
        .execute();

      expect(finalRows).toHaveLength(1);
      expect(finalRows[0]?.cell_x).toBe(3);
      expect(finalRows[0]?.cell_y).toBe(3);
      expect(finalRows[0]?.shape).toBe("hex");
      expect(finalRows[0]?.color).toBe("red");
      expect(finalRows[0]?.owner_id).toBe("owner-c");

      const finalHash = await computeHashForRegion(db, regionId);
      expect(finalHash).toBe(latestSnapshot.expectedHash);
      expect(finalHash).not.toBe(firstSnapshot.expectedHash);

      const unrelatedRows = await db
        .selectFrom("tiles")
        .selectAll()
        .where("region_id", "=", unrelatedRegion)
        .execute();
      expect(unrelatedRows).toHaveLength(1);
      expect(unrelatedRows[0]?.color).toBe("yellow");
    });

    it("detects hash mismatch when region state diverges after snapshot creation", async () => {
      if (!testsCanRun || !runtime || !service) {
        return;
      }

      const regionId = `region-hash-mismatch-${Date.now()}`;
      const actorId = "actor-test";
      const db = runtime.db;

      try {
        await db
          .insertInto("tiles")
          .values({
            region_id: regionId,
            cell_x: 0,
            cell_y: 0,
            offset_x: 0,
            offset_y: 0,
            shape: "square",
            color: "red",
            style_payload: {},
            owner_id: "owner-a"
          })
          .execute();

        const snapshot1 = await service.createSnapshot({
          regionId,
          actorId
        });

        const hash1 = await computeHashForRegion(db, regionId);
        expect(hash1).toBe(snapshot1.expectedHash);

        await db
          .insertInto("tiles")
          .values({
            region_id: regionId,
            cell_x: 1,
            cell_y: 1,
            offset_x: 0.1,
            offset_y: 0.1,
            shape: "circle",
            color: "blue",
            style_payload: {},
            owner_id: "owner-b"
          })
          .execute();

        const hash2 = await computeHashForRegion(db, regionId);
        expect(hash2).not.toBe(snapshot1.expectedHash);
        expect(hash2).not.toBe(hash1);

        await expect(
          service.restoreLatest({
            regionId,
            actorId
          })
        ).rejects.toThrow(RegionSnapshotHashMismatchError);

        try {
          await service.restoreLatest({
            regionId,
            actorId
          });
          throw new Error("Expected RegionSnapshotHashMismatchError to be thrown");
        } catch (error) {
          if (error instanceof RegionSnapshotHashMismatchError) {
            expect(error.message).toContain("expected");
            expect(error.message).toContain("got");
          } else {
            throw error;
          }
        }
      } finally {
        await db
          .deleteFrom("tiles")
          .where("region_id", "=", regionId)
          .execute();

        await db
          .deleteFrom("region_snapshot_tiles")
          .where("snapshot_id", "in", (eb) =>
            eb
              .selectFrom("region_snapshots")
              .select("snapshot_id")
              .where("region_id", "=", regionId)
          )
          .execute();

        await db
          .deleteFrom("region_snapshots")
          .where("region_id", "=", regionId)
          .execute();
      }
    });
});
