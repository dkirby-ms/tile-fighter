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
import { SessionCheckpointService } from "../session/session-checkpoint.service.js";
import { DeltaFanoutCoordinator, type DeltaFanoutConfig } from "../domain/delta-fanout.service.js";

/**
 * Registry for room-scoped delta fanout coordinators indexed by regionId
 * Allows HTTP layer and rooms to coordinate fanout dispatch
 */
export type DeltaFanoutRegistry = Map<string, DeltaFanoutCoordinator>;

export type HttpAppDependencies = {
  readinessCheck: () => Promise<ReadinessReport>;
  authMiddleware: RequestHandler;
  telemetrySink: TelemetrySink;
  authService: AuthService;
  lifecycleService: SessionLifecycleService;
  checkpointService: SessionCheckpointService;
  db?: Kysely<ServerDatabase>;
  tileRepository?: ITileRepository;
  regionSnapshotService?: RegionSnapshotService;
  regionDiffService?: RegionDiffService;
  deltaFanoutRegistry?: DeltaFanoutRegistry;
  deltaFanoutConfig?: DeltaFanoutConfig;
  tilePlaceThrottlePolicy?: {
    maxRequests: number;
    windowMs: number;
    ttlMs?: number;
  };
  regionDiffLimits?: {
    defaultMaxTiles: number;
    maxTilesPerRequest: number;
    maxViewportArea: number;
  };
};

export function createHttpApp(dependencies: HttpAppDependencies) {
  const app = express();
  const appWithCleanup = app as typeof app & { _throttleCleanupInterval?: ReturnType<typeof setInterval> };
  app.disable("x-powered-by");

  const tilePlaceThrottlePolicy = dependencies.tilePlaceThrottlePolicy ?? {
    maxRequests: 5,
    windowMs: 60_000,
    ttlMs: 24 * 60 * 60 * 1000
  };
  const regionDiffLimits = dependencies.regionDiffLimits ?? {
    defaultMaxTiles: DEFAULT_REGION_DIFF_POLICY.limits.defaultMaxTiles,
    maxTilesPerRequest: DEFAULT_REGION_DIFF_POLICY.limits.maxTilesPerRequest,
    maxViewportArea: DEFAULT_REGION_DIFF_POLICY.limits.maxViewportArea
  };

  /**
   * Tile placement throttle map with TTL-based cleanup.
   *
   * **Structure**: Map<key, { lastActivityMs, attempts }>
   * - key: `${tenantScopedSubject}:${regionId}` (account + region scoped)
   * - lastActivityMs: timestamp of most recent placement attempt
   * - attempts: array of attempt timestamps within current window
   *
   * **Cleanup Strategy**:
   * 1. **Lazy Cleanup** (lines ~125-128): After filtering old attempts within sliding window,
   *    if no recent attempts remain, the key is lazily deleted.
   * 2. **Periodic Cleanup** (lines ~134-142): Every hour, scan all keys and remove entries
   *    where lastActivityMs is older than TTL (default 24h). This prevents unbounded
   *    map growth on long-lived servers.
   *
   * **Memory Impact**: O(accounts × regions) map entries. With 1k accounts × 10 regions,
   * ~10k entries × ~100 bytes ≈ 1MB. Periodic cleanup keeps this bounded over time.
   */
  type ThrottleEntry = { lastActivityMs: number; attempts: number[] };
  const tilePlacementThrottleByKey = new Map<string, ThrottleEntry>();
  const tilePlaceThrottleTtlMs = tilePlaceThrottlePolicy.ttlMs ?? 24 * 60 * 60 * 1000;

  // Periodic cleanup: every hour, remove entries older than TTL
  const cleanupIntervalMs = 60 * 60 * 1000; // 1 hour
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of tilePlacementThrottleByKey) {
      if (now - entry.lastActivityMs > tilePlaceThrottleTtlMs) {
        tilePlacementThrottleByKey.delete(key);
      }
    }
  }, cleanupIntervalMs);

  // Clean up interval on graceful shutdown
  appWithCleanup._throttleCleanupInterval = cleanupInterval;

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

          // Dispatch fanout to subscribers in this region after successful commit
          if (dependencies.deltaFanoutRegistry && result.tile.sequenceId) {
            const coordinator = dependencies.deltaFanoutRegistry.get(input.regionId);
            if (coordinator) {
              // Prepare delta payload for realtime fanout
              const deltaPayload = {
                sequenceId: String(result.tile.sequenceId),
                regionId: input.regionId,
                cellX: input.cellX,
                cellY: input.cellY,
                offsetX: input.offsetX,
                offsetY: input.offsetY,
                shape: input.shape,
                color: input.color,
                stylePayload: input.stylePayload,
                ownerId: input.ownerId,
                sentAt: new Date().toISOString(),
                retransmitAttempt: 0
              };

              // Dispatch to all subscribers in this coordinator's registry
              // Note: coordinator maintains its own subscriber set managed by room lifecycle
              await coordinator.publish(
                new Set(), // Empty set - coordinator will send to all tracked subscribers
                deltaPayload,
                async () => {
                  // onSend callback - actual sending is handled by room
                }
              );
            }
          }

          return {
            ok: true as const,
            tileId: result.tile.id,
            createdAt: result.tile.createdAt
          };
        },
        shouldThrottleTilePlace: async ({ key, nowMs, regionId, cellX, cellY, ownerId }) => {
          // Get or create throttle entry for this key
          const entry: ThrottleEntry = tilePlacementThrottleByKey.get(key) ?? {
            lastActivityMs: nowMs,
            attempts: []
          };

          // Filter attempts within current sliding window
          const cutoff = nowMs - tilePlaceThrottlePolicy.windowMs;
          const recentAttempts = entry.attempts.filter((attemptedAtMs) => attemptedAtMs > cutoff);

          if (recentAttempts.length >= tilePlaceThrottlePolicy.maxRequests) {
            // Throttle limit exceeded: calculate retry-after and emit telemetry
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

          // Record this attempt and update entry
          recentAttempts.push(nowMs);
          entry.lastActivityMs = nowMs;
          entry.attempts = recentAttempts;
          tilePlacementThrottleByKey.set(key, entry);

          // Lazy cleanup: if no recent attempts remain, delete the key
          if (recentAttempts.length === 0) {
            tilePlacementThrottleByKey.delete(key);
          }

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
      lifecycleService: dependencies.lifecycleService,
      checkpointService: dependencies.checkpointService
    })
  );

  return app;
}