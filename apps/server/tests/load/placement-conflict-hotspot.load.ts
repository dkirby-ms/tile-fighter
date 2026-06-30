import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { ITileRepository, TileRepository } from "../../src/persistence/tile.repository.js";
import {
  ServerDatabase,
  DatabaseRuntime,
  closeDatabaseRuntime,
  createDatabaseRuntime
} from "../../src/persistence/db.js";
import { createIntegrationTestDbGuard } from "../integration/test-db-guard.js";

describe("Placement conflict hotspot load", () => {
  const dbGuard = createIntegrationTestDbGuard("placement-conflict-hotspot.load");
  const testDbConnectionString = dbGuard.testDbConnectionString;

  let runtime: DatabaseRuntime | null = null;
  let db: Kysely<ServerDatabase> | null = null;
  let repository: TileRepository;

  beforeAll(async () => {
    runtime = createDatabaseRuntime(testDbConnectionString);
    db = runtime.db;
    repository = new TileRepository({
      telemetrySink: {
        emit: vi.fn(async () => undefined),
        emitPlacementConflictDetected: vi.fn(async () => undefined),
        emitPlacementConflictResolved: vi.fn(async () => undefined),
        emitTilePlaceRejected: vi.fn(async () => undefined),
        emitTilePlaceThrottled: vi.fn(async () => undefined),
        emitTilePlaced: vi.fn(async () => undefined),
        emitTileEdited: vi.fn(async () => undefined)
      } as unknown as TelemetrySink
    });

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

  function createAppForSubject(subject: string, tileRepository: ITileRepository = repository) {
    const telemetrySink = {
      emit: vi.fn(async () => undefined),
      emitPlacementConflictDetected: vi.fn(async () => undefined),
      emitPlacementConflictResolved: vi.fn(async () => undefined),
      emitTilePlaceRejected: vi.fn(async () => undefined),
      emitTilePlaceThrottled: vi.fn(async () => undefined),
      emitTilePlaced: vi.fn(async () => undefined),
      emitTileEdited: vi.fn(async () => undefined)
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
      checkpointService: {
        issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token"),
        resolveReconnect: vi.fn(async () => ({ ok: false, reason: "checkpoint_not_found" }))
      } as never,
      db: db!,
      tileRepository,
      tilePlaceThrottlePolicy: {
        maxRequests: 5_000,
        windowMs: 60_000
      }
    });
  }

  it.skipIf(!dbGuard.testsCanRun)(
    "validates hotspot contention yields single side effect and deterministic loser conflicts",
    async () => {
      const regionId = "hotspot-region-1";
      const cellX = 33;
      const cellY = 44;
      const contenderCount = 20;

      let winnerCommitted = false;
      const hotspotRepository: ITileRepository = {
        insertTile: vi.fn(async (_dbArg, input) => {
          if (!winnerCommitted) {
            winnerCommitted = true;
            return {
              ok: true,
              replayed: false,
              tile: {
                id: 5454,
                createdAt: new Date("2026-06-30T12:30:00.000Z"),
                sequenceId: 1
              }
            };
          }

          return {
            ok: false,
            reason: "coordinate_conflict",
            replayed: false,
            commandId: input.commandId ?? "unknown",
            regionId: input.regionId,
            error: {
              type: "coordinate_conflict",
              region_id: input.regionId,
              cell_x: input.cellX,
              cell_y: input.cellY,
              winner_owner_id: "tenant-a|hotspot-player-0",
              winner_tile_id: 5454,
              winner_resolved_at: new Date("2026-06-30T12:30:00.000Z")
            }
          };
        }),
        editTileWithinSelfEditWindow: vi.fn(async () => ({
          ok: false,
          reason: "forbidden_owner_mismatch"
        })),
        deleteTile: vi.fn(async () => ({ ok: false, reason: "not_found" })),
        selectTilesByRegion: vi.fn(async () => []),
        selectTileByCoordinate: vi.fn(async () => null)
      };

      const contenderApps = Array.from({ length: contenderCount }, (_, index) =>
        createAppForSubject(`hotspot-player-${index}`, hotspotRepository)
      );

      const responses = await Promise.all(
        contenderApps.map((app, index) =>
          request(app)
            .post("/api/tiles/place")
            .set("Authorization", `Bearer hotspot-${index}`)
            .send({
              commandId: `cmd_hotspot_${index.toString().padStart(2, "0")}_deterministic_0001`,
              regionId,
              cellX,
              cellY,
              offsetX: 0,
              offsetY: 0,
              shape: "square",
              color: "orange",
              stylePayload: { contender: index }
            })
        )
      );

      const successes = responses.filter((response) => response.status === 201);
      const conflicts = responses.filter((response) => response.status === 409);

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(contenderCount - 1);

      for (const conflict of conflicts) {
        expect(conflict.body.ok).toBe(false);
        expect(conflict.body.reason).toBe("occupied");
        expect(conflict.body.conflictCode).toBe("placement_conflict_idempotent");
        expect(conflict.body.regionId).toBe(regionId);
        expect(conflict.body.cell).toEqual({ cellX, cellY });
      }

      const tileCount = await db!
        .selectFrom("tiles")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("region_id", "=", regionId)
        .where("cell_x", "=", cellX)
        .where("cell_y", "=", cellY)
        .executeTakeFirstOrThrow();

      expect(Number(tileCount.count)).toBe(0);
      expect((hotspotRepository.insertTile as ReturnType<typeof vi.fn>).mock.calls.length).toBe(contenderCount);
    }
  );

  it.skipIf(!dbGuard.testsCanRun)(
    "validates retry storm remains side-effect bounded for same command identity",
    async () => {
      const regionId = "hotspot-region-retry";
      const commandId = "cmd_retry_storm_identity_0001";
      const retryAttempts = 60;
      const app = createAppForSubject("retry-storm-player");

      const seed = await request(app)
        .post("/api/tiles/place")
        .set("Authorization", "Bearer retry-storm")
        .send({
          commandId,
          regionId,
          cellX: 5,
          cellY: 5,
          offsetX: 0,
          offsetY: 0,
          shape: "triangle",
          color: "purple",
          stylePayload: { storm: true }
        });

      expect(seed.status).toBe(201);

      const responses = await Promise.all(
        Array.from({ length: retryAttempts }, () =>
          request(app)
            .post("/api/tiles/place")
            .set("Authorization", "Bearer retry-storm")
            .send({
              commandId,
              regionId,
              cellX: 5,
              cellY: 5,
              offsetX: 0,
              offsetY: 0,
              shape: "triangle",
              color: "purple",
              stylePayload: { storm: true }
            })
        )
      );

      expect(responses.every((response) => response.status === 201)).toBe(true);

      const firstBody = seed.body;
      for (const response of responses) {
        expect(response.body.ok).toBe(true);
        expect(response.body.tileId).toBe(firstBody.tileId);
        expect(response.body.createdAt).toBe(firstBody.createdAt);
      }

      const tileCount = await db!
        .selectFrom("tiles")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("region_id", "=", regionId)
        .where("cell_x", "=", 5)
        .where("cell_y", "=", 5)
        .executeTakeFirstOrThrow();

      const commandCount = await db!
        .selectFrom("placement_commands")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("region_id", "=", regionId)
        .where("actor_id", "=", "tenant-a|retry-storm-player")
        .where("command_id", "=", commandId)
        .executeTakeFirstOrThrow();

      expect(Number(tileCount.count)).toBe(1);
      expect(Number(commandCount.count)).toBe(1);
    }
  );
});
