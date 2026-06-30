import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

describe("Join/Rejoin load scenario", () => {
  it("handles mass reconnect churn and enforces retention cleanup guardrails", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "load-player",
        tenantScopedSubject: "tenant-a|load-player",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000
      })),
      issueJoinToken: vi.fn(() => "join-token-load")
    };

    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const lifecycleService = new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });

    const archivedCheckpointCount = 7;
    const checkpointService = {
      issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token-load"),
      resolveReconnect: vi.fn(async () => ({
        ok: true as const,
        checkpointId: "checkpoint-load",
        sessionId: "session-load",
        roomId: "arena",
        regionId: "arena",
        sinceVersion: 2,
        currentVersion: 3,
        deltaCount: 1,
        deltas: [
          {
            cellX: 1,
            cellY: 1,
            version: 3,
            operation: "upsert",
            offsetX: 0,
            offsetY: 0,
            shape: "square",
            color: "red",
            stylePayload: null,
            ownerId: "tenant-a|load-player"
          }
        ],
        serverChecksum: "load-checksum",
        checksumScope: "full_region_canonical"
      })),
      archiveExpiredStaleCheckpoints: vi.fn(async () => archivedCheckpointCount)
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

    const totalReconnects = 100;
    const reconnectTasks = Array.from({ length: totalReconnects }).map(async (_, index) => {
      const heartbeatResponse = await request(app)
        .post("/api/session/heartbeat")
        .set("Authorization", "Bearer valid-token")
        .send({ roomId: "arena" });

      const reconnectStart = Date.now();
      const reconnectResponse = await request(app)
        .post("/api/session/reconnect")
        .set("Authorization", "Bearer valid-token")
        .send({
          roomId: "arena",
          reconnectToken: heartbeatResponse.body.reconnectToken ?? `fallback-token-${index}`
        });

      return {
        heartbeatStatus: heartbeatResponse.status,
        reconnectStatus: reconnectResponse.status,
        latencyMs: Date.now() - reconnectStart
      };
    });

    const results = await Promise.all(reconnectTasks);
    const reconnectOk = results.filter((result) => result.reconnectStatus === 200);
    const reconnectThrottled = results.filter((result) => result.reconnectStatus === 429);
    const heartbeatAccepted = results.filter((result) => result.heartbeatStatus === 202);
    const heartbeatThrottled = results.filter((result) => result.heartbeatStatus === 429);

    expect(heartbeatAccepted.length).toBeGreaterThan(0);
    expect(heartbeatThrottled.length).toBeGreaterThan(0);
    expect(reconnectOk.length + reconnectThrottled.length).toBe(totalReconnects);
    expect(reconnectOk.length).toBeGreaterThan(0);
    expect(reconnectThrottled.length).toBeGreaterThan(0);

    const latencies = reconnectOk.map((result) => result.latencyMs);
    const p95Latency = percentile(latencies, 95);

    process.stdout.write(
      `\n[join-rejoin-load] reconnect_count=${reconnectOk.length} p95_ms=${p95Latency} archived=${archivedCheckpointCount}\n`
    );

    const cleanupArchived = await checkpointService.archiveExpiredStaleCheckpoints();
    expect(cleanupArchived).toBe(archivedCheckpointCount);
  });
});
