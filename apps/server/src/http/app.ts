import express, { RequestHandler } from "express";
import { ReadinessReport } from "@game/shared-types";
import { createHealthRoutes } from "./routes/health.routes.js";
import { createProtectedRoutes } from "./routes/protected.routes.js";
import { createSessionRoutes } from "./routes/session.routes.js";
import { createTileRoutes } from "./routes/tile.routes.js";
import { createSnapshotRoutes } from "./routes/snapshot.routes.js";
import { createRegionDiffRoutes } from "./routes/region-diff.routes.js";
import { TelemetrySink } from "../telemetry/telemetry-sink.js";
import { AuthService } from "../auth/auth-service.js";
import { SessionLifecycleService } from "../session/session-lifecycle.service.js";
import { Kysely } from "kysely";
import { ServerDatabase } from "../persistence/db.js";
import { ITileRepository } from "../persistence/tile.repository.js";
import { RegionSnapshotService } from "../domain/region-snapshot.service.js";
import { RegionDiffService } from "../domain/region-diff.service.js";
import { DEFAULT_REGION_DIFF_POLICY } from "@game/shared-types";

export type HttpAppDependencies = {
  readinessCheck: () => Promise<ReadinessReport>;
  authMiddleware: RequestHandler;
  telemetrySink: TelemetrySink;
  authService: AuthService;
  lifecycleService: SessionLifecycleService;
  db?: Kysely<ServerDatabase>;
  tileRepository?: ITileRepository;
  regionSnapshotService?: RegionSnapshotService;
  regionDiffService?: RegionDiffService;
  tilePlaceThrottlePolicy?: {
    maxRequests: number;
    windowMs: number;
  };
  regionDiffLimits?: {
    defaultMaxTiles: number;
    maxTilesPerRequest: number;
    maxViewportArea: number;
  };
};

export function createHttpApp(dependencies: HttpAppDependencies) {
  const app = express();
  app.disable("x-powered-by");

  const tilePlaceThrottlePolicy = dependencies.tilePlaceThrottlePolicy ?? {
    maxRequests: 5,
    windowMs: 60_000
  };
  const regionDiffLimits = dependencies.regionDiffLimits ?? {
    defaultMaxTiles: DEFAULT_REGION_DIFF_POLICY.limits.defaultMaxTiles,
    maxTilesPerRequest: DEFAULT_REGION_DIFF_POLICY.limits.maxTilesPerRequest,
    maxViewportArea: DEFAULT_REGION_DIFF_POLICY.limits.maxViewportArea
  };
  const tilePlacementThrottleByKey = new Map<string, number[]>();

  app.use(express.json());
  app.use(createHealthRoutes(dependencies.readinessCheck));
  app.use(dependencies.authMiddleware);
  app.use(createProtectedRoutes());
  if (dependencies.regionSnapshotService) {
    app.use(
      createSnapshotRoutes({
        snapshotService: dependencies.regionSnapshotService
      })
    );
  }
  if (dependencies.regionDiffService) {
    app.use(
      createRegionDiffRoutes({
        regionDiffService: dependencies.regionDiffService,
        isRegionMember: ({ tenantScopedSubject, regionId }) =>
          dependencies.lifecycleService.isRegionMember(tenantScopedSubject, regionId),
        limits: regionDiffLimits
      })
    );
  }
  if (dependencies.db && dependencies.tileRepository) {
    app.use(
      createTileRoutes({
        placeTile: async (input) => {
          const result = await dependencies.tileRepository!.insertTile(dependencies.db!, {
            regionId: input.regionId,
            cellX: input.cellX,
            cellY: input.cellY,
            offsetX: input.offsetX,
            offsetY: input.offsetY,
            shape: input.shape,
            color: input.color,
            stylePayload: input.stylePayload,
            ownerId: input.ownerId
          });

          if (!result.ok) {
            await dependencies.telemetrySink.emitTilePlaceRejected(
              input.regionId,
              input.cellX,
              input.cellY,
              input.ownerId,
              "occupied"
            );
            return {
              ok: false as const,
              reason: "occupied" as const
            };
          }

          await dependencies.telemetrySink.emitTilePlaced(
            result.tile.id,
            input.regionId,
            input.cellX,
            input.cellY,
            input.ownerId
          );

          return {
            ok: true as const,
            tileId: result.tile.id,
            createdAt: result.tile.createdAt
          };
        },
        shouldThrottleTilePlace: async ({ key, nowMs, regionId, cellX, cellY, ownerId }) => {
          const cutoff = nowMs - tilePlaceThrottlePolicy.windowMs;
          const recentAttempts = (tilePlacementThrottleByKey.get(key) ?? []).filter(
            (attemptedAtMs) => attemptedAtMs > cutoff
          );

          if (recentAttempts.length >= tilePlaceThrottlePolicy.maxRequests) {
            const oldestAttemptInWindow = recentAttempts[0] ?? nowMs;
            const retryAfterMs = Math.max(1, tilePlaceThrottlePolicy.windowMs - (nowMs - oldestAttemptInWindow));
            await dependencies.telemetrySink.emitTilePlaceThrottled(
              regionId,
              cellX,
              cellY,
              ownerId,
              retryAfterMs,
              tilePlaceThrottlePolicy.windowMs,
              tilePlaceThrottlePolicy.maxRequests
            );
            return {
              throttled: true,
              retryAfterMs
            };
          }

          recentAttempts.push(nowMs);
          tilePlacementThrottleByKey.set(key, recentAttempts);
          return {
            throttled: false,
            retryAfterMs: 0
          };
        },
        editTile: async (input) => {
          const result = await dependencies.tileRepository!.editTileWithinSelfEditWindow(
            dependencies.db!,
            {
              regionId: input.regionId,
              cellX: input.cellX,
              cellY: input.cellY,
              shape: input.shape,
              color: input.color,
              stylePayload: input.stylePayload,
              ownerId: input.ownerId,
              now: input.now,
              selfEditWindowMs: input.selfEditWindowMs
            }
          );

          if (!result.ok) {
            return {
              ok: false as const,
              reason: result.reason
            };
          }

          await dependencies.telemetrySink.emitTileEdited(
            result.tile.id,
            input.regionId,
            input.cellX,
            input.cellY,
            input.ownerId
          );

          return {
            ok: true as const,
            tileId: result.tile.id,
            editedAt: result.tile.editedAt
          };
        }
      })
    );
  }
  app.use(
    createSessionRoutes({
      telemetrySink: dependencies.telemetrySink,
      authService: dependencies.authService,
      lifecycleService: dependencies.lifecycleService
    })
  );

  return app;
}