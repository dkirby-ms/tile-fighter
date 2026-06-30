import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { ArenaRoom } from "../../src/rooms/arena.room.js";
import { OperatorClaimContract } from "@game/shared-types";

describe("HTTP auth integration", () => {
  function createLifecycleService(telemetrySink: TelemetrySink): SessionLifecycleService {
    return new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });
  }

  function createCheckpointServiceStub(options?: {
    reconnectToken?: string | null;
    resolveReconnectResult?: { ok: false; reason: "subject_mismatch" | "room_mismatch" | "checkpoint_not_found" };
  }) {
    return {
      issueReconnectTokenForSubject: vi.fn(async () => options?.reconnectToken ?? "reconnect-token-auth"),
      resolveReconnect: vi.fn(async () =>
        options?.resolveReconnectResult ?? {
          ok: false,
          reason: "checkpoint_not_found"
        }
      )
    };
  }

  it("returns unauthorized without bearer token", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => {
        throw new Error("unauthorized");
      }),
      issueJoinToken: vi.fn()
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
      authService: authService as never,
      telemetrySink: {
        emit: vi.fn(async () => undefined)
      } as unknown as TelemetrySink,
      lifecycleService: createLifecycleService({ emit: vi.fn(async () => undefined) } as unknown as TelemetrySink),
      checkpointService: createCheckpointServiceStub() as never
    });

    const response = await request(app).get("/api/protected/profile");
    expect(response.status).toBe(401);
  });

  it("returns profile for valid token", async () => {
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
      .get("/api/protected/profile")
      .set("Authorization", "Bearer valid-token");
    expect(response.status).toBe(200);
    expect(response.body.subject).toBe("player-1");
    expect(response.body.tenantScopedSubject).toBe("tenant-a|player-1");
  });

  it("returns bootstrap payload for valid token", async () => {
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
      .get("/api/session/bootstrap")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.shellInit.bootstrapState).toBe("token-ready");
    expect(response.body.shellInit.retryPolicy.maxBootstrap401Retry).toBe(1);
    expect(response.body.tenantScopedSubject).toBe("tenant-a|player-1");
  });

  it("returns service unavailable when telemetry emission fails during bootstrap", async () => {
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
      emit: vi.fn(async (eventName: string) => {
        if (eventName === "session_started") {
          throw new Error("sink unavailable");
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
      lifecycleService: createLifecycleService(telemetrySink),
      checkpointService: createCheckpointServiceStub() as never
    });

    const response = await request(app)
      .get("/api/session/bootstrap")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Session bootstrap unavailable");
  });

  it("issues a room-scoped join token for an authenticated subject", async () => {
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
      issueJoinToken: vi.fn(() => "signed-join-token")
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
    expect(response.body.roomId).toBe(ArenaRoom.ROOM_KEY);
    expect(response.body.joinToken).toBe("signed-join-token");
    expect(authService.issueJoinToken).toHaveBeenCalledWith("tenant-a|player-1", ArenaRoom.ROOM_KEY);
  });

  it("returns forbidden on operator route when principal lacks operator authorization", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000,
        roles: ["Player"]
      })),
      issueJoinToken: vi.fn()
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
      authService: authService as never,
      telemetrySink: {
        emit: vi.fn(async () => undefined)
      } as unknown as TelemetrySink,
      lifecycleService: createLifecycleService({ emit: vi.fn(async () => undefined) } as unknown as TelemetrySink),
      checkpointService: createCheckpointServiceStub() as never,
      regionSnapshotService: {
        createSnapshot: vi.fn(async () => ({
          snapshotId: "snapshot-1",
          expectedHash: "hash-1",
          tileCount: 0
        })),
        restoreLatest: vi.fn(async () => ({
          snapshotId: "snapshot-1",
          expectedHash: "hash-1",
          actualHash: "hash-1",
          restoredTileCount: 0
        }))
      } as never
    });

    const response = await request(app)
      .post("/api/admin/snapshots/restore-latest")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "arena" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Forbidden" });
  });

  it("allows transitional scope fallback for operator route when configured", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000,
        roles: ["Player"],
        scp: "ops"
      })),
      issueJoinToken: vi.fn()
    };

    const operatorContract: OperatorClaimContract = {
      source: "roles_with_scope_fallback",
      roleValues: ["operator", "ops", "admin"],
      scopeValues: ["ops", "admin"]
    };

    const regionSnapshotService = {
      createSnapshot: vi.fn(async () => ({
        snapshotId: "snapshot-1",
        expectedHash: "hash-1",
        tileCount: 0
      })),
      restoreLatest: vi.fn(async () => ({
        snapshotId: "snapshot-1",
        expectedHash: "hash-1",
        actualHash: "hash-1",
        restoredTileCount: 0
      }))
    };

    const app = createHttpApp({
      readinessCheck: async () => ({
        ok: true,
        checks: {
          database: "ok",
          config: "ok"
        }
      }),
      authMiddleware: buildAuthMiddleware(authService as never, operatorContract),
      authService: authService as never,
      telemetrySink: {
        emit: vi.fn(async () => undefined)
      } as unknown as TelemetrySink,
      lifecycleService: createLifecycleService({ emit: vi.fn(async () => undefined) } as unknown as TelemetrySink),
      checkpointService: createCheckpointServiceStub() as never,
      regionSnapshotService: regionSnapshotService as never
    });

    const response = await request(app)
      .post("/api/admin/snapshots/restore-latest")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "arena" });

    expect(response.status).toBe(200);
    expect(regionSnapshotService.restoreLatest).toHaveBeenCalledOnce();
  });

  it("returns forbidden on snapshot create when principal lacks operator authorization", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000,
        roles: ["Player"]
      })),
      issueJoinToken: vi.fn()
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
      authService: authService as never,
      telemetrySink: {
        emit: vi.fn(async () => undefined)
      } as unknown as TelemetrySink,
      lifecycleService: createLifecycleService({ emit: vi.fn(async () => undefined) } as unknown as TelemetrySink),
      checkpointService: createCheckpointServiceStub() as never,
      regionSnapshotService: {
        createSnapshot: vi.fn(async () => ({
          snapshotId: "snapshot-1",
          expectedHash: "hash-1",
          tileCount: 0
        })),
        restoreLatest: vi.fn(async () => ({
          snapshotId: "snapshot-1",
          expectedHash: "hash-1",
          actualHash: "hash-1",
          restoredTileCount: 0
        }))
      } as never
    });

    const response = await request(app)
      .post("/api/admin/snapshots/create")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "arena" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Forbidden" });
  });

  it("allows snapshot create when principal has operator authorization via roles", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000,
        roles: ["operator"]
      })),
      issueJoinToken: vi.fn()
    };

    const regionSnapshotService = {
      createSnapshot: vi.fn(async () => ({
        snapshotId: "snapshot-1",
        expectedHash: "hash-1",
        tileCount: 0
      })),
      restoreLatest: vi.fn(async () => ({
        snapshotId: "snapshot-1",
        expectedHash: "hash-1",
        actualHash: "hash-1",
        restoredTileCount: 0
      }))
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
      authService: authService as never,
      telemetrySink: {
        emit: vi.fn(async () => undefined)
      } as unknown as TelemetrySink,
      lifecycleService: createLifecycleService({ emit: vi.fn(async () => undefined) } as unknown as TelemetrySink),
      checkpointService: createCheckpointServiceStub() as never,
      regionSnapshotService: regionSnapshotService as never
    });

    const response = await request(app)
      .post("/api/admin/snapshots/create")
      .set("Authorization", "Bearer valid-token")
      .send({ regionId: "arena" });

    expect(response.status).toBe(201);
    expect(regionSnapshotService.createSnapshot).toHaveBeenCalledOnce();
  });

  it("returns 403 on reconnect when token subject belongs to another tenant", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-b|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-b",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000
      })),
      issueJoinToken: vi.fn()
    };

    const checkpointService = createCheckpointServiceStub({
      resolveReconnectResult: {
        ok: false,
        reason: "subject_mismatch"
      }
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
      authService: authService as never,
      telemetrySink: {
        emit: vi.fn(async () => undefined)
      } as unknown as TelemetrySink,
      lifecycleService: createLifecycleService({ emit: vi.fn(async () => undefined) } as unknown as TelemetrySink),
      checkpointService: checkpointService as never
    });

    const response = await request(app)
      .post("/api/session/reconnect")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: "arena", reconnectToken: "tenant-a-token" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("subject_mismatch");
  });
});