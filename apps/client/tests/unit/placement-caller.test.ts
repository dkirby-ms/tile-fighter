import { describe, expect, it, vi } from "vitest";
import { placeTile } from "../../src/creator/placement-caller.js";

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("placement-caller", () => {
  const endpoint = "https://example.test/api/tiles/place";

  it("returns success for accepted placement", async () => {
    const fetchImpl = vi.fn(async () =>
      makeJsonResponse(201, {
        ok: true,
        tileId: 41,
        createdAt: "2026-06-30T10:00:00.000Z"
      })
    );

    const result = await placeTile(
      endpoint,
      {
        regionId: "arena-1",
        cellX: 1,
        cellY: 2,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "red",
        stylePayload: {}
      },
      {
        input: {
          allowedShapes: ["square"],
          allowedColors: ["red"],
          createCommandId: () => "cmd_success_12345"
        }
      },
      { fetchImpl }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.commandId).toBe("cmd_success_12345");
    expect(result.result.tileId).toBe(41);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("maps occupied result to terminal failure", async () => {
    const fetchImpl = vi.fn(async () =>
      makeJsonResponse(409, {
        ok: false,
        reason: "occupied",
        conflictCode: "placement_conflict_idempotent",
        commandId: "cmd_occ_12345678",
        regionId: "arena-1",
        cell: { cellX: 1, cellY: 2 },
        winner: {
          ownerId: "tenant:user",
          tileId: 9,
          resolvedAt: "2026-06-30T10:00:00.000Z"
        }
      })
    );

    const result = await placeTile(
      endpoint,
      {
        commandId: "cmd_occ_12345678",
        regionId: "arena-1",
        cellX: 1,
        cellY: 2,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "red",
        stylePayload: {}
      },
      {
        input: {
          allowedShapes: ["square"],
          allowedColors: ["red"]
        }
      },
      { fetchImpl }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.failure.class).toBe("terminal");
    expect(result.failure.code).toBe("occupied");
  });

  it("maps throttled result to retryable failure", async () => {
    const fetchImpl = vi.fn(async () =>
      makeJsonResponse(429, {
        ok: false,
        reason: "throttled",
        retryAfterMs: 500
      })
    );

    const result = await placeTile(
      endpoint,
      {
        commandId: "cmd_thr_123456789",
        regionId: "arena-1",
        cellX: 1,
        cellY: 2,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "red",
        stylePayload: {}
      },
      {
        input: {
          allowedShapes: ["square"],
          allowedColors: ["red"]
        }
      },
      { fetchImpl }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.failure.class).toBe("retryable");
    expect(result.failure.code).toBe("throttled");
    expect(result.failure.retryAfterMs).toBe(500);
  });

  it("returns terminal invalid_input without invoking fetch when sanitization fails", async () => {
    const fetchImpl = vi.fn();

    const result = await placeTile(
      endpoint,
      {
        commandId: "bad",
        regionId: "",
        cellX: 1.25,
        cellY: 2,
        offsetX: 99,
        offsetY: 0,
        shape: "hex",
        color: "pink",
        stylePayload: {}
      },
      {
        input: {
          allowedShapes: ["square"],
          allowedColors: ["red"]
        }
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.failure.class).toBe("terminal");
    expect(result.failure.code).toBe("invalid_input");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps network error to retryable failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("socket timeout");
    });

    const result = await placeTile(
      endpoint,
      {
        commandId: "cmd_net_123456789",
        regionId: "arena-1",
        cellX: 1,
        cellY: 2,
        offsetX: 0,
        offsetY: 0,
        shape: "square",
        color: "red",
        stylePayload: {}
      },
      {
        input: {
          allowedShapes: ["square"],
          allowedColors: ["red"]
        }
      },
      { fetchImpl }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.failure.class).toBe("retryable");
    expect(result.failure.code).toBe("network_error");
  });
});
