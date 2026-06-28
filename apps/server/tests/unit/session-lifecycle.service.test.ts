import { describe, expect, it, vi } from "vitest";
import { SessionLifecycleService } from "../../src/session/session-lifecycle.service.js";

describe("SessionLifecycleService", () => {
  it("tracks heartbeat metadata and cleanup removes stale entries", async () => {
    let nowMs = 1_700_000_000_000;
    const telemetrySink = {
      emit: vi.fn(async () => undefined)
    };

    const service = new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink: telemetrySink as never,
      now: () => nowMs
    });

    service.noteRoomJoin("tenant-a|player-1", "arena-1");
    service.noteHeartbeat("tenant-a|player-1", "arena-1");

    expect(service.getPresenceCount()).toBe(1);
    expect(service.getPresence("tenant-a|player-1")?.roomId).toBe("arena-1");

    nowMs += 31_000;
    await service.cleanupStaleMetadata();

    expect(service.getPresenceCount()).toBe(0);
    expect((telemetrySink.emit as ReturnType<typeof vi.fn>).mock.calls.some((call) => call[0] === "session_metadata_stale")).toBe(
      true
    );
  });

  it("keeps lifecycle metadata separate from room-membership authority", () => {
    const service = new SessionLifecycleService({
      heartbeatTtlSeconds: 30,
      cleanupIntervalSeconds: 5,
      telemetrySink: {
        emit: vi.fn(async () => undefined)
      } as never,
      now: () => 1_700_000_000_000
    });

    service.noteHeartbeat("tenant-a|player-1", "arena-1");
    expect(service.getPresence("tenant-a|player-1")?.roomId).toBe("arena-1");

    service.noteRoomLeave("tenant-a|player-1", "arena-1");
    expect(service.getPresence("tenant-a|player-1")).toBeUndefined();
  });
});