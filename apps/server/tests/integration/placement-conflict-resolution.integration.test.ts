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
import { createIntegrationTestDbGuard } from "./test-db-guard.js";

describe("Placement conflict resolution integration", () => {
  const dbGuard = createIntegrationTestDbGuard("placement-conflict-resolution.integration");
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
      tilePlaceThrottlePolicy: {
        maxRequests: 100,
        windowMs: 60_000
      }
    });

    return app;
  }

  it.skipIf(!dbGuard.testsCanRun)(
    "resolves simultaneous same-cell claims to one winner and deterministic loser payload",
    async () => {
      const regionId = "arena-race-1";
      const commandIdA = "cmd_integration_race_player_a_01";
      const commandIdB = "cmd_integration_race_player_b_01";

      let accepted = false;
      const deterministicRaceRepository: ITileRepository = {
        insertTile: vi.fn(async (_dbArg, input) => {
          if (!accepted) {
            accepted = true;
            return {
              ok: true,
              replayed: false,
              tile: {
                id: 4321,
                createdAt: new Date("2026-06-30T12:00:00.000Z"),
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
              winner_owner_id: "tenant-a|player-a",
              winner_tile_id: 4321,
              winner_resolved_at: new Date("2026-06-30T12:00:00.000Z")
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

      const appPlayerA = createAppForSubject("player-a", deterministicRaceRepository);
      const appPlayerB = createAppForSubject("player-b", deterministicRaceRepository);

      const settled = await Promise.allSettled([
        request(appPlayerA)
          .post("/api/tiles/place")
          .set("Authorization", "Bearer token-a")
          .send({
            commandId: commandIdA,
            regionId,
            cellX: 12,
            cellY: 9,
            offsetX: 0,
            offsetY: 0,
            shape: "square",
            color: "cyan",
            stylePayload: { source: "race-a" }
          }),
        request(appPlayerB)
          .post("/api/tiles/place")
          .set("Authorization", "Bearer token-b")
          .send({
            commandId: commandIdB,
            regionId,
            cellX: 12,
            cellY: 9,
            offsetX: 0,
            offsetY: 0,
            shape: "square",
            color: "magenta",
            stylePayload: { source: "race-b" }
          })
      ]);

      const responseA = settled[0]?.status === "fulfilled" ? settled[0].value : null;
      const responseB = settled[1]?.status === "fulfilled" ? settled[1].value : null;

      expect(responseA).not.toBeNull();
      expect(responseB).not.toBeNull();
      if (!responseA || !responseB) {
        throw new Error("Expected both concurrent placement requests to resolve");
      }

      const success = [responseA, responseB].filter((response) => response.status === 201);
      const conflict = [responseA, responseB].filter((response) => response.status === 409);

      expect(success).toHaveLength(1);
      expect(conflict).toHaveLength(1);

      const loser = conflict[0];
      expect(loser.body.ok).toBe(false);
      expect(loser.body.reason).toBe("occupied");
      expect(loser.body.conflictCode).toBe("placement_conflict_idempotent");
      expect(loser.body.regionId).toBe(regionId);
      expect(loser.body.cell).toEqual({ cellX: 12, cellY: 9 });
      expect(typeof loser.body.commandId).toBe("string");
      expect(typeof loser.body.winner.ownerId).toBe("string");
      expect(typeof loser.body.winner.tileId).toBe("number");
      expect(typeof loser.body.winner.resolvedAt).toBe("string");

      const tileCount = await db!
        .selectFrom("tiles")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("region_id", "=", regionId)
        .executeTakeFirstOrThrow();

      expect(Number(tileCount.count)).toBe(0);
    },
    15_000
  );

  it.skipIf(!dbGuard.testsCanRun)(
    "returns stable response and no duplicate side effects on same-command retry",
    async () => {
      const regionId = "arena-retry-1";
      const commandId = "cmd_integration_retry_same_01";
      const app = createAppForSubject("player-retry");

      const first = await request(app)
        .post("/api/tiles/place")
        .set("Authorization", "Bearer token-retry")
        .send({
          commandId,
          regionId,
          cellX: 4,
          cellY: 6,
          offsetX: 0,
          offsetY: 0,
          shape: "hex",
          color: "yellow",
          stylePayload: { step: 1 }
        });

      expect(first.status).toBe(201);
      expect(first.body.ok).toBe(true);

      const second = await request(app)
        .post("/api/tiles/place")
        .set("Authorization", "Bearer token-retry")
        .send({
          commandId,
          regionId,
          cellX: 4,
          cellY: 6,
          offsetX: 0,
          offsetY: 0,
          shape: "hex",
          color: "yellow",
          stylePayload: { step: 1 }
        });

      expect(second.status).toBe(201);
      expect(second.body.ok).toBe(true);
      expect(second.body.tileId).toBe(first.body.tileId);
      expect(second.body.createdAt).toBe(first.body.createdAt);

      const tileCount = await db!
        .selectFrom("tiles")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("region_id", "=", regionId)
        .where("cell_x", "=", 4)
        .where("cell_y", "=", 6)
        .executeTakeFirstOrThrow();

      const commandCount = await db!
        .selectFrom("placement_commands")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("region_id", "=", regionId)
        .where("actor_id", "=", "tenant-a|player-retry")
        .where("command_id", "=", commandId)
        .executeTakeFirstOrThrow();

      expect(Number(tileCount.count)).toBe(1);
      expect(Number(commandCount.count)).toBe(1);
    }
  );

  it.skipIf(!dbGuard.testsCanRun)(
    "returns deterministic payload mismatch contract for reused commandId with different payload",
    async () => {
      const regionId = "arena-retry-mismatch-1";
      const commandId = "cmd_integration_retry_mismatch_01";
      const app = createAppForSubject("player-mismatch");

      const first = await request(app)
        .post("/api/tiles/place")
        .set("Authorization", "Bearer token-mismatch")
        .send({
          commandId,
          regionId,
          cellX: 7,
          cellY: 8,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "lime",
          stylePayload: { style: "v1" }
        });

      expect(first.status).toBe(201);

      const mismatch = await request(app)
        .post("/api/tiles/place")
        .set("Authorization", "Bearer token-mismatch")
        .send({
          commandId,
          regionId,
          cellX: 7,
          cellY: 8,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "lime",
          stylePayload: { style: "v2" }
        });

      expect(mismatch.status).toBe(409);
      expect(mismatch.body.ok).toBe(false);
      expect(mismatch.body.reason).toBe("command_payload_mismatch");
      expect(mismatch.body.conflictCode).toBe("placement_command_payload_mismatch");
      expect(mismatch.body.commandId).toBe(commandId);
      expect(mismatch.body.regionId).toBe(regionId);
    }
  );
});
