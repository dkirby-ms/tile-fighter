import http from "node:http";
import { Server } from "@colyseus/core";
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
import { createTileRepository, selectBondNeighborhoodTiles } from "./persistence/tile.repository.js";
import { createRegionSnapshotRepository } from "./persistence/region-snapshot.repository.js";
import { createRegionDiffRepository } from "./persistence/region-diff.repository.js";
import { ArenaRoom } from "./rooms/arena.room.js";
import { registerGracefulShutdown } from "./shutdown/graceful-shutdown.js";
import { TelemetrySink } from "./telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "./session/session-lifecycle.service.js";
import { createRegionSnapshotService } from "./domain/region-snapshot.service.js";
import { createRegionDiffService } from "./domain/region-diff.service.js";
import { createSessionCheckpointRepository } from "./persistence/session-checkpoint.repository.js";
import { SessionCheckpointService } from "./session/session-checkpoint.service.js";
import { ReconnectTokenService } from "./auth/reconnect-token.service.js";
import { type DeltaFanoutConfig } from "./domain/delta-fanout.service.js";
import { BondRecomputeCoordinator, type BondRecomputeInput } from "./domain/bond-recompute-coordinator.js";
import { evaluateBondType } from "@game/shared-types";

function buildBondFingerprint(item: BondRecomputeInput, bondType: string | null, neighbors: Array<{ cellX: number; cellY: number; color: string }>): string {
  const neighborSignature = neighbors
    .map((neighbor) => `${neighbor.cellX},${neighbor.cellY},${neighbor.color}`)
    .join("|");

  return `${item.regionId}:${item.cellX}:${item.cellY}:${item.color}:${bondType ?? "none"}:${neighborSignature}`;
}

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
  const bondRecomputeCoordinator = new BondRecomputeCoordinator(
    {
      maxPendingItems: runtimeConfig.bondRecomputeQueueMaxPending,
      maxDrainBatchSize: runtimeConfig.bondRecomputeQueueDrainBatchSize,
      maxQueueWaitMs: runtimeConfig.bondRecomputeQueueMaxWaitMs
    },
    async (item) => {
      const neighborhood = await selectBondNeighborhoodTiles(
        dbRuntime.db,
        item.regionId,
        item.cellX,
        item.cellY
      );

      const bondType = evaluateBondType(
        {
          cellX: item.cellX,
          cellY: item.cellY,
          color: item.color
        },
        neighborhood
      );

      return {
        fingerprint: buildBondFingerprint(item, bondType, neighborhood),
        bondType
      };
    },
    async (item, bondType) => {
      await telemetrySink.emitBondingTriggered({
        bondType,
        regionId: item.regionId,
        cellX: item.cellX,
        cellY: item.cellY
      });
    },
    {
      onStarted: async (event) => {
        await telemetrySink.emitBondRecalcStarted({
          regionId: event.regionId,
          cellX: event.cellX,
          cellY: event.cellY,
          queueDepth: event.queueDepth,
          queueLagMs: event.queueLagMs
        });
      },
      onCompleted: async (event) => {
        await telemetrySink.emitBondRecalcCompleted({
          regionId: event.regionId,
          cellX: event.cellX,
          cellY: event.cellY,
          queueDepth: event.queueDepth,
          queueLagMs: event.queueLagMs,
          bondType: event.bondType,
          emittedBondEvent: event.emittedBondEvent
        });
      },
      onSkipped: async (event) => {
        await telemetrySink.emitBondRecalcSkipped({
          regionId: event.regionId,
          cellX: event.cellX,
          cellY: event.cellY,
          queueDepth: event.queueDepth,
          queueLagMs: event.queueLagMs,
          reason: event.reason
        });
      }
    }
  );

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
    authMiddleware: buildAuthMiddleware(authService),
    telemetrySink,
    authService,
    lifecycleService,
    checkpointService,
    db: dbRuntime.db,
    tileRepository,
    regionSnapshotService,
    regionDiffService,
    deltaFanoutRegistry,
    deltaFanoutConfig,
    bondRecomputeCoordinator,
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

  nodeServer.listen(runtimeConfig.port, () => {
    process.stdout.write(`Server listening on port ${runtimeConfig.port}\n`);
  });

  registerGracefulShutdown(async () => {
    lifecycleService.stop();
    bondRecomputeCoordinator.destroy();
    await gameServer.gracefullyShutdown();
    await new Promise<void>((resolve, reject) => {
      nodeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await closeDatabaseRuntime(dbRuntime);
  });
}

bootstrap().catch((error) => {
  process.stderr.write(`Fatal startup error: ${(error as Error).message}\n`);
  process.exit(1);
});