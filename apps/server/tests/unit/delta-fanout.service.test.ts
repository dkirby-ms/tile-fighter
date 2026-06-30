import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DeltaFanoutCoordinator,
  type RealtimeDeltaPayload,
  type DeltaFanoutConfig,
  type OnRetransmitCallback,
  type OnAckCallback
} from "../../src/domain/delta-fanout.service.js";

const DEFAULT_CONFIG: DeltaFanoutConfig = {
  deltaAckTimeoutMs: 350,
  deltaRetransmitMaxAttempts: 1,
  deltaAckPendingTtlMs: 30000,
  deltaOutboundCapPerConnection: 100
};

function makeTestDelta(sequenceId: string, regionId: string = "arena-1"): RealtimeDeltaPayload {
  return {
    sequenceId,
    regionId,
    cellX: 1,
    cellY: 2,
    offsetX: 0.5,
    offsetY: 0.5,
    shape: "square",
    color: "blue",
    stylePayload: {},
    ownerId: "player-1",
    sentAt: new Date().toISOString(),
    retransmitAttempt: 0
  };
}

describe("DeltaFanoutCoordinator", () => {
  let coordinator: DeltaFanoutCoordinator;
  let onRetransmitMock: ReturnType<typeof vi.fn>;
  let onAckMock: ReturnType<typeof vi.fn>;
  let onSendMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRetransmitMock = vi.fn(async () => undefined);
    onAckMock = vi.fn(async () => undefined);
    onSendMock = vi.fn(async () => undefined);

    coordinator = new DeltaFanoutCoordinator(
      DEFAULT_CONFIG,
      onRetransmitMock as OnRetransmitCallback,
      onAckMock as OnAckCallback
    );
  });

  afterEach(() => {
    coordinator.destroy();
  });

  describe("publish and ack flow", () => {
    it("sends delta to all subscribers and tracks pending ack", async () => {
      const subscribers = new Set(["sub-1", "sub-2", "sub-3"]);
      const delta = makeTestDelta("seq-1");

      await coordinator.publish(subscribers, delta, onSendMock);

      expect(onSendMock).toHaveBeenCalledTimes(3);
      expect(onSendMock).toHaveBeenCalledWith("sub-1", delta);
      expect(onSendMock).toHaveBeenCalledWith("sub-2", delta);
      expect(onSendMock).toHaveBeenCalledWith("sub-3", delta);
    });

    it("emits ack callback when subscriber acknowledges", async () => {
      const subscribers = new Set(["sub-1"]);
      const delta = makeTestDelta("seq-1");

      await coordinator.publish(subscribers, delta, onSendMock);
      expect(onAckMock).not.toHaveBeenCalled();

      await coordinator.handleAck("sub-1", "seq-1");

      expect(onAckMock).toHaveBeenCalledOnce();
      expect(onAckMock).toHaveBeenCalledWith("sub-1", "seq-1");
    });

    it("idempotent ack handling: does not error on unknown ack", async () => {
      // Should not throw
      await coordinator.handleAck("sub-unknown", "seq-unknown");
      expect(onAckMock).not.toHaveBeenCalled();
    });

    it("clears pending ack after successful ack", async () => {
      const subscribers = new Set(["sub-1"]);
      const delta = makeTestDelta("seq-1");

      await coordinator.publish(subscribers, delta, onSendMock);
      await coordinator.handleAck("sub-1", "seq-1");

      // Ack again should not invoke callback again (entry was removed)
      await coordinator.handleAck("sub-1", "seq-1");
      expect(onAckMock).toHaveBeenCalledOnce();
    });
  });

  describe("timeout and retransmit behavior", () => {
    it("triggers retransmit callback on ack timeout", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const delta = makeTestDelta("seq-1");

        await coordinator.publish(subscribers, delta, onSendMock);
        expect(onRetransmitMock).not.toHaveBeenCalled();

        // Advance past timeout
        vi.advanceTimersByTime(DEFAULT_CONFIG.deltaAckTimeoutMs + 10);

        expect(onRetransmitMock).toHaveBeenCalledOnce();
        const retransmitPayload = onRetransmitMock.mock.calls[0][0];
        expect(retransmitPayload.sequenceId).toBe("seq-1");
        expect(retransmitPayload.retransmitAttempt).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("retransmit respects deltaRetransmitMaxAttempts limit (one retransmit max)", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const delta = makeTestDelta("seq-1");

        await coordinator.publish(subscribers, delta, onSendMock);

        // First timeout triggers first retransmit
        vi.advanceTimersByTime(DEFAULT_CONFIG.deltaAckTimeoutMs + 10);
        expect(onRetransmitMock).toHaveBeenCalledTimes(1);

        // Second timeout should not trigger another retransmit (max attempts = 1)
        vi.advanceTimersByTime(DEFAULT_CONFIG.deltaAckTimeoutMs + 10);
        expect(onRetransmitMock).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("ack during retransmit timeout clears pending entry and prevents further timeouts", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const delta = makeTestDelta("seq-1");

        await coordinator.publish(subscribers, delta, onSendMock);

        // Advance to first timeout
        vi.advanceTimersByTime(DEFAULT_CONFIG.deltaAckTimeoutMs + 10);
        expect(onRetransmitMock).toHaveBeenCalledOnce();

        // Ack before second timeout
        await coordinator.handleAck("sub-1", "seq-1");
        expect(onAckMock).toHaveBeenCalledOnce();

        // Advance to second timeout
        vi.advanceTimersByTime(DEFAULT_CONFIG.deltaAckTimeoutMs + 10);
        expect(onRetransmitMock).toHaveBeenCalledOnce(); // No additional retransmit
      } finally {
        vi.useRealTimers();
      }
    });

    it("retransmit payload includes incremented retransmitAttempt counter", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const delta = makeTestDelta("seq-1");

        await coordinator.publish(subscribers, delta, onSendMock);
        expect(delta.retransmitAttempt).toBe(0);

        vi.advanceTimersByTime(DEFAULT_CONFIG.deltaAckTimeoutMs + 10);

        const retransmitPayload = onRetransmitMock.mock.calls[0][0];
        expect(retransmitPayload.retransmitAttempt).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("outbound cap enforcement", () => {
    it("skips send to subscriber if outbound cap is exceeded", async () => {
      const limitedConfig: DeltaFanoutConfig = {
        ...DEFAULT_CONFIG,
        deltaOutboundCapPerConnection: 2
      };
      const limitedCoordinator = new DeltaFanoutCoordinator(
        limitedConfig,
        onRetransmitMock as OnRetransmitCallback,
        onAckMock as OnAckCallback
      );

      try {
        const subscribers = new Set(["sub-1"]);

        // Publish 3 deltas, only first 2 should be sent (cap = 2)
        await limitedCoordinator.publish(subscribers, makeTestDelta("seq-1"), onSendMock);
        await limitedCoordinator.publish(subscribers, makeTestDelta("seq-2"), onSendMock);
        await limitedCoordinator.publish(subscribers, makeTestDelta("seq-3"), onSendMock);

        expect(onSendMock).toHaveBeenCalledTimes(2); // Only seq-1 and seq-2
      } finally {
        limitedCoordinator.destroy();
      }
    });

    it("allows new subscriber to send regardless of stats", async () => {
      const subscribers = new Set(["sub-new"]);
      const delta = makeTestDelta("seq-1");

      // Register and immediately publish (no prior stats)
      coordinator.registerSubscriber("sub-new");
      await coordinator.publish(subscribers, delta, onSendMock);

      expect(onSendMock).toHaveBeenCalledOnce();
    });
  });

  describe("subscriber lifecycle", () => {
    it("registerSubscriber initializes stats for new subscriber", async () => {
      coordinator.registerSubscriber("sub-1");

      // Publish should succeed
      await coordinator.publish(new Set(["sub-1"]), makeTestDelta("seq-1"), onSendMock);
      expect(onSendMock).toHaveBeenCalledOnce();
    });

    it("unregisterSubscriber clears pending acks and stats", async () => {
      const subscribers = new Set(["sub-1", "sub-2"]);
      const delta = makeTestDelta("seq-1");

      await coordinator.publish(subscribers, delta, onSendMock);
      expect(onSendMock).toHaveBeenCalledTimes(2);

      // Clear pending acks for sub-1
      coordinator.unregisterSubscriber("sub-1");

      // sub-1 should not be in pending map anymore
      await coordinator.handleAck("sub-1", "seq-1");
      expect(onAckMock).not.toHaveBeenCalled(); // No ack callback
    });

    it("unregisterSubscriber clears all pending acks for that subscriber", async () => {
      const subscribers = new Set(["sub-1"]);

      // Publish multiple deltas to sub-1
      await coordinator.publish(subscribers, makeTestDelta("seq-1"), onSendMock);
      await coordinator.publish(subscribers, makeTestDelta("seq-2"), onSendMock);

      // Unregister sub-1
      coordinator.unregisterSubscriber("sub-1");

      // Ack for both sequences should not invoke callback
      await coordinator.handleAck("sub-1", "seq-1");
      await coordinator.handleAck("sub-1", "seq-2");
      expect(onAckMock).not.toHaveBeenCalled();
    });
  });

  describe("sequence order preservation", () => {
    it("emits deltas in sequence order to all subscribers", async () => {
      const subscribers = new Set(["sub-1"]);
      const deltas = [
        makeTestDelta("seq-1"),
        makeTestDelta("seq-2"),
        makeTestDelta("seq-3")
      ];

      for (const delta of deltas) {
        await coordinator.publish(subscribers, delta, onSendMock);
      }

      expect(onSendMock).toHaveBeenCalledTimes(3);
      const calls = onSendMock.mock.calls;
      expect(calls[0][1].sequenceId).toBe("seq-1");
      expect(calls[1][1].sequenceId).toBe("seq-2");
      expect(calls[2][1].sequenceId).toBe("seq-3");
    });
  });

  describe("destroy cleanup", () => {
    it("clears all pending timeouts on destroy", async () => {
      vi.useFakeTimers();
      try {
        const subscribers = new Set(["sub-1"]);
        const delta = makeTestDelta("seq-1");

        await coordinator.publish(subscribers, delta, onSendMock);

        // Destroy before timeout fires
        coordinator.destroy();

        // Advance past timeout
        vi.advanceTimersByTime(DEFAULT_CONFIG.deltaAckTimeoutMs + 100);

        // Retransmit should not fire after destroy
        expect(onRetransmitMock).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
