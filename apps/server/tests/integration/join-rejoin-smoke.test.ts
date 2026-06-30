import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import {
  ReconnectFailureResult,
  ReconnectReplayResult
} from "../../src/session/session-lifecycle.types.js";

function createSmokeApp(reconnectOutcome: ReconnectReplayResult | ReconnectFailureResult) {
  const authService = {
    verifyAccessToken: vi.fn(async () => ({
      subject: "smoke-player",
      tenantScopedSubject: "tenant-a|smoke-player",
      issuer: "https://issuer.example",
      audience: "api://tile-fighter-server",
      tenantId: "tenant-a",
      tokenVersion: "2.0",
      expiresAt: 1_900_000_000
    })),
    issueJoinToken: vi.fn(() => "join-token-smoke")
  };

  const telemetrySink = {
    emit: vi.fn(async () => undefined)
  } as unknown as TelemetrySink;

  const lifecycleService = new SessionLifecycleService({
    heartbeatTtlSeconds: 30,
    cleanupIntervalSeconds: 5,
    telemetrySink
  });

  const checkpointService = {
    issueReconnectTokenForSubject: vi.fn(async () => "smoke-reconnect-token"),
    resolveReconnect: vi.fn(async () => reconnectOutcome)
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
    lifecycleService,
    checkpointService: checkpointService as never
  });

  return { app, checkpointService };
}

describe("Join/Rejoin smoke", () => {
  it("covers drop/reconnect flow and keeps reconnect latency within smoke SLA", async () => {
    const { app } = createSmokeApp({
      ok: true,
      checkpointId: "checkpoint-smoke",
      sessionId: "session-smoke",
      roomId: "arena",
      regionId: "arena",
      sinceVersion: 10,
      currentVersion: 12,
      deltaCount: 2,
      deltas: [
        {
          cellX: 10,
          cellY: 11,
          version: 11,
          operation: "upsert",
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "orange",
          stylePayload: null,
          ownerId: "tenant-a|smoke-player"
        },
        {
          cellX: 11,
          cellY: 11,
          version: 12,
          operation: "upsert",
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "teal",
          stylePayload: null,
          ownerId: "tenant-a|smoke-player"
        }
      ],
      serverChecksum: "smoke-checksum",
      checksumScope: "full_region_canonical"
    });

    const heartbeatResponse = await request(app)
      .post("/api/session/heartbeat")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: "arena" });

    expect(heartbeatResponse.status).toBe(202);

    const start = Date.now();
    const reconnectResponse = await request(app)
      .post("/api/session/reconnect")
      .set("Authorization", "Bearer valid-token")
      .send({
        roomId: "arena",
        reconnectToken: heartbeatResponse.body.reconnectToken
      });
    const elapsedMs = Date.now() - start;

    expect(reconnectResponse.status).toBe(200);
    expect(reconnectResponse.body.ok).toBe(true);
    expect(reconnectResponse.body.replay.deltaCount).toBe(2);
    expect(reconnectResponse.body.checksum.scope).toBe("full_region_canonical");

    const smokeReconnectSlaMs = 500;
    expect(elapsedMs).toBeLessThan(smokeReconnectSlaMs);
  });

  it("maps stale reconnect attempts to 410 for operational smoke checks", async () => {
    const { app } = createSmokeApp({
      ok: false,
      reason: "grace_period_expired"
    });

    const response = await request(app)
      .post("/api/session/reconnect")
      .set("Authorization", "Bearer valid-token")
      .send({
        roomId: "arena",
        reconnectToken: "stale-token"
      });

    expect(response.status).toBe(410);
    expect(response.body.error).toBe("grace_period_expired");
  });
});
