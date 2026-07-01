import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { createHttpApp } from "../../src/http/app.js";
import { BondRecomputeCoordinator } from "../../src/domain/bond-recompute-coordinator.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { ServerDatabase } from "../../src/persistence/db.js";

const BURST_REQUESTS = Number(process.env.BOND_RECOMPUTE_BURST_REQUESTS ?? "200");
const MAX_QUEUE_LAG_BUDGET_MS = Number(process.env.BOND_RECOMPUTE_MAX_QUEUE_LAG_MS ?? "500");

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

describe("Tile bond recompute load", () => {
  it("captures queue lag and skip rate under burst placement", async () => {
    const queueLagSamples: number[] = [];
    const queueDepthSamples: number[] = [];
    let skippedCount = 0;
    let completedCount = 0;

    const telemetrySink = {
      emit: vi.fn(async () => undefined),
      emitTilePlaceRejected: vi.fn(async () => undefined),
      emitTilePlaced: vi.fn(async () => undefined),
      emitTileEdited: vi.fn(async () => undefined),
      emitTilePlaceThrottled: vi.fn(async () => undefined),
      emitBondingTriggered: vi.fn(async () => undefined),
      emitBondRecalcStarted: vi.fn(async (event: { queueLagMs: number; queueDepth: number }) => {
        queueLagSamples.push(event.queueLagMs);
        queueDepthSamples.push(event.queueDepth);
      }),
      emitBondRecalcCompleted: vi.fn(async () => {
        completedCount += 1;
      }),
      emitBondRecalcSkipped: vi.fn(async (event: { queueDepth: number }) => {
        skippedCount += 1;
        queueDepthSamples.push(event.queueDepth);
      })
    } as unknown as TelemetrySink;

    const lifecycleService = new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });

    let tileSequence = 0;
    const tileRepository = {
      insertTile: vi.fn(async () => {
        tileSequence += 1;

        return {
          ok: true as const,
          replayed: false,
          tile: {
            id: tileSequence,
            createdAt: new Date(),
            sequenceId: tileSequence
          }
        };
      }),
      editTileWithinSelfEditWindow: vi.fn(async () => ({
        ok: false as const,
        reason: "forbidden_owner_mismatch" as const
      }))
    };

    const bondRecomputeCoordinator = new BondRecomputeCoordinator(
      {
        maxPendingItems: 64,
        maxDrainBatchSize: 16,
        maxQueueWaitMs: 5
      },
      async (item) => ({
        fingerprint: `${item.regionId}:${item.cellX}:${item.cellY}:${item.color}:glow-chain`,
        bondType: "glow-chain"
      }),
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
          await telemetrySink.emitBondRecalcStarted(event);
        },
        onCompleted: async (event) => {
          await telemetrySink.emitBondRecalcCompleted(event);
        },
        onSkipped: async (event) => {
          await telemetrySink.emitBondRecalcSkipped(event);
        }
      }
    );

    const app = createHttpApp({
      readinessCheck: async () => ({
        ok: true,
        checks: {
          database: "ok",
          config: "ok"
        }
      }),
      authMiddleware: (_req, res, next) => {
        res.locals.principal = {
          tenantScopedSubject: "tenant-a|recompute-load-player"
        };
        next();
      },
      telemetrySink,
      authService: {
        verifyAccessToken: vi.fn(),
        issueJoinToken: vi.fn()
      } as never,
      lifecycleService,
      checkpointService: {
        issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token"),
        resolveReconnect: vi.fn(async () => ({ ok: false, reason: "checkpoint_not_found" }))
      } as never,
      db: {} as Kysely<ServerDatabase>,
      tileRepository: tileRepository as never,
      bondRecomputeCoordinator,
      tilePlaceThrottlePolicy: {
        maxRequests: BURST_REQUESTS * 2,
        windowMs: 60_000
      },
      bondRecomputeFloodPolicy: {
        maxRequests: BURST_REQUESTS * 2,
        windowMs: 60_000
      }
    });

    try {
      const warmup = await request(app)
        .post("/api/tiles/place")
        .set("Authorization", "Bearer recompute-load-token")
        .send({
          commandId: "cmd-bond-recompute-load-warmup",
          regionId: "bond-recompute-load-region",
          cellX: 5,
          cellY: 5,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "blue",
          stylePayload: { run: "warmup" }
        });

      expect(warmup.status).toBe(201);
      await vi.waitFor(() => {
        expect(completedCount).toBeGreaterThanOrEqual(1);
      });

      const responses = await Promise.all(
        Array.from({ length: BURST_REQUESTS }, (_, index) =>
          request(app)
            .post("/api/tiles/place")
            .set("Authorization", "Bearer recompute-load-token")
            .send({
              commandId: `cmd-bond-recompute-load-${index.toString().padStart(4, "0")}`,
              regionId: "bond-recompute-load-region",
              cellX: 5,
              cellY: 5,
              offsetX: 0,
              offsetY: 0,
              shape: "square",
              color: "blue",
              stylePayload: { run: index }
            })
        )
      );

      expect(responses.every((response) => response.status === 201)).toBe(true);

      await vi.waitFor(
        () => {
          expect(skippedCount).toBeGreaterThanOrEqual(1);
        },
        { timeout: 5000 }
      );

      const queueLagP95Ms = percentile(queueLagSamples, 95);
      const totalProcessed = completedCount + skippedCount;
      const skipRate = totalProcessed > 0 ? skippedCount / totalProcessed : 0;
      const maxQueueDepth = queueDepthSamples.length > 0 ? Math.max(...queueDepthSamples) : 0;

      process.stdout.write(
        `\n[tile-bond-recompute.load] requests=${BURST_REQUESTS} ` +
          `queue_lag_p95_ms=${queueLagP95Ms} skip_rate=${skipRate.toFixed(4)} max_queue_depth=${maxQueueDepth}\n`
      );

      expect(queueLagSamples.length).toBeGreaterThan(0);
      expect(totalProcessed).toBeGreaterThanOrEqual(2);
      expect(queueLagP95Ms).toBeLessThanOrEqual(MAX_QUEUE_LAG_BUDGET_MS);
      expect(skipRate).toBeGreaterThan(0);
      expect(maxQueueDepth).toBeLessThanOrEqual(64);
    } finally {
      bondRecomputeCoordinator.destroy();
    }
  }, 20_000);
});
