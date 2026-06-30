import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DeltaFanoutCoordinator,
  type RealtimeDeltaPayload,
  type DeltaFanoutConfig,
  type OnRetransmitCallback,
  type OnAckCallback
} from "../../src/domain/delta-fanout.service.js";

const TEST_CONFIG: DeltaFanoutConfig = {
  deltaAckTimeoutMs: 100, // Short timeout for testing
  deltaRetransmitMaxAttempts: 1,
  deltaAckPendingTtlMs: 5000,
  deltaOutboundCapPerConnection: 1000
};

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
    ownerId: "player-1",
    sentAt: new Date().toISOString(),
    retransmitAttempt: 0
  };
}

describe("Realtime Delta Fanout Integration: Cross-Subscriber Ordering", () => {
  let coordinator: DeltaFanoutCoordinator;
  let onRetransmitMock: ReturnType<typeof vi.fn>;
  let onAckMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRetransmitMock = vi.fn(async () => undefined);
    onAckMock = vi.fn(async () => undefined);

    coordinator = new DeltaFanoutCoordinator(
      TEST_CONFIG,
      onRetransmitMock as OnRetransmitCallback,
      onAckMock as OnAckCallback
    );
  });

  afterEach(() => {
    coordinator.destroy();
  });

  describe("ordered fanout across multiple subscribers", () => {
    it("same placement sequence delivered to all subscribers in identical order", async () => {
      const subscribers = new Set(["sub-a", "sub-b", "sub-c"]);
      const sequenceA = new Array<RealtimeDeltaPayload>();
      const sequenceB = new Array<RealtimeDeltaPayload>();
      const sequenceC = new Array<RealtimeDeltaPayload>();

      const onSend = vi.fn(async (subscriberId: string, delta: RealtimeDeltaPayload) => {
        if (subscriberId === "sub-a") {
          sequenceA.push(delta);
        } else if (subscriberId === "sub-b") {
          sequenceB.push(delta);
        } else if (subscriberId === "sub-c") {
          sequenceC.push(delta);
        }
      });

      // Publish 3 placements to all subscribers
      const delta1 = makeTestDelta("seq-1");
      const delta2 = makeTestDelta("seq-2");
      const delta3 = makeTestDelta("seq-3");

      await coordinator.publish(subscribers, delta1, onSend);
      await coordinator.publish(subscribers, delta2, onSend);
      await coordinator.publish(subscribers, delta3, onSend);

      // Verify all subscribers received same sequence in same order
      expect(sequenceA).toHaveLength(3);
      expect(sequenceB).toHaveLength(3);
      expect(sequenceC).toHaveLength(3);

      // Verify sequence IDs match across subscribers
      expect(sequenceA[0].sequenceId).toBe("seq-1");
      expect(sequenceB[0].sequenceId).toBe("seq-1");
      expect(sequenceC[0].sequenceId).toBe("seq-1");

      expect(sequenceA[1].sequenceId).toBe("seq-2");
      expect(sequenceB[1].sequenceId).toBe("seq-2");
      expect(sequenceC[1].sequenceId).toBe("seq-2");

      expect(sequenceA[2].sequenceId).toBe("seq-3");
      expect(sequenceB[2].sequenceId).toBe("seq-3");
      expect(sequenceC[2].sequenceId).toBe("seq-3");
    });

    it("multiple placements applied in same order across mixed subscriber join times", async () => {
      const onSend = vi.fn(async () => undefined);

      // Subscribe early subscribers
      const earlySubscribers = new Set(["sub-early-1", "sub-early-2"]);
      const delta1 = makeTestDelta("seq-1");
      await coordinator.publish(earlySubscribers, delta1, onSend);

      // Add late subscriber and publish to all
      const allSubscribers = new Set(["sub-early-1", "sub-early-2", "sub-late"]);
      const delta2 = makeTestDelta("seq-2");
      const delta3 = makeTestDelta("seq-3");

      await coordinator.publish(allSubscribers, delta2, onSend);
      await coordinator.publish(allSubscribers, delta3, onSend);

      // Verify send calls for late subscriber maintain ordering
      const lateSubCalls = onSend.mock.calls.filter((call: [string, RealtimeDeltaPayload]) => call[0] === "sub-late");
      expect(lateSubCalls).toHaveLength(2); // Only seq-2 and seq-3
      expect((lateSubCalls[0][1] as RealtimeDeltaPayload).sequenceId).toBe("seq-2");
      expect((lateSubCalls[1][1] as RealtimeDeltaPayload).sequenceId).toBe("seq-3");
    });
  });

  describe("timeout and retransmit ordering convergence", () => {
    it("intentional dropped ack triggers single retransmit with ordering preserved", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-acking", "sub-silent"]);
        const receivedDeltas: RealtimeDeltaPayload[] = [];

        const onSend = vi.fn(async (subscriberId: string, delta: RealtimeDeltaPayload) => {
          receivedDeltas.push(delta);
        });

        // Publish initial delta to both
        const delta1 = makeTestDelta("seq-1");
        await coordinator.publish(subscribers, delta1, onSend);

        // sub-acking acknowledges
        await coordinator.handleAck("sub-acking", "seq-1");

        // sub-silent does not acknowledge, timeout fires
        vi.advanceTimersByTime(TEST_CONFIG.deltaAckTimeoutMs + 10);

        // Verify retransmit occurred
        expect(onRetransmitMock).toHaveBeenCalledOnce();
        const retransmitPayload = onRetransmitMock.mock.calls[0][0];
        expect(retransmitPayload.sequenceId).toBe("seq-1");
        expect(retransmitPayload.retransmitAttempt).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("retransmit does not reorder subsequent published deltas", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const appliedSequence: string[] = [];

        const onSend = vi.fn(async (subscriberId: string, delta: RealtimeDeltaPayload) => {
          appliedSequence.push(delta.sequenceId);
        });

        // Publish seq-1 and seq-2
        const delta1 = makeTestDelta("seq-1");
        const delta2 = makeTestDelta("seq-2");

        await coordinator.publish(subscribers, delta1, onSend);
        await coordinator.publish(subscribers, delta2, onSend);

        expect(appliedSequence).toEqual(["seq-1", "seq-2"]);

        // Ack seq-2, leave seq-1 unacked (will timeout)
        await coordinator.handleAck("sub-1", "seq-2");

        // seq-1 timeout triggers retransmit
        vi.advanceTimersByTime(TEST_CONFIG.deltaAckTimeoutMs + 10);

        // Retransmitted delta1 should appear in retransmit calls
        expect(onRetransmitMock).toHaveBeenCalledOnce();
        const retransmit = onRetransmitMock.mock.calls[0][0];
        expect(retransmit.sequenceId).toBe("seq-1");

        // Publish seq-3 (after retransmit event)
        const delta3 = makeTestDelta("seq-3");
        await coordinator.publish(subscribers, delta3, onSend);

        // Verify final order in sent calls
        const sentSequences = onSend.mock.calls.map((call: [string, RealtimeDeltaPayload]) => (call[1] as RealtimeDeltaPayload).sequenceId);
        expect(sentSequences).toEqual(["seq-1", "seq-2", "seq-3"]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("multiple timeout paths converge to same sequence with retransmit cap", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1", "sub-2"]);
        const sequences: Map<string, string[]> = new Map([["sub-1", []], ["sub-2", []]]);

        const onSend = vi.fn(async (subscriberId: string, delta: RealtimeDeltaPayload) => {
          sequences.get(subscriberId)!.push(delta.sequenceId);
        });

        // Publish to both, but only sub-2 will ack
        const delta = makeTestDelta("seq-1");
        await coordinator.publish(subscribers, delta, onSend);

        // sub-2 acks, sub-1 does not
        await coordinator.handleAck("sub-2", "seq-1");

        // Advance to timeout
        vi.advanceTimersByTime(TEST_CONFIG.deltaAckTimeoutMs + 10);

        // sub-1 timeout triggers retransmit
        expect(onRetransmitMock).toHaveBeenCalledOnce();

        // Both subscribers received same sequence (from initial publish)
        expect(sequences.get("sub-1")).toEqual(["seq-1"]);
        expect(sequences.get("sub-2")).toEqual(["seq-1"]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("pending ack state across multiple regions", () => {
    it("tracks separate pending acks for same subscriber across different regions", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => undefined);

        // Publish deltas from different regions
        const deltaRegionA = makeTestDelta("seq-1", "arena-a");
        const deltaRegionB = makeTestDelta("seq-2", "arena-b");

        await coordinator.publish(subscribers, deltaRegionA, onSend);
        await coordinator.publish(subscribers, deltaRegionB, onSend);

        expect(onSend).toHaveBeenCalledTimes(2);

        // Ack one region
        await coordinator.handleAck("sub-1", "seq-1");
        expect(onAckMock).toHaveBeenCalledOnce();

        // Advance to timeout window
        vi.advanceTimersByTime(TEST_CONFIG.deltaAckTimeoutMs + 10);

        // seq-2 timeout should trigger retransmit (seq-1 was already acked)
        expect(onRetransmitMock).toHaveBeenCalledOnce();
        const retransmit = onRetransmitMock.mock.calls[0][0];
        expect(retransmit.sequenceId).toBe("seq-2");
        expect(retransmit.regionId).toBe("arena-b");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("race conditions and edge cases", () => {
    it("ack during ongoing timeout window clears entry before second timeout fires", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const onSend = vi.fn(async () => undefined);

        const delta = makeTestDelta("seq-1");
        await coordinator.publish(subscribers, delta, onSend);

        // Advance partway through timeout
        vi.advanceTimersByTime(TEST_CONFIG.deltaAckTimeoutMs / 2);

        // Ack arrives during timeout window
        await coordinator.handleAck("sub-1", "seq-1");

        // Advance past original timeout
        vi.advanceTimersByTime(TEST_CONFIG.deltaAckTimeoutMs);

        // No retransmit should fire
        expect(onRetransmitMock).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("rapid successive acks idempotent and dont trigger multiple callbacks", async () => {
      const subscribers = new Set(["sub-1"]);
      const onSend = vi.fn(async () => undefined);

      const delta = makeTestDelta("seq-1");
      await coordinator.publish(subscribers, delta, onSend);

      // Multiple acks for same sequence
      await coordinator.handleAck("sub-1", "seq-1");
      await coordinator.handleAck("sub-1", "seq-1");
      await coordinator.handleAck("sub-1", "seq-1");

      // Only first ack should invoke callback
      expect(onAckMock).toHaveBeenCalledOnce();
    });

    it("simultaneous publish and ack maintains ordering", async () => {
      const subscribers = new Set(["sub-1"]);
      const sendOrder: string[] = [];

      const onSend = vi.fn(async (subscriberId: string, delta: RealtimeDeltaPayload) => {
        sendOrder.push(delta.sequenceId);
      });

      // Publish deltas
      const delta1 = makeTestDelta("seq-1");
      const delta2 = makeTestDelta("seq-2");
      const delta3 = makeTestDelta("seq-3");

      await coordinator.publish(subscribers, delta1, onSend);
      await coordinator.handleAck("sub-1", "seq-1"); // Ack in middle of publishes
      await coordinator.publish(subscribers, delta2, onSend);
      await coordinator.publish(subscribers, delta3, onSend);

      // Verify publication order maintained despite ack interspersed
      expect(sendOrder).toEqual(["seq-1", "seq-2", "seq-3"]);
    });
  });

  describe("subscriber-specific state tracking", () => {
    it("unsubscribe during timeout clears only that subscriber's pending", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1", "sub-2"]);
        const onSend = vi.fn(async () => undefined);

        const delta = makeTestDelta("seq-1");
        await coordinator.publish(subscribers, delta, onSend);

        // Unsubscribe sub-1
        coordinator.unregisterSubscriber("sub-1");

        // Advance to timeout
        vi.advanceTimersByTime(TEST_CONFIG.deltaAckTimeoutMs + 10);

        // sub-1's timeout should not fire (unsubscribed)
        // sub-2's timeout should fire
        expect(onRetransmitMock).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it("multi-subscriber unsubscribe does not interfere with others", async () => {
      const subscribers = new Set(["sub-1", "sub-2", "sub-3"]);
      const onSend = vi.fn(async () => undefined);

      const delta = makeTestDelta("seq-1");
      await coordinator.publish(subscribers, delta, onSend);

      // Unsubscribe middle subscriber
      coordinator.unregisterSubscriber("sub-2");

      // Ack both remaining
      await coordinator.handleAck("sub-1", "seq-1");
      await coordinator.handleAck("sub-3", "seq-1");

      expect(onAckMock).toHaveBeenCalledTimes(2);
    });
  });
});
