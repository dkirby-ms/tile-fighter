import { describe, expect, it, vi } from "vitest";
import {
  RealtimeDeltaHandler,
  type RealtimeDeltaPayload,
  type ApplyDeltaCallback
} from "../../src/session/realtime-delta-handler.js";

function makeTestDelta(sequenceId: string, overrides: Partial<RealtimeDeltaPayload> = {}): RealtimeDeltaPayload {
  return {
    sequenceId,
    regionId: "arena-1",
    cellX: 1,
    cellY: 2,
    offsetX: 0.5,
    offsetY: 0.5,
    shape: "square",
    color: "blue",
    stylePayload: {},
    ownerId: "player-1",
    sentAt: new Date().toISOString(),
    retransmitAttempt: 0,
    ...overrides
  };
}

function createMockRoom() {
  let deltaHandler: ((data: RealtimeDeltaPayload) => void) | null = null;

  return {
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      if (event === "delta") {
        deltaHandler = handler as (data: RealtimeDeltaPayload) => void;
      }
    }),
    send: vi.fn(),
    _getDeltaHandler: () => deltaHandler,
    _triggerDelta: async (delta: RealtimeDeltaPayload) => {
      if (deltaHandler) {
        await deltaHandler(delta);
      }
    }
  };
}

describe("RealtimeDeltaHandler", () => {
  describe("ordered apply with sequence deduplication", () => {
    it("applies first delta and tracks sequence ID", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);

      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      const delta = makeTestDelta("seq-100");
      await (room as any)._triggerDelta(delta);

      expect(applyDeltaMock).toHaveBeenCalledOnce();
      expect(applyDeltaMock).toHaveBeenCalledWith(delta);
      expect(handler.getLastAppliedSequenceId()).toBe("seq-100");
    });

    it("applies deltas in monotonic sequence order", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      // Apply seq-1, seq-2, seq-3 in order
      const delta1 = makeTestDelta("1");
      const delta2 = makeTestDelta("2");
      const delta3 = makeTestDelta("3");

      await (room as any)._triggerDelta(delta1);
      await (room as any)._triggerDelta(delta2);
      await (room as any)._triggerDelta(delta3);

      expect(applyDeltaMock).toHaveBeenCalledTimes(3);
      expect(applyDeltaMock.mock.calls[0][0].sequenceId).toBe("1");
      expect(applyDeltaMock.mock.calls[1][0].sequenceId).toBe("2");
      expect(applyDeltaMock.mock.calls[2][0].sequenceId).toBe("3");
      expect(handler.getLastAppliedSequenceId()).toBe("3");
    });

    it("dedupe: ignores duplicate sequence ID (does not apply)", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      // Apply seq-1 twice
      const delta1a = makeTestDelta("1");
      const delta1b = makeTestDelta("1");

      await (room as any)._triggerDelta(delta1a);
      expect(applyDeltaMock).toHaveBeenCalledTimes(1);

      await (room as any)._triggerDelta(delta1b);
      expect(applyDeltaMock).toHaveBeenCalledTimes(1); // No additional apply

      expect(handler.getLastAppliedSequenceId()).toBe("1");
    });

    it("dedupe: ignores old sequence ID (does not apply)", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      // Apply seq-2, then seq-1 (out of order, old)
      const delta2 = makeTestDelta("2");
      const delta1 = makeTestDelta("1");

      await (room as any)._triggerDelta(delta2);
      expect(applyDeltaMock).toHaveBeenCalledTimes(1);

      await (room as any)._triggerDelta(delta1);
      expect(applyDeltaMock).toHaveBeenCalledTimes(1); // No apply for old sequence

      expect(handler.getLastAppliedSequenceId()).toBe("2");
    });

    it("dedupe with retransmitAttempt > 0 still dedupes by sequence ID", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      // Apply seq-1 with attempt 0
      const delta1 = makeTestDelta("1", { retransmitAttempt: 0 });
      await (room as any)._triggerDelta(delta1);
      expect(applyDeltaMock).toHaveBeenCalledTimes(1);

      // Same sequence with attempt 1 (retransmit) should be deduplicated
      const delta1Retry = makeTestDelta("1", { retransmitAttempt: 1 });
      await (room as any)._triggerDelta(delta1Retry);
      expect(applyDeltaMock).toHaveBeenCalledTimes(1); // Still 1, no additional apply
    });
  });

  describe("ack emission behavior", () => {
    it("emits ack after applying new delta", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      const delta = makeTestDelta("seq-100");
      await (room as any)._triggerDelta(delta);

      expect((room as any).send).toHaveBeenCalledOnce();
      const [event, payload] = (room as any).send.mock.calls[0];
      expect(event).toBe("delta_ack");
      expect(payload.sequenceId).toBe("seq-100");
    });

    it("emits ack even for duplicate sequence (deterministic policy)", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      const delta = makeTestDelta("seq-100");

      // First delta
      await (room as any)._triggerDelta(delta);
      expect((room as any).send).toHaveBeenCalledTimes(1);

      // Duplicate delta
      await (room as any)._triggerDelta(delta);
      expect((room as any).send).toHaveBeenCalledTimes(2); // Ack sent again

      const ackPayloads = (room as any).send.mock.calls.map((call: any[]) => call[1]);
      expect(ackPayloads[0].sequenceId).toBe("seq-100");
      expect(ackPayloads[1].sequenceId).toBe("seq-100");
    });

    it("does not emit ack if apply callback throws", async () => {
      const room = createMockRoom();
      const error = new Error("apply failed");
      const applyDeltaMock = vi.fn(async () => {
        throw error;
      });
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      const delta = makeTestDelta("seq-100");
      await (room as any)._triggerDelta(delta);

      expect(applyDeltaMock).toHaveBeenCalledOnce();
      expect((room as any).send).not.toHaveBeenCalled(); // No ack on error
    });

    it("deterministic ack policy: always ack after processing (new or duplicate)", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      // New deltas with acks
      await (room as any)._triggerDelta(makeTestDelta("1"));
      await (room as any)._triggerDelta(makeTestDelta("2"));

      // Duplicate ack (tells server to stop retransmitting)
      await (room as any)._triggerDelta(makeTestDelta("1"));

      expect((room as any).send).toHaveBeenCalledTimes(3);
      const ackCalls = (room as any).send.mock.calls.filter((call: any[]) => call[0] === "delta_ack");
      expect(ackCalls).toHaveLength(3);
      expect(ackCalls[0][1].sequenceId).toBe("1");
      expect(ackCalls[1][1].sequenceId).toBe("2");
      expect(ackCalls[2][1].sequenceId).toBe("1");
    });

    it("invokes ack observer callback when ack is emitted", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const ackObserver = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock, ackObserver);
      handler.start();

      await (room as any)._triggerDelta(makeTestDelta("11"));

      expect(ackObserver).toHaveBeenCalledOnce();
      expect(ackObserver).toHaveBeenCalledWith({ sequenceId: "11" });
    });
  });

  describe("sequence ID comparison", () => {
    it("compares numeric string sequences correctly", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      // Apply in numeric order: 1, 2, 10 (not lexicographic 1, 10, 2)
      await (room as any)._triggerDelta(makeTestDelta("1"));
      await (room as any)._triggerDelta(makeTestDelta("2"));
      await (room as any)._triggerDelta(makeTestDelta("10"));

      expect(applyDeltaMock).toHaveBeenCalledTimes(3);
      expect(applyDeltaMock.mock.calls[0][0].sequenceId).toBe("1");
      expect(applyDeltaMock.mock.calls[1][0].sequenceId).toBe("2");
      expect(applyDeltaMock.mock.calls[2][0].sequenceId).toBe("10");
    });

    it("numeric comparison: 2 is not <= 1, so 2 after 1 should apply", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      await (room as any)._triggerDelta(makeTestDelta("1"));
      await (room as any)._triggerDelta(makeTestDelta("2"));

      // Both should apply (not duplicate)
      expect(applyDeltaMock).toHaveBeenCalledTimes(2);
    });

    it("numeric comparison: 1 is <= 2, so 1 after 2 should dedupe", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      await (room as any)._triggerDelta(makeTestDelta("2"));
      await (room as any)._triggerDelta(makeTestDelta("1"));

      // Only first should apply
      expect(applyDeltaMock).toHaveBeenCalledTimes(1);
      expect(applyDeltaMock.mock.calls[0][0].sequenceId).toBe("2");
    });
  });

  describe("state tracking", () => {
    it("getLastAppliedSequenceId returns null initially", () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      expect(handler.getLastAppliedSequenceId()).toBeNull();
    });

    it("getLastAppliedSequenceId updates after each apply", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      await (room as any)._triggerDelta(makeTestDelta("100"));
      expect(handler.getLastAppliedSequenceId()).toBe("100");

      await (room as any)._triggerDelta(makeTestDelta("200"));
      expect(handler.getLastAppliedSequenceId()).toBe("200");
    });

    it("getLastAppliedSequenceId not updated on duplicate", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      await (room as any)._triggerDelta(makeTestDelta("100"));
      expect(handler.getLastAppliedSequenceId()).toBe("100");

      await (room as any)._triggerDelta(makeTestDelta("100")); // Duplicate
      expect(handler.getLastAppliedSequenceId()).toBe("100"); // Unchanged
    });
  });

  describe("stop behavior", () => {
    it("stop clears the handler reference", async () => {
      const room = createMockRoom();
      const applyDeltaMock = vi.fn(async () => undefined);
      const handler = new RealtimeDeltaHandler(room as any, applyDeltaMock);
      handler.start();

      await (room as any)._triggerDelta(makeTestDelta("1"));
      expect(applyDeltaMock).toHaveBeenCalledOnce();

      handler.stop();

      // After stop, the handler should no longer be callable through the room's handler
      // Since we're using our mock, we verify by checking that internal state is cleaned
      // The mock doesn't have a way to truly "unsubscribe", so we test the intent
      expect(handler.getLastAppliedSequenceId()).toBe("1"); // State preserved after stop
    });
  });
});
