import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import request from "supertest";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import type { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import type { ITileRepository } from "../../src/persistence/tile.repository.js";
import type { Kysely } from "kysely";
import type { ServerDatabase } from "../../src/persistence/db.js";
import { BondEvaluatorService } from "../../src/domain/bond-evaluator.service.js";

describe("recompute telemetry", () => {
  it("emits recompute lifecycle and bonding telemetry from authoritative tile placement", async () => {
    const emitTilePlaced = vi.fn(async () => undefined);
    const emitBondRecalcStarted = vi.fn(async () => undefined);
    const emitBondRecalcSkipped = vi.fn(async () => undefined);
    const emitBondRecalcCompleted = vi.fn(async () => undefined);
    const emitBondingTriggered = vi.fn(async () => undefined);

    const telemetrySink = {
      emit: vi.fn(async () => undefined),
      emitTilePlaced,
      emitTilePlaceRejected: vi.fn(async () => undefined),
      emitTilePlaceThrottled: vi.fn(async () => undefined),
      emitTileEdited: vi.fn(async () => undefined),
      emitBondRecalcStarted,
      emitBondRecalcSkipped,
      emitBondRecalcCompleted,
      emitBondingTriggered
    } as unknown as TelemetrySink;

    const regionTiles = [
      {
        id: 1,
        region_id: "arena-main",
        cell_x: 0,
        cell_y: 0,
        offset_x: 0,
        offset_y: 0,
        shape: "square",
        color: "red",
        style_payload: {},
        owner_id: "tenant-a|player-1",
        created_at: new Date("2026-07-01T00:00:00.000Z")
      },
      {
        id: 2,
        region_id: "arena-main",
        cell_x: 1,
        cell_y: 0,
        offset_x: 0,
        offset_y: 0,
        shape: "square",
        color: "red",
        style_payload: {},
        owner_id: "tenant-a|player-1",
        created_at: new Date("2026-07-01T00:00:01.000Z")
      }
    ];

    const tileRepository: ITileRepository = {
      insertTile: vi.fn(async () => ({
        ok: true,
        replayed: false,
        tile: {
          id: 2,
          createdAt: new Date("2026-07-01T00:00:01.000Z"),
          sequenceId: 0
        }
      })),
      editTileWithinSelfEditWindow: vi.fn(),
      deleteTile: vi.fn(),
      selectTilesByRegion: vi.fn(async () => regionTiles as never),
      selectTileByCoordinate: vi.fn()
    };

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
      checkpointService: {
        onPresenceCleared: vi.fn(async () => undefined),
        updateSessionHeartbeat: vi.fn(async () => undefined),
        archiveCheckpoint: vi.fn(async () => undefined)
      } as never,
      db: {} as Kysely<ServerDatabase>,
      tileRepository,
      bondEvaluatorService: new BondEvaluatorService()
    });

    const response = await request(app)
      .post("/api/tiles/place")
      .set("authorization", "Bearer dev-token")
      .send({
        commandId: "cmd_recompute_telemetry_0001",
        regionId: "arena-main",
        cellX: 1,
        cellY: 0,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "red",
        stylePayload: {}
      });

    expect(response.status).toBe(201);
    expect(emitTilePlaced).toHaveBeenCalledTimes(1);
    expect(emitBondRecalcStarted).toHaveBeenCalledTimes(1);
    expect(emitBondRecalcCompleted).toHaveBeenCalledTimes(1);
    expect(emitBondRecalcSkipped).toHaveBeenCalledTimes(1);
    expect(emitBondingTriggered).toHaveBeenCalledTimes(1);
  });
});
