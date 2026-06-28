import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";

describe("Session bootstrap integration", () => {
  function createLifecycleService(telemetrySink: TelemetrySink): SessionLifecycleService {
    return new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });
  }

  it("returns unauthorized without bearer token", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => {
        throw new Error("unauthorized");
      }),
      issueJoinToken: vi.fn()
    };

    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

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
      lifecycleService: createLifecycleService(telemetrySink)
    });

    const response = await request(app).get("/api/session/bootstrap");

    expect(response.status).toBe(401);
  });

  it("returns bootstrap payload for valid token and emits session_started", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://tenant.ciamlogin.com/tenant.onmicrosoft.com/v2.0",
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
      lifecycleService: createLifecycleService(telemetrySink)
    });

    const response = await request(app)
      .get("/api/session/bootstrap")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.tenantScopedSubject).toBe("tenant-a|player-1");
    expect(response.body.shellInit.bootstrapState).toBe("token-ready");
    expect(response.body.shellInit.retryPolicy.maxBootstrap401Retry).toBe(1);
    expect(response.body.shellInit.retryPolicy.interactiveAuthRequiredAfterRetry).toBe(true);

    const calls = (telemetrySink.emit as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("session_started");
  });

  it("emits session_bootstrap_failed and returns 503 on telemetry sink failure", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://tenant.ciamlogin.com/tenant.onmicrosoft.com/v2.0",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000
      })),
      issueJoinToken: vi.fn()
    };

    const telemetrySink = {
      emit: vi.fn(async (eventName: string) => {
        if (eventName === "session_started") {
          throw new Error("telemetry failure");
        }
      })
    } as unknown as TelemetrySink;

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
      lifecycleService: createLifecycleService(telemetrySink)
    });

    const response = await request(app)
      .get("/api/session/bootstrap")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Session bootstrap unavailable");

    const calls = (telemetrySink.emit as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe("session_started");
    expect(calls[1][0]).toBe("session_bootstrap_failed");
  });
});
