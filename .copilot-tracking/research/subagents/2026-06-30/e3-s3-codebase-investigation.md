<!-- markdownlint-disable-file -->
---
title: E3-S3 Codebase Investigation
description: Research-only analysis for issue #19 deterministic placement conflict resolution in tile-fighter.
author: Researcher Subagent
ms.date: 2026-06-30
ms.topic: reference
---

## Scope

* Objective: analyze server placement/conflict paths for E3-S3 (#19), determine current behavior for simultaneous claims and same-command retries, identify gaps versus acceptance criteria, and propose implementation-ready options.
* Constraints: research only, no code changes.
* Acceptance criteria evaluated:
* deterministic winner rule
* loser idempotent conflict code
* retry with same command id has no duplicate side effects
* replay window checks
* telemetry events `placement_conflict_detected` and `placement_conflict_resolved`

## Files Analyzed

* Command contract and HTTP placement handling:
* packages/shared-types/src/index.ts:50
* packages/shared-types/src/index.ts:77
* apps/server/src/http/routes/tile.routes.ts:75
* apps/server/src/http/routes/tile.routes.ts:112
* apps/server/src/http/routes/tile.routes.ts:124
* apps/server/src/http/routes/tile.routes.ts:173
* apps/server/src/http/app.ts:128
* apps/server/src/http/app.ts:142
* apps/server/src/http/app.ts:155
* apps/server/src/http/app.ts:201

* Conflict detection, transaction boundaries, and version sequencing:
* apps/server/src/persistence/migrations/1720000000000_tiles.js:59
* apps/server/src/persistence/tile.repository.ts:116
* apps/server/src/persistence/tile.repository.ts:137
* apps/server/src/persistence/tile.repository.ts:142
* apps/server/src/persistence/tile.repository.ts:193
* apps/server/src/persistence/tile.repository.ts:201
* apps/server/src/persistence/tile.repository.ts:208
* apps/server/src/persistence/tile.repository.ts:431
* apps/server/src/persistence/tile.repository.ts:439

* Realtime ordering/ack fanout and telemetry:
* apps/server/src/domain/delta-fanout.service.ts:49
* apps/server/src/domain/delta-fanout.service.ts:77
* apps/server/src/domain/delta-fanout.service.ts:117
* apps/server/src/domain/delta-fanout.service.ts:140
* apps/server/src/domain/delta-fanout.service.ts:147
* apps/server/src/rooms/arena.room.ts:32
* apps/server/src/rooms/arena.room.ts:67
* apps/server/src/rooms/arena.room.ts:114
* apps/server/src/rooms/arena.room.ts:125
* apps/server/src/rooms/arena.room.ts:145
* apps/server/src/index.ts:71
* apps/server/src/index.ts:77
* apps/server/src/config/env.ts:70
* apps/server/src/config/env.ts:121
* apps/server/src/telemetry/telemetry-sink.ts:76
* apps/server/src/telemetry/telemetry-sink.ts:100
* apps/server/src/telemetry/telemetry-sink.ts:120
* apps/server/src/telemetry/telemetry-sink.ts:140
* apps/server/src/telemetry/telemetry-sink.ts:242
* apps/server/src/telemetry/telemetry-sink.ts:260
* apps/server/src/telemetry/telemetry-sink.ts:282

* Replay window/replay protections (session/reconnect):
* apps/server/src/http/routes/session.routes.ts:197
* apps/server/src/http/routes/session.routes.ts:235
* apps/server/src/session/session-checkpoint.service.ts:282
* apps/server/src/session/session-checkpoint.service.ts:287
* apps/server/src/session/session-checkpoint.service.ts:322

* Tests for contention/race/idempotency/load:
* apps/server/tests/load/room-join-load.ts:27
* apps/server/tests/load/room-join-load.ts:110
* apps/server/tests/load/room-join-load.ts:111
* apps/server/tests/load/room-join-load.ts:112
* apps/server/tests/integration/tile-persistence.integration.test.ts:158
* apps/server/tests/integration/tile-persistence.integration.test.ts:192
* apps/server/tests/integration/tile-persistence.integration.test.ts:557
* apps/server/tests/unit/tile.repository.test.ts:51
* apps/server/tests/unit/tile.repository.test.ts:77
* apps/server/tests/unit/delta-fanout.service.test.ts:82
* apps/server/tests/unit/delta-fanout.service.test.ts:102
* apps/server/tests/unit/delta-fanout.service.test.ts:123
* apps/server/tests/integration/realtime-delta-fanout.integration.test.ts:55
* apps/server/tests/integration/realtime-delta-fanout.integration.test.ts:124
* apps/server/tests/integration/realtime-delta-fanout.integration.test.ts:154
* apps/server/tests/integration/realtime-delta-fanout.integration.test.ts:288

## Current Behavior

* Placement command handling:
* `TilePlaceCommand` currently has no `commandId`; payload is region/cell/style only.
* Validation and routing happen in `createTileRoutes`; result maps are `201` success, `409 occupied`, `429 throttled`.
* No route-level command-id idempotency cache/table lookup exists.

* Conflict detection/resolution:
* Deterministic winner today is implicit first-committer-wins by DB unique constraint on `(region_id, cell_x, cell_y)`.
* Repository catches SQLSTATE `23505` and maps to domain `coordinate_conflict`; HTTP maps this to `occupied`.
* Behavior is deterministic at the coordinate level but does not expose winner identity/clock semantics.

* Idempotency/replay protections:
* Placement path has no command id, no idempotency key persistence, and no replay window on placement commands.
* Existing replay protections are implemented for join/reconnect tokens and replay payload assembly, not placement command dedupe.
* `token_replay_detected` exists in session flows, separate from tile placement.

* Optimistic transaction boundaries:
* `insertTile`, `editTileWithinSelfEditWindow`, and `deleteTile` are wrapped in `withTransaction`.
* Successful writes bump `region_versions` (row lock via `forUpdate`) and append `tile_deltas` in the same transaction.
* This gives atomic mutation+versioning but no explicit optimistic concurrency token from client command metadata.

* Telemetry events for placement/conflict:
* Present: `tile_placed`, `tile_place_rejected`, `tile_place_throttled`, `tile_persist_conflict`, `delta_sent`, `delta_acked`, `delta_retransmitted`.
* Missing exact issue #19 names: `placement_conflict_detected`, `placement_conflict_resolved`.
* Realtime delta telemetry is partially under-specified in room callbacks (`regionId`/`sessionId` placeholders in some callbacks).

* Existing race/load tests:
* Load test validates one winner (`201`) with mixed `409/429` under contention on one coordinate.
* Integration/unit tests validate duplicate coordinate conflict mapping and throttle recovery.
* Delta fanout unit/integration tests validate ordering, ack idempotency, timeout retransmit max=1, and interleaving behavior.

### Simultaneous claims behavior

* When two or more concurrent place requests target the same `(regionId, cellX, cellY)`:
* exactly one insert succeeds (`201`), governed by DB unique constraint race outcome.
* others become `coordinate_conflict` in repository, mapped to API `409 { ok:false, reason:"occupied" }`.
* winner selection is deterministic from DB commit ordering, but not expressed as an explicit domain winner rule in code comments/contracts.

### Retry with same command id behavior

* There is currently no placement `commandId` in shared types or route validation.
* Therefore retry-with-same-command-id semantics do not exist for placement.
* A repeated request can either:
* return `409 occupied` (same coordinate now taken), or
* create additional side effects if request parameters differ or target a different coordinate.
* No dedupe table/TTL window currently prevents duplicate placement side effects by command identity.

## Gaps

* Gap 1: Deterministic winner rule not explicitly modeled for E3-S3.
* Current behavior is DB-first-commit wins, but there is no explicit `winnerRule` contract/event payload and no canonical tie-break metadata persisted for conflict decisions.

* Gap 2: Loser idempotent conflict code is not command-id aware.
* Losers get `occupied`, but there is no idempotent conflict replay keyed by `(player, commandId)`.

* Gap 3: Retry same command id no-side-effect guarantee is missing.
* No `commandId` field, no command ledger table, no dedupe upsert/lookup, no replayed-success return behavior.

* Gap 4: Replay window checks are present for reconnect/session tokens, not placement commands.
* Placement has throttle window but not replay protection window keyed by command id.

* Gap 5: Required telemetry names are missing.
* `placement_conflict_detected` and `placement_conflict_resolved` are not emitted.

## Alternatives

### Alternative A: Command Ledger Table (Strong Idempotency, Recommended)

* Data model:
* add `placement_commands` table with unique key on `(region_id, actor_id, command_id)`.
* columns: `command_id`, `actor_id`, `region_id`, `cell_x`, `cell_y`, `request_hash`, `status` (`applied|conflict|replayed`), `winning_tile_id` nullable, `conflict_code`, `created_at`, `expires_at`.
* optional index for replay window purge by `expires_at`.

* Service/repository changes:
* extend `TilePlaceCommand` with `commandId`.
* in a single transaction:
* upsert/read command ledger row first.
* if existing row with same request hash: return stored result idempotently (no new tile write).
* if existing row with different payload hash: return deterministic `409` conflict code (`command_payload_mismatch`).
* if new row: attempt tile insert; on success mark ledger `applied`; on unique conflict mark ledger `conflict` and persist winner reference when resolvable.
* emit `placement_conflict_detected` at detection and `placement_conflict_resolved` after resolution decision (include winner/loser metadata).

* Tests:
* concurrent same-coordinate different actors: deterministic one winner + one loser event pair.
* same actor retry same commandId same payload: identical response, no extra tile/version/delta side effects.
* same actor retry same commandId different payload: deterministic mismatch code.
* replay window expiration behavior.

* Trade-offs:
* Pros: strongest correctness and auditability, explicit idempotency semantics, easiest to reason in load/incident analysis.
* Cons: schema + transaction complexity; additional storage/cleanup job required.

### Alternative B: Embedded CommandId on `tile_deltas` + Redis/In-memory Dedupe Cache (Lower DB Change)

* Data model:
* add nullable `command_id` and `actor_id` to `tile_deltas` (or a lightweight `placement_attempts` table without full status machine).

* Service/repository changes:
* route requires `commandId`.
* dedupe via cache key `(region,actor,commandId)` with TTL and best-effort persistence fallback query against recent `tile_deltas`/attempt rows.
* on cache hit, return prior outcome if found.

* Tests:
* similar to Alternative A but include restart/cache-eviction scenarios and fallback query correctness.

* Trade-offs:
* Pros: smaller initial migration and faster implementation.
* Cons: weaker guarantees across restart/multi-instance/cache eviction; harder to prove no duplicate side effects under failures.

### Alternative C: DB Advisory Lock Winner Arbitration + Minimal Command Log

* Data model:
* small `placement_command_log` table keyed by `(actor_id, command_id)` with status and response blob.

* Service/repository changes:
* acquire transaction-scoped advisory lock on coordinate hash before insert to enforce explicit deterministic arbitration order.
* write/read command log for idempotent retries.

* Tests:
* lock contention under load; retry semantics; no deadlock regressions.

* Trade-offs:
* Pros: explicit deterministic arbitration per coordinate.
* Cons: lock tuning and deadlock risks; heavier DB coupling than Alternative A while offering less business-level traceability.

## Recommended Next Research

* Validate issue #19 exact response contract for loser idempotent conflict code naming and payload shape (current code only returns `occupied`).
* Decide replay window policy for placement command IDs (duration, storage TTL, purge strategy).
* Confirm whether winner metadata must be returned to losers or telemetry-only.
* Validate fanout integration in `createHttpApp` currently calls `publish(new Set(), ...)`; confirm intended subscriber source, because empty set means no sends unless coordinator manages elsewhere.
* Audit room retransmit callback metadata completeness (`sessionId`/`regionId` placeholders) before adding conflict telemetry dependencies.
* Add focused load test for duplicate same-command retries at high concurrency once implementation starts.
