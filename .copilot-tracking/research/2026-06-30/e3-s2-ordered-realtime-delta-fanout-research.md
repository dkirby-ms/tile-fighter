<!-- markdownlint-disable-file -->
# Task Research: E3-S2 Ordered Realtime Delta Fanout

Research what is needed to implement story E3-S2 so nearby players receive ordered placement deltas with retransmit-on-timeout and duplicate dedupe by sequence ID.

## Task Implementation Requests

* Determine exact implementation requirements for E3-S2 acceptance criteria
* Identify current server and client capabilities and gaps
* Define file-by-file change plan
* Define test and telemetry requirements
* Evaluate alternatives and select one recommended approach for this codebase

## Scope and Success Criteria

* Scope: E3-S2 only, with dependency notes for E3-S1 and E2-S2 where required
* Assumptions:
  * Story input is issue #18: ordered fanout, one retransmit on ack timeout, dedupe via sequence ID
  * Current monorepo architecture and runtime topology remain as-is unless explicitly changed
  * Work should be implementation-ready for Sprint 2 scope
* Success Criteria:
  * Acceptance criteria mapped to concrete code changes
  * Required tests identified by type and placement
  * Required telemetry and config updates identified
  * A single recommended technical approach selected with rationale

## Outline

1. Baseline current delta flow and ordering guarantees
2. Map gaps against E3-S2 acceptance criteria
3. Evaluate implementation alternatives
4. Select recommended approach
5. Produce file-by-file plan, test plan, risks, and open questions

## Potential Next Research

* Multi-instance topology decision for near-term deployment
  * Reasoning: Determines whether in-memory ack tracking is sufficient or Redis/outbox is required immediately
  * Reference: apps/server/src/index.ts, docker-compose.yml, .github/workflows/ci.yml
* Colyseus message contract conventions for this repo
  * Reasoning: Helps keep new room message names and payloads idiomatic with existing patterns
  * Reference: apps/server/src/rooms/arena.room.ts

## Research Executed

### File Analysis

* apps/server/src/rooms/arena.room.ts
  * Room currently sends joined message and tracks connections, but has no delta ack/retransmit message handlers.
* apps/server/src/persistence/tile.repository.ts
  * Tile mutations bump region version and persist tile_deltas records, providing an ordered sequence primitive.
* apps/server/src/persistence/region-diff.repository.ts
  * Delta retrieval is ordered by version ascending, then id ascending.
* apps/server/src/domain/region-diff.service.ts
  * Region diff is pull-based, compacts by coordinate, and is not realtime ordered fanout.
* apps/server/src/telemetry/telemetry-sink.ts
  * Telemetry helper surface exists, but required E3-S2 events are not present.
* apps/server/src/config/env.ts
  * No ack-timeout/retransmit config knobs exist yet.
* apps/client/src/session/replay-checksum.ts
  * Client replay logic handles versioned replay/checksum but not realtime ack/sequence dedupe.

### Code Search Results

* Search: delta_sent|delta_acked|delta_retransmitted
  * No matches in apps/server/src or apps/client/src.
* Search: ack_timeout|pendingAck|sequence_id|retransmit
  * No direct implementation for ack timeout/retransmit state machine.
* Search: redis|ioredis in runtime server source
  * No active runtime wiring in server code paths.

### Project Conventions

* Standards referenced: existing room-driven realtime transport via Colyseus, DB-authoritative versioning for tile deltas, typed telemetry helper methods
* Instructions followed: Task Researcher mode requirements and .copilot-tracking research file conventions

## Key Discoveries

### Project Structure

E3-S2 needs to bridge two existing patterns that are currently disconnected:

* Realtime transport exists through Colyseus rooms
* Ordered tile delta source of truth exists in DB versioned writes and ordered reads

Today, the system supports pull-based ordered diffs and reconnect replay, but not push fanout with ack/retransmit semantics.

### Implementation Patterns

Current patterns that should be reused:

* Sequence primitive: use region version emitted at mutation commit as delta sequence ID
* Deterministic ordering: preserve version ASC application order client-side and server-side
* Typed telemetry wrapper methods for event emission
* Config-driven runtime behavior in env parser

Patterns currently missing and required:

* Pending-ack registry per subscriber and sequence
* Timeout-driven retransmit once policy
* Client sequence dedupe for realtime stream
* Integration assertions for cross-subscriber order equality

### Complete Examples

```text
AC: two placements in order -> all subscribers apply same order
Server:
1) placement committed with sequence 101
2) broadcast delta(seq=101) to subscribers
3) placement committed with sequence 102
4) broadcast delta(seq=102) to subscribers
Client:
1) receive 101, apply, ack 101
2) receive 102, apply, ack 102
3) enforce monotonic apply rule: nextSequence must be lastApplied+1 or buffered by strict policy
Result:
All subscribers converge on same ordered sequence stream.
```

### Configuration Examples

```text
# Proposed server env additions
DELTA_ACK_TIMEOUT_MS=350
DELTA_RETRANSMIT_MAX_ATTEMPTS=1
DELTA_ACK_PENDING_TTL_MS=30000
DELTA_OUTBOUND_CAP_PER_CONNECTION=128
```

## Technical Scenarios

### Scenario: Implement E3-S2 in Current Architecture

E3-S2 acceptance criteria require ordered fanout semantics that are stronger than the current pull-diff model. The lowest-risk path is to add a dedicated fanout coordinator tied to successful tile writes and room subscriber sessions.

Requirements:

* Every realtime delta includes sequenceId
* Every subscriber processes in same order
* Missing ack triggers one retransmit only
* Duplicate delta is ignored client-side via sequence tracking
* Telemetry emitted for send, ack, retransmit
* Per-connection outbound cap enforced

Preferred Approach:

* Add in-memory room-scoped ordered fanout coordinator using existing single-node assumptions.

```text
server write -> sequence assigned (region version)
            -> fanout coordinator broadcast delta envelope
            -> pendingAck[sessionId, sequenceId] start timer
client receive delta -> dedupe check -> apply -> send ack(sequenceId)
server receive ack -> clear pending
timeout without ack -> retransmit once, emit retransmit telemetry
```

Implementation Details:

* Primary server touchpoints:
  * apps/server/src/rooms/arena.room.ts
  * apps/server/src/http/app.ts
  * apps/server/src/persistence/tile.repository.ts
  * apps/server/src/domain/delta-fanout.service.ts (new)
  * apps/server/src/telemetry/telemetry-sink.ts
  * apps/server/src/config/env.ts
* Primary client touchpoints:
  * apps/client/src/session/realtime-delta-handler.ts (new)
  * apps/client/src/session/heartbeat-caller.ts (integration point as needed)
  * apps/client/src/index.ts
* Supporting docs/config:
  * apps/server/README.md
  * .env.example

#### Considered Alternatives

* Alternative A: Redis Streams/PubSub fanout now
  * Rejected for immediate E3-S2 implementation because runtime wiring is not active in current server paths and it increases infra/deployment blast radius for Sprint 2.
* Alternative B: DB outbox + dispatcher
  * Rejected for E3-S2 due to highest complexity and operational overhead relative to current story scope.
* Alternative C: In-memory room-scoped fanout
  * Selected because it satisfies acceptance criteria with the smallest incremental change and aligns with current architecture.

## File-by-File Change Plan

* apps/server/src/domain/delta-fanout.service.ts (new)
  * Implement delta envelope publish, pending ack registry, timeout scheduling, one retransmit cap, and cleanup.
* apps/server/src/rooms/arena.room.ts
  * Add message handlers for client ack payloads and subscriber registration state.
* apps/server/src/http/app.ts
  * Invoke fanout service after successful tile mutation responses are built from committed writes.
* apps/server/src/persistence/tile.repository.ts
  * Ensure mutation results expose canonical sequence/version needed by fanout payload.
* apps/server/src/telemetry/telemetry-sink.ts
  * Add emitDeltaSent, emitDeltaAcked, emitDeltaRetransmitted helper methods.
* apps/server/src/config/env.ts
  * Add ack timeout and retransmit limits plus outbound cap settings.
* apps/client/src/session/realtime-delta-handler.ts (new)
  * Add ordered apply, sequence dedupe, and ack emission contract.
* apps/client/src/index.ts
  * Export realtime handler surface.

## Test Plan

* Unit: sequence validation and ack state machine
  * apps/server/tests/unit/delta-fanout.service.test.ts (new)
  * Verify monotonic sequence handling, timeout transitions, exactly-once retransmit.
* Unit: client duplicate dedupe and ordering
  * apps/client/tests/unit/realtime-delta-handler.test.ts (new)
  * Verify duplicate sequence ignored, in-order application and ack emission.
* Integration: ordered fanout across subscribers
  * apps/server/tests/integration/realtime-delta-fanout.integration.test.ts (new)
  * Two or more subscribers receive and apply identical sequence order for same placements.
* Load: ack timeout and retransmit rate
  * apps/server/tests/load/realtime-ack-timeout-load.ts (new)
  * Measure timeout percentage and retransmit behavior under dropped-ack simulation.

## Risks and Mitigations

* Risk: memory growth from pending ack map under high churn
  * Mitigation: bounded pending window, TTL cleanup, per-connection caps, telemetry on pending size.
* Risk: false retransmits from race timing near timeout boundary
  * Mitigation: idempotent ack handling and deterministic timeout state transitions.
* Risk: node restart loses pending ack state
  * Mitigation: document single-node limitation in E3-S2; plan distributed durability follow-up.
* Risk: sequence source mismatch between write and fanout payload
  * Mitigation: always emit sequence from committed repository mutation result.

## Open Questions

* Must E3-S2 be multi-instance safe now, or is single-node correctness acceptable for Sprint 2?
* Should retransmit target only the missing-ack subscriber, or room-wide rebroadcast?
* Final default ack timeout value expected by product/network SLOs?
* Strict monotonic dedupe only, or bounded seen-sequence window for tolerance?

## Selected Approach and Why

Selected approach: in-memory room-scoped ordered fanout with one-shot retransmit and client dedupe by sequence ID.

Why this is the best fit now:

* It directly satisfies all E3-S2 acceptance criteria.
* It reuses existing ordering primitives already in production paths.
* It avoids introducing new infrastructure during Sprint 2 while still leaving clean extension points for Redis/outbox later.

## Research Summary

* Primary document: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md
* Supporting subagent evidence: .copilot-tracking/research/subagents/2026-06-30/e3-s2-requirements-research.md
* Key discoveries: 8
* Alternatives evaluated: 3
* Recommended approach: 1 (in-memory ordered fanout + one retransmit)
