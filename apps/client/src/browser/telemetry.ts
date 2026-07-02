import type { ClientInteractionTelemetryEventName } from "@game/shared-types";

export type BrowserTelemetryAttributes = Record<string, string | number | boolean | null>;

function readStringFromGlobalThis(key: string): string | undefined {
  const candidate = Reflect.get(globalThis, key);
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

function readStringFromImportMetaEnv(key: string): string | undefined {
  const envCandidate = (import.meta as { env?: Record<string, unknown> }).env;
  const value = envCandidate ? envCandidate[key] : undefined;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getBrowserTelemetrySinkUrl(): string | undefined {
  return (
    readStringFromGlobalThis("__APP_TELEMETRY_SINK_URL__") ??
    readStringFromImportMetaEnv("VITE_APP_TELEMETRY_SINK_URL")
  );
}

export async function emitClientTelemetry(
  eventName: ClientInteractionTelemetryEventName,
  attributes: BrowserTelemetryAttributes
): Promise<void> {
  const sinkUrl = getBrowserTelemetrySinkUrl();
  if (!sinkUrl) {
    return;
  }

  const payload = {
    eventName,
    occurredAt: new Date().toISOString(),
    attributes
  };

  try {
    await fetch(sinkUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // Telemetry must never break the interaction loop.
  }
}
