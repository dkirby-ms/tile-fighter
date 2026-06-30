import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeDatabaseRuntime,
  createDatabaseRuntime,
  DatabaseRuntime
} from "../../src/persistence/db.js";
import { RegionSnapshotService } from "../../src/domain/region-snapshot.service.js";
import { createRegionSnapshotRepository } from "../../src/persistence/region-snapshot.repository.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { computeRegionHash } from "../../src/domain/region-hash.js";

describe("Region restore drill smoke", () => {
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

  async function regionHash(db: DatabaseRuntime["db"], regionId: string): Promise<string> {
    const rows = await db
      .selectFrom("tiles")
      .selectAll()
      .where("region_id", "=", regionId)
      .orderBy("cell_x", "asc")
      .orderBy("cell_y", "asc")
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
        "Skipping region restore drill smoke tests: database not available",
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

  it("drill recovers region hash after drift using latest snapshot restore", async () => {
    if (!testsCanRun || !runtime || !service) {
      return;
    }

    const db = runtime.db;
    const regionId = "restore-drill-region";
    const actorId = "tenant-a|operator-drill";

    await insertTile(db, {
      regionId,
      cellX: 10,
      cellY: 2,
      offsetX: 0,
      offsetY: 0,
      shape: "square",
      color: "blue",
      stylePayload: { layer: "base" },
      ownerId: "owner-1"
    });
    await insertTile(db, {
      regionId,
      cellX: 11,
      cellY: 2,
      offsetX: 0.2,
      offsetY: 0,
      shape: "triangle",
      color: "green",
      stylePayload: { layer: "decor" },
      ownerId: "owner-2"
    });

    const snapshot = await service.createSnapshot({ regionId, actorId });
    const baselineHash = await regionHash(db, regionId);

    expect(baselineHash).toBe(snapshot.expectedHash);

    await db.deleteFrom("tiles").where("region_id", "=", regionId).execute();
    await insertTile(db, {
      regionId,
      cellX: 99,
      cellY: 99,
      offsetX: 0,
      offsetY: 0,
      shape: "diamond",
      color: "red",
      stylePayload: { drift: true },
      ownerId: "owner-drift"
    });

    const driftHash = await regionHash(db, regionId);
    expect(driftHash).not.toBe(snapshot.expectedHash);

    const restoreResult = await service.restoreLatest({ regionId, actorId });
    const recoveredHash = await regionHash(db, regionId);

    expect(restoreResult.snapshotId).toBe(snapshot.snapshotId);
    expect(restoreResult.expectedHash).toBe(snapshot.expectedHash);
    expect(restoreResult.actualHash).toBe(snapshot.expectedHash);
    expect(restoreResult.restoredTileCount).toBe(2);
    expect(recoveredHash).toBe(snapshot.expectedHash);

    const restoredRows = await db
      .selectFrom("tiles")
      .selectAll()
      .where("region_id", "=", regionId)
      .orderBy("cell_x", "asc")
      .orderBy("cell_y", "asc")
      .execute();

    expect(restoredRows).toHaveLength(2);
    expect(restoredRows[0]?.cell_x).toBe(10);
    expect(restoredRows[1]?.cell_x).toBe(11);
  });
});
