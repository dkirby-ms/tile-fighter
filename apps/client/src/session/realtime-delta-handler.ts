/**
 * Realtime delta handler for ordered placement fanout with sequence deduplication.
 * Enforces monotonic apply semantics and deterministic ack emission.
 */

/**
 * Realtime delta payload received from server
 * Matches server's RealtimeDeltaPayload interface from delta-fanout.service
 */
export interface RealtimeDeltaPayload {
  sequenceId: string;
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
  ownerId: string;
  sentAt: string;
  retransmitAttempt: number;
}

/**
 * Delta acknowledgment payload to send back to server
 */
export interface DeltaAckPayload {
  sequenceId: string;
}

/**
 * Callback invoked when a delta should be applied to local world state
 * Only called for non-duplicate deltas in sequence order
 */
export type ApplyDeltaCallback = (delta: RealtimeDeltaPayload) => void | Promise<void>;
export type DeltaAckObserver = (ack: DeltaAckPayload) => void | Promise<void>;

/**
 * Client-side realtime delta handler
 * Manages ordered apply semantics and sequence deduplication
 */
export class RealtimeDeltaHandler {
  private lastAppliedSequenceId: string | null = null;
  private messageUnsubscriber?: () => void;

  constructor(
    private readonly room: { on(event: string, handler: (data: unknown) => void): void; send(event: string, data: unknown): void },
    private readonly applyDeltaCallback: ApplyDeltaCallback,
    private readonly onAckEmitted?: DeltaAckObserver
  ) {}

  /**
   * Start listening for delta messages from the server
   * Sets up message handler for ordered apply with monotonic sequence tracking
   */
  start(): void {
    this.room.on("delta", ((payload: RealtimeDeltaPayload) => {
      this.handleDelta(payload);
    }) as (data: unknown) => void);
  }

  /**
   * Stop listening for delta messages
   */
  stop(): void {
    if (this.messageUnsubscriber) {
      this.messageUnsubscriber();
    }
  }

  /**
   * Get the last applied sequence ID
   * Used for testing and diagnostics
   */
  getLastAppliedSequenceId(): string | null {
    return this.lastAppliedSequenceId;
  }

  /**
   * Handle incoming delta message
   * Enforces monotonic sequence ordering with strict dedupe:
   * - If sequence > lastAppliedSequenceId: apply delta and update tracking
   * - If sequence <= lastAppliedSequenceId: skip apply (duplicate), but still ack
   * - Always emit ack deterministically to collapse server retransmits
   */
  private async handleDelta(delta: RealtimeDeltaPayload): Promise<void> {
    const isDuplicate =
      this.lastAppliedSequenceId !== null &&
      this.compareSequenceIds(delta.sequenceId, this.lastAppliedSequenceId) <= 0;

    // Apply delta only if it's not a duplicate
    if (!isDuplicate) {
      try {
        await this.applyDeltaCallback(delta);
        // Only update tracking after successful apply
        this.lastAppliedSequenceId = delta.sequenceId;
      } catch (error) {
        // Log error but do not emit ack on apply failure
        // This allows server to retry on timeout
        console.error("Failed to apply delta with sequence ID", delta.sequenceId, error);
        return;
      }
    }

    // Emit ack deterministically:
    // - For first-seen (new): confirms receipt and apply
    // - For duplicates: tells server to clear pending entry and stop retransmitting
    // This deterministic "always ack" policy reduces retry noise
    await this.emitAck(delta.sequenceId);
  }

  /**
   * Compare two sequence IDs numerically
   * Returns: < 0 if a < b, 0 if a == b, > 0 if a > b
   * Sequence IDs are numeric strings that compare lexicographically
   */
  private compareSequenceIds(a: string, b: string): number {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    return numA - numB;
  }

  /**
   * Emit delta ack message to server
   * Server uses ack to clear pending entry and stop retransmitting
   */
  private async emitAck(sequenceId: string): Promise<void> {
    const ackPayload: DeltaAckPayload = {
      sequenceId
    };
    this.room.send("delta_ack", ackPayload);
    if (this.onAckEmitted) {
      await this.onAckEmitted(ackPayload);
    }
  }
}

/**
 * Factory function to create and start a realtime delta handler
 * Simplified interface for integration with session lifecycle
 */
export function createRealtimeDeltaHandler(
  room: { on(event: string, handler: (data: unknown) => void): void; send(event: string, data: unknown): void },
  applyDeltaCallback: ApplyDeltaCallback,
  onAckEmitted?: DeltaAckObserver
): RealtimeDeltaHandler {
  const handler = new RealtimeDeltaHandler(room, applyDeltaCallback, onAckEmitted);
  handler.start();
  return handler;
}
