# Tile Fighter: Real-Time Sync Implementation Assessment

**Date:** 2026-06-29  
**Assessment Scope:** Current state of real-time sync architecture and gap analysis against epic requirements  
**Document Owner:** Copilot Research  

## Executive Summary

The tile-fighter codebase implements a **hybrid sync model** combining:
- **Colyseus rooms** for real-time state management (arena simulation)
- **REST API + database polling** for tile persistence and delta recovery
- **Heartbeat-based session lifecycle** for presence tracking
- **Basic throttling** for tile placement rate limiting

**Current State:** Phase 1 (Tile Persistence) is complete with schema, migrations, and basic conflict detection. The foundation for delta sync is partially implemented but **lacks critical production-ready components** for the epic requirements (ordered fanout, conflict resolution, rejoin reliability, load testing).

---

## 1. Current Real-Time Sync Implementation

### 1.1 Sync Protocol Architecture

#### Colyseus Integration (Room-Based State)
- **File:** `apps/server/src/rooms/arena.room.ts`
- **State:** `apps/server/src/rooms/arena.state.ts`
- **Protocol:** Colyseus room lifecycle with auth-gated join
  
```typescript
// Arena state is minimal combat simulation
class ArenaState extends Schema {
  tick = 0;
  playerAHealth = 100;
  playerBHealth = 100;
}
```

**Current Behavior:**
- Room creation triggers a `CombatSimulationService` with 100ms simulation interval
- Auth via `onAuth()`: join tokens validated and mapped to `tenantScopedSubject`
- Join/Leave events recorded by `SessionLifecycleService`
- Client receives automatic Colyseus state patches (binary encoded, automatic delta compression)

**Observation:** Colyseus handles **room state synchronization internally** but tile placement sync is **not integrated with this room model**. Tile sync is entirely separate (REST + polling).

---

#### Tile Delta Sync (REST + Polling)
- **Client Initiator:** `apps/client/src/session/heartbeat-caller.ts`
- **Server Endpoint:** `apps/server/src/http/routes/region-diff.routes.ts`
- **Service Layer:** `apps/server/src/domain/region-diff.service.ts`
- **Repository:** `apps/server/src/persistence/region-diff.repository.ts`

**Protocol Flow:**

```
Client                          Server
  |                                |
  |--- POST /heartbeat ----------->|
  |  { roomId }                     |
  |                                | validate token
  |                                | noteHeartbeat()
  |<--- 200 { accepted } ---------|
  |                                |
  |--- GET /api/region-diff ------>|
  |  { regionId,                   |
  |    sinceVersion,               |
  |    viewport,                   |
  |    maxTiles }                  |
  |                                | fetch deltas >= sinceVersion
  |                                | compact by coordinate
  |                                | filter deletes
  |                                | sort by version, cellX, cellY, op
  |<--- 200 { deltas[] } ---------|
```

**Message Ordering Guarantees:**
✅ **Version-ordered within viewport:** Deltas ordered by `version ASC, id ASC` (deterministic tie-breaking)
✅ **Per-coordinate latest-wins:** `compactLatestByCoordinate()` keeps only latest delta per (cellX, cellY)
✅ **Delete semantics:** Deletes are filtered from response; absence = deleted or never existed (implicit delete)
❌ **Cross-viewport ordering:** No guarantee on ordering of deltas in different viewport regions
❌ **Ordered fanout:** No multi-client update fanout mechanism (each client polls independently)

---

### 1.2 Message Ordering Deep Dive

#### Database Schema for Ordering
**File:** `apps/server/src/persistence/db.ts`

```typescript
type TileDeltasTable = {
  id: string;                    // UUID primary key (insertion order)
  region_id: string;             
  version: string;               // Logical version (monotonic increment)
  cell_x: number;
  cell_y: number;
  operation: string;             // "upsert" | "delete"
  offset_x, offset_y, shape, color, style_payload, owner_id
  changed_at: Date;              // Timestamp of delta
};
```

**Query Ordering** (`region-diff.repository.ts`):
```typescript
.orderBy("version", "asc")     // Primary: logical version
.orderBy("id", "asc")          // Secondary: UUID insertion order (deterministic tiebreaker)
```

**Compaction Logic** (`region-diff.service.ts`, lines ~95-110):
```typescript
function compactLatestByCoordinate(deltas) {
  const latestByCoordinate = new Map<string, RegionDiffTileDelta>();
  
  for (const delta of deltas) {
    const key = `${delta.cell_x}:${delta.cell_y}`;
    latestByCoordinate.set(key, mapDelta(delta));  // Overwrites with each delta
  }
  
  // Filter out delete operations: only return live tiles
  return Array.from(latestByCoordinate.values())
    .filter(delta => delta.operation !== "delete")
    .sort((left, right) => {
      if (left.version !== right.version) return left.version - right.version;
      if (left.cellX !== right.cellX) return left.cellX - right.cellX;
      if (left.cellY !== right.cellY) return left.cellY - right.cellY;
      return left.operation.localeCompare(right.operation);
    });
}
```

**Delivery Guarantees:**
- ✅ **Single-client consistency:** Each client fetches deltas in version order; stale clients converge to live state
- ❌ **Multi-client ordering:** No server-side fanout; clients see deltas in fetch order, not transaction order
- ❌ **Causal consistency:** No causal metadata; clients cannot detect if a delta is causally dependent on another
- ⚠️ **Implicit deletes:** Clients cannot distinguish "never placed" from "deleted" (delete ops are stripped)

**Risk:** If two clients fetch diffs at slightly different times, they may perceive operations in different orders (eventual consistency only).

---

### 1.3 Join/Rejoin Handling Flow

#### Session Bootstrap Flow
**File:** `apps/server/src/http/routes/session.routes.ts`

```
1. Client: GET /api/session/bootstrap
   ├─ Rate limit check: 10 requests / 60s per (subject, IP)
   └─ Response includes:
      ├─ tenantScopedSubject
      ├─ shellInit: { bootstrapState: "token-ready" }
      ├─ retryPolicy: { maxBootstrap401Retry: 1, interactiveAuthRequiredAfterRetry: true }
      └─ serverTime (ISO 8601)

2. Client: POST /api/session/join-token { roomId }
   └─ Response: { roomId, joinToken }
      (joinToken signed with subject + roomId, expires in ~5 min)

3. Client: Colyseus room.join() with joinToken
   ├─ Server: onAuth(client, { joinToken })
   │  └─ Verify token → extract tenantScopedSubject
   ├─ Server: onJoin(client)
   │  └─ lifecycleService.noteRoomJoin(subject, roomId)
   └─ Client: receives "joined" event + state patch

4. Client: POST /api/session/heartbeat { roomId }
   ├─ Rate limit: 30 requests / 10s per subject
   └─ Response: { accepted: true, roomId }
   (Sent periodically to refresh presence metadata)
```

**Client-Side Session Management**
**File:** `apps/client/src/session/bootstrap-store.ts`

```typescript
async bootstrap() {
  // 1. Acquire access token (MSAL state machine)
  const tokenState = await authSession.acquireTokenReadyState();
  
  if (tokenState.state === "interaction-required") {
    await authSession.beginInteractiveAuth();
    throw new Error("Interactive auth required");
  }
  
  // 2. Fetch bootstrap
  const response = await fetch(bootstrapEndpoint, {
    headers: { Authorization: `Bearer ${tokenState.accessToken}` }
  });
  
  // 3. If 401: attempt reacquire (token may be stale)
  if (response.status === 401) {
    const retryTokenState = await authSession.handleBootstrapUnauthorizedReacquire();
    // Retry fetch with new token
  }
  
  return response.json() as BootstrapPayload;
}
```

#### Rejoin Handling
**Status:** ⚠️ **Minimal Implementation**

**Current behavior:**
1. If Colyseus connection drops: room auto-reconnect (Colyseus built-in retry logic)
2. If session token expires during room membership: **Colyseus does not re-auth** (client must manually rejoin)
3. If database becomes unavailable: no automatic delta sync retry (client polls and eventually times out)

**Missing:** Explicit rejoin protocol with delta replay checkpoint. On reconnect, client should:
- Send `sinceVersion` from last confirmed delta
- Receive replay of intermediate deltas
- Verify checkpoint hash to detect data loss

---

### 1.4 Conflict Resolution Implementation

#### Tile Placement Conflict Detection
**File:** `apps/server/src/http/routes/tile.routes.ts` (lines ~80-140)

```typescript
// Placement logic:
// 1. Check throttle policy (5 placements / 60s per user-region)
if (throttle.throttled) {
  return 429 { reason: "throttled", retryAfterMs };
}

// 2. Attempt insert (application-level logic delegates to repository)
const result = await dependencies.placeTile({
  regionId, cellX, cellY, /* style params */
  ownerId: principal.tenantScopedSubject
});

// 3. Result handling
if (result.ok) {
  // Emit telemetry
  await telemetrySink.emitTilePlaced(...);
  return 200 { ok: true, tileId, createdAt };
} else if (result.reason === "occupied") {
  // Database unique constraint violation caught
  await telemetrySink.emitTilePlaceRejected(..., "occupied");
  return 200 { ok: false, reason: "occupied" };
}
```

**Database Constraint Enforcement**
**File:** `apps/server/src/persistence/db.ts` (migration)

```sql
CREATE UNIQUE INDEX tiles_region_coordinate_unique 
  ON tiles (region_id, cell_x, cell_y);
```

**Conflict Strategy: Last-Write-Wins with Deterministic Rejection**
- ✅ **Database-enforced uniqueness:** Only one tile per (region, cell_x, cell_y)
- ✅ **First-insert wins:** If two clients place on same coordinate simultaneously, one succeeds (INSERT first), other fails
- ✅ **Telemetry emission:** `tile_persist_conflict` event logged for monitoring
- ⚠️ **No causal metadata:** Cannot determine *which* client's placement was "more recent" logically (no lamport clock)
- ❌ **No conflict resolution merge:** Only binary (accept/reject); no rebasing or 3-way merge

**Tile Edit Conflict**
**File:** `apps/server/src/http/routes/tile.routes.ts` (lines ~170+)

```typescript
// Edit allowed only if:
// 1. Caller is original owner (ownerId match)
// 2. Edit within 10min window of creation
if (now - createdAt > SELF_EDIT_WINDOW_MS) {
  return { ok: false, reason: "edit_window_expired" };
}
if (ownerId !== principal.tenantScopedSubject) {
  return { ok: false, reason: "forbidden_owner_mismatch" };
}
// Proceed with update
```

**Conflict Resolution Summary:**
| Scenario | Resolution | Implementation |
|----------|-----------|-----------------|
| Simultaneous placement on coordinate | Last-write-wins (first INSERT) | Database unique constraint + rejection telemetry |
| Edit by non-owner | Rejection | Application-level ownership check |
| Edit after 10min expiry | Rejection | Application-level time window |
| Stale client delta | Implicit overwrite | Compaction keeps only latest per coordinate |
| Network partition | No special handling | Client retries with no backoff (TODO) |

---

### 1.5 Telemetry for Latency Measurement

**File:** `apps/server/src/telemetry/telemetry-sink.ts`

**Telemetry Events Emitted:**

1. **Session Lifecycle**
   - `session_started`: User begins session (bootstrap succeeds)
   - `session_heartbeat`: Heartbeat received (presence refresh)
   - `session_ended`: User leaves room
   - `session_bootstrap_failed`: Bootstrap request fails

2. **Tile Persistence**
   - `tile_persisted`: Tile inserted successfully
   - `tile_persist_conflict`: Insert failed (coordinate occupied)
   - `tile_placed`: Story-level placement accepted
   - `tile_place_rejected`: Placement rejected (reason: occupied, etc.)
   - `tile_place_throttled`: Placement rejected (rate limit exceeded)
   - `tile_edited`: Tile edited successfully
   - `tile_edit_rejected`: Edit rejected (owner mismatch, window expired)

3. **Delta Sync (Partial Implementation)**
   - `tile_diff_requested`: Region diff request received
     - Attributes: `region_id`, `since_version`, `viewport_area`
   - `tile_diff_returned`: Region diff response sent
     - Attributes: `region_id`, `since_version`, `current_version`, `viewport_area`, `tile_count`, `truncated`, `duration_ms`

4. **Snapshot Operations**
   - `snapshot_created`: Snapshot written
   - `snapshot_restore_started`: Restore initiated
   - `snapshot_restore_completed`: Restore finished
     - Attributes: `region_id`, `snapshot_id`, `tile_count`, `expected_hash`, `actual_hash`, `duration_ms`

**Latency Measurement Gaps:**
- ❌ **No client-side round-trip time (RTT):** Telemetry only measures server duration, not network latency
- ❌ **No delta propagation latency:** No timestamp on when delta is created vs. when client fetches it
- ❌ **No heartbeat response time:** Heartbeat events have no timing data
- ⚠️ **Limited scope:** Deltas telemetry not emitted on every request (appears to be partial implementation)

---

### 1.6 Load Testing Infrastructure

**File:** `apps/server/tests/load/`

#### Region Diff Load Test
**File:** `region-diff-load.ts`

```typescript
describe("Region diff load scenario", () => {
  it("executes stale/unchanged mix and logs latency + payload summary", async () => {
    // Mocks:
    // - authService: returns fixed tenant-scoped subject
    // - telemetrySink: captures emit calls
    // - lifecycleService: pre-joins user to room
    
    // Scenario: Parameterized stale/unchanged queries
    // - "stale": sinceVersion very old → many deltas returned
    // - "unchanged": sinceVersion == currentVersion → 0 deltas returned
    
    // Metrics collected:
    // - latencyMs: time for endpoint call
    // - bytes: response payload size
    // - status: HTTP status code
    
    // Output: percentile analysis (p50, p95, p99)
    const latencies = [];
    // ... run scenario multiple times
    console.log(`p50: ${percentile(latencies, 50)}ms`);
    console.log(`p95: ${percentile(latencies, 95)}ms`);
  });
});
```

**Status:** ⚠️ **Test Infrastructure Exists, Load Modeling Incomplete**

**What's Implemented:**
- ✅ Basic latency capture (ms resolution)
- ✅ Payload size measurement
- ✅ Percentile calculation (p50, p95, p99)
- ✅ Scenario definition (stale vs unchanged mix)

**What's Missing:**
- ❌ **Concurrent load:** Only single sequential requests; no parallelism simulation
- ❌ **Sustained load:** No duration-based test (e.g., run for 30 seconds with N concurrent clients)
- ❌ **CCU scaling:** No test for 50 concurrent users; only individual request latency
- ❌ **Resource utilization:** No CPU, memory, or database connection tracking
- ❌ **Failure modes:** No network latency simulation, no database timeout, no malformed requests
- ❌ **Comparison baseline:** No before/after performance tracking

#### Room Join Load Test
**File:** `room-join-load.ts`

```typescript
describe("Load-focused authoritative placement and throttle paths", () => {
  it("simulates placement contention on one coordinate...", async () => {
    // Mocks placement repository to simulate occupied conflict
    // Runs multiple placement attempts against same coordinate
    // Verifies throttle and occupancy rejection paths
  });
});
```

**Status:** ⚠️ **Happy-path only; no realistic concurrency**

---

## 2. Epic Requirements Gap Analysis

### 2.1 Epic: Ordered Delta Fanout (50 CCU)

**Requirement:** All clients in a region receive tile deltas in identical order with consistent causality.

**Current State:**
```
✅ Deltas ordered by version (monotonic)
✅ Per-coordinate latest-wins semantics
✅ Deterministic compaction (same result on retry)
❌ NO FANOUT: Each client polls independently
❌ NO MULTI-CLIENT ORDERING GUARANTEE
❌ NO TRANSACTION BOUNDARIES: Cannot group related deltas
```

**Gaps:**

| Gap | Impact | Severity |
|-----|--------|----------|
| No server-side fanout | Clients may perceive deltas in different orders | 🔴 Critical |
| No version vector / lamport clock | Cannot detect causal relationships between deltas | 🔴 Critical |
| No transaction grouping | Multi-tile operations not atomic to all clients | 🟠 High |
| No publish-subscribe | Must implement server → all-clients push (currently REST polling) | 🟠 High |
| No ordering proof | No way for client to verify received deltas are in server's order | 🟡 Medium |

**Implementing Fanout Requires:**
1. Pub/Sub layer (Redis, Kafka, or Colyseus broadcast)
2. Version vector or lamport clock for causal metadata
3. Transaction boundaries (deltas grouped into "batches")
4. Client acknowledgment of received deltas
5. Catch-up mechanism for late-joining clients

**Effort Estimate:** 3-5 weeks (design + implementation + testing)

---

### 2.2 Epic: Conflict Resolution

**Requirement:** Deterministic, application-aware conflict resolution for concurrent tile operations.

**Current State:**
```
✅ Last-write-wins (first INSERT on duplicate key)
✅ Throttling (5 placements / 60s per user-region)
✅ Ownership enforcement (edit only by owner, within 10min)
❌ NO CAUSAL CONFLICT DETECTION
❌ NO REBASE/MERGE SEMANTICS
❌ NO VECTOR CLOCK / LAMPORT CLOCK
❌ NO CONFLICT RESOLUTION METADATA
```

**Gaps:**

| Gap | Impact | Severity |
|-----|--------|----------|
| No causal metadata | Cannot detect or resolve logical conflicts | 🔴 Critical |
| Only binary outcomes | No compromise/rebase resolution | 🔴 Critical |
| No conflict history | Cannot audit which operation "won" | 🟠 High |
| No application hooks | Conflict resolution is DB-enforced, not business-logic-aware | 🟠 High |
| No conflict notifications | Client doesn't know if placement was rejected due to occupied | 🟡 Medium |
| No rollback mechanism | No way to undo accepted placement if it conflicts with later operation | 🟡 Medium |

**Conflict Types Not Handled:**
1. **Circular placement:** If player A places → player B overrides → player A re-validates → should A be rejected or should B's override be reverted?
2. **Ownership conflicts:** If tile changes owner mid-edit, edit should fail (currently only checks at request start)
3. **Spatial clustering:** If 10 clients place tiles in overlapping viewport, order of acceptance affects final state
4. **Out-of-order edits:** If edit arrives before placement confirmation, apply-time semantics are unclear

**Implementing Conflict Resolution Requires:**
1. Causal metadata (Lamport clock or version vector per player)
2. Conflict detection algorithm (e.g., vector clock comparison)
3. Application-defined merge strategy (e.g., "newer version wins", "both accepted", "reject newer")
4. Rollback capability (audit trail + undo log)
5. Client API for conflict notifications

**Effort Estimate:** 4-6 weeks (design + vector clock impl + client integration)

---

### 2.3 Epic: Join/Rejoin Reliability

**Requirement:** Clients can reconnect after network loss and resume play without data loss or duplication.

**Current State:**
```
✅ Session bootstrap with token retry logic (1 retry on 401)
✅ Colyseus auto-reconnect (built-in)
✅ Heartbeat for presence tracking
✅ Region membership authority in room lifecycle hooks
❌ NO EXPLICIT REJOIN PROTOCOL
❌ NO DELTA REPLAY CHECKPOINT
❌ NO DEDUPLICATION ID
❌ NO RECOVERY GUARANTEE SLA
```

**Gaps:**

| Gap | Impact | Severity |
|-----|--------|----------|
| No delta replay checkpoint | On rejoin, cannot determine which deltas to resend | 🔴 Critical |
| No deduplication ID | Reapplied deltas may cause duplicates (2 tiles on same coordinate) | 🔴 Critical |
| No recovery guarantee | No SLA on how long deltas are retained for rejoin | 🔴 Critical |
| No explicit rejoin flow | Token expires mid-session → must manually re-bootstrap | 🟠 High |
| No stale session cleanup | Zombie sessions can accumulate if client disconnects abruptly | 🟠 High |
| No failure notification | Client doesn't know if rejoin failed due to data loss vs. auth | 🟡 Medium |
| No connection state probing | Unclear if TCP connection is alive or dead before rejoin attempt | 🟡 Medium |

**Current Rejoin Behavior:**
```
Scenario: Network partition for 5 seconds
1. Colyseus detects TCP timeout (30s default)
2. Client auto-reconnects (retries every 2s)
3. Auth: re-uses same token (may be expired now)
4. onAuth() re-validates token
5. onJoin() re-records presence
6. Client fetches deltas with sinceVersion = last known
   ├─ If deltas within retention: success
   └─ If deltas evicted: gets partial state, gaps unknown

Result: Data loss if deltas evicted; no notification to client
```

**Implementing Join/Rejoin Reliability Requires:**
1. Durable delta retention (minimum 24h; TBD based on CCU)
2. Checkpoint-based rejoin protocol (sequence number per session)
3. Deduplication by checkpoint ID (client re-sends same placement → server dedupes)
4. Explicit error codes (data-loss vs. auth-failure vs. timeout)
5. Client-side retry with backoff
6. Stale session cleanup (e.g., TTL-based)
7. Recovery SLA monitoring (telemetry on rejoin latency, data gaps)

**Effort Estimate:** 2-3 weeks (checkpoint impl + dedup + client integration)

---

### 2.4 Epic: 50 CCU Load Validation

**Requirement:** Sustained performance test with 50 concurrent users placing tiles, validating latency, throughput, and resource utilization.

**Current State:**
```
✅ Individual request latency measurement (p50, p95, p99)
✅ Payload size tracking
✅ Scenario definition (stale/unchanged)
❌ NO SUSTAINED LOAD TEST (50 CCU)
❌ NO RESOURCE UTILIZATION TRACKING
❌ NO THROUGHPUT MEASUREMENT (ops/sec)
❌ NO FAILURE MODE TESTING
❌ NO BASELINE PERFORMANCE TARGETS
```

**Gaps:**

| Gap | Impact | Severity |
|-----|--------|----------|
| No concurrent client simulation | Cannot validate 50 CCU performance | 🔴 Critical |
| No throughput measurement | Unknown if server can handle 50 placements/sec | 🔴 Critical |
| No resource utilization tracking | Unknown CPU/memory headroom | 🔴 Critical |
| No failure mode testing | Unknown behavior under overload | 🟠 High |
| No baseline targets | No SLA to validate against | 🟠 High |
| No k6 / Artillery setup | Manual test harness only (not reproducible) | 🟠 High |
| No CI/CD integration | Load test not run on each PR | 🟡 Medium |
| No failure detection | Test doesn't fail if latency/throughput degrades | 🟡 Medium |

**Load Test Scenarios Required:**
1. **Baseline:** 50 clients each place 10 tiles sequentially (500 ops, no overlap)
   - Target: p95 latency < 200ms, no errors
2. **Contention:** 50 clients place tiles in overlapping region (1k×1k grid, ~50 CCU)
   - Target: p95 latency < 500ms, occupied conflicts < 20%
3. **Sustained:** Run for 60 seconds at 10 placements/sec per client = 500 ops/sec
   - Target: p95 latency < 500ms, CPU < 70%, memory stable
4. **Failover:** Kill 1 server instance → test recovery on 50 concurrent users
   - Target: latency spike < 2s, no data loss
5. **Token Expiry:** All 50 clients' tokens expire simultaneously → test re-bootstrap
   - Target: recover within 5s, no duplicate placements

**Implementing Load Validation Requires:**
1. Load testing framework (k6, Artillery, or custom Node.js)
2. Metrics export (Prometheus, DataDog, CloudWatch)
3. Performance baselines (document p50/p95/p99 for each scenario)
4. Resource monitoring (CPU, memory, disk I/O, DB connections)
5. Failure injection (network latency, server crash, database disconnect)
6. CI/CD integration (run on each PR, fail if regresses)
7. Dashboards (real-time monitoring during test)

**Effort Estimate:** 2-3 weeks (framework setup + scenarios + dashboards)

---

## 3. Architecture Recommendations for Epic Support

### 3.1 Sync Protocol Enhancement: Ordered Fanout

**Current:** REST polling (client-pull)  
**Recommended:** Hybrid push-pull with version vectors

```
Design:
┌─────────────────────────────────────────────────────────┐
│ Tile Placement Transaction                              │
│ (e.g., player places 3 tiles)                           │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Server Atomically:                                       │
│ 1. Insert 3 tiles into database                         │
│ 2. Create 3 deltas with transaction_id = UUID           │
│ 3. Increment region_version to N                        │
│ 4. Publish { transaction_id, deltas[], version: N }    │
│    to PubSub channel "region:regionId"                  │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Clients Subscribing to "region:regionId" Receive:      │
│ { transaction_id, deltas[], version, timestamp, actor } │
│                                                          │
│ All clients receive in SAME order (guaranteed by        │
│ PubSub ordering semantics)                              │
└─────────────────────────────────────────────────────────┘
```

**Implementation Options:**

1. **Redis Streams** (low effort, good for <100 CCU)
   - Pros: Built-in ordered queue, consumer groups for failover
   - Cons: Single-node bottleneck (no sharding for >100 CCU)
   - Effort: 1-2 weeks

2. **Colyseus Broadcast + REST Fallback** (medium effort, good for <50 CCU)
   - Pros: Leverages existing Colyseus, no new infra
   - Cons: Broadcasts only to connected room members (excludes clients fetching via REST)
   - Effort: 2-3 weeks

3. **Kafka** (high effort, best for >100 CCU + multi-region)
   - Pros: Scalable, multi-consumer, retention policy, replication
   - Cons: Operational complexity, higher latency (typically 10-50ms)
   - Effort: 4-6 weeks

**Recommendation:** Start with **Redis Streams** for spike validation; upgrade to **Kafka** if 50 CCU load test succeeds and expansion is planned.

---

### 3.2 Conflict Resolution: Vector Clocks + Merge Strategy

**Approach:** Lamport clock per player + tie-breaking rule

```typescript
// Proposed delta structure with causal metadata
type DeltaWithCausality = {
  id: string;                    // UUID (insertion order)
  region_id: string;
  version: number;               // Monotonic version (already have)
  actor: string;                 // tenantScopedSubject
  actor_clock: number;           // Lamport clock for this actor
  observed_clock: number;        // Max clock seen from other actors
  
  // Current fields...
  cell_x, cell_y, operation, ...
  
  // Conflict metadata
  conflict_resolution_strategy: "first_win" | "last_win" | "application_merge"
  conflict_detected: boolean;
  losing_transaction_id?: string;  // If conflict, ID of operation that lost
};

// Conflict detection logic:
// If two deltas D1 and D2 affect same (cell_x, cell_y):
//   if D1.version < D2.version: D1 accepted, D2 rejected (simple case)
//   else if D1.actor_clock ↦ D2.actor_clock: happens-before
//     (D2 can see D1's effect; use application merge strategy)
//   else: concurrent (neither sees the other)
//     (use tie-breaker: min(actor1, actor2) wins, or UDF)
```

**Effort:** 3-4 weeks (clock impl + merge UDF + testing)

---

### 3.3 Rejoin Reliability: Checkpoint-Based Recovery

**Current Gap:** No durable state for rejoin; must re-bootstrap and re-sync all deltas

**Proposed:** Checkpoint per session with sequence number

```typescript
// Session checkpoint stored server-side
type SessionCheckpoint = {
  session_id: string;            // UUID issued at bootstrap
  actor: string;                 // tenantScopedSubject
  region_id: string;
  
  // Recovered state
  last_confirmed_delta_id: string;  // Last delta applied by client
  last_confirmed_version: number;   // Version number of that delta
  
  // Rejoin info
  created_at: Date;
  updated_at: Date;               // TTL cleanup based on this
  ttl_seconds: number;            // Configurable (default 3600 = 1h)
};

// Rejoin flow:
// Client: POST /api/session/rejoin { session_id, last_confirmed_delta_id }
// Server: 
//   1. Lookup checkpoint
//   2. Fetch deltas since last_confirmed_delta_id
//   3. Emit: { replay_deltas[], new_version, new_checkpoint }
// Client:
//   1. Verify checkpoint hash matches local state
//   2. Apply replay_deltas
//   3. Resume polling from new_checkpoint.last_confirmed_version
```

**Effort:** 2-3 weeks (checkpoint impl + TTL cleanup + client integration)

---

### 3.4 Load Validation Framework

**Recommended Setup:**

```bash
# Use k6 for load testing (TypeScript-based, cloud-compatible)
npm install --save-dev k6

# Scenarios:
# 1. apps/server/tests/load/50-ccu-baseline.k6.ts
# 2. apps/server/tests/load/50-ccu-contention.k6.ts
# 3. apps/server/tests/load/50-ccu-sustained.k6.ts
# 4. apps/server/tests/load/50-ccu-failover.k6.ts
# 5. apps/server/tests/load/50-ccu-token-expiry.k6.ts

# CI/CD integration:
# .github/workflows/load-test.yml
#   - Run after integration tests pass
#   - Compare against baseline
#   - Fail if p95 latency > threshold OR throughput < threshold
#   - Export metrics to DataDog/CloudWatch
```

**Effort:** 2-3 weeks (framework + scenarios + CI integration)

---

## 4. Recommended Implementation Order

**Phase 2 (Next Sprint):** Ordered Delta Fanout
- Spike: Evaluate Redis Streams vs. Colyseus broadcast
- Implement PubSub layer with transaction grouping
- Extend load test to verify multi-client ordering
- Estimate: 3-5 weeks

**Phase 3 (Sprint +2):** Join/Rejoin Reliability
- Implement checkpoint-based recovery
- Add session TTL and cleanup
- Update client SDK to use checkpoints
- Estimate: 2-3 weeks

**Phase 4 (Sprint +3):** Conflict Resolution
- Implement Lamport clock tracking
- Add conflict detection and merge UDFs
- Update telemetry for conflict metrics
- Estimate: 3-4 weeks

**Phase 5 (Sprint +4):** Load Validation
- Build k6 load test suite
- Integrate into CI/CD
- Document baselines and SLAs
- Estimate: 2-3 weeks

**Total Effort:** 12-18 weeks for full epic support (production-ready)

---

## 5. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Pub/Sub bottleneck at 50 CCU** | Start with load test on simpler scenarios; scale infra before 50 CCU spike |
| **Token expiry during session** | Implement background token refresh before expiry (MSAL silent flow) |
| **Database connection exhaustion** | Add connection pooling monitoring; set alerts if pool > 80% utilized |
| **Stale client delta loss** | Set delta retention minimum to 24h; monitor retention in telemetry |
| **Conflict explosion on high contention** | Implement backpressure; reject placements if conflict rate > 50% |
| **Production incidents during load test** | Run load tests in staging environment only; never in production |

---

## 6. Summary Table: Current vs. Required

| Dimension | Current | Required for Epic | Gap |
|-----------|---------|------------------|-----|
| **Sync Protocol** | REST polling per client | PubSub push + version vectors | Fanout + causality |
| **Ordering Guarantee** | Per-coordinate latest-wins | Multi-client consistency | 🔴 Major |
| **Conflict Resolution** | DB constraint (first-write-wins) | App-aware merge + vector clock | 🔴 Major |
| **Rejoin Recovery** | Stateless (re-sync all deltas) | Checkpoint + sequence numbers | 🔴 Major |
| **Load Tested** | Single request latency | 50 CCU sustained + resource util | 🔴 Major |
| **Telemetry** | Event emission (partial) | End-to-end RTT + conflict metrics | 🟠 Partial |
| **Retry Logic** | Hardcoded (1x bootstrap retry) | Exponential backoff + jitter | 🟡 Minor |
| **Error Handling** | HTTP status codes + domain errors | Structured error codes + recovery SLA | 🟡 Minor |

---

## Appendix: Key Files Reference

| Component | File | Key Functions |
|-----------|------|---|
| Room state sync | `apps/server/src/rooms/arena.room.ts` | `onCreate()`, `onAuth()`, `onJoin()`, `onLeave()` |
| Delta service | `apps/server/src/domain/region-diff.service.ts` | `getRegionDiff()`, `compactLatestByCoordinate()` |
| Delta repository | `apps/server/src/persistence/region-diff.repository.ts` | `getTileDeltasSince()`, `getCurrentRegionVersion()` |
| Tile placement | `apps/server/src/http/routes/tile.routes.ts` | Throttle check, conflict rejection, telemetry |
| Session bootstrap | `apps/server/src/http/routes/session.routes.ts` | Bootstrap endpoint, heartbeat endpoint |
| Client heartbeat | `apps/client/src/session/heartbeat-caller.ts` | `sendHeartbeat()`, token retry logic |
| Telemetry | `apps/server/src/telemetry/telemetry-sink.ts` | Event emission, configurable sink URL |
| Load tests | `apps/server/tests/load/{region-diff,room-join}-load.ts` | Latency + payload measurement |

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-29  
**Status:** Ready for epic planning
