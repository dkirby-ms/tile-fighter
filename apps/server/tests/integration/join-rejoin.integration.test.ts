import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import {
  ReconnectFailureResult,
  ReconnectReplayResult
} from "../../src/session/session-lifecycle.types.js";

function createLifecycleService(telemetrySink: TelemetrySink): SessionLifecycleService {
  return new SessionLifecycleService({
    heartbeatTtlSeconds: 30,
    cleanupIntervalSeconds: 5,
    telemetrySink
  });
}

type PrincipalInput = {
  subject: string;
  tenantScopedSubject: string;
  tenantId: string;
};

type ReconnectOutcome = ReconnectReplayResult | ReconnectFailureResult;

type CreateAppOptions = {
  principal: PrincipalInput;
  heartbeatToken?: string | null;
  reconnectOutcomes?: ReconnectOutcome[];
};

function createReconnectReplayResult(partial?: Partial<ReconnectReplayResult>): ReconnectReplayResult {
  return {
    ok: true,
    checkpointId: "checkpoint-1",
    sessionId: "session-1",
    roomId: "arena",
    regionId: "arena",
    sinceVersion: 4,
    currentVersion: 8,
    deltaCount: 2,
    deltas: [
      {
        cellX: 0,
        cellY: 0,
        version: 7,
        operation: "upsert",
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "red",
        stylePayload: null,
        ownerId: "tenant-a|player-1"
      },
      {
        cellX: 1,
        cellY: 0,
        version: 8,
        operation: "upsert",
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "blue",
        stylePayload: null,
        ownerId: "tenant-a|player-1"
      }
    ],
    serverChecksum: "checksum-abc",
    checksumScope: "full_region_canonical",
    ...partial
  };
}

function createApp(options: CreateAppOptions) {
  const authService = {
    verifyAccessToken: vi.fn(async () => ({
      subject: options.principal.subject,
      tenantScopedSubject: options.principal.tenantScopedSubject,
      issuer: "https://issuer.example",
      audience: "api://tile-fighter-server",
      tenantId: options.principal.tenantId,
      tokenVersion: "2.0",
      expiresAt: 1_900_000_000
    })),
    issueJoinToken: vi.fn(() => "join-token-abc")
  };

  const telemetrySink = {
    emit: vi.fn(async () => undefined)
  } as unknown as TelemetrySink;

  const reconnectOutcomes = [...(options.reconnectOutcomes ?? [createReconnectReplayResult()])];

  const checkpointService = {
    issueReconnectTokenForSubject: vi.fn(async () => options.heartbeatToken ?? "reconnect-token-abc"),
    resolveReconnect: vi.fn(async () => {
      const next = reconnectOutcomes.shift();
      return (
        next ??
        ({
          ok: false,
          reason: "checkpoint_not_found"
        } satisfies ReconnectFailureResult)
      );
    })
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
    lifecycleService: createLifecycleService(telemetrySink),
    checkpointService: checkpointService as never
  });

  return {
    app,
    telemetrySink,
    checkpointService,
    authService
  };
}

describe("Join and rejoin integration", () => {
  it("AC1 creates reconnect bootstrap token and AC3 returns replay payload with canonical checksum scope", async () => {
    const { app, checkpointService } = createApp({
      principal: {
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        tenantId: "tenant-a"
      },
      heartbeatToken: "reconnect-token-issued",
      reconnectOutcomes: [
        createReconnectReplayResult({
          sinceVersion: 0,
          currentVersion: 5,
          deltaCount: 1,
          deltas: [
            {
              cellX: 2,
              cellY: 3,
              version: 5,
              operation: "upsert",
              offsetX: 0,
              offsetY: 0,
              shape: "hex",
              color: "green",
              stylePayload: { source: "replay" },
              ownerId: "tenant-a|player-1"
            }
          ]
        })
      ]
    });

    const heartbeatResponse = await request(app)
      .post("/api/session/heartbeat")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: "arena" });

    expect(heartbeatResponse.status).toBe(202);
    expect(heartbeatResponse.body.accepted).toBe(true);
    expect(heartbeatResponse.body.reconnectToken).toBe("reconnect-token-issued");

    const reconnectResponse = await request(app)
      .post("/api/session/reconnect")
      .set("Authorization", "Bearer valid-token")
      .send({
        roomId: "arena",
        reconnectToken: heartbeatResponse.body.reconnectToken
      });

    expect(reconnectResponse.status).toBe(200);
    expect(reconnectResponse.body.ok).toBe(true);
    expect(reconnectResponse.body.replay.sinceVersion).toBe(0);
    expect(reconnectResponse.body.replay.currentVersion).toBe(5);
    expect(reconnectResponse.body.replay.deltaCount).toBe(1);
    expect(reconnectResponse.body.checksum.scope).toBe("full_region_canonical");
    expect(reconnectResponse.body.checksum.serverChecksum).toBe("checksum-abc");

    expect(checkpointService.issueReconnectTokenForSubject).toHaveBeenCalledWith(
      "tenant-a|player-1",
      "arena"
    );
    expect(checkpointService.resolveReconnect).toHaveBeenCalledWith(
      "reconnect-token-issued",
      "tenant-a|player-1",
      "arena"
    );
  });

  it("AC2 reconnects within grace period with same identity and stable session", async () => {
    const { app } = createApp({
      principal: {
        subject: "player-2",
        tenantScopedSubject: "tenant-a|player-2",
        tenantId: "tenant-a"
      },
      reconnectOutcomes: [
        createReconnectReplayResult({
          sessionId: "session-grace-1",
          checkpointId: "checkpoint-grace-1",
          sinceVersion: 9,
          currentVersion: 9,
          deltaCount: 0,
          deltas: []
        })
      ]
    });

    const heartbeatResponse = await request(app)
      .post("/api/session/heartbeat")
      .set("Authorization", "Bearer valid-token")
      .send({ roomId: "arena" });

    expect(heartbeatResponse.status).toBe(202);
    expect(typeof heartbeatResponse.body.reconnectToken).toBe("string");

    const reconnectResponse = await request(app)
      .post("/api/session/reconnect")
      .set("Authorization", "Bearer valid-token")
      .send({
        roomId: "arena",
        reconnectToken: heartbeatResponse.body.reconnectToken
      });

    expect(reconnectResponse.status).toBe(200);
    expect(reconnectResponse.body.sessionId).toBe("session-grace-1");
    expect(reconnectResponse.body.checkpointId).toBe("checkpoint-grace-1");
    expect(reconnectResponse.body.replay.deltaCount).toBe(0);
  });

  it("maps reconnect abuse/failure reasons to expected statuses", async () => {
    const { app } = createApp({
      principal: {
        subject: "player-3",
        tenantScopedSubject: "tenant-a|player-3",
        tenantId: "tenant-a"
      },
      reconnectOutcomes: [
        { ok: false, reason: "invalid_signature" },
        { ok: false, reason: "token_expired" },
        { ok: false, reason: "token_replay_detected" },
        { ok: false, reason: "checkpoint_not_found" },
        { ok: false, reason: "checkpoint_archived" }
      ]
    });

    const cases: Array<{ expectedStatus: number; token: string; reason: string }> = [
      { expectedStatus: 401, token: "invalid-token", reason: "invalid_signature" },
      { expectedStatus: 401, token: "expired-token", reason: "token_expired" },
      { expectedStatus: 403, token: "replayed-token", reason: "token_replay_detected" },
      { expectedStatus: 404, token: "missing-checkpoint-token", reason: "checkpoint_not_found" },
      { expectedStatus: 410, token: "archived-checkpoint-token", reason: "checkpoint_archived" }
    ];

    for (const testCase of cases) {
      const response = await request(app)
        .post("/api/session/reconnect")
        .set("Authorization", "Bearer valid-token")
        .send({ roomId: "arena", reconnectToken: testCase.token });

      expect(response.status).toBe(testCase.expectedStatus);
      expect(response.body.error).toBe(testCase.reason);
    }
  });

  it("enforces tenant isolation for reconnect token reuse across principals", async () => {
    const { app } = createApp({
      principal: {
        subject: "player-4",
        tenantScopedSubject: "tenant-b|player-4",
        tenantId: "tenant-b"
      },
      reconnectOutcomes: [{ ok: false, reason: "subject_mismatch" }]
    });

    const response = await request(app)
      .post("/api/session/reconnect")
      .set("Authorization", "Bearer valid-token")
      .send({
        roomId: "arena",
        reconnectToken: "token-issued-for-tenant-a"
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("subject_mismatch");
  });
});
