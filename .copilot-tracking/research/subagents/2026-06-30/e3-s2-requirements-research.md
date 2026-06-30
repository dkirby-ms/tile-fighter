<!-- markdownlint-disable-file -->
---
title: E3-S2 Requirements Research
description: Implementation requirements research for ordered realtime delta fanout (issue #18), including current-state evidence, gaps, alternatives, and an implementation-ready change plan.
author: Researcher Subagent
ms.date: 2026-06-30
ms.topic: reference
---

## Scope

* Story: E3-S2 ordered realtime delta fanout (issue #18).
* Research-only objective: identify current flow, change points, coverage gaps, telemetry and infra dependencies, and recommend a viable implementation approach for this codebase.
* Acceptance criteria in scope:
* two placements in order -> all subscribers apply same order
* ack timeout -> missing delta retransmitted once
* duplicate delta -> client dedupes via sequence id

## Evidence Log

* Server runtime and transport bootstrap:
* apps/server/src/index.ts:3
* apps/server/src/index.ts:114
* apps/server/src/index.ts:118
* Room behavior and message surface:
* apps/server/src/rooms/arena.room.ts:28
* apps/server/src/rooms/arena.room.ts:50
* Tile write/version creation path:
* apps/server/src/persistence/tile.repository.ts:158
* apps/server/src/persistence/tile.repository.ts:161
* apps/server/src/persistence/tile.repository.ts:427
* apps/server/src/persistence/tile.repository.ts:441
* Ordered delta query path:
* apps/server/src/persistence/region-diff.repository.ts:58
* apps/server/src/persistence/region-diff.repository.ts:63
* apps/server/src/persistence/region-diff.repository.ts:64
* Diff/replay service behavior:
* apps/server/src/domain/region-diff.service.ts:91
* apps/server/src/domain/region-diff.service.ts:101
* apps/server/src/domain/region-diff.service.ts:177
* apps/server/src/domain/region-diff.service.ts:202
* apps/server/src/domain/region-diff.service.ts:226
* Reconnect replay HTTP projection:
* apps/server/src/http/routes/session.routes.ts:176
* apps/server/src/http/routes/session.routes.ts:187
* apps/server/src/http/routes/session.routes.ts:235
* apps/server/src/http/routes/session.routes.ts:239
* Session checkpoint lifecycle/progress:
* apps/server/src/session/session-checkpoint.service.ts:281
* apps/server/src/session/session-checkpoint.service.ts:287
* apps/server/src/session/session-checkpoint.service.ts:317
* apps/server/src/persistence/session-checkpoint.repository.ts:69
* apps/server/src/persistence/session-checkpoint.repository.ts:187
* Telemetry sink surface:
* apps/server/src/telemetry/telemetry-sink.ts:13
* apps/server/src/telemetry/telemetry-sink.ts:242
* apps/server/src/telemetry/telemetry-sink.ts:260
* Config/runtime env surface:
* apps/server/src/config/env.ts:28
* apps/server/src/config/env.ts:30
* apps/server/src/config/env.ts:34
* apps/server/src/config/env.ts:36
* Delta retention and TTL migration:
* apps/server/src/persistence/migrations/1750000000000_session_checkpoints.js:96
* apps/server/src/persistence/migrations/1750000000000_session_checkpoints.js:102
* Local/CI infra:
* docker-compose.yml:1
* docker-compose.yml:3
* .github/workflows/ci.yml:14
* .github/workflows/ci.yml:18
* Existing tests relevant to ordering/version/replay/load:
* apps/server/tests/unit/region-diff.service.test.ts:106
* apps/server/tests/unit/region-diff.service.test.ts:137
* apps/server/tests/unit/region-diff.service.test.ts:202
* apps/server/tests/integration/region-diff.integration.test.ts:271
* apps/client/tests/unit/replay-checksum.test.ts:13
* apps/client/tests/unit/replay-checksum.test.ts:32
* apps/client/tests/unit/replay-checksum.test.ts:82
* apps/server/tests/load/join-rejoin-load.ts:19
* apps/server/tests/load/join-rejoin-load.ts:115
* apps/server/tests/load/room-join-load.ts:27

Negative evidence searches (no matches in scoped paths):

* `delta_sent|delta_acked|delta_retransmitted` in apps/server/src/** and apps/client/src/**: no matches.
* `ackTimeout|ack_timeout|pendingAck|sequenceId|sequence_id|retransmit` in apps/server/src/** and apps/client/src/**: no matches.
* `redis|ioredis|connect-redis|express-session` in apps/server/src/**: no matches.

## Current State

### 1) Flow for placement deltas, version semantics, and ordering

* Tile placement persistence is HTTP-driven and DB-authoritative via `/api/tiles/place` routing to repository insert logic:
* apps/server/src/http/routes/tile.routes.ts:104
* apps/server/src/http/app.ts:116
* apps/server/src/persistence/tile.repository.ts:135
* Each successful mutation (insert/edit/delete) bumps `region_versions.current_version` and writes one `tile_deltas` row with that version.
* apps/server/src/persistence/tile.repository.ts:158
* apps/server/src/persistence/tile.repository.ts:267
* apps/server/src/persistence/tile.repository.ts:339
* apps/server/src/persistence/tile.repository.ts:427
* Delta retrieval is ordered by `(version ASC, id ASC)` from DB, providing deterministic read order for HTTP diff/replay consumers.
* apps/server/src/persistence/region-diff.repository.ts:58
* apps/server/src/persistence/region-diff.repository.ts:63
* apps/server/src/persistence/region-diff.repository.ts:64
* Region diff endpoint compacts latest-by-coordinate and can truncate by `maxTiles`; this is snapshot-like incremental sync, not guaranteed per-event fanout.
* apps/server/src/domain/region-diff.service.ts:91
* apps/server/src/domain/region-diff.service.ts:101
* apps/server/src/domain/region-diff.service.ts:173
* apps/server/src/domain/region-diff.service.ts:177

### 2) Ack/retransmit and dedupe behavior today

* There is no explicit realtime delta delivery contract with ack IDs, ack timeout, pending-ack tracking, or retransmit logic in server or client runtime paths (negative evidence above).
* Client replay apply uses `version` fields and map-overwrite semantics for reconnect payloads, but not realtime sequence-ack dedupe. It computes `appliedVersion = max(version)` and applies deltas in input order.
* apps/client/src/session/replay-checksum.ts:42
* apps/client/src/session/replay-checksum.ts:66
* apps/client/src/session/replay-checksum.ts:70
* apps/client/src/session/replay-checksum.ts:80
* Room currently sends only `joined` event and has no `onMessage` handlers for delta ack.
* apps/server/src/rooms/arena.room.ts:45
* apps/server/src/rooms/arena.room.ts:50

### 3) Ordering guarantees currently available

* Strongest existing ordering primitive is DB version sequencing plus ordered query for pull/replay.
* No documented or implemented guarantee that active subscribers receive push deltas in strict order with retry semantics.
* WS transport exists (Colyseus), but no tile delta broadcast state/message path in `ArenaRoom`.
* apps/server/src/index.ts:114
* apps/server/src/index.ts:118
* apps/server/src/rooms/arena.state.ts:3

## Gaps

### Gap A: No realtime fanout path for tile deltas

* Missing server path from tile mutation to room broadcast payload carrying an ordered sequence.
* Missing client runtime path to consume ordered fanout deltas (current client package exports auth/bootstrap/reconnect/checksum helpers only).
* apps/client/src/index.ts:1

### Gap B: No ack timeout/retransmit mechanism

* No server-side pending-ack registry keyed by session + sequence.
* No timeout scheduler and one-shot retransmit policy for missing ack.
* No client ack message emission API.

### Gap C: No duplicate suppression by sequence id in realtime channel

* Current replay client dedupe is coordinate overwrite plus checksum validation, not sequence-aware realtime dedupe.
* apps/client/src/session/replay-checksum.ts:66
* apps/client/src/session/replay-checksum.ts:80

### Gap D: Telemetry event names required by E3-S2 are absent

* `delta_sent`, `delta_acked`, `delta_retransmitted` are not exposed as typed helpers in `TelemetrySink` and not emitted by current flow.
* apps/server/src/telemetry/telemetry-sink.ts:242
* apps/server/src/telemetry/telemetry-sink.ts:260

### Gap E: Infra/runtime knobs for ack/retransmit are missing

* Config currently has session/reconnect and region-diff limits, but no env for ack timeout, retransmit cap, or pending ack window.
* apps/server/src/config/env.ts:28
* apps/server/src/config/env.ts:36

## Alternatives

### Alternative 1: In-memory room-scoped ordered fanout + one-shot retransmit (single-node)

* Design:
* Emit ordered sequence ID at tile mutation commit (reuse region version as sequence ID).
* Broadcast to room clients from `ArenaRoom`.
* Track pending ack per `(sessionId, sequenceId)` with timeout and max retransmit = 1.
* Client sends ack message with sequence ID.
* Client tracks `lastAppliedSequence` + `seenSequences` window to ignore duplicates.
* Pros:
* Smallest change set.
* Leverages existing single-node assumptions and existing session identity/checkpoint data.
* Fastest path to satisfy E3-S2 acceptance criteria.
* Cons:
* Not multi-instance safe without shared pub/sub.
* Pending ack state lost on process restart.

### Alternative 2: DB-backed outbox + polling dispatcher

* Design:
* Write fanout events to durable outbox table; dispatcher sends ordered events and records ack status/retransmit attempts in DB.
* Pros:
* Durable and restart-safe.
* Easier observability and replay of delivery states.
* Cons:
* Highest complexity and latency overhead.
* Larger schema + worker lifecycle changes than needed for current codebase maturity.

### Alternative 3: Redis pub/sub fanout + local ack registries

* Design:
* Publish ordered delta envelopes via Redis channels; each instance forwards to local clients and tracks local pending acks.
* Pros:
* Multi-instance fanout support.
* Moderate complexity vs full durable outbox.
* Cons:
* Requires Redis infra that is not currently wired in runtime code.
* No durable ack state unless combined with persistent store.

## Recommended Approach

Recommend Alternative 1 for E3-S2 in this repository now.

Rationale tied to codebase:

* Current operational topology is single Postgres dependency in local and CI flows, no Redis runtime wiring in server source.
* docker-compose.yml:1
* .github/workflows/ci.yml:16
* Existing ordering primitive (monotonic region version on write and ordered reads) can directly seed sequence IDs.
* apps/server/src/persistence/tile.repository.ts:427
* apps/server/src/persistence/region-diff.repository.ts:63
* Existing checkpoint/session identity surfaces make per-session ack tracking natural.
* apps/server/src/persistence/session-checkpoint.repository.ts:53
* apps/server/src/session/session-checkpoint.service.ts:281
* This approach meets all three acceptance criteria with lowest blast radius and leaves clear extension points for Redis/pubsub in later stories.

## File-by-File Change Plan

### Server core and room flow

* apps/server/src/rooms/arena.room.ts
* Add typed room message handlers for:
* client -> server ack (`delta_ack` with sequence ID)
* optional subscribe/init handshake for initial sequence watermark
* Add room broadcast method for delta envelopes after placement commit.

* apps/server/src/rooms/arena.state.ts
* Decide whether realtime delta stream metadata belongs in schema state; if not, keep transient messaging only.

* apps/server/src/index.ts
* Wire new fanout coordinator dependency into room options when defining `arena` room.

### Placement integration and fanout coordinator

* apps/server/src/http/app.ts
* After successful `insertTile`/`editTile`/`deleteTile`, invoke fanout coordinator with ordered envelope.
* Ensure send happens only after transaction commit (current repository methods already return post-commit result).

* apps/server/src/persistence/tile.repository.ts
* Expose sequence/version in successful mutation return shape or add lookup helper so fanout event carries exact sequence ID tied to persisted delta row.

* apps/server/src/domain (new file likely)
* Add `delta-fanout.service.ts` (or similar):
* `publishDelta(envelope)`
* pending-ack tracking map keyed by session+sequence
* timeout scheduler
* one retransmit only
* callback to telemetry sink

### Telemetry

* apps/server/src/telemetry/telemetry-sink.ts
* Add typed helpers:
* `emitDeltaSent(...)`
* `emitDeltaAcked(...)`
* `emitDeltaRetransmitted(...)`
* Include sequence ID, room/region, session/client ID, attempt number, latency.

### Config/env/runtime

* apps/server/src/config/env.ts
* Add config keys:
* `DELTA_ACK_TIMEOUT_MS`
* `DELTA_RETRANSMIT_MAX_ATTEMPTS` (default `1`)
* `DELTA_ACK_PENDING_WINDOW_SIZE` or TTL

* .env.example
* Document new variables with safe defaults.

* apps/server/README.md
* Add section for realtime delta delivery policy and ack/retransmit knobs.

### Client

* apps/client/src (new realtime session/fanout module)
* Add delta subscription handler with ordered apply.
* Track `lastAppliedSequence` and reject duplicate sequence IDs.
* Emit ack per applied sequence ID.

* apps/client/src/index.ts
* Export new realtime fanout client API.

## Test Plan

### Unit tests (required by E3-S2)

* Add server unit tests for sequence validation and ack state machine:
* monotonic sequence acceptance
* out-of-order ack ignored/rejected
* timeout -> exactly one retransmit
* no second retransmit after cap

* Suggested location:
* apps/server/tests/unit/delta-fanout.service.test.ts (new)

* Add client unit tests for duplicate suppression by sequence ID:
* same sequence twice -> second ignored
* apply order preserved for increasing sequence IDs

* Suggested location:
* apps/client/tests/unit/realtime-delta-handler.test.ts (new)

### Integration tests (ordered fanout)

* Add integration test with 2+ subscribers in same room:
* perform two placements in order
* assert both subscribers receive and apply same ordered sequence
* assert ack path updates server pending-ack state

* Suggested location:
* apps/server/tests/integration/realtime-delta-fanout.integration.test.ts (new)

Current related but insufficient coverage:

* Region diff integration tests validate pull-based compaction/truncation, not push fanout acking.
* apps/server/tests/integration/region-diff.integration.test.ts:271

### Load tests (ack timeout rate)

* Add load scenario measuring ack timeout and retransmit ratio under dropped-ack simulation.
* Suggested location:
* apps/server/tests/load/realtime-ack-timeout-load.ts (new)

Current load tests do not track delta ack timeout/retransmit metrics:

* apps/server/tests/load/join-rejoin-load.ts:19
* apps/server/tests/load/room-join-load.ts:27
* apps/server/tests/load/region-diff-load.ts:26

## Risks/Mitigations

* Risk: using in-memory pending-ack maps can leak memory under churn.
* Mitigation: bounded pending window, TTL cleanup, and per-session cap metrics.

* Risk: race between rapid placements and ack processing causing false retransmit.
* Mitigation: deterministic timer scheduling, idempotent ack handling, and single source of truth per `(session, sequence)` state.

* Risk: process restart loses pending ack state.
* Mitigation: explicitly document single-node ephemeral behavior for E3-S2 and plan E3 follow-up for distributed durability (Redis or outbox).

* Risk: sequence source ambiguity if not returned from write path.
* Mitigation: return persisted version from repository mutation result to avoid secondary reads.

## Open Questions

* Should sequence ID be strictly `region_versions.current_version`, or should fanout have independent per-room sequence?
* AC text says sequence id; current data model already has per-region version, likely equivalent but should be confirmed.

* Should retransmit target only non-acking client, or rebroadcast to all subscribers with same sequence?
* Preferred for bandwidth is per-client resend.

* What is acceptable ack timeout default for gameplay UX?
* Proposed starting point: 250-500 ms with one retransmit, but product/network SLO should confirm.

* Should duplicate suppression keep only `lastAppliedSequence` (strictly increasing) or a bounded `seenSequences` set to tolerate out-of-order delivery?
* Given acceptance criteria emphasize order, strict monotonic apply with drop of older sequence is likely sufficient.
