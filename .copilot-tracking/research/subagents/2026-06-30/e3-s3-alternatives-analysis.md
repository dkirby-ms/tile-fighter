---
title: E3-S3 Alternatives Analysis
description: Deterministic concurrent placement winner strategy analysis for issue #19, with selection and test matrix.
author: Researcher Subagent
ms.date: 2026-06-30
ms.topic: reference
---

## Decision Criteria

Issue #19 requirements for E3-S3 are explicit in docs/layer1-backlog.md:221-227:

* Deterministic winner rule under same-coordinate race
* Idempotent conflict code for loser path
* Same command-id retry must not create duplicate side effects
* Replay window and command-id entropy checks
* Telemetry events `placement_conflict_detected` and `placement_conflict_resolved`

Current baseline behavior from code evidence:

* Tile placement command has no `commandId` field: packages/shared-types/src/index.ts:50-59
* Placement validation and response mapping only support `occupied`/`throttled`: apps/server/src/http/routes/tile.routes.ts:75-90, apps/server/src/http/routes/tile.routes.ts:155-173
* Winner is currently implicit first committer via DB unique constraint and SQLSTATE `23505` mapping to `coordinate_conflict`: apps/server/src/persistence/tile.repository.ts:133-135, apps/server/src/persistence/tile.repository.ts:193-216
* Current load test already demonstrates one 201 winner and remaining 409/429 on hotspot coordinate, but no command-id retry semantics: apps/server/tests/load/room-join-load.ts:91-129
* Existing telemetry names are `tile_persist_conflict`, `tile_place_rejected`, etc., not issue #19 names: apps/server/src/telemetry/telemetry-sink.ts:76-95, apps/server/src/telemetry/telemetry-sink.ts:117-159

Scoring dimensions used:

* Determinism strength
* Idempotency and retry correctness
* Optimistic transaction fit
* Operational complexity and failure risk
* Fit with current stack and migration cost

## Strategy A

### A1. Transactional Command Ledger + Coordinate Unique Constraint (strong consistency)

Implementation summary:

* Add command ledger table keyed by `(region_id, actor_id, command_id)` with request hash, outcome, winner metadata, and `expires_at` for replay window.
* Keep existing `tiles_region_coordinate_unique` as final coordinate arbiter.
* Process placement inside one DB transaction:
  1. Upsert/read ledger row
  2. If existing + same hash, return stored result idempotently
  3. If existing + hash mismatch, return deterministic conflict code (`command_payload_mismatch`)
  4. If new command, attempt tile insert
  5. Persist outcome in ledger (`applied` or `conflict`) and emit conflict telemetry

Determinism guarantees:

* Coordinate winner remains deterministic due to unique constraint enforcement at commit boundary.
* Same `(actor, command_id)` is deterministic because stored ledger outcome is replayed exactly.

Idempotency/retry implications:

* Strong no-duplicate-side-effects guarantee for retries with identical command payload.
* Explicit mismatch detection for command-id reuse with different payload.
* Replay window naturally implemented with `expires_at` retention policy.

Optimistic transaction boundary implications:

* Best fit with existing optimistic transactional shape in repository (`insert tile + bump region version + write delta` in one transaction): apps/server/src/persistence/tile.repository.ts:142-179.
* Adds one additional write/read in same transaction, preserving atomicity and avoiding split-brain outcomes.

Operational complexity/risk:

* Medium complexity (new migration, new repository methods, cleanup job/index).
* Low correctness risk once implemented because DB remains source of truth.
* Good incident forensics due to persisted command outcome trail.

Fit with stack and likely touched files:

* Strong fit with Kysely + Postgres transaction model already used.
* Likely files:
  * apps/server/src/persistence/migrations/1720000000000_tiles.js (pattern reference for adding table/constraints)
  * apps/server/src/persistence/db.ts
  * apps/server/src/persistence/tile.repository.ts
  * apps/server/src/http/routes/tile.routes.ts
  * packages/shared-types/src/index.ts
  * apps/server/src/telemetry/telemetry-sink.ts
  * apps/server/tests/unit/tile.repository.test.ts
  * apps/server/tests/integration/tile-persistence.integration.test.ts
  * apps/server/tests/load/room-join-load.ts

## Strategy B

### B1. Cache-First Idempotency (Redis/in-memory) + DB fallback lookup

Implementation summary:

* Add `commandId` to API contract.
* Use `(region, actor, commandId)` cache key with TTL for dedupe.
* Cache hit returns prior outcome; miss proceeds to DB insert path.
* Optional fallback query from recent deltas/attempt rows when cache miss occurs.

Determinism guarantees:

* Winner for coordinate still deterministic only because DB unique constraint decides races.
* Command-id determinism becomes probabilistic under cache eviction/restart or split cache state.

Idempotency/retry implications:

* Good in happy path.
* Weak under process restart, cache loss, partition, or multi-instance inconsistency.
* Higher risk of duplicate side effects if cache misses and fallback history is incomplete.

Optimistic transaction boundary implications:

* Idempotency decision lives partially outside DB transaction boundary.
* Harder to prove exactly-once effects because outcome storage is not fully atomic with tile insert.

Operational complexity/risk:

* Medium implementation complexity but higher operational risk.
* Additional moving parts (cache sizing, TTL tuning, replication, cold start behavior).
* Troubleshooting idempotency defects is harder due to dual truth (cache + DB).

Fit with stack and likely touched files:

* Moderate fit if Redis already exists; otherwise introduces new infra.
* Likely files similar to Strategy A plus runtime config/env and deployment manifests.

## Strategy C

### C1. Coordinate Advisory Lock Arbitration + Minimal Command Log

Implementation summary:

* Add transaction-scoped advisory lock by coordinate hash before insert.
* Add smaller command log keyed by `(actor_id, command_id)` for replay.
* Winner chosen by lock acquisition order, then insert proceeds.

Determinism guarantees:

* Strong per-coordinate serialization in DB when lock discipline is perfect.
* Determinism can degrade if lock key computation/versioning changes or mixed code paths bypass lock.

Idempotency/retry implications:

* Depends on command log quality.
* Better than cache-first, but weaker auditability than full ledger unless log stores full payload hash and terminal result.

Optimistic transaction boundary implications:

* Lock + insert + log in one transaction is possible.
* Increases risk of lock contention/deadlock and introduces lock ordering constraints.

Operational complexity/risk:

* Highest operational risk.
* Requires careful deadlock prevention and performance tuning under conflict hotspots.
* Harder to reason about under high load than unique-constraint-only arbitration.

Fit with stack and likely touched files:

* Technically feasible in Postgres/Kysely, but introduces advanced DB coupling and lock policy maintenance burden.
* Likely file touch set is similar to Strategy A plus lock utility/helpers.

## Selected Strategy

Selected: Strategy A (Transactional Command Ledger + existing unique-constraint winner).

Why selected:

* Meets all E3-S3 requirements with strongest determinism and idempotency proof surface.
* Keeps winner arbitration where it already is reliable today (DB unique coordinate constraint).
* Extends current transaction model instead of splitting correctness between cache and DB.
* Produces explicit replay-window controls and auditable command outcomes.

Explicit rejection reasons:

* Reject Strategy B:
  * Cannot guarantee no duplicate side effects across restart/eviction without effectively reintroducing a persistent ledger.
  * Violates confidence target for deterministic replay behavior under failure modes.
* Reject Strategy C:
  * Adds lock-heavy complexity and deadlock risk without clear benefit over existing unique-constraint arbitration.
  * Operational burden is higher than Strategy A for comparable or weaker business-level traceability.

Pseudo-code (winner rule + idempotency check):

```text
function placeTile(command, actor, now):
  require command.commandId has required entropy

  begin transaction

  cmd = select placement_commands
        where region_id = command.regionId
          and actor_id = actor
          and command_id = command.commandId
        for update

  payloadHash = hash(command.regionId, command.cellX, command.cellY,
                     command.offsetX, command.offsetY, command.shape,
                     command.color, command.stylePayload)

  if cmd exists:
    if cmd.request_hash != payloadHash:
      commit
      return conflict(code = "command_payload_mismatch", idempotent = true)

    commit
    return cmd.stored_response   // exact replay; no side effects

  insert placement_commands(status="pending", request_hash=payloadHash,
                            expires_at=now + replayWindow)

  try:
    tile = insert into tiles(region_id, cell_x, cell_y, ...)
           // existing unique constraint decides coordinate winner

    sequenceId = bumpRegionVersion(region_id)
    insert tile_deltas(..., version=sequenceId)

    update placement_commands
      set status="applied",
          result_code="placed",
          tile_id=tile.id,
          sequence_id=sequenceId,
          stored_response={ok:true,tileId:tile.id,...}

    emit placement_conflict_resolved only when race was observed
    commit
    return stored_response

  catch unique_coordinate_conflict:
    winner = select tile owner/id at (region_id, cell_x, cell_y)

    update placement_commands
      set status="conflict",
          result_code="occupied",
          winner_tile_id=winner.id,
          stored_response={ok:false,reason:"occupied",idempotentConflict:true}

    emit placement_conflict_detected
    emit placement_conflict_resolved
    commit
    return stored_response
```

## Test Matrix

Matrix aligns directly to docs/layer1-backlog.md:221-227.

| Requirement | Unit tests | Integration tests | Load tests |
| --- | --- | --- | --- |
| Deterministic winner for same coordinate race | Winner-rule function returns stable result for same inputs; unique-conflict mapping remains deterministic | Concurrent place requests to same coordinate from N actors => exactly one 201, remaining idempotent conflict code; verify winner metadata stable | Hotspot at one coordinate with sustained contention; verify single winner per command set and no divergent outcomes across nodes |
| Loser response includes idempotent conflict code | Conflict result serializer returns canonical code (`occupied` + idempotent marker or dedicated code) | Replaying losing command with same commandId returns identical conflict payload/body | Mixed hotspot + retries should not inflate tile count or delta count |
| Retry with same commandId has no duplicate side effects | Ledger dedupe: same hash returns stored response; mismatch hash returns `command_payload_mismatch` | Send same command 10x concurrently and sequentially; assert one DB mutation, one region version increment, one delta | High-QPS duplicate retries with random jitter; assert zero duplicate writes |
| Optimistic transaction boundary integrity | Repository test: ledger write + tile insert + version bump + delta append are atomic | Inject failure between tile insert and ledger update and assert rollback leaves no partial side effects | Chaos load with random DB statement failures; verify no orphan pending commands beyond retry policy |
| Replay window + command-id entropy | Validator rejects weak/short command IDs; expiry checks enforce replay window | Expired commandId retry produces deterministic replay-window rejection | Long-running load validates TTL purge does not break active idempotency guarantees |
| Telemetry events `placement_conflict_detected` and `placement_conflict_resolved` | Telemetry helper unit tests assert event schema and required fields | Conflict race test asserts both events emitted exactly once per conflict resolution decision | Conflict-hotspot run tracks event rate consistency with observed conflict count |

Starting points from current tests to extend:

* apps/server/tests/integration/tile-persistence.integration.test.ts:158-192
* apps/server/tests/load/room-join-load.ts:91-129

## Risks

* Schema growth risk from command ledger retention:
  * Mitigation: TTL index on `expires_at`, periodic purge, and bounded replay window policy.
* Hash canonicalization bugs for idempotency mismatch detection:
  * Mitigation: deterministic JSON canonicalization and golden tests.
* Backward compatibility risk when introducing required `commandId`:
  * Mitigation: temporary compatibility mode with server-generated command IDs for legacy callers, sunset by version flag.
* Event cardinality drift for conflict telemetry under load:
  * Mitigation: define one conflict decision = one detected + one resolved pair, and assert in integration/load tests.
* Multi-instance ordering assumptions:
  * Mitigation: keep source of truth in Postgres transaction, avoid cache-authoritative dedupe.
