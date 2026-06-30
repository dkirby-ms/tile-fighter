import { TelemetrySink } from "../telemetry/telemetry-sink.js";
import { SessionCheckpointService } from "./session-checkpoint.service.js";

export type SessionLifecycleServiceOptions = {
  heartbeatTtlSeconds: number;
  cleanupIntervalSeconds: number;
  telemetrySink: TelemetrySink;
  checkpointService?: SessionCheckpointService;
  now?: () => number;
};

type PresenceMetadata = {
  tenantScopedSubject: string;
  roomId: string;
  lastHeartbeatAtMs: number;
  lastTransportEventAtMs: number;
};

export class SessionLifecycleService {
  private readonly heartbeatTtlMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly telemetrySink: TelemetrySink;
  private readonly checkpointService: SessionCheckpointService | undefined;
  private readonly now: () => number;
  private readonly presenceBySubject = new Map<string, PresenceMetadata>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: SessionLifecycleServiceOptions) {
    this.heartbeatTtlMs = options.heartbeatTtlSeconds * 1000;
    this.cleanupIntervalMs = options.cleanupIntervalSeconds * 1000;
    this.telemetrySink = options.telemetrySink;
    this.checkpointService = options.checkpointService;
    this.now = options.now ?? (() => Date.now());
  }

  start(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      void this.cleanupStaleMetadata();
      if (this.checkpointService) {
        void this.checkpointService.archiveExpiredStaleCheckpoints();
      }
    }, this.cleanupIntervalMs);
  }

  stop(): void {
    if (!this.cleanupTimer) {
      return;
    }

    clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async noteRoomJoin(tenantScopedSubject: string, roomId: string): Promise<void> {
    const nowMs = this.now();
    this.presenceBySubject.set(tenantScopedSubject, {
      tenantScopedSubject,
      roomId,
      lastHeartbeatAtMs: nowMs,
      lastTransportEventAtMs: nowMs
    });

    if (this.checkpointService) {
      const checkpoint = await this.checkpointService.noteJoin(tenantScopedSubject, roomId);
      await this.telemetrySink.emit("room_joined", {
        tenantScopedSubject,
        roomId,
        sessionId: checkpoint.sessionId,
        isFirstJoin: checkpoint.wasCreated,
        checkpointId: checkpoint.checkpointId
      });
    }

    void this.telemetrySink.emit("session_heartbeat", {
      tenantScopedSubject,
      roomId
    });
  }

  async noteRoomLeave(tenantScopedSubject: string, roomId: string): Promise<void> {
    const presence = this.presenceBySubject.get(tenantScopedSubject);

    if (presence && presence.roomId === roomId) {
      this.presenceBySubject.delete(tenantScopedSubject);
    }

    if (this.checkpointService) {
      await this.checkpointService.noteLeave(tenantScopedSubject, roomId);
    }

    void this.telemetrySink.emit("session_ended", {
      tenantScopedSubject,
      roomId
    });
  }

  noteHeartbeat(tenantScopedSubject: string, roomId: string): void {
    const nowMs = this.now();
    const existing = this.presenceBySubject.get(tenantScopedSubject);

    this.presenceBySubject.set(tenantScopedSubject, {
      tenantScopedSubject,
      roomId,
      lastHeartbeatAtMs: nowMs,
      lastTransportEventAtMs: existing?.lastTransportEventAtMs ?? nowMs
    });

    void this.telemetrySink.emit("session_heartbeat", {
      tenantScopedSubject,
      roomId
    });
  }

  getPresence(tenantScopedSubject: string): PresenceMetadata | undefined {
    return this.presenceBySubject.get(tenantScopedSubject);
  }

  isRegionMember(tenantScopedSubject: string, regionId: string): boolean {
    const presence = this.presenceBySubject.get(tenantScopedSubject);
    if (!presence) {
      return false;
    }

    return presence.roomId === regionId;
  }

  getPresenceCount(): number {
    return this.presenceBySubject.size;
  }

  async cleanupStaleMetadata(): Promise<void> {
    const nowMs = this.now();

    for (const [subject, presence] of this.presenceBySubject.entries()) {
      const ageMs = nowMs - presence.lastHeartbeatAtMs;

      if (ageMs <= this.heartbeatTtlMs) {
        continue;
      }

      this.presenceBySubject.delete(subject);
      await this.telemetrySink.emit("presence_cleared", {
        tenantScopedSubject: subject,
        roomId: presence.roomId,
        staleAfterSeconds: Math.floor(ageMs / 1000)
      });
    }
  }
}