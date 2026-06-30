import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => ({
  Room: class RoomMock {
    public clients: Array<{ sessionId: string; send: ReturnType<typeof vi.fn> }> = [];
    public state: unknown;

    public setState(state: unknown): void {
      this.state = state;
    }

    public setSimulationInterval(): void {
      // no-op in unit tests
    }

    public onMessage(): void {
      // no-op in unit tests
    }
  },
  Client: class ClientMock {}
}));

import { ArenaRoom } from "../../src/rooms/arena.room.js";

describe("ArenaRoom authorization", () => {
  it("requires a valid join token during onAuth", async () => {
    const verifyJoinToken = vi.fn(() => ({
      sub: "tenant-a|p1",
      roomId: "arena-1",
      jti: "jti-1",
      exp: 1_900_000_000
    }));
    const room = new ArenaRoom();
    (room as unknown as { roomId: string }).roomId = "arena-1";
    (room as unknown as { authService: { verifyJoinToken: typeof verifyJoinToken } }).authService = {
      verifyJoinToken
    };
    (room as unknown as { lifecycleService: { noteRoomJoin: () => void; noteRoomLeave: () => void } }).lifecycleService = {
      noteRoomJoin: vi.fn(),
      noteRoomLeave: vi.fn()
    };

    const client = {} as never;
    const authorized = await room.onAuth(client, { joinToken: "valid-join-token" });

    expect(authorized).toBe(true);
    expect(verifyJoinToken).toHaveBeenCalledWith("valid-join-token", ArenaRoom.ROOM_KEY);
    expect((client as { auth?: { tenantScopedSubject?: string } }).auth?.tenantScopedSubject).toBe("tenant-a|p1");
  });

  it("registers and removes coordinator binding in shared fanout registry lifecycle", () => {
    const room = new ArenaRoom();
    const registry = new Map();

    room.onCreate({
      authService: {
        verifyJoinToken: vi.fn()
      } as never,
      lifecycleService: {
        noteRoomJoin: vi.fn(),
        noteRoomLeave: vi.fn()
      } as never,
      deltaFanoutRegistry: registry,
      telemetrySink: {
        emitDeltaRetransmitted: vi.fn(async () => undefined),
        emitDeltaAcked: vi.fn(async () => undefined)
      } as never,
      deltaFanoutConfig: {
        deltaAckTimeoutMs: 100,
        deltaRetransmitMaxAttempts: 1,
        deltaAckPendingTtlMs: 5000,
        deltaOutboundCapPerConnection: 100
      }
    });

    const key = ArenaRoom.fanoutRegistryKey();
    expect(registry.has(key)).toBe(true);

    room.onDispose();

    expect(registry.has(key)).toBe(false);
  });
});