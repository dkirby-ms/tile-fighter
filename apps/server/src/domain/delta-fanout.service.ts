/**
 * Delta fanout coordinator for ordered realtime placement delivery with ack-driven retransmit.
 * Tracks pending acks per subscriber and sequence, enforces one retransmit max,
 * and cleans expired pending entries using TTL.
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

export interface DeltaAckPayload {
  sequenceId: string;
}

/**
 * Pending ack entry tracking state and expiration
 */
interface PendingAckEntry {
  sequenceId: string;
  subscriberId: string;
  regionId: string;
  deltaPayload: RealtimeDeltaPayload;
  retransmitAttempts: number;
  createdAt: Date;
  expiresAt: Date;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

/**
 * Per-subscriber outbound rate tracking for cap enforcement
 */
interface SubscriberStats {
  outboundCount: number;
  windowResetAt: Date;
}

export type DeltaFanoutConfig = {
  deltaAckTimeoutMs: number;
  deltaRetransmitMaxAttempts: number;
  deltaAckPendingTtlMs: number;
  deltaOutboundCapPerConnection: number;
};

export type OnRetransmitCallback = (payload: RealtimeDeltaPayload) => Promise<void>;
export type OnAckCallback = (subscriberId: string, sequenceId: string) => Promise<void>;

/**
 * In-memory ordered fanout coordinator for broadcasting deltas and managing acks
 */
export class DeltaFanoutCoordinator {
  private pendingAckMap = new Map<string, PendingAckEntry>();
  private subscriberStats = new Map<string, SubscriberStats>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(
    private config: DeltaFanoutConfig,
    private onRetransmit: OnRetransmitCallback,
    private onAck: OnAckCallback
  ) {
    this.startCleanupInterval();
  }

  /**
   * Publish a delta to subscribers with pending ack tracking and timeout scheduling
   */
  async publish(
    subscribers: Set<string>,
    delta: RealtimeDeltaPayload,
    onSend: (subscriberId: string, payload: RealtimeDeltaPayload) => Promise<void>
  ): Promise<void> {
    for (const subscriberId of subscribers) {
      // Enforce outbound cap per connection
      if (!this.canSendToSubscriber(subscriberId)) {
        continue; // Skip this subscriber if cap is exceeded
      }

      // Send the delta
      await onSend(subscriberId, delta);
      this.recordOutboundSend(subscriberId);

      // Create pending ack entry with timeout
      const entryKey = this.makePendingAckKey(subscriberId, delta.sequenceId);
      const expiresAt = new Date(Date.now() + this.config.deltaAckPendingTtlMs);
      const timeoutHandle = setTimeout(() => {
        this.handleAckTimeout(entryKey);
      }, this.config.deltaAckTimeoutMs);

      const entry: PendingAckEntry = {
        sequenceId: delta.sequenceId,
        subscriberId,
        regionId: delta.regionId,
        deltaPayload: delta,
        retransmitAttempts: 0,
        createdAt: new Date(),
        expiresAt,
        timeoutHandle
      };

      this.pendingAckMap.set(entryKey, entry);
    }
  }

  /**
   * Handle ack from subscriber and clear pending entry
   */
  async handleAck(subscriberId: string, sequenceId: string): Promise<void> {
    const entryKey = this.makePendingAckKey(subscriberId, sequenceId);
    const entry = this.pendingAckMap.get(entryKey);

    if (!entry) {
      return; // Ack for unknown or already-cleared entry
    }

    // Clear timeout
    if (entry.timeoutHandle) {
      clearTimeout(entry.timeoutHandle);
    }

    // Remove from pending map
    this.pendingAckMap.delete(entryKey);

    // Invoke ack callback for telemetry
    await this.onAck(subscriberId, sequenceId);
  }

  /**
   * Handle timeout for pending ack with one retransmit maximum
   */
  private async handleAckTimeout(entryKey: string): Promise<void> {
    const entry = this.pendingAckMap.get(entryKey);
    if (!entry) {
      return;
    }

    // Check if we can retransmit
    if (entry.retransmitAttempts < this.config.deltaRetransmitMaxAttempts) {
      entry.retransmitAttempts++;
      const retransmitPayload: RealtimeDeltaPayload = {
        ...entry.deltaPayload,
        retransmitAttempt: entry.retransmitAttempts
      };

      // Invoke retransmit callback
      await this.onRetransmit(retransmitPayload);

      // Schedule another timeout for the retransmit
      if (entry.timeoutHandle) {
        clearTimeout(entry.timeoutHandle);
      }
      entry.timeoutHandle = setTimeout(() => {
        this.handleAckTimeout(entryKey);
      }, this.config.deltaAckTimeoutMs);
    } else {
      // Max retransmits reached, mark entry for cleanup
      this.pendingAckMap.delete(entryKey);
    }
  }

  /**
   * Check if subscriber can receive more messages within the outbound cap
   */
  private canSendToSubscriber(subscriberId: string): boolean {
    const stats = this.subscriberStats.get(subscriberId);
    if (!stats) {
      return true; // New subscriber, always allow first message
    }

    return stats.outboundCount < this.config.deltaOutboundCapPerConnection;
  }

  /**
   * Record an outbound send for the subscriber
   */
  private recordOutboundSend(subscriberId: string): void {
    let stats = this.subscriberStats.get(subscriberId);
    if (!stats) {
      stats = {
        outboundCount: 1,
        windowResetAt: new Date()
      };
      this.subscriberStats.set(subscriberId, stats);
    } else {
      stats.outboundCount++;
    }
  }

  /**
   * Register a subscriber for tracking
   */
  registerSubscriber(subscriberId: string): void {
    // Initialize stats if not present
    if (!this.subscriberStats.has(subscriberId)) {
      this.subscriberStats.set(subscriberId, {
        outboundCount: 0,
        windowResetAt: new Date()
      });
    }
  }

  /**
   * Unregister a subscriber and clean up pending acks
   */
  unregisterSubscriber(subscriberId: string): void {
    // Clear all pending acks for this subscriber
    const keysToRemove: string[] = [];
    for (const [key, entry] of this.pendingAckMap.entries()) {
      if (entry.subscriberId === subscriberId) {
        if (entry.timeoutHandle) {
          clearTimeout(entry.timeoutHandle);
        }
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.pendingAckMap.delete(key);
    }

    // Remove subscriber stats
    this.subscriberStats.delete(subscriberId);
  }

  /**
   * Make a composite key for pending ack tracking
   */
  private makePendingAckKey(subscriberId: string, sequenceId: string): string {
    return `${subscriberId}:${sequenceId}`;
  }

  /**
   * Start periodic cleanup of expired pending acks
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredPendingAcks();
    }, 5000); // Run cleanup every 5 seconds
  }

  /**
   * Clean up expired pending ack entries
   */
  private cleanupExpiredPendingAcks(): void {
    const now = new Date();
    const keysToRemove: string[] = [];

    for (const [key, entry] of this.pendingAckMap.entries()) {
      if (now > entry.expiresAt) {
        if (entry.timeoutHandle) {
          clearTimeout(entry.timeoutHandle);
        }
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.pendingAckMap.delete(key);
    }
  }

  /**
   * Destroy the coordinator and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear all pending timeouts
    for (const [, entry] of this.pendingAckMap.entries()) {
      if (entry.timeoutHandle) {
        clearTimeout(entry.timeoutHandle);
      }
    }

    this.pendingAckMap.clear();
    this.subscriberStats.clear();
  }
}
