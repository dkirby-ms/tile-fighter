import http from "node:http";
import { Server } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ReadinessReport } from "@game/shared-types";
import { AuthService } from "./auth/auth-service.js";
import { readRuntimeConfig } from "./config/env.js";
import { createHttpApp, type DeltaFanoutRegistry } from "./http/app.js";
import { buildAuthMiddleware } from "./http/auth-middleware.js";
import {
  createDatabaseRuntime,
  verifyDatabaseConnectivity,
  closeDatabaseRuntime
} from "./persistence/db.js";
import { createTileRepository } from "./persistence/tile.repository.js";
import { createRegionSnapshotRepository } from "./persistence/region-snapshot.repository.js";
import { createRegionDiffRepository } from "./persistence/region-diff.repository.js";
import { ArenaRoom } from "./rooms/arena.room.js";
import { registerGracefulShutdown } from "./shutdown/graceful-shutdown.js";
import { TelemetrySink } from "./telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "./session/session-lifecycle.service.js";
import { createRegionSnapshotService } from "./domain/region-snapshot.service.js";
import { createRegionDiffService } from "./domain/region-diff.service.js";
import { createBondEvaluatorService } from "./domain/bond-evaluator.service.js";
import { createSessionCheckpointRepository } from "./persistence/session-checkpoint.repository.js";
import { SessionCheckpointService } from "./session/session-checkpoint.service.js";
import { ReconnectTokenService } from "./auth/reconnect-token.service.js";
import { type DeltaFanoutConfig } from "./domain/delta-fanout.service.js";

async function bootstrap(): Promise<void> {
  const runtimeConfig = readRuntimeConfig();
  const dbRuntime = createDatabaseRuntime(runtimeConfig.databaseUrl);
  await verifyDatabaseConnectivity(dbRuntime.db);

  const authService = new AuthService(runtimeConfig);
  const telemetrySink = new TelemetrySink(runtimeConfig);
  const tileRepository = createTileRepository({
    telemetrySink,
    replayWindowSeconds: runtimeConfig.placementCommandReplayWindowSeconds
  });
  const regionSnapshotRepository = createRegionSnapshotRepository();
  const regionDiffRepository = createRegionDiffRepository();
  const regionSnapshotService = createRegionSnapshotService({
    db: dbRuntime.db,
    repository: regionSnapshotRepository,
    telemetrySink
  });
  const regionDiffService = createRegionDiffService({
    db: dbRuntime.db,
    repository: regionDiffRepository,
    telemetrySink
  });
  const bondEvaluatorService = createBondEvaluatorService();
  const sessionCheckpointRepository = createSessionCheckpointRepository();
  const reconnectTokenService = new ReconnectTokenService({
    signingSecret: runtimeConfig.joinTokenSigningSecret,
    ttlSeconds: runtimeConfig.joinTokenTtlSeconds
  });
  const checkpointService = new SessionCheckpointService({
    db: dbRuntime.db,
    telemetrySink,
    regionDiffService,
    tileRepository,
    reconnectTokenService,
    checkpointRepository: sessionCheckpointRepository,
    gracePeriodSeconds: runtimeConfig.sessionReconnectGracePeriodSeconds
  });
  const lifecycleService = new SessionLifecycleService({
    heartbeatTtlSeconds: runtimeConfig.sessionHeartbeatTtlSeconds,
    cleanupIntervalSeconds: runtimeConfig.sessionCleanupIntervalSeconds,
    telemetrySink,
    checkpointService
  });
  lifecycleService.start();

  // Initialize delta fanout configuration and registry for coordinating realtime deltas
  const deltaFanoutConfig: DeltaFanoutConfig = {
    deltaAckTimeoutMs: runtimeConfig.deltaAckTimeoutMs || 350,
    deltaRetransmitMaxAttempts: runtimeConfig.deltaRetransmitMaxAttempts || 1,
    deltaAckPendingTtlMs: runtimeConfig.deltaAckPendingTtlMs || 30000,
    deltaOutboundCapPerConnection: runtimeConfig.deltaOutboundCapPerConnection || 128
  };
  const deltaFanoutRegistry: DeltaFanoutRegistry = new Map();

  const readinessCheck = async (): Promise<ReadinessReport> => {
    try {
      await verifyDatabaseConnectivity(dbRuntime.db);
      return {
        ok: true,
        checks: {
          database: "ok",
          config: "ok"
        }
      };
    } catch {
      return {
        ok: false,
        checks: {
          database: "error",
          config: "ok"
        }
      };
    }
  };

  const app = createHttpApp({
    readinessCheck,
    authMiddleware: buildAuthMiddleware(authService, undefined, {
      devAuthMode: runtimeConfig.devAuthMode
    }),
    monitorRouter: monitor(),
    telemetrySink,
    authService,
    lifecycleService,
    checkpointService,
    db: dbRuntime.db,
    tileRepository,
    regionSnapshotService,
    regionDiffService,
    bondEvaluatorService,
    deltaFanoutRegistry,
    deltaFanoutConfig,
    tilePlaceThrottlePolicy: {
      maxRequests: runtimeConfig.tilePlaceThrottleMaxRequests,
      windowMs: runtimeConfig.tilePlaceThrottleWindowMs,
      ttlMs: runtimeConfig.tilePlaceThrottleTtlMs
    },
    regionDiffLimits: {
      defaultMaxTiles: runtimeConfig.regionDiffDefaultMaxTiles,
      maxTilesPerRequest: runtimeConfig.regionDiffMaxTilesPerRequest,
      maxViewportArea: runtimeConfig.regionDiffMaxViewportArea
    }
  });

  const nodeServer = http.createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: nodeServer })
  });

  gameServer.define("arena", ArenaRoom, {
    authService,
    lifecycleService,
    deltaFanoutRegistry,
    telemetrySink,
    deltaFanoutConfig
  });

  const maybeListenable = gameServer as unknown as {
    listen?: (port: number) => Promise<void> | void;
  };

  if (typeof maybeListenable.listen === "function") {
    await maybeListenable.listen(runtimeConfig.port);
  } else {
    await new Promise<void>((resolve, reject) => {
      nodeServer.listen(runtimeConfig.port, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  process.stdout.write(`Server listening on port ${runtimeConfig.port}\n`);

  registerGracefulShutdown(async () => {
    lifecycleService.stop();
    await gameServer.gracefullyShutdown();
    await closeDatabaseRuntime(dbRuntime);
  });
}

bootstrap().catch((error) => {
  process.stderr.write(`Fatal startup error: ${(error as Error).message}\n`);
  process.exit(1);
});