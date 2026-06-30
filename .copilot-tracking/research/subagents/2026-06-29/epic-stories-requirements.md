# Epic #3 Research: Real-Time Sync and Room Reliability

**Date:** 2026-06-29  
**Epic:** [dkirby-ms/tile-fighter#3](https://github.com/dkirby-ms/tile-fighter/issues/3)  
**Status:** OPEN  
**Milestone:** Layer 1 MVP  
**Priority:** P1

---

## Epic Overview

### Title
`epic(layer1): E3 real-time sync and room reliability`

### Why Now
Real-time sync reliability is the core MMO trust boundary and enables 50 CCU validation.

### Strategic Context
This epic addresses the fundamental requirement for multiplayer consistency—ensuring players see the same game state and can reliably join/rejoin without desync or ghost sessions.

---

## In-Scope Items

| Item | Description |
|------|-------------|
| **Join/rejoin reliability** | Players must join and rejoin without desync after interruptions (E3-S1) |
| **Ordered delta fanout** | Placement deltas must be delivered in order to all nearby players (E3-S2) |
| **Conflict resolution** | Concurrent placement conflicts must be resolved deterministically (E3-S3) |
| **50 CCU load validation** | System must support 50 concurrent users with <200ms ack latency (E3-S4) |

---

## Out-of-Scope Items

- **Multi-region migration:** Cross-region player movement and state migration
- **>50 CCU auto scale:** Horizontal scaling beyond the 50 CCU validation threshold

---

## Primary Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Desync and ghost sessions** | Critical | Ordered delta fanout + deterministic conflict resolution |
| **Latency budget miss** | High | Load validation with metrics pipeline (E3-S4) |

---

## Stories Breakdown

### E3-S1: Reliable Room Join and Rejoin

**Issue:** [#17](https://github.com/dkirby-ms/tile-fighter/issues/17)  
**Title:** `story(layer1): E3-S1 reliable room join and rejoin`

#### Story
As a player, I can join and rejoin a room without desync after interruptions.

#### Acceptance Criteria
1. **First Join:** Region state initializes correctly on initial room join
   - When: Player joins room for first time
   - Then: Region state is loaded and transmitted to client
   
2. **Transient Disconnect + Reconnect:** Player resumes with same identity after network interruption
   - When: Player experiences transient disconnect
   - Then: Reconnect with reconnect token restores session identity
   
3. **Rejoin Replay:** Client checksum matches server after replay
   - When: Player rejoins after disconnect
   - Then: Client applies state replay and validates checksum

#### Technical Details
- **Component:** Colyseus room lifecycle and reconnect token handling
- **Harness Mapping:** Items 2, 6 (deterministic build/type safety, post-deploy verification)
- **Estimate:** 5 story points
- **Confidence:** Medium
- **Target Sprint:** Sprint 2

#### Telemetry Events
- `room_joined` — Initial room join event
- `room_rejoined` — Successful rejoin after disconnect
- `room_rejoin_failed` — Failed rejoin attempt

#### Testing Requirements
- Integration test: join/rejoin scenarios
- Smoke test: drop/reconnect cycle
- Load test: mass reconnect simulation

#### Security Considerations
- Reconnect token validation
- Stale token rejection
- Token expiration enforcement

#### Dependencies
- E1-S2 (session bootstrap)
- E2-S4 (auth state machine)

#### Addresses In-Scope Item
✅ **Join/rejoin reliability**

---

### E3-S2: Ordered Realtime Delta Fanout

**Issue:** [#18](https://github.com/dkirby-ms/tile-fighter/issues/18)  
**Title:** `story(layer1): E3-S2 ordered realtime delta fanout`

#### Story
As a nearby player, I receive ordered placement deltas so world state appears consistent.

#### Acceptance Criteria
1. **Ordered Placement Delivery:** Two placements delivered in order → all subscribers apply same order
   - When: Two placement commands sent in sequence
   - Then: All clients receive and apply in identical order
   
2. **Ack Timeout Handling:** Missing delta retransmitted once after ack timeout
   - When: Client fails to ack delta within timeout window
   - Then: Delta is retransmitted exactly once
   
3. **Duplicate Delta Deduplication:** Client dedupes duplicate delta via sequence ID
   - When: Client receives duplicate delta
   - Then: Client recognizes duplicate via sequence ID and skips duplicate application

#### Technical Details
- **Component:** Sequence IDs and delta ack strategy
- **Harness Mapping:** Items 2, 6 (deterministic build/type safety, post-deploy verification)
- **Estimate:** 5 story points
- **Confidence:** Medium
- **Target Sprint:** Sprint 2

#### Telemetry Events
- `delta_sent` — Delta fanout to subscribers
- `delta_acked` — Client acknowledgment of delta
- `delta_retransmitted` — Timeout-triggered retransmit

#### Testing Requirements
- Unit test: sequence validation logic
- Integration test: ordered fanout to multiple subscribers
- Load test: ack timeout rate under high concurrency

#### Security Considerations
- Per-connection outbound cap (rate limiting)
- Duplicate detection prevents malicious replay

#### Dependencies
- E3-S1 (join/rejoin must be reliable first)
- E2-S2 (region snapshot foundation)

#### Addresses In-Scope Item
✅ **Ordered delta fanout**

---

### E3-S3: Deterministic Placement Conflict Resolution

**Issue:** [#19](https://github.com/dkirby-ms/tile-fighter/issues/19)  
**Title:** `story(layer1): E3-S3 deterministic placement conflict resolution`

#### Story
As the server, I resolve concurrent placement conflicts deterministically.

#### Acceptance Criteria
1. **Simultaneous Claims:** Deterministic winner rule applies to concurrent claims
   - When: Two players claim same cell simultaneously
   - Then: Server applies deterministic rule (e.g., lowest user_id wins) and resolves
   
2. **Loser Command Idempotency:** Loser command returns idempotent conflict code
   - When: Player receives conflict response
   - Then: Loser can retry with same command and get same conflict code
   
3. **No Duplicate Side Effects:** Retry with same command ID produces no duplicate side effects
   - When: Player retries claim with same command ID
   - Then: Server idempotent key prevents duplicate placement, retry returns same response

#### Technical Details
- **Component:** Idempotency key and optimistic transaction boundary
- **Harness Mapping:** Item 2 (deterministic build/type safety)
- **Estimate:** 3 story points
- **Confidence:** Medium
- **Target Sprint:** Sprint 3

#### Telemetry Events
- `placement_conflict_detected` — Concurrent claim detected
- `placement_conflict_resolved` — Deterministic resolution applied

#### Testing Requirements
- Unit test: deterministic winner rule validation
- Integration test: race simulation with concurrent commands
- Load test: hotspot conflict scenarios (high contention areas)

#### Security Considerations
- Command ID replay window checks (prevent infinite retries)
- Idempotency key lifecycle management

#### Dependencies
- E2-S2 (region snapshot foundation for conflict detection)

#### Addresses In-Scope Item
✅ **Conflict resolution**

---

### E3-S4: 50 CCU and Latency Budget Validation

**Issue:** [#20](https://github.com/dkirby-ms/tile-fighter/issues/20)  
**Title:** `story(layer1): E3-S4 50 CCU and latency budget validation`

#### Story
As a producer, I can validate 50 CCU and placement ack latency under 200 ms median.

#### Acceptance Criteria
1. **50 CCU Latency Budget:** 50 CCU sustained for 30 minutes → median ack latency <200 ms
   - When: Load harness sustains 50 concurrent users for 30 minutes
   - Then: Metrics show median placement ack latency below 200 ms threshold
   
2. **Reconnect P95 SLA:** Load run completed → p95 reconnect latency <3 seconds
   - When: Load harness completes 50 CCU run
   - Then: Metrics show p95 reconnect latency below 3 second threshold
   
3. **Budget Regression Gate:** Budget regression → release candidate blocked
   - When: Load metrics indicate regression vs. previous baseline
   - Then: Automated gate blocks release candidate

#### Technical Details
- **Component:** Load harness and metrics export pipeline
- **Harness Mapping:** Items 2, 6, 7 (deterministic build/type safety, post-deploy verification, operations and rollback)
- **Estimate:** 5 story points
- **Confidence:** Medium
- **Target Sprint:** Sprint 6

#### Telemetry Events
- `load_run_started` — Load harness initialized
- `load_run_completed` — Load run finished
- `latency_budget_violation` — SLA violation detected

#### Testing Requirements
- Load test: 50 CCU sustained for 30 minutes
- Integration test: metrics ingestion pipeline validation
- Smoke test: 10 CCU sanity check

#### Security Considerations
- Isolated synthetic credentials for load runs (prevent test data pollution)
- Load test traffic source isolation

#### Dependencies
- E3-S2 (ordered delta fanout must work reliably)
- E3-S3 (conflict resolution must be deterministic)

#### Addresses In-Scope Item
✅ **50 CCU load validation**

---

## Harness Mapping Reference

### Item 2: Deterministic Build and Type Safety
**Referenced by:** E3-S1, E3-S2, E3-S3, E3-S4

**Scope:** All stories require deterministic build outputs and strong TypeScript type safety for replay/idempotency validation.

**Implementation Points:**
- Sequence ID type safety (E3-S2)
- Deterministic winner rule (E3-S3)
- Idempotency key types (E3-S3)
- Load metrics export (E3-S4)

---

### Item 6: Post-Deploy Verification
**Referenced by:** E3-S1, E3-S2, E3-S4

**Scope:** Smoke and integration tests that verify sync behavior after deployment.

**Implementation Points:**
- Join/rejoin smoke tests (E3-S1)
- Ordered fanout integration tests (E3-S2)
- Metrics pipeline smoke tests (E3-S4)

---

### Item 7: Operations and Rollback
**Referenced by:** E3-S4

**Scope:** Load harness operations, budget baseline tracking, and automated regression gates.

**Implementation Points:**
- Load run baseline establishment (E3-S4)
- Automated regression detection (E3-S4)
- Release candidate blocking (E3-S4)

---

## Exit Criteria Analysis

### Criterion 1: 50 CCU Run Passes

**What it tests:**
- System stability under 50 concurrent players
- Delta fanout reliability at scale
- Reconnect storm resilience
- Server resource utilization (CPU, memory, connections)

**Where it's measured:**
- Load harness in `apps/server/tests/load/`
- Metrics exported to telemetry pipeline
- Baseline comparison against previous release candidate

**Validation gates:**
- ✅ 30-minute sustained load completes without crashes
- ✅ Median placement ack <200 ms (E3-S4 AC#1)
- ✅ P95 reconnect <3s (E3-S4 AC#2)

---

### Criterion 2: Median Placement Ack <200 ms in Target Test

**What it measures:**
- End-to-end latency from client placement command send → server ack receipt
- Includes: network transit, server processing, delta fanout, client ack send

**Where it's measured:**
- Telemetry sink in `apps/server/src/telemetry/telemetry-sink.ts`
- Load test client in `apps/server/tests/load/room-join-load.ts`
- Metrics exported to observability backend

**Test conditions:**
- 50 CCU over 30 minutes
- Placement commands at steady rate
- Normal network conditions (no synthetic delays)
- Colocation: load client and server in same region

**Metrics components:**
1. **delta_sent timestamp** — server processes command
2. **delta_acked timestamp** — client receives ack
3. **Latency = delta_acked - delta_sent**

**Acceptable distribution:**
- Median (p50): <200 ms ✅
- p95: <500 ms (implicit from M3 story)
- p99: <1000 ms (safety margin)

---

## Story Map: Dependency Graph

```
E1-S2 (session bootstrap)
  ↓
E2-S4 (auth state machine)
  ↓
E3-S1 (join/rejoin reliability)
  ├─→ E3-S2 (ordered delta fanout)
  │     ├─→ E3-S4 (50 CCU validation) ✅ GATE
  │     └─→ E2-S2 (region snapshot)
  │
  └─→ E3-S3 (conflict resolution)
        ├─→ E3-S4 (50 CCU validation) ✅ GATE
        └─→ E2-S2 (region snapshot)
```

---

## Summary Table

| Story | Issue | Title | Sprint | Estimate | Depends On | Enables | Status |
|-------|-------|-------|--------|----------|-----------|---------|--------|
| E3-S1 | #17 | Reliable join/rejoin | 2 | 5 pts | E1-S2, E2-S4 | E3-S2, E3-S3 | Ready |
| E3-S2 | #18 | Ordered delta fanout | 2 | 5 pts | E3-S1, E2-S2 | E3-S4 | Ready |
| E3-S3 | #19 | Deterministic conflict resolution | 3 | 3 pts | E2-S2 | E3-S4 | Ready |
| E3-S4 | #20 | 50 CCU + latency budget | 6 | 5 pts | E3-S2, E3-S3 | Epic exit gate | Ready |

---

## Key Insights

1. **Critical Path:** E3-S1 → E3-S2 → E3-S4 (join reliability must precede fanout testing)
2. **Parallel Track:** E3-S3 can proceed independently after E2-S2 lands
3. **Gate Control:** E3-S4 is the hard exit gate for epic; all stories must complete first
4. **Load Testing Priority:** Load harness (E3-S4) is Sprint 6, allowing 3+ sprints for stability maturation
5. **Telemetry Requirement:** All stories feed events to the metrics pipeline for E3-S4 validation

---

## Risk Mitigation Checklist

- [ ] E3-S1: Validate reconnect token TTL prevents stale session reuse
- [ ] E3-S2: Implement per-connection outbound cap to prevent fanout DoS
- [ ] E3-S3: Test idempotency key collision handling under high command rate
- [ ] E3-S4: Establish baseline metrics before first load run; use as regression threshold

---

**Research completed:** 2026-06-29  
**Researcher notes:** Epic E3 provides clear sprint roadmap with well-defined dependencies. Critical path is join reliability (S1) → fanout (S2) → validation (S4). Conflict resolution (S3) runs parallel. Load testing (S4) is properly gated to Sprint 6 after stability work.
