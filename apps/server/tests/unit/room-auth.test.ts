import { describe, expect, it, vi } from "vitest";
import { ArenaRoom } from "../../src/rooms/arena.room.js";

describe("ArenaRoom authorization", () => {
  it("requires a valid token during onAuth", async () => {
    const verifyAccessToken = vi.fn(async () => ({ subject: "p1" }));
    const room = new ArenaRoom();
    (room as unknown as { authService: { verifyAccessToken: typeof verifyAccessToken } }).authService = {
      verifyAccessToken
    };

    const authorized = await room.onAuth({} as never, { token: "valid-token" });

    expect(authorized).toBe(true);
    expect(verifyAccessToken).toHaveBeenCalledWith("valid-token");
  });
});