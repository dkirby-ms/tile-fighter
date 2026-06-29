import http from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ReadinessReport } from "@game/shared-types";
import { AuthService } from "./auth/auth-service.js";
import { readRuntimeConfig } from "./config/env.js";
import { createHttpApp } from "./http/app.js";
import { buildAuthMiddleware } from "./http/auth-middleware.js";
import {
  createDatabaseRuntime,
  verifyDatabaseConnectivity,
  closeDatabaseRuntime
} from "./persistence/db.js";
import { createTileRepository } from "./persistence/tile.repository.js";
import { ArenaRoom } from "./rooms/arena.room.js";
import { registerGracefulShutdown } from "./shutdown/graceful-shutdown.js";
import { TelemetrySink } from "./telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "./session/session-lifecycle.service.js";

async function bootstrap(): Promise<void> {
  const runtimeConfig = readRuntimeConfig();
  const dbRuntime = createDatabaseRuntime(runtimeConfig.databaseUrl);
  await verifyDatabaseConnectivity(dbRuntime.db);

  const authService = new AuthService(runtimeConfig);
  const telemetrySink = new TelemetrySink(runtimeConfig);
  const tileRepository = createTileRepository();
  const lifecycleService = new SessionLifecycleService({
    heartbeatTtlSeconds: runtimeConfig.sessionHeartbeatTtlSeconds,
    cleanupIntervalSeconds: runtimeConfig.sessionCleanupIntervalSeconds,
    telemetrySink
  });
  lifecycleService.start();

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
    db: dbRuntime.db,
    tileRepository
  });

  const nodeServer = http.createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: nodeServer })
  });

  gameServer.define("arena", ArenaRoom, { authService, lifecycleService });

  nodeServer.listen(runtimeConfig.port, () => {
    process.stdout.write(`Server listening on port ${runtimeConfig.port}\n`);
  });

  registerGracefulShutdown(async () => {
    lifecycleService.stop();
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