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
};

export function createHttpApp(dependencies: HttpAppDependencies) {
  const app = express();
  app.disable("x-powered-by");

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
        regionDiffService: dependencies.regionDiffService
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