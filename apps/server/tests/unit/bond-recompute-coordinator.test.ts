import { describe, expect, it, vi } from "vitest";
import { BondRecomputeCoordinator } from "../../src/domain/bond-recompute-coordinator.js";

describe("BondRecomputeCoordinator", () => {
  it("coalesces repeated enqueue calls for the same key", async () => {
    const recompute = vi.fn(async () => ({
      fingerprint: "fp-1",
      bondType: "glow-chain" as const
    }));
    const emitBondingTriggered = vi.fn(async () => undefined);

    const coordinator = new BondRecomputeCoordinator(
      {
        maxPendingItems: 8,
        maxDrainBatchSize: 4,
        maxQueueWaitMs: 0
      },
      recompute,
      emitBondingTriggered
    );

    try {
      const first = coordinator.enqueue({ regionId: "r1", cellX: 1, cellY: 2, color: "cyan" });
      const second = coordinator.enqueue({ regionId: "r1", cellX: 1, cellY: 2, color: "cyan" });

      expect(first.accepted).toBe(true);
      expect(first.coalesced).toBe(false);
      expect(second.accepted).toBe(true);
      expect(second.coalesced).toBe(true);

      await vi.waitFor(() => {
        expect(recompute).toHaveBeenCalledTimes(1);
      });
    } finally {
      coordinator.destroy();
    }
  });

  it("emits skipped telemetry when fingerprint is unchanged", async () => {
    const recompute = vi.fn(async () => ({
      fingerprint: "same-fingerprint",
      bondType: "glow-chain" as const
    }));
    const emitBondingTriggered = vi.fn(async () => undefined);
    const onSkipped = vi.fn(async () => undefined);

    const coordinator = new BondRecomputeCoordinator(
      {
        maxPendingItems: 8,
        maxDrainBatchSize: 2,
        maxQueueWaitMs: 0
      },
      recompute,
      emitBondingTriggered,
      {
        onSkipped
      }
    );

    try {
      coordinator.enqueue({ regionId: "r2", cellX: 4, cellY: 9, color: "red" });
      await vi.waitFor(() => {
        expect(emitBondingTriggered).toHaveBeenCalledTimes(1);
      });

      coordinator.enqueue({ regionId: "r2", cellX: 4, cellY: 9, color: "red" });
      await vi.waitFor(() => {
        expect(onSkipped).toHaveBeenCalledWith(
          expect.objectContaining({
            regionId: "r2",
            cellX: 4,
            cellY: 9,
            reason: "unchanged_fingerprint"
          })
        );
      });

      expect(emitBondingTriggered).toHaveBeenCalledTimes(1);
    } finally {
      coordinator.destroy();
    }
  });

  it("rejects enqueue when queue is full and reports queue_full skip", async () => {
    const recompute = vi.fn(async () => ({
      fingerprint: "fp-unused",
      bondType: null
    }));
    const emitBondingTriggered = vi.fn(async () => undefined);
    const onSkipped = vi.fn(async () => undefined);

    const coordinator = new BondRecomputeCoordinator(
      {
        maxPendingItems: 1,
        maxDrainBatchSize: 1,
        maxQueueWaitMs: 10_000
      },
      recompute,
      emitBondingTriggered,
      {
        onSkipped
      }
    );

    try {
      const first = coordinator.enqueue({ regionId: "r3", cellX: 1, cellY: 1, color: "blue" });
      const second = coordinator.enqueue({ regionId: "r3", cellX: 1, cellY: 2, color: "blue" });

      expect(first.accepted).toBe(true);
      expect(second.accepted).toBe(false);
      expect(second.reason).toBe("queue_full");

      await vi.waitFor(() => {
        expect(onSkipped).toHaveBeenCalledWith(
          expect.objectContaining({ reason: "queue_full", queueDepth: 1 })
        );
      });
    } finally {
      coordinator.destroy();
    }
  });

  it("reports queue lag and depth in started/completed lifecycle hooks", async () => {
    const recompute = vi.fn(async () => ({
      fingerprint: "fp-lag",
      bondType: null
    }));
    const emitBondingTriggered = vi.fn(async () => undefined);
    const onStarted = vi.fn(async () => undefined);
    const onCompleted = vi.fn(async () => undefined);

    const coordinator = new BondRecomputeCoordinator(
      {
        maxPendingItems: 8,
        maxDrainBatchSize: 2,
        maxQueueWaitMs: 5
      },
      recompute,
      emitBondingTriggered,
      {
        onStarted,
        onCompleted
      }
    );

    try {
      coordinator.enqueue({ regionId: "r4", cellX: 8, cellY: 8, color: "green" });

      await vi.waitFor(() => {
        expect(onStarted).toHaveBeenCalledTimes(1);
        expect(onCompleted).toHaveBeenCalledTimes(1);
      });

      const startedEvent = onStarted.mock.calls[0]?.[0];
      const completedEvent = onCompleted.mock.calls[0]?.[0];

      expect(startedEvent).toBeDefined();
      expect(completedEvent).toBeDefined();
      expect(startedEvent?.queueLagMs).toBeGreaterThanOrEqual(0);
      expect(startedEvent?.queueDepth).toBeGreaterThanOrEqual(0);
      expect(completedEvent?.queueLagMs).toBeGreaterThanOrEqual(startedEvent?.queueLagMs ?? 0);
      expect(completedEvent?.queueDepth).toBe(startedEvent?.queueDepth);
    } finally {
      coordinator.destroy();
    }
  });
});
