import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { ArenaRoom } from "../../src/rooms/arena.room.js";

describe("Join token integration", () => {
  function createLifecycleService(telemetrySink: TelemetrySink): SessionLifecycleService {
    return new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });
  }

  function createCheckpointServiceStub() {
    return {
      issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token"),
      resolveReconnect: vi.fn(async () => ({ ok: false, reason: "checkpoint_not_found" }))
    };
  }

  it("issues join token for authenticated caller", async () => {
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
      issueJoinToken: vi.fn(() => "join-token-abc")
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
      lifecycleService: createLifecycleService(telemetrySink),
      checkpointService: createCheckpointServiceStub() as never
    });
    const response = await request(app)
      .post("/api/session/join-token")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: ArenaRoom.ROOM_KEY });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ roomId: ArenaRoom.ROOM_KEY, joinToken: "join-token-abc" });
    expect(authService.issueJoinToken).toHaveBeenCalledWith("tenant-a|player-1", ArenaRoom.ROOM_KEY);
  });

  it("rejects unauthenticated join token request", async () => {
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
      lifecycleService: createLifecycleService(telemetrySink),
      checkpointService: createCheckpointServiceStub() as never
    });
    const response = await request(app).post("/api/session/join-token").send({ roomId: ArenaRoom.ROOM_KEY });

    expect(response.status).toBe(401);
  });

  it("rejects join token request with roomId mismatch input", async () => {
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
      lifecycleService: createLifecycleService(telemetrySink),
      checkpointService: createCheckpointServiceStub() as never
    });
    const response = await request(app)
      .post("/api/session/join-token")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("roomId is required");
  });

  it("rejects join token request for unsupported room key", async () => {
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
      lifecycleService: createLifecycleService(telemetrySink),
      checkpointService: createCheckpointServiceStub() as never
    });
    const response = await request(app)
      .post("/api/session/join-token")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: "arena-main" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Unsupported roomId: arena-main");
    expect(authService.issueJoinToken).not.toHaveBeenCalled();
  });
});
