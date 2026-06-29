import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";

type LoadScenarioResult = {
  label: "stale" | "unchanged";
  latencyMs: number;
  bytes: number;
  status: number;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

describe("Region diff load scenario", () => {
  it("executes stale/unchanged mix and logs latency + payload summary", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        tokenVersion: "2.0",
        expiresAt: 1_900_000_000
      })),
      issueJoinToken: vi.fn()
    };

    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const lifecycleService = new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink
    });

    let callCount = 0;
    const regionDiffService = {
      getRegionDiff: vi.fn(async (input: { sinceVersion: number }) => {
        callCount += 1;
        const isStale = input.sinceVersion === 0;

        if (!isStale) {
          return {
            ok: true as const,
            regionId: "arena-main",
            sinceVersion: 20,
            currentVersion: 20,
            nextSinceVersion: 20,
            isEmpty: true,
            tiles: [],
            truncated: false
          };
        }

        const sizeHint = callCount % 3;
        return {
          ok: true as const,
          regionId: "arena-main",
          sinceVersion: 0,
          currentVersion: 20,
          nextSinceVersion: 20,
          isEmpty: false,
          truncated: false,
          tiles: Array.from({ length: 10 + sizeHint * 5 }).map((_, index) => ({
            cellX: index,
            cellY: index + 1,
            version: 11 + index,
            operation: "upsert",
            offsetX: 0,
            offsetY: 0,
            shape: "square",
            color: "blue",
            stylePayload: { seq: index },
            ownerId: "tenant-a|player-1"
          }))
        };
      })
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
      regionDiffService: regionDiffService as never
    });

    const totalRequests = 60;
    const staleRatio = 0.65;
    const jobs: Promise<LoadScenarioResult>[] = [];

    for (let index = 0; index < totalRequests; index += 1) {
      const label: "stale" | "unchanged" = index / totalRequests < staleRatio ? "stale" : "unchanged";
      const sinceVersion = label === "stale" ? 0 : 20;

      jobs.push(
        (async () => {
          const start = Date.now();
          const response = await request(app)
            .post("/api/regions/diff")
            .set("Authorization", "Bearer valid-token")
            .send({
              regionId: "arena-main",
              sinceVersion,
              viewport: {
                minCellX: 0,
                maxCellX: 49,
                minCellY: 0,
                maxCellY: 49
              },
              maxTiles: 500
            });

          const latencyMs = Date.now() - start;
          const bytes = Buffer.byteLength(JSON.stringify(response.body), "utf8");
          return {
            label,
            latencyMs,
            bytes,
            status: response.status
          };
        })()
      );
    }

    const results = await Promise.all(jobs);
    const stale = results.filter((result) => result.label === "stale");
    const unchanged = results.filter((result) => result.label === "unchanged");

    expect(results).toHaveLength(totalRequests);
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(stale.length).toBeGreaterThan(0);
    expect(unchanged.length).toBeGreaterThan(0);

    const staleAvgBytes = stale.reduce((sum, result) => sum + result.bytes, 0) / stale.length;
    const unchangedAvgBytes =
      unchanged.reduce((sum, result) => sum + result.bytes, 0) / unchanged.length;

    const staleLatency = stale.map((result) => result.latencyMs);
    const unchangedLatency = unchanged.map((result) => result.latencyMs);

    process.stdout.write("\n[region-diff-load] summary\n");
    process.stdout.write(
      `[region-diff-load] stale count=${stale.length} avg_bytes=${staleAvgBytes.toFixed(1)} p95_ms=${percentile(staleLatency, 95)}\n`
    );
    process.stdout.write(
      `[region-diff-load] unchanged count=${unchanged.length} avg_bytes=${unchangedAvgBytes.toFixed(1)} p95_ms=${percentile(unchangedLatency, 95)}\n`
    );

    expect(staleAvgBytes).toBeGreaterThan(unchangedAvgBytes);
  });
});