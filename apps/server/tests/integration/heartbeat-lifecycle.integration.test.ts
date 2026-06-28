import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";

describe("Heartbeat lifecycle integration", () => {
  it("accepts authenticated heartbeat updates", async () => {
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

    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

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
      lifecycleService
    });

    const response = await request(app)
      .post("/api/session/heartbeat")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: "arena-1" });

    expect(response.status).toBe(202);
    expect(response.body.accepted).toBe(true);
    expect(lifecycleService.getPresence("tenant-a|player-1")?.roomId).toBe("arena-1");
  });

  it("cleans stale lifecycle metadata without room-membership mutation", async () => {
    let nowMs = 1_700_000_000_000;
    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;
    const lifecycleService = new SessionLifecycleService({
      heartbeatTtlSeconds: 10,
      cleanupIntervalSeconds: 5,
      telemetrySink,
      now: () => nowMs
    });

    lifecycleService.noteHeartbeat("tenant-a|player-1", "arena-1");
    expect(lifecycleService.getPresenceCount()).toBe(1);

    nowMs += 11_000;
    await lifecycleService.cleanupStaleMetadata();

    expect(lifecycleService.getPresenceCount()).toBe(0);
  });
});