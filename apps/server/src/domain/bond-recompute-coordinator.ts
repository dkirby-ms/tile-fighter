type BondType = "glow-chain" | "blend-gradient" | "pulse-rhythm";

export type BondRecomputeConfig = {
  maxPendingItems: number;
  maxDrainBatchSize: number;
  maxQueueWaitMs: number;
};

export type BondRecomputeInput = {
  regionId: string;
  cellX: number;
  cellY: number;
  color: string;
};

type BondRecomputeItem = BondRecomputeInput & {
  enqueuedAtMs: number;
};

type BondRecomputeResult = {
  fingerprint: string;
  bondType: BondType | null;
};

export type BondRecomputeSkipReason = "unchanged_fingerprint" | "queue_full";

export type BondRecomputeStartedEvent = {
  regionId: string;
  cellX: number;
  cellY: number;
  queueDepth: number;
  queueLagMs: number;
};

export type BondRecomputeCompletedEvent = BondRecomputeStartedEvent & {
  bondType: BondType | null;
  emittedBondEvent: boolean;
};

export type BondRecomputeSkippedEvent = BondRecomputeStartedEvent & {
  reason: BondRecomputeSkipReason;
};

export type BondRecomputeTelemetryHooks = {
  onStarted?: (event: BondRecomputeStartedEvent) => Promise<void>;
  onCompleted?: (event: BondRecomputeCompletedEvent) => Promise<void>;
  onSkipped?: (event: BondRecomputeSkippedEvent) => Promise<void>;
};

export class BondRecomputeCoordinator {
  private readonly pendingByKey = new Map<string, BondRecomputeItem>();
  private readonly pendingKeyOrder: string[] = [];
  private readonly lastEmittedFingerprintByKey = new Map<string, string>();
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  private isDraining = false;

  constructor(
    private readonly config: BondRecomputeConfig,
    private readonly recompute: (item: BondRecomputeItem) => Promise<BondRecomputeResult>,
    private readonly emitBondingTriggered: (item: BondRecomputeItem, bondType: BondType) => Promise<void>,
    private readonly telemetryHooks: BondRecomputeTelemetryHooks = {}
  ) {}

  enqueue(input: BondRecomputeInput): { accepted: boolean; coalesced: boolean; reason?: BondRecomputeSkipReason } {
    const key = this.makeKey(input);
    const existing = this.pendingByKey.get(key);

    if (existing) {
      this.pendingByKey.set(key, {
        ...input,
        enqueuedAtMs: existing.enqueuedAtMs
      });
      return {
        accepted: true,
        coalesced: true
      };
    }

    if (this.pendingByKey.size >= this.config.maxPendingItems) {
      void this.telemetryHooks.onSkipped?.({
        regionId: input.regionId,
        cellX: input.cellX,
        cellY: input.cellY,
        queueDepth: this.pendingByKey.size,
        queueLagMs: 0,
        reason: "queue_full"
      });
      return {
        accepted: false,
        coalesced: false,
        reason: "queue_full"
      };
    }

    this.pendingByKey.set(key, {
      ...input,
      enqueuedAtMs: Date.now()
    });
    this.pendingKeyOrder.push(key);

    if (this.pendingByKey.size >= this.config.maxDrainBatchSize) {
      this.scheduleDrain(0);
    } else {
      this.scheduleDrain(this.config.maxQueueWaitMs);
    }

    return {
      accepted: true,
      coalesced: false
    };
  }

  destroy(): void {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }

    this.pendingByKey.clear();
    this.pendingKeyOrder.length = 0;
    this.lastEmittedFingerprintByKey.clear();
    this.isDraining = false;
  }

  getPendingCount(): number {
    return this.pendingByKey.size;
  }

  private scheduleDrain(waitMs: number): void {
    if (this.isDraining || this.drainTimer) {
      return;
    }

    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      void this.drainOnce();
    }, Math.max(0, waitMs));
  }

  private async drainOnce(): Promise<void> {
    if (this.isDraining) {
      return;
    }

    this.isDraining = true;

    try {
      let processed = 0;

      while (processed < this.config.maxDrainBatchSize) {
        const nextKey = this.pendingKeyOrder.shift();
        if (!nextKey) {
          break;
        }

        const item = this.pendingByKey.get(nextKey);
        if (!item) {
          continue;
        }

        this.pendingByKey.delete(nextKey);
        processed += 1;

        const queueLagMs = Math.max(0, Date.now() - item.enqueuedAtMs);
        const queueDepth = this.pendingByKey.size;
        await this.telemetryHooks.onStarted?.({
          regionId: item.regionId,
          cellX: item.cellX,
          cellY: item.cellY,
          queueDepth,
          queueLagMs
        });

        const result = await this.recompute(item);
        const lastFingerprint = this.lastEmittedFingerprintByKey.get(nextKey);

        if (lastFingerprint === result.fingerprint) {
          await this.telemetryHooks.onSkipped?.({
            regionId: item.regionId,
            cellX: item.cellX,
            cellY: item.cellY,
            queueDepth,
            queueLagMs,
            reason: "unchanged_fingerprint"
          });
          continue;
        }

        this.lastEmittedFingerprintByKey.set(nextKey, result.fingerprint);

        let emittedBondEvent = false;

        if (result.bondType) {
          await this.emitBondingTriggered(item, result.bondType);
          emittedBondEvent = true;
        }

        await this.telemetryHooks.onCompleted?.({
          regionId: item.regionId,
          cellX: item.cellX,
          cellY: item.cellY,
          queueDepth,
          queueLagMs,
          bondType: result.bondType,
          emittedBondEvent
        });
      }
    } finally {
      this.isDraining = false;

      if (this.pendingByKey.size > 0) {
        this.scheduleDrain(0);
      }
    }
  }

  private makeKey(input: BondRecomputeInput): string {
    return `${input.regionId}:${input.cellX}:${input.cellY}`;
  }
}