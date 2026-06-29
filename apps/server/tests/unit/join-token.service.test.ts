import { describe, expect, it } from "vitest";
import { JoinTokenService } from "../../src/auth/join-token.service.js";

describe("JoinTokenService", () => {
  it("issues and verifies a valid join token", () => {
    const service = new JoinTokenService({
      signingSecret: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 60,
      now: () => 1_700_000_000_000
    });

    const token = service.issue("tenant-a|player-1", "arena-1");
    const payload = service.verify(token, "arena-1");

    expect(payload.sub).toBe("tenant-a|player-1");
    expect(payload.roomId).toBe("arena-1");
    expect(payload.jti).toBeTruthy();
    expect(payload.exp).toBe(1_700_000_060);
  });

  it("rejects malformed token", () => {
    const service = new JoinTokenService({
      signingSecret: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 60,
      now: () => 1_700_000_000_000
    });

    expect(() => service.verify("not-a-token", "arena-1")).toThrow("Malformed join token");
  });

  it("rejects expired token", () => {
    let currentTime = 1_700_000_000_000;
    const service = new JoinTokenService({
      signingSecret: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 1,
      now: () => currentTime
    });

    const token = service.issue("tenant-a|player-1", "arena-1");
    currentTime = 1_700_000_002_500;

    expect(() => service.verify(token, "arena-1")).toThrow("Join token expired");
  });

  it("rejects room mismatch", () => {
    const service = new JoinTokenService({
      signingSecret: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 60,
      now: () => 1_700_000_000_000
    });

    const token = service.issue("tenant-a|player-1", "arena-1");

    expect(() => service.verify(token, "arena-2")).toThrow("Join token room mismatch");
  });

  it("rejects replay attempts", () => {
    const service = new JoinTokenService({
      signingSecret: "0123456789abcdef0123456789abcdef",
      ttlSeconds: 60,
      now: () => 1_700_000_000_000
    });

    const token = service.issue("tenant-a|player-1", "arena-1");

    service.verify(token, "arena-1");
    expect(() => service.verify(token, "arena-1")).toThrow("Join token replay detected");
  });
});
