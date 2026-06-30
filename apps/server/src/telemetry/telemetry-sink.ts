import { RuntimeConfig } from "../config/env.js";

export type TelemetryEventPayload = {
  eventName: string;
  occurredAt: string;
  attributes: Record<string, string | number | boolean | null>;
};

export class TelemetrySink {
  constructor(private readonly config: RuntimeConfig) {}

  /**
   * Emit a telemetry event with custom event name and attributes
   */
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

  /**
   * Emit tile_persisted event when a tile is successfully inserted
   * @param tileId - The database ID of the inserted tile
   * @param regionId - The region where the tile was placed
   * @param cellX - The cell X coordinate
   * @param cellY - The cell Y coordinate
   * @param ownerId - The server-owned player ID that owns the tile
   */
  async emitTilePersisted(
    tileId: number,
    regionId: string,
    cellX: number,
    cellY: number,
    ownerId: string
  ): Promise<void> {
    await this.emit("tile_persisted", {
      tile_id: tileId,
      region_id: regionId,
      cell_x: cellX,
      cell_y: cellY,
      owner_id: ownerId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit tile_persist_conflict event when a tile insertion conflicts with existing coordinate
   * @param regionId - The region where the conflict occurred
   * @param cellX - The cell X coordinate
   * @param cellY - The cell Y coordinate
   * @param attemptedOwnerId - The player ID that attempted the insertion
   */
  async emitTilePersistConflict(
    regionId: string,
    cellX: number,
    cellY: number,
    attemptedOwnerId: string
  ): Promise<void> {
    await this.emit("tile_persist_conflict", {
      region_id: regionId,
      cell_x: cellX,
      cell_y: cellY,
      attempted_owner_id: attemptedOwnerId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit tile_placed event for story-level authoritative placement success.
   */
  async emitTilePlaced(
    tileId: number,
    regionId: string,
    cellX: number,
    cellY: number,
    ownerId: string
  ): Promise<void> {
    await this.emit("tile_placed", {
      tile_id: tileId,
      region_id: regionId,
      cell_x: cellX,
      cell_y: cellY,
      owner_id: ownerId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit tile_place_rejected event for story-level placement rejection outcomes.
   */
  async emitTilePlaceRejected(
    regionId: string,
    cellX: number,
    cellY: number,
    attemptedOwnerId: string,
    reason: string
  ): Promise<void> {
    await this.emit("tile_place_rejected", {
      region_id: regionId,
      cell_x: cellX,
      cell_y: cellY,
      attempted_owner_id: attemptedOwnerId,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit tile_place_throttled event for policy rate-limit rejection outcomes.
   */
  async emitTilePlaceThrottled(
    regionId: string,
    cellX: number,
    cellY: number,
    attemptedOwnerId: string,
    retryAfterMs: number,
    throttleWindowMs: number,
    throttleMaxRequests: number
  ): Promise<void> {
    await this.emit("tile_place_throttled", {
      region_id: regionId,
      cell_x: cellX,
      cell_y: cellY,
      attempted_owner_id: attemptedOwnerId,
      retry_after_ms: retryAfterMs,
      throttle_window_ms: throttleWindowMs,
      throttle_max_requests: throttleMaxRequests,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit tile_edited event for story-level bounded edit success.
   */
  async emitTileEdited(
    tileId: number,
    regionId: string,
    cellX: number,
    cellY: number,
    ownerId: string
  ): Promise<void> {
    await this.emit("tile_edited", {
      tile_id: tileId,
      region_id: regionId,
      cell_x: cellX,
      cell_y: cellY,
      owner_id: ownerId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit snapshot_created for immutable region snapshot creation.
   */
  async emitSnapshotCreated(
    regionId: string,
    snapshotId: string,
    tileCount: number,
    expectedHash: string
  ): Promise<void> {
    await this.emit("snapshot_created", {
      region_id: regionId,
      snapshot_id: snapshotId,
      tile_count: tileCount,
      expected_hash: expectedHash,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit snapshot_restore_started when replay restore begins.
   */
  async emitSnapshotRestoreStarted(
    regionId: string,
    snapshotId: string,
    tileCount: number,
    expectedHash: string
  ): Promise<void> {
    await this.emit("snapshot_restore_started", {
      region_id: regionId,
      snapshot_id: snapshotId,
      tile_count: tileCount,
      expected_hash: expectedHash,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit snapshot_restore_completed after replay restore and verification.
   */
  async emitSnapshotRestoreCompleted(
    regionId: string,
    snapshotId: string,
    tileCount: number,
    expectedHash: string,
    actualHash: string,
    durationMs: number
  ): Promise<void> {
    await this.emit("snapshot_restore_completed", {
      region_id: regionId,
      snapshot_id: snapshotId,
      tile_count: tileCount,
      expected_hash: expectedHash,
      actual_hash: actualHash,
      duration_ms: durationMs,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit tile_diff_requested when a region diff request is evaluated.
   */
  async emitTileDiffRequested(
    regionId: string,
    sinceVersion: number,
    currentVersion: number | null,
    viewportArea: number
  ): Promise<void> {
    await this.emit("tile_diff_requested", {
      region_id: regionId,
      since_version: sinceVersion,
      current_version: currentVersion,
      viewport_area: viewportArea,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit tile_diff_returned when a region diff response is assembled.
   */
  async emitTileDiffReturned(
    regionId: string,
    sinceVersion: number,
    currentVersion: number,
    viewportArea: number,
    tileCount: number,
    truncated: boolean,
    durationMs: number
  ): Promise<void> {
    await this.emit("tile_diff_returned", {
      region_id: regionId,
      since_version: sinceVersion,
      current_version: currentVersion,
      viewport_area: viewportArea,
      tile_count: tileCount,
      truncated,
      duration_ms: durationMs,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit delta_sent event when a delta is dispatched to a subscriber
   * @param roomId - The arena room ID
   * @param sessionId - The subscriber's session ID
   * @param sequenceId - The delta sequence ID (region version)
   * @param regionId - The region ID
   * @param retransmitAttempt - The retransmit attempt number (0 for initial send)
   */
  async emitDeltaSent(
    roomId: string,
    sessionId: string,
    sequenceId: string,
    regionId: string,
    retransmitAttempt: number
  ): Promise<void> {
    await this.emit("delta_sent", {
      room_id: roomId,
      session_id: sessionId,
      sequence_id: sequenceId,
      region_id: regionId,
      retransmit_attempt: retransmitAttempt,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit delta_acked event when a subscriber acknowledges receipt of a delta
   * @param roomId - The arena room ID
   * @param sessionId - The subscriber's session ID
   * @param sequenceId - The delta sequence ID being acknowledged
   * @param regionId - The region ID
   */
  async emitDeltaAcked(
    roomId: string,
    sessionId: string,
    sequenceId: string,
    regionId: string
  ): Promise<void> {
    await this.emit("delta_acked", {
      room_id: roomId,
      session_id: sessionId,
      sequence_id: sequenceId,
      region_id: regionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit delta_retransmitted event when a delta is retransmitted due to ack timeout
   * @param roomId - The arena room ID
   * @param sessionId - The subscriber's session ID
   * @param sequenceId - The delta sequence ID being retransmitted
   * @param regionId - The region ID
   * @param retransmitAttempt - The retransmit attempt number
   * @param timeoutReasonMs - The timeout value in milliseconds that triggered retransmit
   */
  async emitDeltaRetransmitted(
    roomId: string,
    sessionId: string,
    sequenceId: string,
    regionId: string,
    retransmitAttempt: number,
    timeoutReasonMs: number
  ): Promise<void> {
    await this.emit("delta_retransmitted", {
      room_id: roomId,
      session_id: sessionId,
      sequence_id: sequenceId,
      region_id: regionId,
      retransmit_attempt: retransmitAttempt,
      timeout_reason_ms: timeoutReasonMs,
      timestamp: new Date().toISOString()
    });
  }
}