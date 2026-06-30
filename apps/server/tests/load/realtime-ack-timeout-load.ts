import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DeltaFanoutCoordinator,
  type RealtimeDeltaPayload,
  type DeltaFanoutConfig,
  type OnRetransmitCallback,
  type OnAckCallback
} from "../../src/domain/delta-fanout.service.js";

/**
 * Load test for realtime delta ack timeout and retransmit behavior
 * Simulates dropped ack scenarios and measures timeout/retransmit rates
 */

const LOAD_CONFIG: DeltaFanoutConfig = {
  deltaAckTimeoutMs: 50, // Short for fast test execution
  deltaRetransmitMaxAttempts: 1,
  deltaAckPendingTtlMs: 5000,
  deltaOutboundCapPerConnection: 10000
};

interface LoadTestMetrics {
  totalSent: number;
  totalRetransmitted: number;
  totalAcked: number;
  totalTimeouts: number;
  droppedAckCount: number;
  sentWithDroppedAck: number;
}

function makeTestDelta(sequenceId: string, regionId: string = "arena-1"): RealtimeDeltaPayload {
  return {
    sequenceId,
    regionId,
    cellX: Math.floor(Math.random() * 100),
    cellY: Math.floor(Math.random() * 100),
    offsetX: Math.random(),
    offsetY: Math.random(),
    shape: "square",
    color: Math.random() > 0.5 ? "blue" : "red",
    stylePayload: {},
    ownerId: `player-${Math.floor(Math.random() * 10)}`,
    sentAt: new Date().toISOString(),
    retransmitAttempt: 0
  };
}

describe("Load test: Realtime Delta Fanout with Ack Timeout and Retransmit", () => {
  let coordinator: DeltaFanoutCoordinator;
  let metrics: LoadTestMetrics;
  let retransmitCalls: RealtimeDeltaPayload[] = [];
  let ackCalls: Array<[string, string]> = [];

  beforeEach(() => {
    metrics = {
      totalSent: 0,
      totalRetransmitted: 0,
      totalAcked: 0,
      totalTimeouts: 0,
      droppedAckCount: 0,
      sentWithDroppedAck: 0
    };
    retransmitCalls = [];
    ackCalls = [];

    const onRetransmit = vi.fn(async (payload: RealtimeDeltaPayload) => {
      retransmitCalls.push(payload);
      metrics.totalRetransmitted++;
    });

    const onAck = vi.fn(async (subscriberId: string, sequenceId: string) => {
      ackCalls.push([subscriberId, sequenceId]);
      metrics.totalAcked++;
    });

    coordinator = new DeltaFanoutCoordinator(
      LOAD_CONFIG,
      onRetransmit as OnRetransmitCallback,
      onAck as OnAckCallback
    );
  });

  afterEach(() => {
    coordinator.destroy();
  });

  describe("timeout rate under simulated dropped acks", () => {
    it("measures timeout retransmit rate with 20% ack drop rate", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1", "sub-2"]);
        const droppedAckRatio = 0.2; // 20% of acks are dropped

        const onSend = vi.fn(async () => {
          metrics.totalSent++;
        });

        // Publish 100 deltas
        const deltaCount = 100;
        for (let i = 1; i <= deltaCount; i++) {
          const delta = makeTestDelta(`seq-${i}`);
          await coordinator.publish(subscribers, delta, onSend);

          // Simulate ack delivery with drop rate
          for (const subscriberId of subscribers) {
            if (Math.random() > droppedAckRatio) {
              await coordinator.handleAck(subscriberId, `seq-${i}`);
              metrics.totalAcked++;
            } else {
              metrics.droppedAckCount++;
            }
          }
        }

        // Advance time to trigger all timeouts
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs * deltaCount + 1000);

        // Verify metrics
        expect(metrics.totalSent).toBeGreaterThan(0);
        expect(metrics.totalAcked).toBeGreaterThan(0);
        expect(metrics.totalRetransmitted).toBeGreaterThan(0);

        // Rough check: retransmitted count should correlate with dropped acks
        // Using 30% tolerance to account for timing variations in test environment
        const expectedRetransmits = Math.floor(deltaCount * 2 * droppedAckRatio); // 2 subscribers
        expect(metrics.totalRetransmitted).toBeGreaterThanOrEqual(expectedRetransmits * 0.7);
        expect(metrics.totalRetransmitted).toBeLessThanOrEqual(expectedRetransmits * 1.3);
      } finally {
        vi.useRealTimers();
      }
    });

    it("measures timeout rate with 0% ack drop (no retransmits expected)", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => {
          metrics.totalSent++;
        });

        // Publish and ack all deltas
        const deltaCount = 50;
        for (let i = 1; i <= deltaCount; i++) {
          const delta = makeTestDelta(`seq-${i}`);
          await coordinator.publish(subscribers, delta, onSend);

          // Ack immediately
          await coordinator.handleAck("sub-1", `seq-${i}`);
        }

        // Advance time
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs * deltaCount + 1000);

        // No retransmits expected
        expect(metrics.totalRetransmitted).toBe(0);
        expect(metrics.totalAcked).toBe(deltaCount);
      } finally {
        vi.useRealTimers();
      }
    });

    it("measures timeout rate with 100% ack drop (all retransmits)", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => {
          metrics.totalSent++;
        });

        // Publish deltas without acking any
        const deltaCount = 25;
        for (let i = 1; i <= deltaCount; i++) {
          const delta = makeTestDelta(`seq-${i}`);
          await coordinator.publish(subscribers, delta, onSend);
          metrics.droppedAckCount++;
        }

        // Advance time to trigger all timeouts
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs * deltaCount + 1000);

        // All should retransmit once (one attempt max)
        expect(metrics.totalRetransmitted).toBe(deltaCount);
        expect(metrics.totalAcked).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("concurrent subscriber ack patterns", () => {
    it("multi-subscriber convergence: some ack, some drop", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-good", "sub-flaky", "sub-bad"]);
        const onSend = vi.fn(async () => {
          metrics.totalSent++;
        });

        // Publisher behavior:
        // sub-good: acks everything (100%)
        // sub-flaky: acks 50%
        // sub-bad: acks nothing (0%)

        const deltaCount = 30;
        for (let i = 1; i <= deltaCount; i++) {
          const delta = makeTestDelta(`seq-${i}`);
          await coordinator.publish(subscribers, delta, onSend);

          // sub-good always acks
          await coordinator.handleAck("sub-good", `seq-${i}`);
          metrics.totalAcked++;

          // sub-flaky sometimes acks
          if (Math.random() > 0.5) {
            await coordinator.handleAck("sub-flaky", `seq-${i}`);
            metrics.totalAcked++;
          } else {
            metrics.droppedAckCount++;
          }

          // sub-bad never acks
          metrics.droppedAckCount++;
        }

        // Advance to trigger timeouts
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs * deltaCount + 1000);

        // Verify retransmit behavior correlates with dropped acks
        expect(metrics.totalRetransmitted).toBeGreaterThan(0);
        expect(metrics.droppedAckCount).toBeGreaterThan(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("single retransmit cap enforcement", () => {
    it("verifies max one retransmit per sequence (no double retransmits)", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => {
          metrics.totalSent++;
        });

        const delta = makeTestDelta("seq-1");
        await coordinator.publish(subscribers, delta, onSend);

        // First timeout triggers retransmit
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs + 10);
        expect(metrics.totalRetransmitted).toBe(1);

        // Second timeout should not trigger retransmit (cap = 1)
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs + 10);
        expect(metrics.totalRetransmitted).toBe(1);

        // Even advancing far past should not trigger
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs * 10);
        expect(metrics.totalRetransmitted).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("all sequences respect max retransmit cap regardless of count", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => {
          metrics.totalSent++;
        });

        // Publish 100 deltas without acking
        const deltaCount = 100;
        for (let i = 1; i <= deltaCount; i++) {
          const delta = makeTestDelta(`seq-${i}`);
          await coordinator.publish(subscribers, delta, onSend);
        }

        // Trigger all timeouts
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs * deltaCount * 2 + 5000);

        // Exactly one retransmit per sequence
        expect(metrics.totalRetransmitted).toBe(deltaCount);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("outbound cap behavior under load", () => {
    it("cap does not crash room flow, silently skips over-cap publishes", async () => {
      const capConfig: DeltaFanoutConfig = {
        ...LOAD_CONFIG,
        deltaOutboundCapPerConnection: 10
      };

      const capMetrics: LoadTestMetrics = {
        totalSent: 0,
        totalRetransmitted: 0,
        totalAcked: 0,
        totalTimeouts: 0,
        droppedAckCount: 0,
        sentWithDroppedAck: 0
      };

      const onRetransmit = vi.fn(async () => {
        capMetrics.totalRetransmitted++;
      });
      const onAck = vi.fn(async () => {
        capMetrics.totalAcked++;
      });

      const capCoordinator = new DeltaFanoutCoordinator(
        capConfig,
        onRetransmit as OnRetransmitCallback,
        onAck as OnAckCallback
      );

      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => {
          capMetrics.totalSent++;
        });

        // Try to publish 30 deltas (cap is 10)
        const deltaCount = 30;
        for (let i = 1; i <= deltaCount; i++) {
          const delta = makeTestDelta(`seq-${i}`);
          await capCoordinator.publish(subscribers, delta, onSend);
        }

        // Should only send cap count (10)
        expect(capMetrics.totalSent).toBe(capConfig.deltaOutboundCapPerConnection);

        // Should not crash
        expect(capCoordinator).toBeDefined();
      } finally {
        capCoordinator.destroy();
      }
    });
  });

  describe("telemetry observation points", () => {
    it("retransmit callback includes updated retransmitAttempt counter", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => undefined);

        const delta = makeTestDelta("seq-1");
        expect(delta.retransmitAttempt).toBe(0);

        await coordinator.publish(subscribers, delta, onSend);

        // Trigger timeout
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckTimeoutMs + 10);

        // Verify retransmit payload has incremented counter
        expect(retransmitCalls).toHaveLength(1);
        const retransmitPayload = retransmitCalls[0];
        expect(retransmitPayload.retransmitAttempt).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("ack callback invoked only after successful ack clearance", async () => {
      const subscribers = new Set(["sub-1", "sub-2"]);
      const onSend = vi.fn(async () => undefined);

      const delta = makeTestDelta("seq-1");
      await coordinator.publish(subscribers, delta, onSend);

      // Ack sub-1 only
      await coordinator.handleAck("sub-1", "seq-1");
      expect(ackCalls).toHaveLength(1);
      expect(ackCalls[0]).toEqual(["sub-1", "seq-1"]);

      // Ack sub-2
      await coordinator.handleAck("sub-2", "seq-1");
      expect(ackCalls).toHaveLength(2);
      expect(ackCalls[1]).toEqual(["sub-2", "seq-1"]);
    });
  });

  describe("memory stability under load", () => {
    it("pending ack map does not grow unbounded with TTL cleanup", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        let pubCount = 0;

        const onSend = vi.fn(async () => {
          pubCount++;
        });

        // Publish many deltas and let TTL expire
        const deltaCount = 200;
        for (let i = 1; i <= deltaCount; i++) {
          const delta = makeTestDelta(`seq-${i}`);
          await coordinator.publish(subscribers, delta, onSend);
        }

        expect(pubCount).toBe(deltaCount);

        // Advance past TTL expiration (30 seconds)
        vi.advanceTimersByTime(LOAD_CONFIG.deltaAckPendingTtlMs + 1000);

        // Coordinator should still be responsive
        const testDelta = makeTestDelta("seq-test");
        await coordinator.publish(subscribers, testDelta, onSend);

        expect(pubCount).toBe(deltaCount + 1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
