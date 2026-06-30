import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { Kysely } from "kysely";
import { ServerDatabase } from "../../src/persistence/db.js";
import { TileRepository } from "../../src/persistence/tile.repository.js";

function createAuthService(subject: string) {
  return {
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
}

describe("Load-focused authoritative placement and throttle paths", () => {
  it("simulates placement contention on one coordinate with deterministic occupied rejections", async () => {
    const telemetrySink = {
      emit: vi.fn(async () => undefined),
      emitTilePlaceRejected: vi.fn(async () => undefined),
      emitTilePlaced: vi.fn(async () => undefined),
      emitTileEdited: vi.fn(async () => undefined),
      emitTilePlaceThrottled: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    let inserted = false;
    const tileRepository = {
      insertTile: vi.fn(async () => {
        if (!inserted) {
          inserted = true;
          return {
            ok: true as const,
            tile: {
              id: 101,
              createdAt: new Date("2026-06-29T12:00:00.000Z")
            }
          };
        }

        return {
          ok: false as const,
          reason: "coordinate_conflict" as const,
          error: {
            type: "coordinate_conflict" as const,
            region_id: "arena-main",
            cell_x: 3,
            cell_y: 4
          }
        };
      }),
      editTileWithinSelfEditWindow: vi.fn(async () => ({
        ok: false as const,
        reason: "forbidden_owner_mismatch" as const
      }))
    } as unknown as TileRepository;

    const app = createHttpApp({
      readinessCheck: async () => ({
        ok: true,
        checks: {
          database: "ok",
          config: "ok"
        }
      }),
      authMiddleware: buildAuthMiddleware(createAuthService("player-1") as never),
      telemetrySink,
      authService: createAuthService("player-1") as never,
      lifecycleService: new SessionLifecycleService({
        heartbeatTtlSeconds: 30,
        cleanupIntervalSeconds: 5,
        telemetrySink
      }),
      checkpointService: {
        issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token"),
        resolveReconnect: vi.fn(async () => ({ ok: false, reason: "checkpoint_not_found" }))
      } as never,
      db: {} as Kysely<ServerDatabase>,
      tileRepository
    });

    const attempts = 12;
    const responses = await Promise.all(
      Array.from({ length: attempts }).map(() =>
        request(app)
          .post("/api/tiles/place")
          .set("Authorization", "Bearer valid-token")
          .send({
            regionId: "arena-main",
            cellX: 3,
            cellY: 4,
            offsetX: 0,
            offsetY: 0,
            shape: "square",
            color: "red",
            stylePayload: { hotSpot: true }
          })
      )
    );

    const createdResponses = responses.filter((response) => response.status === 201);
    const occupiedResponses = responses.filter((response) => response.status === 409);
    const throttledResponses = responses.filter((response) => response.status === 429);

    expect(createdResponses).toHaveLength(1);
    expect(occupiedResponses.length + throttledResponses.length).toBe(attempts - 1);
    expect(occupiedResponses.length).toBeGreaterThan(0);
    expect(throttledResponses.length).toBeGreaterThan(0);
    for (const response of occupiedResponses) {
      expect(response.body).toEqual({ ok: false, reason: "occupied" });
    }
    for (const response of throttledResponses) {
      expect(response.body.ok).toBe(false);
      expect(response.body.reason).toBe("throttled");
      expect(typeof response.body.retryAfterMs).toBe("number");
      expect(response.body.retryAfterMs).toBeGreaterThan(0);
    }

    expect(tileRepository.insertTile).toHaveBeenCalledTimes(createdResponses.length + occupiedResponses.length);
  });

  it("exercises high-rate heartbeat throttle path under load", async () => {
    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const authService = createAuthService("player-throttle");
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
      } as never
    });

    const burst = 40;
    const responses = await Promise.all(
      Array.from({ length: burst }).map(() =>
        request(app)
          .post("/api/session/heartbeat")
          .set("Authorization", "Bearer valid-token")
          .send({ roomId: "arena-1" })
      )
    );

    const accepted = responses.filter((response) => response.status === 202);
    const throttled = responses.filter((response) => response.status === 429);

    expect(accepted.length).toBeGreaterThan(0);
    expect(throttled.length).toBeGreaterThan(0);
    expect(throttled[0].body.error).toBe("Heartbeat rate limit exceeded");
  });
});