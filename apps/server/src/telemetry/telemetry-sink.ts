import { RuntimeConfig } from "../config/env.js";

export type TelemetryEventPayload = {
  eventName: string;
  occurredAt: string;
  attributes: Record<string, string | number | boolean | null>;
};

export class TelemetrySink {
  constructor(private readonly config: RuntimeConfig) {}

  async emit(
    eventName: string,
    attributes: Record<string, string | number | boolean | null>
  ): Promise<void> {
    const payload: TelemetryEventPayload = {
      eventName,
      occurredAt: new Date().toISOString(),
      attributes
    };

    if (this.config.telemetrySinkMode === "off") {
      return;
    }

    if (!this.config.telemetrySinkUrl) {
      if (this.config.telemetrySinkMode === "required") {
        throw new Error("Telemetry sink URL is required");
      }
      return;
    }

    const response = await fetch(this.config.telemetrySinkUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.telemetrySinkName ? { "X-Telemetry-Sink": this.config.telemetrySinkName } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok && this.config.telemetrySinkMode === "required") {
      throw new Error(`Telemetry sink request failed with status ${response.status}`);
    }
  }
}