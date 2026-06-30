export type CheckpointLifecycleState =
  | "active"
  | "stale_within_grace"
  | "archived"
  | "missing_checkpoint";

export type ReconnectFailureReason =
  | "invalid_signature"
  | "token_expired"
  | "token_replay_detected"
  | "checkpoint_not_found"
  | "checkpoint_archived"
  | "grace_period_expired"
  | "stale_token"
  | "subject_mismatch"
  | "room_mismatch";

export type SessionJoinTransitionResult = {
  checkpointId: string;
  sessionId: string;
  state: CheckpointLifecycleState;
  lastConfirmedVersion: number;
  wasCreated: boolean;
  wasRestored: boolean;
};

export type ReconnectReplayDelta = {
  cellX: number;
  cellY: number;
  version: number;
  operation: string;
  offsetX: number | null;
  offsetY: number | null;
  shape: string | null;
  color: string | null;
  stylePayload: unknown | null;
  ownerId: string | null;
};

export type ReconnectReplayResult = {
  ok: true;
  checkpointId: string;
  sessionId: string;
  roomId: string;
  regionId: string;
  sinceVersion: number;
  currentVersion: number;
  deltaCount: number;
  deltas: ReconnectReplayDelta[];
  serverChecksum: string;
  checksumScope: "full_region_canonical";
};

export type ReconnectFailureResult = {
  ok: false;
  reason: ReconnectFailureReason;
};

export type ReconnectResolution = ReconnectReplayResult | ReconnectFailureResult;

export type PlacementConflictWinner = {
  ownerId: string;
  tileId: number;
  resolvedAt: string;
};

export type PlacementOutcomeReplay = {
  kind: "replay";
  originalOutcome: "applied" | "occupied";
};

export type PlacementOutcomeMismatch = {
  kind: "mismatch";
  conflictCode: "placement_command_payload_mismatch";
};

export type PlacementOutcomeDeterministicConflict = {
  kind: "deterministic_conflict";
  conflictCode: "placement_conflict_idempotent";
  winner: PlacementConflictWinner;
};

export type PlacementOutcomeApplied = {
  kind: "applied";
};

export type PlacementDeterministicOutcome =
  | PlacementOutcomeApplied
  | PlacementOutcomeReplay
  | PlacementOutcomeMismatch
  | PlacementOutcomeDeterministicConflict;
