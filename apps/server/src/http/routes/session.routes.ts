import { Router } from "express";
import { TelemetrySink } from "../../telemetry/telemetry-sink.js";
import { AuthService } from "../../auth/auth-service.js";
import { SessionLifecycleService } from "../../session/session-lifecycle.service.js";
import { ArenaRoom } from "../../rooms/arena.room.js";
import { SessionCheckpointService } from "../../session/session-checkpoint.service.js";

export type SessionRoutesDependencies = {
  telemetrySink: TelemetrySink;
  authService: AuthService;
  lifecycleService: SessionLifecycleService;
  checkpointService: SessionCheckpointService;
};

type RateWindow = {
  windowStartedAtMs: number;
  count: number;
};

const BOOTSTRAP_RATE_LIMIT_WINDOW_MS = 60_000;
const BOOTSTRAP_RATE_LIMIT_MAX = 10;
const HEARTBEAT_RATE_LIMIT_WINDOW_MS = 10_000;
const HEARTBEAT_RATE_LIMIT_MAX = 30;
const RECONNECT_RATE_LIMIT_WINDOW_MS = 60_000;
const RECONNECT_RATE_LIMIT_MAX = 10;

function isRateLimited(
  windows: Map<string, RateWindow>,
  key: string,
  nowMs: number,
  windowMs: number,
  maxInWindow: number
): boolean {
  const current = windows.get(key);

  if (!current || nowMs - current.windowStartedAtMs >= windowMs) {
    windows.set(key, {
      windowStartedAtMs: nowMs,
      count: 1
    });
    return false;
  }

  current.count += 1;
  windows.set(key, current);
  return current.count > maxInWindow;
}

export function createSessionRoutes(dependencies: SessionRoutesDependencies): Router {
  const router = Router();
  const bootstrapWindowsBySubjectIp = new Map<string, RateWindow>();
  const heartbeatWindowsBySubject = new Map<string, RateWindow>();
  const reconnectWindowsBySession = new Map<string, RateWindow>();

  router.get("/api/session/bootstrap", async (req, res) => {
    const principal = res.locals.principal;
    const subjectIpKey = `${principal.tenantScopedSubject}|${req.ip ?? "unknown"}`;

    if (
      isRateLimited(
        bootstrapWindowsBySubjectIp,
        subjectIpKey,
        Date.now(),
        BOOTSTRAP_RATE_LIMIT_WINDOW_MS,
        BOOTSTRAP_RATE_LIMIT_MAX
      )
    ) {
      res.status(429).json({ error: "Bootstrap rate limit exceeded" });
      return;
    }

    try {
      await dependencies.telemetrySink.emit("session_started", {
        tenantScopedSubject: principal.tenantScopedSubject,
        tenantId: principal.tenantId ?? null,
        tokenVersion: principal.tokenVersion ?? null,
        bootstrapState: "token-ready"
      });

      res.status(200).json({
        subject: principal.subject,
        tenantScopedSubject: principal.tenantScopedSubject,
        tenantId: principal.tenantId,
        issuer: principal.issuer,
        serverTime: new Date().toISOString(),
        shellInit: {
          bootstrapState: "token-ready",
          retryPolicy: {
            maxBootstrap401Retry: 1,
            interactiveAuthRequiredAfterRetry: true
          }
        }
      });
    } catch (error) {
      await dependencies.telemetrySink.emit("session_bootstrap_failed", {
        reasonClass: "telemetry_sink_error",
        errorMessage: (error as Error).message
      });

      res.status(503).json({
        error: "Session bootstrap unavailable"
      });
    }
  });

  router.post("/api/session/join-token", async (req, res) => {
    const principal = res.locals.principal;
    const roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : "";

    if (!roomId) {
      res.status(400).json({ error: "roomId is required" });
      return;
    }

    if (roomId !== ArenaRoom.ROOM_KEY) {
      res.status(400).json({ error: `Unsupported roomId: ${roomId}` });
      return;
    }

    try {
      const joinToken = dependencies.authService.issueJoinToken(
        principal.tenantScopedSubject,
        ArenaRoom.ROOM_KEY
      );

      await dependencies.telemetrySink.emit("room_join_token_issued", {
        tenantScopedSubject: principal.tenantScopedSubject,
        roomId
      });

      res.status(200).json({ roomId, joinToken });
    } catch (error) {
      await dependencies.telemetrySink.emit("room_join_token_rejected", {
        tenantScopedSubject: principal.tenantScopedSubject,
        roomId,
        reasonClass: "join_token_issue_failed",
        errorMessage: (error as Error).message
      });

      res.status(503).json({ error: "Join token unavailable" });
    }
  });

  router.post("/api/session/heartbeat", async (req, res) => {
    const principal = res.locals.principal;
    const roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : "";

    if (!roomId) {
      res.status(400).json({ error: "roomId is required" });
      return;
    }

    if (
      isRateLimited(
        heartbeatWindowsBySubject,
        principal.tenantScopedSubject,
        Date.now(),
        HEARTBEAT_RATE_LIMIT_WINDOW_MS,
        HEARTBEAT_RATE_LIMIT_MAX
      )
    ) {
      res.status(429).json({ error: "Heartbeat rate limit exceeded" });
      return;
    }

    dependencies.lifecycleService.noteHeartbeat(principal.tenantScopedSubject, roomId);

    const reconnectToken = await dependencies.checkpointService.issueReconnectTokenForSubject(
      principal.tenantScopedSubject,
      roomId
    );

    res.status(202).json({ accepted: true, roomId, reconnectToken });
  });

  router.post("/api/session/reconnect", async (req, res) => {
    const principal = res.locals.principal;
    const roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : "";
    const reconnectToken =
      typeof req.body?.reconnectToken === "string" ? req.body.reconnectToken.trim() : "";

    if (!roomId || !reconnectToken) {
      res.status(400).json({ error: "roomId and reconnectToken are required" });
      return;
    }

    const resolveResult = await dependencies.checkpointService.resolveReconnect(
      reconnectToken,
      principal.tenantScopedSubject,
      roomId
    );

    if (!resolveResult.ok) {
      const reasonToStatus: Record<string, number> = {
        invalid_signature: 401,
        token_expired: 401,
        token_replay_detected: 403,
        checkpoint_not_found: 404,
        checkpoint_archived: 410,
        grace_period_expired: 410,
        stale_token: 410,
        subject_mismatch: 403,
        room_mismatch: 403
      };

      await dependencies.telemetrySink.emit("room_rejoin_failed", {
        tenantScopedSubject: principal.tenantScopedSubject,
        roomId,
        sessionId: null,
        reason: resolveResult.reason
      });

      res.status(reasonToStatus[resolveResult.reason] ?? 400).json({ error: resolveResult.reason });
      return;
    }

    if (
      isRateLimited(
        reconnectWindowsBySession,
        resolveResult.sessionId,
        Date.now(),
        RECONNECT_RATE_LIMIT_WINDOW_MS,
        RECONNECT_RATE_LIMIT_MAX
      )
    ) {
      res.status(429).json({ error: "Reconnect rate limit exceeded" });
      return;
    }

    res.status(200).json({
      ok: true,
      roomId: resolveResult.roomId,
      sessionId: resolveResult.sessionId,
      checkpointId: resolveResult.checkpointId,
      replay: {
        sinceVersion: resolveResult.sinceVersion,
        currentVersion: resolveResult.currentVersion,
        deltaCount: resolveResult.deltaCount,
        deltas: resolveResult.deltas
      },
      checksum: {
        scope: resolveResult.checksumScope,
        serverChecksum: resolveResult.serverChecksum
      }
    });
  });

  return router;
}