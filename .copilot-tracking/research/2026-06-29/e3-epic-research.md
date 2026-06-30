<!-- markdownlint-disable-file -->
# Task Research: E3 Real-Time Sync and Room Reliability Epic

Epic #3 in layer1 backlog focused on real-time sync reliability as the core MMO trust boundary, enabling 50 CCU validation.

## Task Implementation Requests

* Research epic scope, requirements, and success criteria
* Investigate referenced stories (E3-S1, E3-S2, E3-S3, E3-S4)
* Understand harness mapping and exit criteria validation
* Assess current codebase readiness for real-time sync
* Identify implementation patterns and potential risks

## Scope and Success Criteria

* Scope: Epic objective, in-scope/out-of-scope items, stories, harness alignment, exit criteria, risk assessment
* Assumptions:
  * Stories E3-S1 through E3-S4 exist as GitHub issues in tile-fighter
  * Harness mapping references documented CICD/verification processes
  * 50 CCU load test is feasible in current infrastructure
  * Median placement ack <200ms is measurable in existing telemetry
* Success Criteria:
  * All 4 stories identified and mapped to requirements
  * Harness mapping (items 2, 6, 7) understood and validated
  * Exit criteria assessment approach defined
  * Implementation risks and mitigations identified
  * Current code state for real-time sync components assessed

## Research Executed

### Epic Stories Mapped

| Story | Issue | Title | Points | Sprint | Status |
|-------|-------|-------|--------|--------|--------|
| **E3-S1** | #17 | Reliable room join and rejoin | 5 | 2 | Planned |
| **E3-S2** | #18 | Ordered realtime delta fanout | 5 | 2 | Planned |
| **E3-S3** | #19 | Deterministic conflict resolution | 3 | 3 | Planned (parallel) |
| **E3-S4** | #20 | 50 CCU + latency budget | 5 | 6 | Planned |

### Requirement-to-Story Mapping

✅ **E3-S1 (Join/Rejoin)** → Covers: First join, transient disconnect+reconnect, rejoin replay
✅ **E3-S2 (Ordered Delta Fanout)** → Covers: Multi-client ordered delivery, version vectors
✅ **E3-S3 (Conflict Resolution)** → Covers: Concurrent tile placement determinism, causal ordering
✅ **E3-S4 (50 CCU Load)** → Covers: 50 concurrent players for 30 min, latency SLA <200ms median, <3s P95 reconnect

### Harness Mapping Validation

- **Point 2 (Deterministic Build)** → Type safety: Sequence IDs, deterministic winner rules, idempotency keys (All stories require)
- **Point 6 (Post-Deploy Verification)** → Smoke tests for join/rejoin, fanout, metrics pipeline (E3-S2 critical)
- **Point 7 (Operations/Rollback)** → Load baseline tracking, automated regression gates (E3-S4 instrumentation)

### Exit Criteria Operational Meaning

**"50 CCU run passes"** = Automated test simulates 50 concurrent players for 30 minutes → all join/rejoin succeed → zero crashes → game state consistent

**"Median placement ack <200ms"** = HTTP latency from client POST `/placement` to response ack, measured at P50 during 50 CCU run, persisted as telemetry event `delta_sent` → `delta_acked`

**Measurement Infrastructure:**
- Telemetry sink: Configurable HTTP endpoint (`TELEMETRY_SINK_URL` env var)
- Events: `tile_placed`, `tile_place_throttled`, `tile_diff_returned`, `tile_diff_acked`, session events
- Calculation: Post-run aggregation of telemetry, percentile computed via sorted index lookup
- Status: ❌ **Not yet wired to CI/CD** — Manual gate only; E3-S2 planned implementation

## Key Discoveries

### 1. Current Real-Time Sync Architecture

**Hybrid model implemented:**
- **Colyseus rooms** for arena state (100ms simulation ticks, auth-gated join)
- **REST API + polling** for tile persistence (heartbeat + `/api/region-diff`)
- **Tile delta protocol:** Client polls `/api/region-diff` with `sinceVersion`, server returns sorted deltas

**Message Ordering Guarantees Today:**
- ✅ Version-ordered within viewport (deterministic sort: version ASC, id ASC)
- ✅ Latest-wins-per-coordinate via `compactLatestByCoordinate()`
- ✅ Implicit delete semantics
- ❌ **No ordered fanout** — Each client polls independently; concurrent clients may see different ordering
- ❌ **No cross-viewport ordering** — Ordering only guaranteed within single viewport region

**File References:**
- Room lifecycle: [apps/server/src/rooms/arena.room.ts](apps/server/src/rooms/arena.room.ts)
- Tile deltas: [apps/server/src/domain/region-diff.service.ts](apps/server/src/domain/region-diff.service.ts) (service), [apps/server/src/persistence/region-diff.repository.ts](apps/server/src/persistence/region-diff.repository.ts) (persistence)
- Client sync: [apps/client/src/session/heartbeat-caller.ts](apps/client/src/session/heartbeat-caller.ts)

### 2. Critical Gaps for Epic Requirements

**All gaps marked CRITICAL (blocking epic completion):**

| Requirement | Current State | Gap | Effort |
|-------------|---------------|-----|--------|
| **Join/Rejoin Reliability** | No checkpoint recovery, no delta retention SLA | Missing: Session checkpoints, delta TTL policy, rejoin dedup | 2-3 weeks |
| **Ordered Delta Fanout** | Per-client polling only; no fanout broker | Missing: Redis Streams fanout, version vector broadcast | 3-5 weeks |
| **Conflict Resolution** | Last-write-wins via DB upsert only | Missing: Causal metadata, deterministic merge, rollback | 3-4 weeks |
| **50 CCU Load Validation** | Single-request latency measured; no concurrent client sim | Missing: 50-player simulator, sustained load harness, SLA enforcement | 2-3 weeks |

**Total Implementation Effort:** 12–18 weeks for production-ready epic

**File References for Current Implementation:**
- Schema & migrations: [apps/server/src/persistence/db.ts](apps/server/src/persistence/db.ts)
- Conflict handling: [apps/server/src/domain/combat-simulation.service.ts](apps/server/src/domain/combat-simulation.service.ts) (minimal causal logic)
- Telemetry: [apps/server/src/telemetry/telemetry-sink.ts](apps/server/src/telemetry/telemetry-sink.ts)

### 3. Load Testing Infrastructure

**Existing Load Tests:**
- [apps/server/tests/load/region-diff-load.ts](apps/server/tests/load/region-diff-load.ts) — 60 concurrent region-diff requests, measures p95 latency per stale/unchanged ratio
- [apps/server/tests/load/room-join-load.ts](apps/server/tests/load/room-join-load.ts) — 12-40 concurrent placements, validates 201/409/429 mix, throttle path

**Current CCU Coverage:** Max 60 concurrent requests; ❌ **no sustained 50 CCU × 30 min harness**

**Telemetry Events Emitted:** 13+ event types (tile_placed, tile_place_rejected, tile_place_throttled, tile_diff_requested, snapshot_created, session_heartbeat, etc.), including latency and error attributes

**Dashboard Status:** ❌ **No external telemetry sink configured** — Endpoint is env var but unmapped

### 4. Primary Risks & Mitigations

| Risk | Severity | Root Cause | Mitigation |
|------|----------|-----------|-----------|
| **Desync (concurrent clients see different order)** | Critical | No fanout broker; each client polls independently | Implement Redis Streams fanout broker in E3-S2 |
| **Ghost sessions (disconnected players persist)** | High | No checkpoint recovery on rejoin | Checkpoint-based recovery + TTL policy in E3-S1 |
| **Latency budget miss <200ms** | High | No sustained load validation; single-request SLA unmeasured | E3-S4: 50 CCU harness + SLA gate in CI/CD |
| **Conflict resolution non-determinism** | Critical | Last-write-wins only; no causal metadata | Lamport clocks + deterministic winner rules in E3-S3 |

### 5. Dependency Chain

**Critical Path (blocks E3-S4):**
```
E3-S1 (Join/Rejoin)
   ↓ (depends on)
E3-S2 (Ordered Delta Fanout)
   ↓ (depends on)
E3-S4 (50 CCU Load Validation) ← exit criteria gate
```

**Parallel Track (independent):**
```
E3-S3 (Conflict Resolution) — depends on E2-S2, can start after E1 complete
```

**Sprint Allocation:** S1/S2 in Sprint 2 (8 weeks), S3 in Sprint 3 (overlap), S4 in Sprint 6 (after S2 complete, 6 weeks)

## Technical Scenarios

### Scenario 1: Current Join/Rejoin Flow vs. Epic Requirements

**Current Implementation** (insufficient for E3-S1):

1. Client calls `join()` on Colyseus room
2. Server validates join token, creates session record
3. Client receives Colyseus state patch (combat sim only)
4. Client polls `/api/region-diff` for tile state
5. **On disconnect:** Colyseus auto-reconnect attempts; client resumes polling
6. **On rejoin after TTL:** Session record deleted; player must rejoin as new session (no checkpoints)

**Issues:**
- ❌ No checkpoint saved on disconnect
- ❌ No delta retention SLA (deltas deleted after X hours)
- ❌ Rejoin replays entire region state (N/A if deltas absent)
- ❌ No idempotency keys for duplicate placement detection

**Epic Requirement (E3-S1 acceptance criteria):**
- ✅ First Join: Region state initializes correctly
- ✅ Transient Disconnect + Reconnect: Resume with same session identity
- ✅ Rejoin Replay: Client checksum matches server after replay

**Implementation Pattern:**
```
On Join:
  - Create session checkpoint (player ID, region ID, last confirmed version, client checksum)
  - Retain deltas >= checkpoint version for 24 hours (SLA)

On Disconnect Detected:
  - Session remains "stale" for 5 min (grace period)
  - Deltas continue accumulating

On Reconnect (within grace):
  - Restore session checkpoint
  - Replay deltas from checkpoint version onwards
  - Client applies replay, verifies checksum
  - Checkpoint updated; stale flag cleared

On Rejoin (after grace):
  - Treat as new session (old checkpoints aged out)
  - Create fresh checkpoint, sync full region state
```

**Affected Files:**
- [apps/server/src/session/session-lifecycle.service.ts](apps/server/src/session/session-lifecycle.service.ts) — Add checkpoint/restore logic
- [apps/server/src/persistence/region-diff.repository.ts](apps/server/src/persistence/region-diff.repository.ts) — Add delta TTL + retention query
- [apps/client/src/session/heartbeat-caller.ts](apps/client/src/session/heartbeat-caller.ts) — Add checksum validation on replay

**Effort:** 2–3 weeks

---

### Scenario 2: Ordered Delta Fanout (E3-S2 requirement)

**Current Polling Model** (insufficient):
- Each client independently polls `/api/region-diff` on heartbeat (default 5s interval)
- Concurrent clients polling at staggered times see deltas in same order (version-sorted) but fanout timing varies
- ❌ **Risk:** If server receives deltas D1 and D2 in order, but client A polls before server publishes D2, client A sees {D1} while client B (polls after) sees {D1, D2}. Later, when both clients update, they may apply in different orders if they have incomplete view.

**Epic Requirement (E3-S2 acceptance criteria):**
- ✅ Ordered fanout: Deltas delivered to all nearby players in same deterministic order
- ✅ Cross-client consistency: All clients apply same deltas, same order, same semantics

**Implementation Pattern (Redis Streams Fanout):**

```
Server:
  When tile placed (event):
    1. Persist to DB (region_deltas table)
    2. Publish to Redis Stream: "region:{regionId}:deltas"
       Event: { version, delta_id, operation, tile_data, timestamp }
    3. Trigger optional fanout endpoint (e.g., push notification via Colyseus room broadcast)

Client:
  On heartbeat response from `/api/region-diff`:
    1. Receive deltas batch
    2. Check if Redis Stream has newer deltas (via version number)
    3. If stream ahead, subscribe to stream and pull remaining deltas
    4. Apply all in version order

Benefits:
  ✅ Clients always see same delta order (Redis stream ordered)
  ✅ Fanout decoupled from polling interval
  ✅ Server publishes once; all subscribers get same order
  ✅ Replay-safe: stream retention guarantees old deltas always available
```

**Affected Files:**
- [apps/server/src/http/routes/region-diff.routes.ts](apps/server/src/http/routes/region-diff.routes.ts) — Add Redis fanout on delta creation
- [apps/client/src/session/heartbeat-caller.ts](apps/client/src/session/heartbeat-caller.ts) — Subscribe to Redis stream, merge with polled deltas

**Dependencies:**
- Redis instance required (add to `docker-compose.yml`)
- E3-S1 must be complete (checkpoint foundation)

**Effort:** 3–5 weeks

---

### Scenario 3: Exit Criteria Validation (E3-S4 load harness)

**Current State:**
- Load tests exist for region-diff (60 requests) and room-join (40 requests)
- ❌ **No sustained 50 CCU × 30 min harness**
- ❌ **SLA not enforced in CI/CD** — Point 6 harness placeholder only

**Epic Requirement (E3-S4 acceptance criteria):**
- ✅ 50 CCU run passes: 50 concurrent players for 30 min, zero crashes, deterministic outcomes
- ✅ Median placement ack <200ms: P50 HTTP latency < 200ms during run
- ✅ P95 reconnect <3s: Rejoined players recover within 3s

**Implementation Pattern (E3-S4 Load Harness):**

```yaml
# Load Test Definition
load_harness:
  name: "50 CCU Sustained Load + Latency SLA"
  duration_seconds: 1800  # 30 min
  concurrent_players: 50
  
  player_simulation:
    - join_delay_ms: [0, 5000]  # Staggered joins over 5s
    - placement_rate: 1 per 5-10s (randomized)
    - heartbeat_interval: 5000ms
    - disconnect_probability: 0.01 (1% per heartbeat)
    - reconnect_delay_ms: [100, 500]

  telemetry_collection:
    - Track every placement latency (POST → 200 response)
    - Track every reconnect latency (disconnect → session restored)
    - Record errors and crashes
    - Publish to telemetry sink

  sla_gates:
    - Placement Ack P50 < 200ms
    - Placement Ack P95 < 1s
    - Reconnect Latency P95 < 3s
    - Zero crashes / exceptions
    - Deterministic conflict resolution (same winner for concurrent placements)

  output:
    - CSV report: latencies, percentiles, error counts
    - Pass/Fail verdict for CI/CD gate
```

**Affected Files:**
- [apps/server/tests/load/e3-s4-sustained-load.ts](apps/server/tests/load/e3-s4-sustained-load.ts) — Create new sustained load harness
- [apps/server/src/telemetry/telemetry-sink.ts](apps/server/src/telemetry/telemetry-sink.ts) — Ensure latency capture on every event
- `.github/workflows/` — Wire Point 6 gate to E3-S4 harness execution

**Dependencies:**
- E3-S1 and E3-S2 must be complete (reliable join/rejoin, ordered fanout)
- Redis instance deployed for fanout

**Effort:** 2–3 weeks for harness + telemetry integration

---

## Implementation Roadmap

### Phase 1: E3-S1 (Join/Rejoin) — Sprint 2, Weeks 1–3
- Add session checkpoints (DB table, service logic)
- Implement delta TTL retention policy
- Add checksum validation on client replay
- Smoke test: join/disconnect/reconnect cycle

### Phase 2: E3-S2 (Ordered Fanout) — Sprint 2, Weeks 4–8
- Integrate Redis Streams
- Implement fanout broker on server
- Update client heartbeat to merge polled + streamed deltas
- Integration test: multi-client ordering validation

### Phase 3: E3-S3 (Conflict Resolution) — Sprint 3 (parallel after E1)
- Add Lamport clocks to tile metadata
- Implement deterministic winner rules (clock-based tiebreak)
- Conflict detection unit tests
- Load test: concurrent placement at same coordinate

### Phase 4: E3-S4 (50 CCU + Latency SLA) — Sprint 6
- Create sustained load harness (50 players × 30 min)
- Implement telemetry capture for placement latency
- Wire SLA gates to CI/CD Point 6
- Smoke test: verify harness, manual baseline measurement

**Total Effort:** 12–18 weeks (serialized critical path E3-S1 → E3-S2 → E3-S4)

## Alternatives Evaluated & Rejected

### Alternative 1: WebSocket Push Instead of Redis Fanout (E3-S2)
**Approach:** Use Colyseus room broadcast for all tile deltas (via Room plugin)
**Rejected Because:**
- ❌ Colyseus rooms not designed for tile delta sync (designed for game object state)
- ❌ No ordering guarantee across room state patches and tile broadcast (separate protocols)
- ❌ Scaling issue: room must deserialize + re-encode every tile event (expensive at 50 CCU)
- ✅ Redis Streams: simpler ordering, better performance, leverages existing queue pattern

### Alternative 2: Checkpoint Every Placement (E3-S1)
**Approach:** Snapshot full region state at every tile placement
**Rejected Because:**
- ❌ Storage bloat: 50 CCU × 10 placements/min × 30 min = 15k snapshots
- ❌ Replay overhead: client must load full snapshots instead of delta replay
- ✅ Current approach: Light checkpoints (metadata only) + delta replay (O(n) instead of O(n²))

### Alternative 3: Last-Write-Wins Conflict Only (E3-S3)
**Approach:** Skip deterministic conflict resolution; use DB upsert final decision
**Rejected Because:**
- ❌ Non-deterministic tie-breaking: Different clients may see different winners if network reorders
- ❌ Violates E3-S4 requirement: "deterministic outcomes" needed for competitive play trust
- ✅ Current approach: Lamport clocks ensure all clients see same winner
