import { Router } from "express";
import { TelemetrySink } from "../../telemetry/telemetry-sink.js";
import { AuthService } from "../../auth/auth-service.js";
import { SessionLifecycleService } from "../../session/session-lifecycle.service.js";

export type SessionRoutesDependencies = {
  telemetrySink: TelemetrySink;
  authService: AuthService;
  lifecycleService: SessionLifecycleService;
};

export function createSessionRoutes(dependencies: SessionRoutesDependencies): Router {
  const router = Router();

  router.get("/api/session/bootstrap", async (_req, res) => {
    const principal = res.locals.principal;

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

    try {
      const joinToken = dependencies.authService.issueJoinToken(principal.tenantScopedSubject, roomId);

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

    dependencies.lifecycleService.noteHeartbeat(principal.tenantScopedSubject, roomId);
    res.status(202).json({ accepted: true, roomId });
  });

  return router;
}