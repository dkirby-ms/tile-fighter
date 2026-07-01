import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { ITileRepository, TileRepository, selectBondNeighborhoodTiles } from "../../src/persistence/tile.repository.js";
import { BondRecomputeCoordinator, type BondRecomputeInput } from "../../src/domain/bond-recompute-coordinator.js";
import { evaluateBondType } from "@game/shared-types";
import {
  ServerDatabase,
  DatabaseRuntime,
  closeDatabaseRuntime,
  createDatabaseRuntime
} from "../../src/persistence/db.js";
import { createIntegrationTestDbGuard } from "./test-db-guard.js";

describe("Tile bonding trigger integration", () => {
  const dbGuard = createIntegrationTestDbGuard("tile-bonding-trigger.integration");
  const testDbConnectionString = dbGuard.testDbConnectionString;

  let runtime: DatabaseRuntime | null = null;
  let db: Kysely<ServerDatabase> | null = null;
  let repository: TileRepository;

  beforeAll(async () => {
    runtime = createDatabaseRuntime(testDbConnectionString);
    db = runtime.db;
    repository = new TileRepository();

    await db.selectFrom("tiles").selectAll().limit(1).execute();
    await db.selectFrom("placement_commands").selectAll().limit(1).execute();
  });

  afterAll(async () => {
    if (runtime) {
      await closeDatabaseRuntime(runtime);
    }
  });

  beforeEach(async () => {
    if (!db) {
      return;
    }

    await db.deleteFrom("placement_commands").execute();
    await db.deleteFrom("tile_deltas").execute();
    await db.deleteFrom("region_versions").execute();
    await db.deleteFrom("tiles").execute();
  });

  function buildBondFingerprint(item: BondRecomputeInput, bondType: string | null, neighbors: Array<{ cellX: number; cellY: number; color: string }>): string {
    const neighborSignature = neighbors
      .map((neighbor) => `${neighbor.cellX},${neighbor.cellY},${neighbor.color}`)
      .join("|");

    return `${item.regionId}:${item.cellX}:${item.cellY}:${item.color}:${bondType ?? "none"}:${neighborSignature}`;
  }

  function createAppWithTelemetrySpy(subject: string, tileRepository: ITileRepository = repository) {
    const telemetrySink = {
      emit: vi.fn(async () => undefined),
      emitTilePlaceRejected: vi.fn(async () => undefined),
      emitTilePlaced: vi.fn(async () => undefined),
      emitTileEdited: vi.fn(async () => undefined),
      emitTilePlaceThrottled: vi.fn(async () => undefined),
      emitBondingTriggered: vi.fn(async () => undefined),
      emitBondRecalcStarted: vi.fn(async () => undefined),
      emitBondRecalcCompleted: vi.fn(async () => undefined),
      emitBondRecalcSkipped: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject,
        tenantScopedSubject: `tenant-a|${subject}`,
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

    const bondRecomputeCoordinator = new BondRecomputeCoordinator(
      {
        maxPendingItems: 32,
        maxDrainBatchSize: 8,
        maxQueueWaitMs: 0
      },
      async (item) => {
        const neighborhood = await selectBondNeighborhoodTiles(db!, item.regionId, item.cellX, item.cellY);
        const bondType = evaluateBondType(
          {
            cellX: item.cellX,
            cellY: item.cellY,
            color: item.color
          },
          neighborhood
        );

        return {
          fingerprint: buildBondFingerprint(item, bondType, neighborhood),
          bondType
        };
      },
      async (item, bondType) => {
        await telemetrySink.emitBondingTriggered({
          bondType,
          regionId: item.regionId,
          cellX: item.cellX,
          cellY: item.cellY
        });
      },
      {
        onStarted: async () => undefined,
        onCompleted: async () => undefined,
        onSkipped: async () => undefined
      }
    );

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
      checkpointService: {
        issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token"),
        resolveReconnect: vi.fn(async () => ({ ok: false, reason: "checkpoint_not_found" }))
      } as never,
      db: db!,
      tileRepository,
      bondRecomputeCoordinator,
      tilePlaceThrottlePolicy: {
        maxRequests: 100,
        windowMs: 60_000
      }
    });

    return {
      app,
      telemetrySink: telemetrySink as {
        emitBondingTriggered: ReturnType<typeof vi.fn>;
      }
    };
  }

  it.skipIf(!dbGuard.testsCanRun)("emits bonding telemetry after successful commit when bond is found", async () => {
    const { app, telemetrySink } = createAppWithTelemetrySpy("bond-player");
    const regionId = "bonding-region-1";

    const primer = await request(app)
      .post("/api/tiles/place")
      .set("Authorization", "Bearer token-bond")
      .send({
        commandId: "cmd-bond-primer-1",
        regionId,
        cellX: 10,
        cellY: 10,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "cyan",
        stylePayload: { seed: 1 }
      });

    expect(primer.status).toBe(201);

    const trigger = await request(app)
      .post("/api/tiles/place")
      .set("Authorization", "Bearer token-bond")
      .send({
        commandId: "cmd-bond-trigger-1",
        regionId,
        cellX: 11,
        cellY: 10,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "cyan",
        stylePayload: { seed: 2 }
      });

    expect(trigger.status).toBe(201);
    await vi.waitFor(() => {
      expect(telemetrySink.emitBondingTriggered).toHaveBeenCalledTimes(1);
    });
    expect(telemetrySink.emitBondingTriggered).toHaveBeenCalledWith({
      bondType: "glow-chain",
      regionId,
      cellX: 11,
      cellY: 10
    });
  });

  it.skipIf(!dbGuard.testsCanRun)("does not emit bonding telemetry on unsuccessful placement", async () => {
    const conflictRepository: ITileRepository = {
      insertTile: vi.fn(async (_dbArg, input) => ({
        ok: false,
        reason: "coordinate_conflict",
        replayed: false,
        commandId: input.commandId ?? "unknown-command",
        regionId: input.regionId,
        error: {
          type: "coordinate_conflict",
          region_id: input.regionId,
          cell_x: input.cellX,
          cell_y: input.cellY,
          winner_owner_id: "tenant-a|winner",
          winner_tile_id: 1001,
          winner_resolved_at: new Date("2026-06-30T12:00:00.000Z")
        }
      })),
      editTileWithinSelfEditWindow: vi.fn(async () => ({ ok: false, reason: "forbidden_owner_mismatch" })),
      deleteTile: vi.fn(async () => ({ ok: false, reason: "not_found" })),
      selectTilesByRegion: vi.fn(async () => []),
      selectTileByCoordinate: vi.fn(async () => null)
    };

    const { app, telemetrySink } = createAppWithTelemetrySpy("bond-player-conflict", conflictRepository);
    const regionId = "bonding-region-2";

    const conflict = await request(app)
      .post("/api/tiles/place")
      .set("Authorization", "Bearer token-bond-conflict")
      .send({
        commandId: "cmd-bond-conflict-1",
        regionId,
        cellX: 3,
        cellY: 4,
        offsetX: 0,
        offsetY: 0,
        shape: "hex",
        color: "blue",
        stylePayload: { seed: 4 }
      });

    expect(conflict.status).toBe(409);
    expect(telemetrySink.emitBondingTriggered).not.toHaveBeenCalled();
  });
});
