import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => ({
  Room: class RoomMock {},
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
});