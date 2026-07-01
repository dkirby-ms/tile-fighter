import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { evaluateBondType } from "@game/shared-types";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { BondRecomputeCoordinator } from "../../src/domain/bond-recompute-coordinator.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { ITileRepository, TileRepository, selectBondNeighborhoodTiles } from "../../src/persistence/tile.repository.js";
import {
  ServerDatabase,
  DatabaseRuntime,
  closeDatabaseRuntime,
  createDatabaseRuntime
} from "../../src/persistence/db.js";
import { createIntegrationTestDbGuard } from "./test-db-guard.js";

describe("Tile bonding recompute integration", () => {
  const dbGuard = createIntegrationTestDbGuard("tile-bonding-recompute.integration");
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

  function createAppWithRecompute(subject: string, tileRepository: ITileRepository = repository) {
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

    const coordinator = new BondRecomputeCoordinator(
      {
        maxPendingItems: 128,
        maxDrainBatchSize: 16,
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

        const neighborSignature = neighborhood
          .map((neighbor) => `${neighbor.cellX},${neighbor.cellY},${neighbor.color}`)
          .join("|");

        return {
          fingerprint: `${item.regionId}:${item.cellX}:${item.cellY}:${item.color}:${bondType ?? "none"}:${neighborSignature}`,
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
        onStarted: async (event) => {
          await telemetrySink.emitBondRecalcStarted(event);
        },
        onCompleted: async (event) => {
          await telemetrySink.emitBondRecalcCompleted(event);
        },
        onSkipped: async (event) => {
          await telemetrySink.emitBondRecalcSkipped(event);
        }
      }
    );

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
      bondRecomputeCoordinator: coordinator,
      tilePlaceThrottlePolicy: {
        maxRequests: 100,
        windowMs: 60_000
      },
      bondRecomputeFloodPolicy: {
        maxRequests: 1_000,
        windowMs: 60_000
      }
    });

    return {
      app,
      telemetrySink: telemetrySink as {
        emitBondingTriggered: ReturnType<typeof vi.fn>;
        emitBondRecalcSkipped: ReturnType<typeof vi.fn>;
      },
      coordinator
    };
  }

  it.skipIf(!dbGuard.testsCanRun)(
    "suppresses redundant bond events when repeated placement replay keeps adjacency unchanged",
    async () => {
      const regionId = "bonding-recompute-region-1";
      const { app, telemetrySink, coordinator } = createAppWithRecompute("bond-recompute-player");

      try {
        const primer = await request(app)
          .post("/api/tiles/place")
          .set("Authorization", "Bearer token-bond-primer")
          .send({
            commandId: "cmd-bond-recompute-primer-1",
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
          .set("Authorization", "Bearer token-bond-trigger")
          .send({
            commandId: "cmd-bond-recompute-trigger-1",
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

        const replay = await request(app)
          .post("/api/tiles/place")
          .set("Authorization", "Bearer token-bond-trigger")
          .send({
            commandId: "cmd-bond-recompute-trigger-1",
            regionId,
            cellX: 11,
            cellY: 10,
            offsetX: 0,
            offsetY: 0,
            shape: "square",
            color: "cyan",
            stylePayload: { seed: 2 }
          });

        expect(replay.status).toBe(201);
        await vi.waitFor(() => {
          expect(telemetrySink.emitBondRecalcSkipped).toHaveBeenCalledWith(
            expect.objectContaining({
              regionId,
              cellX: 11,
              cellY: 10,
              reason: "unchanged_fingerprint"
            })
          );
        });

        expect(telemetrySink.emitBondingTriggered).toHaveBeenCalledTimes(1);
      } finally {
        coordinator.destroy();
      }
    }
  );
});
