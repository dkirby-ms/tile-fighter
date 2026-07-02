import * as fs from "node:fs";
import * as path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { ServerDatabase } from "../../src/persistence/db.js";

// ── Budget thresholds ──────────────────────────────────────────────────────────
const PLACEMENT_ACK_MEDIAN_BUDGET_MS = 200;
const RECONNECT_P95_BUDGET_MS = 3000;

// ── Environment-driven configuration ──────────────────────────────────────────
// LOAD_CCU:              Concurrent users to simulate per round (default: 50)
// LOAD_DURATION_MINUTES: How long to run the sustained loop (default: 0.5 = 30 s)
//                        Set to 30 in nonprod-load and verify-release for the full story run.
// LOAD_EVIDENCE_PATH:    JSON artifact destination (default: artifacts/e3-s4-latency-budget.json)
// LOAD_ROOM_KEY:         Room identifier forwarded to placement requests (default: arena)
// LOAD_RUN_CLASS:        Provenance label distinguishing scheduled nonprod vs release runs (default: local)
const LOAD_CCU = Number(process.env.LOAD_CCU ?? "50");
const LOAD_DURATION_MINUTES = Number(process.env.LOAD_DURATION_MINUTES ?? "0.5");
const LOAD_EVIDENCE_PATH = process.env.LOAD_EVIDENCE_PATH ?? "artifacts/e3-s4-latency-budget.json";
const LOAD_ROOM_KEY = process.env.LOAD_ROOM_KEY ?? "arena";
const LOAD_RUN_CLASS = process.env.LOAD_RUN_CLASS ?? "local";
const STRICT_BUDGET_RUN_CLASSES = new Set(["nonprod-load", "verify-release", "ci"]);

// Vitest timeout: accommodate the full configured duration plus a 30-second buffer.
const TEST_TIMEOUT_MS = Math.ceil(LOAD_DURATION_MINUTES * 60 * 1000) + 30_000;

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

function validateConfig(): void {
  if (!Number.isFinite(LOAD_CCU) || LOAD_CCU < 1) {
    throw new Error(
      `Invalid LOAD_CCU value: "${String(process.env.LOAD_CCU)}". Must be a positive integer.`
    );
  }

  if (!Number.isFinite(LOAD_DURATION_MINUTES) || LOAD_DURATION_MINUTES < 0) {
    throw new Error(
      `Invalid LOAD_DURATION_MINUTES value: "${String(process.env.LOAD_DURATION_MINUTES)}". Must be a non-negative number.`
    );
  }
}

function writeEvidenceArtifact(evidence: Record<string, unknown>): void {
  const dir = path.dirname(LOAD_EVIDENCE_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(LOAD_EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
}

describe("E3-S4: 50 CCU latency budget validation", () => {
  it(
    "records placement ack median and reconnect p95 within budget under sustained CCU load",
    async () => {
      validateConfig();

      // ── Mock services following the join-rejoin-load pattern ─────────────────
      const telemetrySink = {
        emit: vi.fn(async () => undefined),
        emitTilePlaced: vi.fn(async () => undefined),
        emitTilePlaceRejected: vi.fn(async () => undefined),
        emitTilePlaceThrottled: vi.fn(async () => undefined),
        emitTilePersisted: vi.fn(async () => undefined),
        emitTilePersistConflict: vi.fn(async () => undefined),
        emitPlacementConflictDetected: vi.fn(async () => undefined),
        emitPlacementConflictResolved: vi.fn(async () => undefined),
        emitLoadRunStarted: vi.fn(async () => undefined),
        emitLoadRunCompleted: vi.fn(async () => undefined),
        emitLoadBudgetViolation: vi.fn(async () => undefined)
      } as unknown as TelemetrySink;

      const authService = {
        verifyAccessToken: vi.fn(async () => ({
          subject: "e3s4-load-player",
          tenantScopedSubject: "tenant-a|e3s4-load-player",
          issuer: "https://issuer.example",
          audience: "api://tile-fighter-server",
          tenantId: "tenant-a",
          tokenVersion: "2.0",
          expiresAt: 1_900_000_000
        })),
        issueJoinToken: vi.fn(() => "join-token-e3s4")
      };

      const lifecycleService = new SessionLifecycleService({
        heartbeatTtlSeconds: 30,
        cleanupIntervalSeconds: 5,
        telemetrySink
      });

      let placementCount = 0;
      const tileRepository = {
        insertTile: vi.fn(async () => {
          placementCount++;

          return {
            ok: true as const,
            tile: {
              id: placementCount,
              createdAt: new Date()
            }
          };
        }),
        editTileWithinSelfEditWindow: vi.fn(async () => ({
          ok: false as const,
          reason: "forbidden_owner_mismatch" as const
        }))
      };

      const checkpointService = {
        issueReconnectTokenForSubject: vi.fn(async () => "reconnect-token-e3s4"),
        resolveReconnect: vi.fn(async () => ({
          ok: true as const,
          checkpointId: "checkpoint-e3s4",
          sessionId: "session-e3s4",
          roomId: LOAD_ROOM_KEY,
          regionId: LOAD_ROOM_KEY,
          sinceVersion: 1,
          currentVersion: 2,
          deltaCount: 1,
          deltas: [
            {
              cellX: 0,
              cellY: 0,
              version: 2,
              operation: "upsert",
              offsetX: 0,
              offsetY: 0,
              shape: "square",
              color: "blue",
              stylePayload: null,
              ownerId: "tenant-a|e3s4-load-player"
            }
          ],
          serverChecksum: "e3s4-checksum",
          checksumScope: "full_region_canonical"
        })),
        archiveExpiredStaleCheckpoints: vi.fn(async () => 0)
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
        lifecycleService,
        checkpointService: checkpointService as never,
        db: {} as Kysely<ServerDatabase>,
        tileRepository: tileRepository as never
      });

      // ── Latency sample collections ─────────────────────────────────────────
      const placementAckLatenciesMs: number[] = [];
      const reconnectLatenciesMs: number[] = [];

      // ── Sustained load loop ────────────────────────────────────────────────
      const runStartedAt = new Date().toISOString();
      const endTimeMs = Date.now() + LOAD_DURATION_MINUTES * 60 * 1000;
      let roundsCompleted = 0;

      await telemetrySink.emitLoadRunStarted({
        scenarioId: "e3-s4-latency-budget",
        ccu: LOAD_CCU,
        durationMinutes: LOAD_DURATION_MINUTES,
        runClass: LOAD_RUN_CLASS,
        evidencePath: LOAD_EVIDENCE_PATH
      });

      do {
        // ── Placement ack round: LOAD_CCU concurrent placement requests ──────
        const placementRound = Array.from({ length: LOAD_CCU }).map(async (_, index) => {
          const commandId = `cmd_e3s4_r${roundsCompleted.toString().padStart(4, "0")}_${index.toString().padStart(3, "0")}`;
          const placementStart = Date.now();

          const response = await request(app)
            .post("/api/tiles/place")
            .set("Authorization", "Bearer valid-token")
            .send({
              commandId,
              regionId: LOAD_ROOM_KEY,
              cellX: (index * 7 + roundsCompleted * 3) % 100,
              cellY: (index * 5 + roundsCompleted * 11) % 100,
              offsetX: 0,
              offsetY: 0,
              shape: "square",
              color: "blue",
              stylePayload: null
            });

          const latencyMs = Date.now() - placementStart;

          if (response.status === 201) {
            placementAckLatenciesMs.push(latencyMs);
          }

          return response.status;
        });

        // ── Reconnect round: LOAD_CCU concurrent reconnect requests ──────────
        const reconnectRound = Array.from({ length: LOAD_CCU }).map(async (_, index) => {
          const heartbeatResponse = await request(app)
            .post("/api/session/heartbeat")
            .set("Authorization", "Bearer valid-token")
            .send({ roomId: LOAD_ROOM_KEY });

          const reconnectStart = Date.now();

          const reconnectResponse = await request(app)
            .post("/api/session/reconnect")
            .set("Authorization", "Bearer valid-token")
            .send({
              roomId: LOAD_ROOM_KEY,
              reconnectToken:
                heartbeatResponse.body.reconnectToken ?? `fallback-token-r${roundsCompleted}-${index}`
            });

          const latencyMs = Date.now() - reconnectStart;

          if (reconnectResponse.status === 200) {
            reconnectLatenciesMs.push(latencyMs);
          }

          return reconnectResponse.status;
        });

        await Promise.all([Promise.all(placementRound), Promise.all(reconnectRound)]);
        roundsCompleted++;
      } while (Date.now() < endTimeMs);

      // ── Compute percentile evidence ────────────────────────────────────────
      const placementAckMedianMs = percentile(placementAckLatenciesMs, 50);
      const reconnectP95Ms = percentile(reconnectLatenciesMs, 95);
      const budgetPassed =
        placementAckMedianMs <= PLACEMENT_ACK_MEDIAN_BUDGET_MS &&
        reconnectP95Ms <= RECONNECT_P95_BUDGET_MS;

      // ── Emit load-run completed telemetry ──────────────────────────────────
      await telemetrySink.emitLoadRunCompleted({
        scenarioId: "e3-s4-latency-budget",
        ccu: LOAD_CCU,
        durationMinutes: LOAD_DURATION_MINUTES,
        runClass: LOAD_RUN_CLASS,
        evidencePath: LOAD_EVIDENCE_PATH,
        placementAckMedianMs,
        reconnectP95Ms,
        roundsCompleted,
        placementSampleCount: placementAckLatenciesMs.length,
        reconnectSampleCount: reconnectLatenciesMs.length,
        budgetPassed
      });

      if (!budgetPassed) {
        if (placementAckMedianMs > PLACEMENT_ACK_MEDIAN_BUDGET_MS) {
          await telemetrySink.emitLoadBudgetViolation({
            scenarioId: "e3-s4-latency-budget",
            metricName: "placement_ack_median_ms",
            measuredMs: placementAckMedianMs,
            budgetMs: PLACEMENT_ACK_MEDIAN_BUDGET_MS,
            runClass: LOAD_RUN_CLASS
          });
        }

        if (reconnectP95Ms > RECONNECT_P95_BUDGET_MS) {
          await telemetrySink.emitLoadBudgetViolation({
            scenarioId: "e3-s4-latency-budget",
            metricName: "reconnect_p95_ms",
            measuredMs: reconnectP95Ms,
            budgetMs: RECONNECT_P95_BUDGET_MS,
            runClass: LOAD_RUN_CLASS
          });
        }
      }

      // ── Serialize evidence artifact ────────────────────────────────────────
      const evidence = {
        scenarioId: "e3-s4-latency-budget",
        timestamp: runStartedAt,
        environment: {
          ccu: LOAD_CCU,
          durationMinutes: LOAD_DURATION_MINUTES,
          runClass: LOAD_RUN_CLASS
        },
        metrics: {
          placementAckMedianMs,
          reconnectP95Ms,
          roundsCompleted,
          placementAckSampleCount: placementAckLatenciesMs.length,
          reconnectSampleCount: reconnectLatenciesMs.length
        },
        budgets: {
          placementAckMedianMs: PLACEMENT_ACK_MEDIAN_BUDGET_MS,
          reconnectP95Ms: RECONNECT_P95_BUDGET_MS
        },
        budgetStatus: {
          placementAckPassed: placementAckMedianMs <= PLACEMENT_ACK_MEDIAN_BUDGET_MS,
          reconnectP95Passed: reconnectP95Ms <= RECONNECT_P95_BUDGET_MS,
          allPassed: budgetPassed
        }
      };

      writeEvidenceArtifact(evidence);

      process.stdout.write(
        `\n[e3-s4-latency-budget] ccu=${LOAD_CCU} run_class=${LOAD_RUN_CLASS} ` +
          `placement_ack_median_ms=${placementAckMedianMs} reconnect_p95_ms=${reconnectP95Ms} ` +
          `placement_samples=${placementAckLatenciesMs.length} reconnect_samples=${reconnectLatenciesMs.length} ` +
          `rounds=${roundsCompleted} budget_passed=${String(budgetPassed)}\n`
      );

      // ── Assert at least one sample was collected per dimension ────────────
      expect(placementAckLatenciesMs.length).toBeGreaterThan(0);
      expect(reconnectLatenciesMs.length).toBeGreaterThan(0);

      // ── Assert latency budgets in strict environments only ─────────────────
      // Local/dev runs still emit evidence and budget status for trend analysis,
      // but do not hard-fail due to machine-dependent timing variance.
      if (STRICT_BUDGET_RUN_CLASSES.has(LOAD_RUN_CLASS)) {
        expect(placementAckMedianMs).toBeLessThanOrEqual(PLACEMENT_ACK_MEDIAN_BUDGET_MS);
        expect(reconnectP95Ms).toBeLessThanOrEqual(RECONNECT_P95_BUDGET_MS);
      }

      // ── Assert artifact was written ────────────────────────────────────────
      expect(fs.existsSync(LOAD_EVIDENCE_PATH)).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
