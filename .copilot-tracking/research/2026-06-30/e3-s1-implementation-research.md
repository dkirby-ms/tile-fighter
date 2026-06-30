<!-- markdownlint-disable-file -->
# E3-S1 Story Implementation Research: Reliable Room Join and Rejoin

**Date:** 2026-06-30  
**Stakeholders:** Product, Engineering  
**Scope:** Story E3-S1 (#17) acceptance criteria breakdown, current implementation gaps, technical requirements, test strategy, and dependency analysis  
**Confidence Level:** High (research completed with full codebase review)

---

## Executive Summary

**Story:** As a player, I can join and rejoin a room without desync after network interruptions.

**Current State:** ❌ **NOT IMPLEMENTED** – Codebase has foundational join flow but lacks rejoin recovery, session checkpoints, delta retention SLA, and checksum validation.

**Critical Gaps (blocking E3-S1):**
1. ❌ No session checkpoint persistence (player ID, region, last confirmed version)
2. ❌ No delta retention SLA/TTL policy (deltas aged out regardless of session state)
3. ❌ No rejoin recovery path (stale sessions treated as new joins)
4. ❌ No client-side checksum validation on replay
5. ❌ No reconnect grace period (session cleanup immediate on disconnect)

**Implementation Effort:** 2–3 weeks (single engineer)

**Harness Mapping:** Points 2 (deterministic sequence IDs), 6 (smoke tests for join/rejoin), 7 (reconnect SLA tracking in CI/CD)

---

## Story Acceptance Criteria Breakdown

### AC1: First Join – Region State Initializes

**Requirement:** When a player joins for the first time, the server initializes their current region state correctly.

**Acceptance Test:**
```
Given: Player has valid auth token and join token
When: Player calls room.join(joinToken)
Then:
  - Colyseus room emits state patch with arena sim state
  - Client polls /api/region-diff with sinceVersion=0
  - Client receives all tiles in viewport (compacted to latest per coordinate)
  - Client verifies region hash matches server
  Status: ✅ Partially implemented
```

**Current Implementation:**
- ✅ `ArenaRoom.onAuth()` validates join token via `authService.verifyJoinToken()`
- ✅ `ArenaRoom.onJoin()` calls `lifecycleService.noteRoomJoin()` to track presence
- ✅ Combat sim broadcasts via Colyseus state patches (arena combat only)
- ✅ Client polls `/api/region-diff` with viewport bounds
- ✅ `RegionDiffService.getRegionDiff()` returns tiles compacted by coordinate (latest-wins semantics)
- ❌ **No initial checkpoint created** – no session identity persisted for reconnect
- ❌ **No checksum validation** – client never verifies region hash matches server

**Technical Details:**
- Join token minting: `JoinTokenService.issue()` creates HMAC-SHA256 signed payload with 120s TTL
- Token verification: `ArenaRoom.onAuth()` calls `authService.verifyJoinToken()` which calls `JoinTokenService.verify()`
- Replay detection: `JoinTokenService` maintains in-memory consumed JTI set (pruned on expiry)
- Region diff: `RegionDiffRepository.getTileDeltasSince()` queries deltas ordered by (version ASC, id ASC)
- Viewport filtering: Both SQL query and compaction logic filter by (cell_x, cell_y) bounds
- Deletion semantics: Deltas with operation='delete' are filtered out (implicit delete)

**Requirements for AC1:**
1. ✅ Join token signed with player identity + room scope
2. ✅ Token replay detection (consumed JTI tracking)
3. ⚠️ Initial checkpoint should capture:
   - `playerIdentity` (tenantScopedSubject)
   - `regionId`
   - `lastConfirmedVersion` = 0 (initial join)
   - `clientChecksum` = empty (will be updated on first sync)
4. ⚠️ Client needs checksum validation logic on replay

---

### AC2: Transient Disconnect + Reconnect – Session Resumes

**Requirement:** When a player disconnects briefly (network hiccup) and reconnects within a grace period, the session resumes with the same player identity.

**Acceptance Test:**
```
Given: Active session with lastHeartbeat < grace_period (5 min default)
When: Client reconnects with same session identity
Then:
  - Server recognizes player as existing session (not new join)
  - Player retains room membership and presence state
  - Session grace period resets
  Status: ❌ NOT IMPLEMENTED
```

**Current Implementation:**
- ✅ `SessionLifecycleService` tracks presence by `tenantScopedSubject` with heartbeat TTL
- ✅ `noteHeartbeat()` updates `lastHeartbeatAtMs` timestamp
- ✅ `cleanupStaleMetadata()` removes presence after heartbeat timeout
- ❌ **No checkpoint persistence** – presence exists only in memory (lost on server restart)
- ❌ **No reconnect identity recovery** – on disconnect, player treated as new session on rejoin
- ❌ **No grace period** – immediate cleanup after timeout; no stale session state

**Technical Details:**
- Session tracking: `SessionLifecycleService` maintains in-memory `Map<tenantScopedSubject, PresenceMetadata>`
- Presence metadata: `{ tenantScopedSubject, roomId, lastHeartbeatAtMs, lastTransportEventAtMs }`
- Cleanup interval: Default 5s, marks sessions stale after heartbeat TTL (default 30s)
- Heartbeat endpoint: `POST /api/session/heartbeat` with auth bearer token
- Rate limiting: 30 requests per 10s window per subject

**Requirements for AC2:**
1. ⚠️ Checkpoint persistence:
   - Store checkpoint in database (new table: `session_checkpoints`)
   - Schema: `playerIdentity, regionId, createdAt, lastConfirmedVersion, clientChecksum, sessionId (UUID)`
2. ⚠️ Reconnect grace period:
   - On disconnect detected: mark checkpoint as `stale=true` with `staleSinceAtMs`
   - On reconnect: if `now - staleSinceAtMs < GRACE_PERIOD` (5 min default), restore checkpoint
   - On grace expiry: checkpoint moved to `archived` (for audit) or deleted
3. ⚠️ Reconnect flow:
   - Client detects disconnect (socket event or heartbeat timeout)
   - Client holds session identity in local storage temporarily
   - On reconnect: client sends `reconnectToken` (opaque reference to checkpoint) to server
   - Server validates token, restores checkpoint, streams delta replay
4. ⚠️ Duplicate detection:
   - If multiple reconnect attempts arrive, idempotency key prevents replay

---

### AC3: Rejoin Replay – Checksum Matches After Replay

**Requirement:** When a player rejoins after disconnecting outside the grace period, the server replays deltas from the last confirmed checkpoint version, and the client validates that its reconstructed state matches the server's checksum.

**Acceptance Test:**
```
Given: Stale session (grace period expired) with lastConfirmedVersion=5
When: Client rejoins and receives deltas from version 6..currentVersion
Then:
  - Client applies each delta in order
  - Client computes regional hash after each delta
  - Final client hash matches server snapshot hash
  - Client emits room_rejoin_succeeded
  Status: ❌ NOT IMPLEMENTED (no replay, no checksum)
```

**Current Implementation:**
- ✅ `RegionSnapshotService` supports snapshot creation and restore
- ✅ `RegionSnapshotRepository.restoreLatest()` replays snapshot tiles to live table
- ✅ `computeRegionHash()` deterministically hashes all tiles by coordinate
- ❌ **No checkpoint-based delta replay** – rejoin doesn't know where to start replay
- ❌ **No incremental checksum validation** – no verification after replay
- ❌ **Snapshot restore is operator-only** – not available to players on rejoin

**Technical Details:**
- Snapshot creation: `RegionSnapshotService.createSnapshot()` reads all tiles, computes hash, persists to `region_snapshots` table
- Snapshot restore: `RegionSnapshotService.restoreLatest()` clears tiles and reinserts from snapshot
- Hash computation: `computeRegionHash()` sorts tiles by (cellX ASC, cellY ASC) and SHA-256 hashes JSON representation
- Delta query: `RegionDiffRepository.getTileDeltasSince(sinceVersion)` returns deltas with version > sinceVersion

**Requirements for AC3:**
1. ⚠️ Checkpoint-based delta replay:
   - On rejoin after grace expiry: query `session_checkpoints` for `lastConfirmedVersion`
   - Query `tile_deltas` for versions > lastConfirmedVersion within viewport bounds
   - Stream deltas to client in order of (version ASC, id ASC)
2. ⚠️ Client-side replay and checksum validation:
   - Client applies each delta (upsert or delete operation)
   - After each delta: compute intermediate hash (optional, for debugging)
   - After final delta: compute region hash and compare to server hash
   - If mismatch: emit `room_rejoin_failed` with reason "checksum_mismatch"
   - If match: update checkpoint to `lastConfirmedVersion = currentVersion`, mark session active
3. ⚠️ Delta retention SLA:
   - Retain deltas >= checkpoint.lastConfirmedVersion for TTL_DAYS (default 24h)
   - Cleanup policy: `DELETE FROM tile_deltas WHERE changed_at < now() - interval '24 hours'`
   - Index strategy: `(region_id, version)` to support range scans

---

## Current Codebase Implementation State

### 1. Join Token Flow (✅ Implemented)

**File:** [apps/server/src/auth/join-token.service.ts](../../apps/server/src/auth/join-token.service.ts)

**Key Components:**
- `JoinTokenService.issue(subject, roomId)` → HMAC-SHA256 signed token with 120s TTL
- `JoinTokenService.verify(token, expectedRoomId)` → validates signature, expiry, room, and replay (JTI)
- Replay detection via `consumedJoinTokenIds` map with TTL-based pruning

**Signature Format:**
```
Payload: { sub, roomId, jti, exp }
Format: base64url(payload).base64url(hmac-sha256(payload))
TTL: 120 seconds
```

**Security Properties:**
- ✅ HMAC prevents tampering
- ✅ Room scope prevents cross-room token reuse
- ✅ JTI replay detection prevents duplicate joins
- ✅ Expiry prevents stale token reuse
- ❌ No session binding (token valid for any room join within TTL)

**Test Coverage:**
- [apps/server/tests/integration/join-token.integration.test.ts](../../apps/server/tests/integration/join-token.integration.test.ts) – 3 tests covering issue, auth, unsupported room

---

### 2. Room Lifecycle (⚠️ Partial)

**File:** [apps/server/src/rooms/arena.room.ts](../../apps/server/src/rooms/arena.room.ts)

**Key Methods:**
- `onCreate(options)` – initializes room and simulation interval (100ms)
- `onAuth(client, options)` – verifies join token, extracts tenantScopedSubject
- `onJoin(client)` – calls `lifecycleService.noteRoomJoin()`, sends `joined` message
- `onLeave(client)` – calls `lifecycleService.noteRoomLeave()`, deletes presence
- Combat simulation runs every 100ms via `setSimulationInterval()`

**Current Limitations:**
- ❌ No reconnect token handling
- ❌ No checkpoint persistence
- ❌ No delta replay stream
- ❌ Combat state only (no tile state broadcast)

---

### 3. Session Lifecycle Service (⚠️ Partial)

**File:** [apps/server/src/session/session-lifecycle.service.ts](../../apps/server/src/session/session-lifecycle.service.ts)

**Responsibilities:**
- Track presence by `tenantScopedSubject` with `lastHeartbeatAtMs` timestamp
- Emit telemetry: `session_heartbeat`, `session_ended`, `presence_cleared`
- Clean up stale sessions after heartbeat TTL expiry
- Enforce heartbeat rate limit (30 per 10s window)

**Public API:**
```typescript
noteRoomJoin(tenantScopedSubject, roomId): void
noteRoomLeave(tenantScopedSubject, roomId): void
noteHeartbeat(tenantScopedSubject, roomId): void
getPresence(tenantScopedSubject): PresenceMetadata | undefined
isRegionMember(tenantScopedSubject, regionId): boolean
cleanupStaleMetadata(): Promise<void>
getPresenceCount(): number
```

**Current Limitations:**
- ❌ In-memory only (lost on restart)
- ❌ No checkpoint association
- ❌ No stale state persistence (immediate cleanup)
- ⚠️ `isRegionMember()` implementation not reviewed

**Test Coverage:**
- [apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts](../../apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts) – 3 tests covering accept, cleanup, flood throttle

---

### 4. Region Diff and Delta Storage (✅ Implemented)

**Files:**
- [apps/server/src/domain/region-diff.service.ts](../../apps/server/src/domain/region-diff.service.ts)
- [apps/server/src/persistence/region-diff.repository.ts](../../apps/server/src/persistence/region-diff.repository.ts)

**Key Responsibilities:**
- Query deltas since version with viewport filtering
- Compact deltas to latest per coordinate (delete operations filtered)
- Return ordered result (version ASC, id ASC, cellX ASC, cellY ASC)

**Schema:**
```sql
tile_deltas (
  id BIGSERIAL PRIMARY KEY,
  region_id TEXT NOT NULL,
  version BIGINT NOT NULL,
  cell_x INTEGER NOT NULL,
  cell_y INTEGER NOT NULL,
  operation TEXT NOT NULL,  -- 'upsert' or 'delete'
  offset_x DOUBLE PRECISION,
  offset_y DOUBLE PRECISION,
  shape TEXT,
  color TEXT,
  style_payload JSONB,
  owner_id TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX tile_deltas_region_version_idx ON tile_deltas(region_id, version);
CREATE INDEX tile_deltas_region_coordinate_version_idx ON tile_deltas(region_id, cell_x, cell_y, version);
```

**API:**
```typescript
async getRegionDiff(input: GetRegionDiffInput): Promise<GetRegionDiffResult>
  - regionId, sinceVersion, viewport { minCellX, maxCellX, minCellY, maxCellY }, maxTiles
  - Returns: tiles[], currentVersion, nextSinceVersion, truncated, isEmpty, durationMs

async getCurrentRegionVersion(db, regionId): Promise<number>
async getTileDeltasSince(db, input): Promise<TileDeltasSelect[]>
```

**Telemetry Emitted:**
- `tile_diff_requested` (viewportArea, sinceVersion)
- `tile_diff_returned` (viewportArea, tileCount, isEmpty, truncated, durationMs)

**Current Limitations:**
- ❌ No TTL enforcement (deltas retained indefinitely)
- ✅ Proper ordering (version primary key)
- ✅ Viewport filtering
- ❌ No checkpoint association (doesn't know which deltas are needed for rejoin)

**Test Coverage:**
- [apps/server/tests/load/region-diff-load.ts](../../apps/server/tests/load/region-diff-load.ts) – latency/payload analysis for stale/unchanged mix

---

### 5. Client Heartbeat (⚠️ Partial)

**File:** [apps/client/src/session/heartbeat-caller.ts](../../apps/client/src/session/heartbeat-caller.ts)

**Responsibilities:**
- Acquire access token from auth session state machine
- POST heartbeat request to `/api/session/heartbeat` with room ID
- Retry once on 401 (Unauthorized)
- Throw on final failure

**Current Limitations:**
- ❌ No checksum validation
- ❌ No disconnect detection (relies on heartbeat timeout)
- ❌ No reconnect token handling
- ❌ Sends heartbeat independent of region diff polling

---

### 6. Snapshot and Hash (✅ Implemented)

**Files:**
- [apps/server/src/domain/region-snapshot.service.ts](../../apps/server/src/domain/region-snapshot.service.ts)
- [apps/server/src/domain/region-hash.ts](../../apps/server/src/domain/region-hash.ts)

**Key Methods:**
- `RegionSnapshotService.createSnapshot(regionId, actorId)` – reads all tiles, computes hash, persists
- `RegionSnapshotService.restoreLatest(regionId, actorId)` – finds latest snapshot, restores tiles
- `computeRegionHash(tiles)` – SHA-256 hash of tiles sorted by (cellX, cellY)

**Schema:**
```sql
region_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  tile_count INTEGER NOT NULL,
  expected_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

region_snapshot_tiles (
  snapshot_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  cell_x INTEGER NOT NULL,
  cell_y INTEGER NOT NULL,
  ... tile fields ...
);
```

**Current Limitations:**
- ⚠️ Restore is operator-only (requires 'operator' role)
- ❌ Not accessible to players on rejoin
- ✅ Hash validation on restore

**Test Coverage:**
- [apps/server/tests/integration/region-restore-drill.smoke.test.ts](../../apps/server/tests/integration/region-restore-drill.smoke.test.ts) – restore and hash validation

---

### 7. Database Schema and Migrations (✅ Current State)

**Migration Files:**
- `1710000000000_init.js` – base tables
- `1720000000000_tiles.js` – tile and region_snapshots tables
- `1730000000000_region_snapshots.js` – region_snapshot_tiles table
- `1740000000000_region_diffs.js` – tile_deltas and region_versions tables

**Schema Status:**
- ✅ All core tables exist
- ❌ No `session_checkpoints` table (required for E3-S1)
- ❌ No TTL/retention policy on tile_deltas (required for SLA)

---

## Session Checkpoint Mechanism – Design Requirements

### Table Design

**New Table: `session_checkpoints`**

```sql
CREATE TABLE session_checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_identity TEXT NOT NULL,  -- tenantScopedSubject
  region_id TEXT NOT NULL,
  session_id UUID NOT NULL UNIQUE,  -- opaque session handle for reconnect
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_version BIGINT NOT NULL DEFAULT 0,
  client_checksum TEXT,  -- computed by client on sync
  stale BOOLEAN NOT NULL DEFAULT false,
  stale_since_at TIMESTAMPTZ,
  grace_expires_at TIMESTAMPTZ,  -- 5 min after stale_since_at
  archived_at TIMESTAMPTZ,  -- NULL if active/stale
  UNIQUE (player_identity, region_id, archived_at IS NULL)  -- one active checkpoint per player+region
);

CREATE INDEX session_checkpoints_player_region_idx 
  ON session_checkpoints(player_identity, region_id) 
  WHERE archived_at IS NULL;

CREATE INDEX session_checkpoints_grace_expires_idx 
  ON session_checkpoints(grace_expires_at) 
  WHERE stale = true AND archived_at IS NULL;
```

### Lifecycle States

```
┌─────────────┐
│   CREATED   │  Player joins for first time
└──────┬──────┘
       │ client syncs region state
       ▼
┌──────────────┐
│    ACTIVE    │  Checkpoint confirmed with lastConfirmedVersion
└──────┬───────┘
       │ network disconnect detected
       ▼
┌──────────────┐
│    STALE     │  stale=true, stale_since_at=now(), grace_expires_at=now()+5min
└──────┬───────┘
       │ (option A) reconnect within grace
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
┌──────────────┐            ┌──────────────┐
│    ACTIVE    │            │   ARCHIVED   │  grace expired
└──────────────┘            └──────────────┘
       │                              ▲
       │                              │
       └──────────────(player rejoin)─┘
                  (treat as new join)
```

### Reconnect Token Design

**Token Structure:**
```json
{
  "checkpointId": "uuid",
  "sessionId": "uuid",
  "playerId": "tenant-a|player-1",
  "regionId": "region-1",
  "lastConfirmedVersion": 42,
  "exp": 1719000000,
  "jti": "uuid"  -- replay nonce
}
```

**Format:** Base64url-encoded, HMAC-SHA256 signed (same as join token)

**TTL:** 120 seconds (matches join token)

**Issuance:** Embedded in `/api/session/heartbeat` response (optional, on demand)

---

## Delta Retention Policy and SLA Requirements

### Policy Definition

**Default Configuration:**
```
DELTA_TTL_HOURS = 24
DELTA_CLEANUP_INTERVAL = 1 hour
STALE_SESSION_GRACE_PERIOD_MINUTES = 5
CHECKPOINT_ARCHIVE_GRACE_PERIOD_DAYS = 7  -- historical audit trail
```

### Cleanup Strategy

**Aggressive Retention (preserves replay window):**
1. On disconnect, mark checkpoint as `stale` with `stale_since_at`
2. Grace period: 5 minutes (sufficient for typical reconnect attempts)
3. After grace: move checkpoint to `archived` state (not deleted; audit trail)
4. Retain deltas >= any active/stale checkpoint's `lastConfirmedVersion`
5. Expire deltas older than max(24h, max(stale_checkpoint.stale_since_at + GRACE_PERIOD))

**SQL Implementation:**
```sql
-- Identify minimum version needed for any checkpoint
SELECT MIN(last_confirmed_version) as min_needed_version
FROM session_checkpoints
WHERE archived_at IS NULL;  -- only active/stale checkpoints

-- Cleanup policy: delete deltas older than 24h 
-- AND no checkpoint needs them
DELETE FROM tile_deltas
WHERE changed_at < now() - interval '24 hours'
  AND version < (
    COALESCE(
      (SELECT MIN(last_confirmed_version) 
       FROM session_checkpoints WHERE archived_at IS NULL),
      999999  -- if no active checkpoints, safe to delete all old
    )
  );

-- Periodic archival: move stale checkpoints after grace
UPDATE session_checkpoints
SET archived_at = now()
WHERE stale = true
  AND grace_expires_at <= now()
  AND archived_at IS NULL;
```

### SLA Metrics

**Target SLA:**
- ✅ Median reconnect latency: <500ms (stretch goal <200ms)
- ✅ P95 reconnect latency: <3s
- ✅ Reconnect success rate: ≥99.5%
- ✅ Checksum match rate on replay: 100% (determinism)

**Telemetry Events:**
- `reconnect_attempt` (checkpointId, versionGap)
- `reconnect_delta_replay_started` (checkpointId, deltaCount)
- `reconnect_delta_replay_completed` (checkpointId, durationMs, checksum)
- `reconnect_checksum_mismatch` (checkpointId, expectedChecksum, actualChecksum)
- `session_checkpoint_archived` (checkpointId, gracePeriodExpired)

---

## Checksum Validation Approach

### Client-Side Replay Algorithm

```typescript
// Pseudo-code: client rejoins after disconnect

const checkpoint = await fetchCheckpoint(sessionId, reconnectToken);
const startVersion = checkpoint.lastConfirmedVersion;
const currentVersion = checkpoint.currentRegionVersion;

if (startVersion >= currentVersion) {
  // No new deltas since last checkpoint
  await emitTelemetry("reconnect_no_new_deltas");
  return { ok: true };
}

// Fetch deltas from startVersion+1 to currentVersion
const deltas = await fetchRegionDiffSince(regionId, startVersion, viewport);

// Apply deltas in order and track intermediate checksum
let tiles = new Map<string, Tile>();  // load from local cache or empty
for (const delta of deltas) {
  if (delta.operation === "upsert") {
    tiles.set(`${delta.cellX}:${delta.cellY}`, delta);
  } else if (delta.operation === "delete") {
    tiles.delete(`${delta.cellX}:${delta.cellY}`);
  }
}

// Compute final checksum
const computedChecksum = computeRegionChecksum(Array.from(tiles.values()));
const expectedChecksum = checkpoint.currentRegionChecksum;

if (computedChecksum !== expectedChecksum) {
  await emitTelemetry("reconnect_checksum_mismatch", {
    expectedChecksum,
    computedChecksum,
    deltaCount: deltas.length,
    versionGap: currentVersion - startVersion
  });
  return { ok: false, reason: "checksum_mismatch" };
}

// Success: update local checkpoint
await updateCheckpoint(checkpoint with {
  lastConfirmedVersion: currentVersion,
  clientChecksum: computedChecksum
});

return { ok: true };
```

### Server-Side Validation

**On Checkpoint Creation (first join):**
```typescript
const tiles = await fetchAllTiles(regionId, viewport);
const checksum = computeRegionChecksum(tiles);
const checkpoint = {
  playerId,
  regionId,
  sessionId: uuid(),
  lastConfirmedVersion: 0,
  currentRegionChecksum: checksum,
  createdAt: now()
};
await db.insert("session_checkpoints", checkpoint);
return { ok: true, sessionId: checkpoint.sessionId, checksum };
```

**On Checkpoint Restoration (reconnect):**
```typescript
const checkpoint = await db.query(
  "SELECT * FROM session_checkpoints WHERE session_id = ?",
  [sessionId]
);

if (!checkpoint || checkpoint.archived_at) {
  return { ok: false, reason: "checkpoint_not_found" };
}

if (now() - checkpoint.stale_since_at > GRACE_PERIOD) {
  await db.update("session_checkpoints", 
    { archived_at: now() }, 
    { session_id: sessionId }
  );
  return { ok: false, reason: "grace_period_expired" };
}

// Stream delta replay
const deltas = await fetchDeltas(regionId, checkpoint.lastConfirmedVersion, viewport);
const latestVersion = await getCurrentRegionVersion(regionId);
const checksum = computeChecksumFromDeltas(
  checkpoint.lastConfirmedVersion,
  deltas,
  latestVersion
);

// Update checkpoint
await db.update("session_checkpoints", {
  lastConfirmedVersion: latestVersion,
  stale: false,
  stale_since_at: null,
  grace_expires_at: null,
  currentRegionChecksum: checksum
}, { session_id: sessionId });

return { 
  ok: true, 
  deltas, 
  currentVersion: latestVersion, 
  checksum 
};
```

### Checksum Algorithm (Deterministic Hash)

```typescript
// Deterministic region checksum based on live tiles

function computeRegionChecksum(tiles: Tile[]): string {
  // Sort by cell coordinates (deterministic order)
  const sorted = tiles
    .sort((a, b) => {
      if (a.cellX !== b.cellX) return a.cellX - b.cellX;
      return a.cellY - b.cellY;
    });

  // Serialize to JSON (canonical form)
  const canonical = sorted.map(tile => ({
    cellX: tile.cellX,
    cellY: tile.cellY,
    offsetX: tile.offsetX,
    offsetY: tile.offsetY,
    shape: tile.shape,
    color: tile.color,
    stylePayload: tile.stylePayload,
    ownerId: tile.ownerId
  }));

  const json = JSON.stringify(canonical);
  
  // SHA-256 hash
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  return hash;
}
```

---

## Dependencies and Impact Analysis

### Dependency Chain

**Critical Path (blocks E3-S4 load test):**
```
E1-S2 (Join Token Issuance)
   ↓
E2-S4 (Region Diff Endpoint)
   ↓
E3-S1 (Join/Rejoin with Checksum)  ← YOU ARE HERE
   ↓
E3-S2 (Ordered Delta Fanout)
   ↓
E3-S4 (50 CCU Load Validation)  ← Cannot start until E3-S2 complete
```

### Inbound Dependencies

**E1-S2: Join Token Issuance (✅ COMPLETE)**
- E3-S1 requires: Valid join token for room access
- Current state: ✅ Fully implemented
- Impact: None (E3-S1 builds on top)

**E2-S4: Region Diff Endpoint (✅ COMPLETE)**
- E3-S1 requires: Deltas ordered by version, viewport filtered
- Current state: ✅ Fully implemented
- Impact: None (E3-S1 reuses existing endpoint)

### Outbound Dependencies

**E3-S2: Ordered Delta Fanout (🔄 DEPENDS ON E3-S1)**
- E3-S2 requires: Session checkpoints to route deltas to correct subscribers
- E3-S2 requires: Delta retention SLA to guarantee no missed messages
- Impact: E3-S2 cannot start until E3-S1 checkpoints + TTL are in place
- Estimated timeline: E3-S1 completes week 1–2, E3-S2 starts week 2–3 (1-week overlap acceptable)

**E3-S3: Deterministic Conflict Resolution (🔄 DEPENDS ON E2-S2)**
- E3-S3 requires: Command idempotency keys
- E3-S3 requires: Determined winner rule for concurrent placements
- Impact: Independent of E3-S1; can start in parallel
- Note: E3-S1 and E3-S3 should coordinate on sequence ID format (shared)

**E3-S4: 50 CCU Load Validation (🔄 BLOCKED UNTIL E3-S2)**
- E3-S4 requires: Working join/rejoin (E3-S1)
- E3-S4 requires: Ordered fanout (E3-S2)
- E3-S4 requires: Conflict resolution (E3-S3)
- Timeline: Cannot start until all three upstream stories complete (~8 weeks)

---

## Test Requirements

### Integration Tests

**File:** `apps/server/tests/integration/join-rejoin.integration.test.ts` (NEW)

**Test Suite 1: First Join**
```typescript
describe("E3-S1: First Join Flow", () => {
  it("accepts first join with valid token and initializes checkpoint", async () => {
    // Given: fresh session with auth token
    // When: player requests join-token and joins arena
    // Then: checkpoint created with lastConfirmedVersion=0
    //   AND checkpoint.sessionId returned to client
    //   AND presence tracked in SessionLifecycleService
    //   AND telemetry emitted: room_joined
  });

  it("client receives current region state on first join", async () => {
    // Given: region with 5 tiles
    // When: fresh client joins with viewport bounds
    // Then: client receives region-diff with 5 tiles
    //   AND tiles ordered by version (all version 0 on first join)
    //   AND client can compute initial checksum
  });

  it("rejects join token after single-use consumption", async () => {
    // Given: join token issued
    // When: same token used twice within TTL
    // Then: second attempt rejected with "join_token_replay_detected"
    //   AND telemetry: room_join_token_rejected (reason: replay)
  });

  it("rejects expired join token", async () => {
    // Given: join token issued at T0 with 120s TTL
    // When: token used at T0 + 121s
    // Then: rejected with "join_token_expired"
  });
});
```

**Test Suite 2: Transient Disconnect + Reconnect**
```typescript
describe("E3-S1: Reconnect within Grace Period", () => {
  it("marks checkpoint as stale on disconnect", async () => {
    // Given: active session with checkpoint
    // When: client disconnects (simulated via heartbeat timeout)
    // Then: checkpoint.stale = true, stale_since_at = now()
    //   AND grace_expires_at = now() + 5min
    //   AND telemetry: session_disconnected
  });

  it("restores session on reconnect within grace", async () => {
    // Given: stale checkpoint within grace period
    //   AND deltas added between disconnect and reconnect (v5..v8)
    // When: client reconnects with reconnectToken
    // Then: checkpoint restored (stale = false)
    //   AND deltas streamed from v5+1 to v8
    //   AND lastConfirmedVersion updated to v8
    //   AND telemetry: room_rejoined
  });

  it("rejects reconnect after grace expiry", async () => {
    // Given: stale checkpoint with grace_expires_at = T0 - 1s
    // When: client reconnects with old reconnectToken
    // Then: checkpoint archived
    //   AND response: "grace_period_expired"
    //   AND client must perform fresh join
    //   AND telemetry: reconnect_grace_expired
  });

  it("prevents duplicate reconnects via JTI replay detection", async () => {
    // Given: reconnect token issued with jti='abc'
    // When: same reconnectToken used twice within TTL
    // Then: second attempt rejected with "reconnect_token_replay_detected"
  });
});
```

**Test Suite 3: Rejoin Replay and Checksum**
```typescript
describe("E3-S1: Rejoin Replay and Checksum Validation", () => {
  it("streams deltas from checkpoint to client on rejoin", async () => {
    // Given: archived checkpoint with lastConfirmedVersion=5
    //   AND new deltas at v6, v7, v8 added post-disconnect
    //   AND grace period expired (checkpoint archived)
    // When: client joins as new session (fresh join flow)
    // Then: checkpoint created as new (sessionId different)
    //   AND client fetches region-diff with sinceVersion=0
    //   AND returns all tiles including v6..v8 effects
  });

  it("client validates checksum after replay", async () => {
    // Given: client received delta replay from v5+1..v8
    // When: client computes SHA-256(sorted tiles)
    // Then: checksum matches server checkpoint.currentRegionChecksum
    //   AND telemetry: reconnect_checksum_match
  });

  it("rejects replay if checksum mismatch detected", async () => {
    // Given: client computes checksum != server checksum
    //   (simulated: missing delta, or wrong version order)
    // When: client detects mismatch during replay
    // Then: emit telemetry: reconnect_checksum_mismatch
    //   AND client triggers manual refresh (full region fetch)
    //   AND does NOT update checkpoint (stays stale)
  });

  it("handles deletion semantics in replay", async () => {
    // Given: region with tile at (5,5), then deleted (operation='delete')
    // When: client replays including delete delta
    // Then: tile removed from client's state
    //   AND checksum matches server (no tile at (5,5))
  });
});
```

### Smoke Tests

**File:** `apps/server/tests/integration/join-rejoin-smoke.test.ts` (NEW)

```typescript
describe("E3-S1: Smoke Tests", () => {
  it("join/rejoin flow completes in <1s end-to-end", async () => {
    // Measures: join-token issue + join + heartbeat + reconnect
    // Target: <1s (p50)
    // Threshold: fail if >2s
  });

  it("checksum computed deterministically across replays", async () => {
    // Given: region with 10 tiles
    // When: compute checksum twice from same tile set
    // Then: checksums are identical (no randomness in hash)
  });

  it("delta retention cleanup preserves active checkpoints", async () => {
    // Given: 3 active checkpoints at different versions
    // When: cleanup job runs with TTL=24h
    // Then: all deltas >= min(active_checkpoint.lastConfirmedVersion) retained
    //   AND old deltas (< TTL and not needed) deleted
  });
});
```

### Load Tests

**File:** `apps/server/tests/load/join-rejoin-load.ts` (NEW)

```typescript
describe("E3-S1: Join/Rejoin Load Scenario", () => {
  it("handles 50 concurrent joins with <500ms p50 latency", async () => {
    // Simulates: 50 players joining simultaneously
    // Measures: join-token issue + arena join + checkpoint creation
    // Target: p50 <500ms, p95 <1s, p99 <2s
    // Success: all 50 joins succeed with unique sessionIds
  });

  it("handles 50 concurrent rejoins (simulated disconnect)", async () => {
    // Simulates: 50 active sessions, all disconnect+reconnect
    // Measures: reconnect time including delta replay (< 1MB viewport)
    // Target: p50 <500ms, p95 <3s (SLA)
    // Success: all 50 reconnects complete with checksum match
  });

  it("delta cleanup under load preserves no data loss", async () => {
    // Simulates: 50 concurrent active sessions + 30 stale sessions in grace
    // Cleanup runs while traffic is active
    // Verifies: no active/stale checkpoint's deltas are deleted
  });
});
```

---

## Security Considerations

### Reconnect Token Validation

**Threat Model:**
- ✅ Token tampering → HMAC verification
- ✅ Token replay → JTI tracking + TTL expiry
- ✅ Token forgery → signed by server secret only
- ✅ Cross-session token reuse → sessionId binding
- ✅ Stale token reuse → grace period expiry + archived checkpoint rejection

**Validation Logic (MUST IMPLEMENT):**

```typescript
// Server-side: validate reconnect token

function validateReconnectToken(token: string): ReconnectTokenPayload {
  // 1. Parse and verify signature
  const payload = verifySignature(token, SERVER_SECRET);
  
  // 2. Check expiry
  if (payload.exp <= now()) {
    throw new Error("reconnect_token_expired");
  }
  
  // 3. Check JTI replay
  if (consumedReconnectTokenJtis.has(payload.jti)) {
    throw new Error("reconnect_token_replay_detected");
    // Log security event: potential attack
  }
  
  // 4. Mark as consumed
  consumedReconnectTokenJtis.set(payload.jti, payload.exp);
  
  // 5. Fetch checkpoint from database
  const checkpoint = await db.query(
    "SELECT * FROM session_checkpoints WHERE session_id = ?",
    [payload.sessionId]
  );
  
  if (!checkpoint) {
    throw new Error("checkpoint_not_found");
  }
  
  // 6. Verify checkpoint is not archived
  if (checkpoint.archived_at !== null) {
    throw new Error("checkpoint_archived");
    // Grace period expired; client must re-join
  }
  
  // 7. Verify checkpoint is stale or active
  if (!checkpoint.stale && checkpoint.last_heartbeat_at < now() - SESSION_TIMEOUT) {
    // Checkpoint went stale but wasn't marked; mark now
    await db.update("session_checkpoints", {
      stale: true,
      stale_since_at: now()
    }, { session_id: payload.sessionId });
  }
  
  // 8. Verify grace period not expired
  if (checkpoint.grace_expires_at && checkpoint.grace_expires_at <= now()) {
    await db.update("session_checkpoints", {
      archived_at: now()
    }, { session_id: payload.sessionId });
    throw new Error("grace_period_expired");
  }
  
  return payload;
}
```

### Stale Token Rejection

**Requirements:**
- ✅ Expired tokens (past `exp`) → reject immediately with 401
- ✅ Archived checkpoints (past grace period) → reject with 410 Gone
- ✅ Replayed tokens (same JTI) → reject with 403 Forbidden + log incident
- ✅ Tampered tokens (invalid signature) → reject with 401 + log incident

**HTTP Status Codes:**
- `200 OK` – reconnect successful, delta replay started
- `400 Bad Request` – malformed token or missing sessionId
- `401 Unauthorized` – expired token or invalid signature
- `403 Forbidden` – token replayed (security incident)
- `404 Not Found` – checkpoint not found
- `410 Gone` – grace period expired, reconnect no longer valid
- `429 Too Many Requests` – reconnect rate limit exceeded

### Rate Limiting

**Requirements:**
- ✅ Reconnect attempts per sessionId: 10 per minute (prevent brute force)
- ✅ Join attempts per IP+subject: 10 per 60s (prevent session stuffing)
- ✅ Heartbeat per subject: 30 per 10s (existing, keep)
- ✅ Emit telemetry on rate limit exceeded

### Tenant Isolation

**Requirements:**
- ✅ Checkpoint queries filtered by `player_identity` (tenantScopedSubject)
- ✅ Cross-tenant session mixing impossible (unique constraint on player_identity + region)
- ✅ Tenant-scoped audit logs for archived checkpoints

---

## Telemetry Events Required

### Event Definitions

**1. room_joined**
```json
{
  "eventName": "room_joined",
  "occurredAt": "2026-06-30T10:00:00Z",
  "attributes": {
    "tenantScopedSubject": "tenant-a|player-1",
    "roomId": "arena-1",
    "sessionId": "uuid",
    "isFirstJoin": true,
    "checkpointId": "uuid"
  }
}
```

**2. room_rejoined**
```json
{
  "eventName": "room_rejoined",
  "occurredAt": "2026-06-30T10:05:00Z",
  "attributes": {
    "tenantScopedSubject": "tenant-a|player-1",
    "roomId": "arena-1",
    "sessionId": "uuid (old)",
    "newSessionId": "uuid (if full rejoin)",
    "reconnectLatencyMs": 450,
    "deltaCount": 23,
    "checksumMatch": true
  }
}
```

**3. room_rejoin_failed**
```json
{
  "eventName": "room_rejoin_failed",
  "occurredAt": "2026-06-30T10:10:00Z",
  "attributes": {
    "tenantScopedSubject": "tenant-a|player-1",
    "roomId": "arena-1",
    "sessionId": "uuid",
    "reason": "grace_period_expired|checksum_mismatch|checkpoint_not_found",
    "gracePeriodRemainingSec": -5
  }
}
```

**4. reconnect_delta_replay_started**
```json
{
  "eventName": "reconnect_delta_replay_started",
  "attributes": {
    "sessionId": "uuid",
    "regionId": "region-1",
    "startVersion": 42,
    "endVersion": 65,
    "deltaCount": 23
  }
}
```

**5. reconnect_delta_replay_completed**
```json
{
  "eventName": "reconnect_delta_replay_completed",
  "attributes": {
    "sessionId": "uuid",
    "regionId": "region-1",
    "durationMs": 245,
    "finalChecksum": "abc123...",
    "success": true
  }
}
```

**6. reconnect_checksum_mismatch**
```json
{
  "eventName": "reconnect_checksum_mismatch",
  "attributes": {
    "sessionId": "uuid",
    "regionId": "region-1",
    "expectedChecksum": "expected123...",
    "actualChecksum": "actual456...",
    "deltaCount": 23,
    "versionGap": 23
  }
}
```

**7. session_checkpoint_archived**
```json
{
  "eventName": "session_checkpoint_archived",
  "attributes": {
    "checkpointId": "uuid",
    "sessionId": "uuid",
    "playerId": "tenant-a|player-1",
    "reasonClass": "grace_period_expired|manual_cleanup",
    "activeDurationSec": 300
  }
}
```

**8. delta_retention_cleanup_executed**
```json
{
  "eventName": "delta_retention_cleanup_executed",
  "attributes": {
    "deletedDeltaCount": 1500,
    "retainedDeltaCount": 2300,
    "earliestRetainedVersion": 42,
    "cleanupDurationMs": 1200,
    "checkpointCountActive": 5,
    "checkpointCountStale": 2
  }
}
```

---

## Database Schema Changes Required

### New Tables

**1. session_checkpoints**
```sql
CREATE TABLE session_checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_identity TEXT NOT NULL,  -- tenantScopedSubject
  region_id TEXT NOT NULL,
  session_id UUID NOT NULL UNIQUE,
  room_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_version BIGINT NOT NULL DEFAULT 0,
  client_checksum TEXT,
  server_checksum TEXT,
  stale BOOLEAN NOT NULL DEFAULT false,
  stale_since_at TIMESTAMPTZ,
  grace_expires_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE (player_identity, region_id, archived_at IS NULL)
);

CREATE INDEX session_checkpoints_player_region_active_idx 
  ON session_checkpoints(player_identity, region_id) 
  WHERE archived_at IS NULL;

CREATE INDEX session_checkpoints_session_idx 
  ON session_checkpoints(session_id);

CREATE INDEX session_checkpoints_grace_expires_idx 
  ON session_checkpoints(grace_expires_at) 
  WHERE stale = true AND archived_at IS NULL;

CREATE INDEX session_checkpoints_archived_idx 
  ON session_checkpoints(archived_at) 
  WHERE archived_at IS NOT NULL;
```

### Modified Tables

**1. tile_deltas – Add TTL support**
```sql
ALTER TABLE tile_deltas ADD COLUMN IF NOT EXISTS 
  ttl_expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours');

CREATE INDEX tile_deltas_ttl_expires_idx 
  ON tile_deltas(ttl_expires_at);
```

### Migration File

**File:** `apps/server/src/persistence/migrations/1750000000000_session_checkpoints.js`

```javascript
export const up = (pgm) => {
  // Create session_checkpoints table
  pgm.createTable("session_checkpoints", {
    checkpoint_id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    player_identity: {
      type: "text",
      notNull: true
    },
    region_id: {
      type: "text",
      notNull: true
    },
    session_id: {
      type: "uuid",
      notNull: true,
      unique: true
    },
    room_id: {
      type: "text",
      notNull: true
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    last_confirmed_version: {
      type: "bigint",
      notNull: true,
      default: 0
    },
    client_checksum: {
      type: "text"
    },
    server_checksum: {
      type: "text"
    },
    stale: {
      type: "boolean",
      notNull: true,
      default: false
    },
    stale_since_at: {
      type: "timestamptz"
    },
    grace_expires_at: {
      type: "timestamptz"
    },
    archived_at: {
      type: "timestamptz"
    }
  });

  // Unique constraint: one active checkpoint per player+region
  pgm.addConstraint(
    "session_checkpoints",
    "session_checkpoints_unique_active_per_player_region",
    {
      unique: ["player_identity", "region_id"],
      where: "archived_at IS NULL"
    }
  );

  // Indexes
  pgm.createIndex("session_checkpoints", ["player_identity", "region_id"], {
    name: "session_checkpoints_player_region_active_idx",
    where: "archived_at IS NULL"
  });

  pgm.createIndex("session_checkpoints", ["session_id"], {
    name: "session_checkpoints_session_idx"
  });

  pgm.createIndex("session_checkpoints", ["grace_expires_at"], {
    name: "session_checkpoints_grace_expires_idx",
    where: "stale = true AND archived_at IS NULL"
  });

  pgm.createIndex("session_checkpoints", ["archived_at"], {
    name: "session_checkpoints_archived_idx",
    where: "archived_at IS NOT NULL"
  });

  // Add TTL to tile_deltas for retention policy
  pgm.addColumn("tile_deltas", {
    ttl_expires_at: {
      type: "timestamptz",
      default: pgm.func("(now() + interval '24 hours')")
    }
  });

  pgm.createIndex("tile_deltas", ["ttl_expires_at"], {
    name: "tile_deltas_ttl_expires_idx"
  });
};

export const down = (pgm) => {
  pgm.dropTable("session_checkpoints");
  pgm.dropColumn("tile_deltas", "ttl_expires_at");
};
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

- [ ] Create `session_checkpoints` table and migration
- [ ] Implement `SessionCheckpointService` (create, restore, archive)
- [ ] Implement `ReconnectTokenService` (sign, verify, JTI tracking)
- [ ] Add checkpoint creation on first join
- [ ] Add telemetry events (room_joined, room_rejoined, room_rejoin_failed)
- [ ] Unit tests for checkpoint/token services

### Phase 2: Reconnect Flow (Week 1–2)

- [ ] Implement disconnect detection (heartbeat timeout, socket close)
- [ ] Implement grace period tracking
- [ ] Implement checkpoint restoration on reconnect
- [ ] Add reconnect endpoint: `POST /api/session/reconnect` with reconnectToken
- [ ] Stream delta replay from checkpoint version
- [ ] Integration tests for reconnect within grace

### Phase 3: Checksum Validation (Week 2)

- [ ] Implement deterministic `computeRegionChecksum()` on server
- [ ] Implement client-side checksum validation
- [ ] Add checksum comparison on replay
- [ ] Emit telemetry for checksum match/mismatch
- [ ] Integration tests for checksum validation

### Phase 4: Delta Retention (Week 2–3)

- [ ] Implement delta TTL cleanup job
- [ ] Add cleanup logic to preserve active/stale checkpoints
- [ ] Add scheduled cleanup task (hourly)
- [ ] Implement grace period archival job
- [ ] Monitor delta table size under load

### Phase 5: Testing and Hardening (Week 3)

- [ ] Comprehensive integration test suite
- [ ] Smoke tests for join/rejoin SLA
- [ ] Load tests for 50 concurrent joins+rejoins
- [ ] Security testing (token replay, checkpoint tampering)
- [ ] Performance profiling (checksum computation, query latency)

### Phase 6: Documentation and Cutover (Week 3)

- [ ] Update E3-S1 story with implementation notes
- [ ] Document reconnect token format and validation
- [ ] Update operational runbook (delta cleanup, checkpoint monitoring)
- [ ] Deploy to staging and run smoke suite
- [ ] Cutover to production

---

## Success Criteria and Exit Checklist

### Functional Requirements

- ✅ First join initializes checkpoint with sessionId
- ✅ Transient disconnect marks checkpoint as stale (grace period 5 min)
- ✅ Reconnect within grace restores session (same sessionId)
- ✅ Delta replay streams from lastConfirmedVersion+1
- ✅ Client checksum matches server after replay
- ✅ Stale session after grace period treated as new join (archived)
- ✅ Join token replay detection prevents duplicate joins
- ✅ Reconnect token replay detection prevents duplicate reconnects
- ✅ Delta retention respects TTL policy (24h default)
- ✅ Checkpoint cleanup respects active/stale checkpoint dependencies

### Performance Requirements (SLA)

- ✅ First join latency: <500ms p50, <1s p95
- ✅ Reconnect latency: <500ms p50, <3s p95
- ✅ Checksum validation: <100ms (local compute)
- ✅ Delta cleanup: <5s hourly for 1M tiles
- ✅ Checkpoint archival: <1s for 1K expired entries

### Reliability Requirements

- ✅ Reconnect success rate: ≥99.5% (within grace period)
- ✅ Checksum match rate: 100% (determinism)
- ✅ Zero data loss on delta cleanup (respects checkpoints)
- ✅ Graceful handling of edge cases (missing deltas, old checkpoints)

### Telemetry Requirements

- ✅ room_joined event emitted on first join
- ✅ room_rejoined event emitted on successful reconnect
- ✅ room_rejoin_failed event emitted on failed reconnect
- ✅ reconnect_checksum_mismatch event emitted if validation fails
- ✅ session_checkpoint_archived event emitted on grace expiry
- ✅ delta_retention_cleanup_executed event emitted after cleanup job

### Security Checklist

- ✅ Reconnect token signed with HMAC-SHA256
- ✅ Token JTI replay detection implemented
- ✅ Token expiry enforcement (120s TTL)
- ✅ Checkpoint queries filtered by player_identity (tenant isolation)
- ✅ Stale token rejection (410 Gone after grace expiry)
- ✅ Rate limiting on reconnect attempts (10 per min per sessionId)
- ✅ Security events logged (replay attempts, invalid signatures)

### Test Coverage

- ✅ Unit: checkpoint service, token service, checksum algorithm
- ✅ Integration: join/rejoin flows, grace period, checksum validation
- ✅ Smoke: join/rejoin SLA, determinism check, cleanup safety
- ✅ Load: 50 concurrent joins, 50 concurrent rejoins
- ✅ Security: replay detection, stale token rejection, tenant isolation

---

## References and Artifacts

### Code Locations

- Join token service: [apps/server/src/auth/join-token.service.ts](../../apps/server/src/auth/join-token.service.ts)
- Room lifecycle: [apps/server/src/rooms/arena.room.ts](../../apps/server/src/rooms/arena.room.ts)
- Session service: [apps/server/src/session/session-lifecycle.service.ts](../../apps/server/src/session/session-lifecycle.service.ts)
- Region diff: [apps/server/src/domain/region-diff.service.ts](../../apps/server/src/domain/region-diff.service.ts)
- Delta repository: [apps/server/src/persistence/region-diff.repository.ts](../../apps/server/src/persistence/region-diff.repository.ts)
- Client heartbeat: [apps/client/src/session/heartbeat-caller.ts](../../apps/client/src/session/heartbeat-caller.ts)
- Snapshot service: [apps/server/src/domain/region-snapshot.service.ts](../../apps/server/src/domain/region-snapshot.service.ts)
- Region hash: [apps/server/src/domain/region-hash.ts](../../apps/server/src/domain/region-hash.ts)

### Test Files

- Join token tests: [apps/server/tests/integration/join-token.integration.test.ts](../../apps/server/tests/integration/join-token.integration.test.ts)
- Heartbeat lifecycle: [apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts](../../apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts)
- Region restore drill: [apps/server/tests/integration/region-restore-drill.smoke.test.ts](../../apps/server/tests/integration/region-restore-drill.smoke.test.ts)
- Region diff load: [apps/server/tests/load/region-diff-load.ts](../../apps/server/tests/load/region-diff-load.ts)

### Documentation

- Layer 1 backlog: [docs/layer1-backlog.md](../../docs/layer1-backlog.md) (E3-S1 story definition)
- Epic research: [.copilot-tracking/research/2026-06-29/e3-epic-research.md](./../2026-06-29/e3-epic-research.md) (broader E3 context)

---

## Conclusion

**E3-S1 is a critical foundational story** for reliable multiplayer gameplay. The current codebase has a solid join flow (E1-S2, E2-S4) but lacks the reconnect infrastructure (checkpoints, deltas retention, checksum validation) required for production multiplayer.

**Implementation requires:**
1. ✅ Database design (session_checkpoints table) – 2–3 days
2. ✅ Checkpoint service (create/restore/archive) – 3–5 days
3. ✅ Reconnect token service (sign/verify) – 1–2 days
4. ✅ Client checksum validation – 2–3 days
5. ✅ Delta retention policy + cleanup – 2–3 days
6. ✅ Comprehensive testing (integration, smoke, load) – 3–5 days
7. ✅ Security review and hardening – 1–2 days

**Total effort: 2–3 weeks (single engineer)**

**Blocking dependencies:** None (E1-S2, E2-S4 complete)  
**Unblocked by:** E3-S1 (E3-S2, E3-S4 depend on this)

**High-risk areas:**
- Checksum determinism under load (must validate with stress tests)
- Delta cleanup race conditions (must coordinate with active checkpoints)
- Grace period timing (5 min may be too aggressive; monitor in staging)

**Recommended approach:** Implement in parallel with E2-S3 (snapshot restore); both depend on deterministic hash computation. E3-S1 completion unblocks E3-S2 (ordered fanout) in sprint 2/3 handoff.
