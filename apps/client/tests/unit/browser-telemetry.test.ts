import { describe, expect, it, vi } from "vitest";
import { emitClientTelemetry } from "../../src/browser/telemetry.js";

describe("browser telemetry", () => {
  it("does nothing when sink url is not configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await emitClientTelemetry("palette_opened", {
      room_id: "arena"
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("posts telemetry payload to configured sink url", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("__APP_TELEMETRY_SINK_URL__", "https://telemetry.example.dev/events");

    await emitClientTelemetry("first_tile_time_recorded", {
      room_id: "arena",
      elapsed_ms: 1234
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://telemetry.example.dev/events");
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers).toEqual({ "Content-Type": "application/json" });

    const payload = JSON.parse(String(requestInit.body)) as {
      eventName: string;
      occurredAt: string;
      attributes: Record<string, unknown>;
    };
    expect(payload.eventName).toBe("first_tile_time_recorded");
    expect(payload.attributes.elapsed_ms).toBe(1234);

    vi.unstubAllGlobals();
  });
});
