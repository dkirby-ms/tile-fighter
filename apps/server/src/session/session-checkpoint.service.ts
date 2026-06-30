import crypto from "node:crypto";
import { Kysely } from "kysely";
import { computeRegionHash } from "../domain/region-hash.js";
import { RegionDiffService } from "../domain/region-diff.service.js";
import { ITileRepository } from "../persistence/tile.repository.js";
import { ServerDatabase } from "../persistence/db.js";
import {
  createSessionCheckpointRepository,
  ISessionCheckpointRepository
} from "../persistence/session-checkpoint.repository.js";
import { TelemetrySink } from "../telemetry/telemetry-sink.js";
import {
  ReconnectFailureResult,
  ReconnectReplayResult,
  SessionJoinTransitionResult
} from "./session-lifecycle.types.js";
import {
  ReconnectTokenError,
  ReconnectTokenPayload,
  ReconnectTokenService
} from "../auth/reconnect-token.service.js";
import { createRegionDiffRepository } from "../persistence/region-diff.repository.js";

export type SessionCheckpointServiceOptions = {
  db: Kysely<ServerDatabase>;
  telemetrySink: TelemetrySink;
  regionDiffService: RegionDiffService;
  tileRepository: ITileRepository;
  reconnectTokenService: ReconnectTokenService;
  checkpointRepository?: ISessionCheckpointRepository;
  gracePeriodSeconds: number;
  now?: () => number;
};

export class SessionCheckpointService {
  private readonly db: Kysely<ServerDatabase>;
  private readonly telemetrySink: TelemetrySink;
  private readonly regionDiffService: RegionDiffService;
  private readonly tileRepository: ITileRepository;
  private readonly reconnectTokenService: ReconnectTokenService;
  private readonly checkpointRepository: ISessionCheckpointRepository;
  private readonly gracePeriodMs: number;
  private readonly now: () => number;
  private readonly retentionRepository = createRegionDiffRepository();

  constructor(options: SessionCheckpointServiceOptions) {
    this.db = options.db;
    this.telemetrySink = options.telemetrySink;
    this.regionDiffService = options.regionDiffService;
    this.tileRepository = options.tileRepository;
    this.reconnectTokenService = options.reconnectTokenService;
    this.checkpointRepository = options.checkpointRepository ?? createSessionCheckpointRepository();
    this.gracePeriodMs = options.gracePeriodSeconds * 1000;
    this.now = options.now ?? (() => Date.now());
  }

  async noteJoin(playerIdentity: string, roomId: string): Promise<SessionJoinTransitionResult> {
    const existing = await this.checkpointRepository.getActiveCheckpointByPlayerRegion(
      this.db,
      playerIdentity,
      roomId
    );

    if (!existing) {
      const created = await this.checkpointRepository.createCheckpoint(this.db, {
        playerIdentity,
        regionId: roomId,
        roomId,
        sessionId: crypto.randomUUID(),
        lastConfirmedVersion: 0
      });

      return {
        checkpointId: created.checkpoint_id,
        sessionId: created.session_id,
        state: "active",
        lastConfirmedVersion: Number(created.last_confirmed_version),
        wasCreated: true,
        wasRestored: false
      };
    }

    if (existing.archived_at) {
      return {
        checkpointId: existing.checkpoint_id,
        sessionId: existing.session_id,
        state: "archived",
        lastConfirmedVersion: Number(existing.last_confirmed_version),
        wasCreated: false,
        wasRestored: false
      };
    }

    if (!existing.stale) {
      return {
        checkpointId: existing.checkpoint_id,
        sessionId: existing.session_id,
        state: "active",
        lastConfirmedVersion: Number(existing.last_confirmed_version),
        wasCreated: false,
        wasRestored: false
      };
    }

    const nowDate = new Date(this.now());
    if (existing.grace_expires_at && existing.grace_expires_at <= nowDate) {
      await this.checkpointRepository.archiveCheckpoint(this.db, {
        checkpointId: existing.checkpoint_id,
        archivedAt: nowDate
      });

      await this.telemetrySink.emit("session_checkpoint_archived", {
        checkpointId: existing.checkpoint_id,
        sessionId: existing.session_id,
        playerId: existing.player_identity,
        reasonClass: "grace_period_expired"
      });

      return {
        checkpointId: existing.checkpoint_id,
        sessionId: existing.session_id,
        state: "archived",
        lastConfirmedVersion: Number(existing.last_confirmed_version),
        wasCreated: false,
        wasRestored: false
      };
    }

    const restored = await this.checkpointRepository.restoreCheckpoint(this.db, {
      checkpointId: existing.checkpoint_id,
      updatedAt: nowDate
    });

    if (!restored) {
      return {
        checkpointId: existing.checkpoint_id,
        sessionId: existing.session_id,
        state: "missing_checkpoint",
        lastConfirmedVersion: Number(existing.last_confirmed_version),
        wasCreated: false,
        wasRestored: false
      };
    }

    return {
      checkpointId: restored.checkpoint_id,
      sessionId: restored.session_id,
      state: "active",
      lastConfirmedVersion: Number(restored.last_confirmed_version),
      wasCreated: false,
      wasRestored: true
    };
  }

  async noteLeave(playerIdentity: string, roomId: string): Promise<void> {
    const checkpoint = await this.checkpointRepository.getActiveCheckpointByPlayerRegion(
      this.db,
      playerIdentity,
      roomId
    );

    if (!checkpoint || checkpoint.archived_at) {
      return;
    }

    const staleSinceAt = new Date(this.now());
    const graceExpiresAt = new Date(staleSinceAt.getTime() + this.gracePeriodMs);

    await this.checkpointRepository.markCheckpointStale(this.db, {
      checkpointId: checkpoint.checkpoint_id,
      staleSinceAt,
      graceExpiresAt
    });
  }

  async archiveExpiredStaleCheckpoints(): Promise<number> {
    const nowDate = new Date(this.now());
    const archivedCount = await this.checkpointRepository.archiveExpiredStaleCheckpoints(this.db, nowDate);

    const minimumProtectedVersion = await this.checkpointRepository.getMinimumProtectedVersion(this.db, "arena");
    const cleanupStart = this.now();
    const deletedDeltaCount = await this.retentionRepository.deleteExpiredTileDeltas(this.db, {
      regionId: "arena",
      expiresBefore: nowDate,
      minimumProtectedVersion
    });
    await this.telemetrySink.emit("delta_retention_cleanup_executed", {
      deletedDeltaCount,
      retainedDeltaCount: 0,
      earliestRetainedVersion: minimumProtectedVersion ?? -1,
      cleanupDurationMs: Math.max(0, this.now() - cleanupStart),
      checkpointCountActive: 0,
      checkpointCountStale: 0
    });

    if (archivedCount > 0) {
      await this.telemetrySink.emit("session_checkpoint_archived", {
        checkpointId: "bulk",
        sessionId: "bulk",
        playerId: "bulk",
        reasonClass: "grace_period_expired",
        archivedCount
      });
    }

    return archivedCount;
  }

  issueReconnectTokenForSubject(playerIdentity: string, roomId: string): Promise<string | null> {
    return this.getReconnectTokenForSubject(playerIdentity, roomId);
  }

  async resolveReconnect(
    reconnectToken: string,
    playerIdentity: string,
    roomId: string
  ): Promise<ReconnectReplayResult | ReconnectFailureResult> {
    const verifiedPayload = this.verifyReconnectToken(reconnectToken);
    if (!verifiedPayload.ok) {
      return verifiedPayload;
    }

    const payload = verifiedPayload.payload;
    if (payload.playerIdentity !== playerIdentity) {
      return {
        ok: false,
        reason: "subject_mismatch"
      };
    }

    if (payload.roomId !== roomId || payload.regionId !== roomId) {
      return {
        ok: false,
        reason: "room_mismatch"
      };
    }

    const checkpoint = await this.checkpointRepository.getCheckpointBySessionId(this.db, payload.sessionId);

    if (!checkpoint) {
      return {
        ok: false,
        reason: "checkpoint_not_found"
      };
    }

    if (checkpoint.archived_at) {
      return {
        ok: false,
        reason: "checkpoint_archived"
      };
    }

    const nowDate = new Date(this.now());
    if (checkpoint.grace_expires_at && checkpoint.grace_expires_at <= nowDate) {
      await this.checkpointRepository.archiveCheckpoint(this.db, {
        checkpointId: checkpoint.checkpoint_id,
        archivedAt: nowDate
      });

      await this.telemetrySink.emit("room_rejoin_failed", {
        tenantScopedSubject: playerIdentity,
        roomId,
        sessionId: checkpoint.session_id,
        reason: "grace_period_expired"
      });

      await this.telemetrySink.emit("session_checkpoint_archived", {
        checkpointId: checkpoint.checkpoint_id,
        sessionId: checkpoint.session_id,
        playerId: checkpoint.player_identity,
        reasonClass: "grace_period_expired"
      });

      return {
        ok: false,
        reason: "grace_period_expired"
      };
    }

    const sinceVersion = Number(checkpoint.last_confirmed_version);
    const replay = await this.regionDiffService.getReplayDiff({
      regionId: checkpoint.region_id,
      sinceVersion
    });

    await this.telemetrySink.emit("reconnect_delta_replay_started", {
      sessionId: checkpoint.session_id,
      regionId: checkpoint.region_id,
      startVersion: sinceVersion + 1,
      endVersion: replay.currentVersion,
      deltaCount: replay.tiles.length
    });

    const fullRegionTiles = await this.tileRepository.selectTilesByRegion(this.db, checkpoint.region_id);
    const serverChecksum = computeRegionHash(
      fullRegionTiles.map((tile) => ({
        regionId: tile.region_id,
        cellX: tile.cell_x,
        cellY: tile.cell_y,
        offsetX: tile.offset_x,
        offsetY: tile.offset_y,
        shape: tile.shape,
        color: tile.color,
        stylePayload: tile.style_payload,
        ownerId: tile.owner_id
      }))
    );

    await this.checkpointRepository.restoreCheckpoint(this.db, {
      checkpointId: checkpoint.checkpoint_id,
      updatedAt: nowDate
    });

    await this.checkpointRepository.updateCheckpointProgress(this.db, {
      checkpointId: checkpoint.checkpoint_id,
      lastConfirmedVersion: replay.currentVersion,
      serverChecksum,
      updatedAt: nowDate
    });

    await this.telemetrySink.emit("reconnect_delta_replay_completed", {
      sessionId: checkpoint.session_id,
      regionId: checkpoint.region_id,
      durationMs: 0,
      finalChecksum: serverChecksum,
      success: true
    });

    await this.telemetrySink.emit("room_rejoined", {
      tenantScopedSubject: playerIdentity,
      roomId,
      sessionId: checkpoint.session_id,
      reconnectLatencyMs: 0,
      deltaCount: replay.tiles.length,
      checksumMatch: true
    });

    return {
      ok: true,
      checkpointId: checkpoint.checkpoint_id,
      sessionId: checkpoint.session_id,
      roomId: checkpoint.room_id,
      regionId: checkpoint.region_id,
      sinceVersion,
      currentVersion: replay.currentVersion,
      deltaCount: replay.tiles.length,
      deltas: replay.tiles,
      serverChecksum,
      checksumScope: "full_region_canonical"
    };
  }

  private async getReconnectTokenForSubject(playerIdentity: string, roomId: string): Promise<string | null> {
    const checkpoint = await this.checkpointRepository.getActiveCheckpointByPlayerRegion(
      this.db,
      playerIdentity,
      roomId
    );

    if (!checkpoint || checkpoint.archived_at) {
      return null;
    }

    return this.reconnectTokenService.issue({
      checkpointId: checkpoint.checkpoint_id,
      sessionId: checkpoint.session_id,
      playerIdentity,
      roomId,
      regionId: checkpoint.region_id,
      lastConfirmedVersion: Number(checkpoint.last_confirmed_version)
    });
  }

  private verifyReconnectToken(
    reconnectToken: string
  ):
    | { ok: true; payload: ReconnectTokenPayload }
    | { ok: false; reason: ReconnectFailureResult["reason"] } {
    try {
      return { ok: true, payload: this.reconnectTokenService.verify(reconnectToken) };
    } catch (error) {
      if (error instanceof ReconnectTokenError) {
        return {
          ok: false,
          reason: error.reason
        };
      }

      return {
        ok: false,
        reason: "invalid_signature"
      };
    }
  }
}
