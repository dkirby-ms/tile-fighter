---
title: Issue 15 Region Snapshot Replay Recovery Research
description: Research findings for story(layer1) E2-S3 region snapshot and replay recovery in dkirby-ms/tile-fighter.
author: GitHub Copilot Researcher Subagent
ms.date: 2026-06-29
ms.topic: reference
keywords:
  - issue-15
  - snapshots
  - replay
  - recovery
  - layer1
estimated_reading_time: 18
---

## Scope

This report investigates GitHub issue #15 in dkirby-ms/tile-fighter: story(layer1): E2-S3 region snapshot and replay recovery.

Research questions:

1. What is the intended scope and acceptance criteria for E2-S3?
2. Which existing architecture and code paths are directly relevant?
3. Which tests already cover adjacent behavior and what gaps remain for E2-S3?
4. What implementation alternatives are viable in this codebase?
5. What approach is recommended with a concrete file-level change plan?

## Evidence Log

Issue and backlog intent:

* GitHub issue #15 body explicitly defines story, acceptance criteria, telemetry events, operator-role restriction, and dependency on E2-S2. Source: GitHub issue `dkirby-ms/tile-fighter#15` (retrieved during this research session).
* `docs/layer1-backlog.md:147` defines E2-S3 with the same acceptance criteria and constraints.
* `docs/layer1-backlog.md:151` requires immutable snapshot metadata on trigger.
* `docs/layer1-backlog.md:152` requires replay restore of last consistent snapshot after region failure.
* `docs/layer1-backlog.md:153` requires a post-replay expected hash check.
* `docs/layer1-backlog.md:155` requires integration, smoke, and ops-simulation tests.
* `docs/layer1-backlog.md:156` requires telemetry events `snapshot_created`, `snapshot_restore_started`, `snapshot_restore_completed`.
* `docs/layer1-backlog.md:157` requires replay command access restriction to operator role.

System architecture and lifecycle evidence:

* Room lifecycle currently centers on `ArenaRoom` with `onCreate`, `onAuth`, `onJoin`, and `onLeave`: `apps/server/src/rooms/arena.room.ts:22`, `apps/server/src/rooms/arena.room.ts:28`, `apps/server/src/rooms/arena.room.ts:37`, `apps/server/src/rooms/arena.room.ts:45`, `apps/server/src/rooms/arena.room.ts:53`.
* Current room state is combat-only (`tick`, `playerAHealth`, `playerBHealth`), not tile-region snapshot state: `apps/server/src/rooms/arena.state.ts:3`, `apps/server/src/rooms/arena.state.ts:5`, `apps/server/src/rooms/arena.state.ts:8`, `apps/server/src/rooms/arena.state.ts:11`.
* Startup wiring creates DB runtime, verifies connectivity, starts lifecycle cleanup, and registers Colyseus room/auth/lifecycle services: `apps/server/src/index.ts:20`, `apps/server/src/index.ts:22`, `apps/server/src/index.ts:23`, `apps/server/src/index.ts:33`, `apps/server/src/index.ts:71`, `apps/server/src/index.ts:77`.
* Session bootstrap and heartbeat flows are already first-class HTTP routes with rate limits: `apps/server/src/http/routes/session.routes.ts:18`, `apps/server/src/http/routes/session.routes.ts:20`, `apps/server/src/http/routes/session.routes.ts:50`, `apps/server/src/http/routes/session.routes.ts:101`, `apps/server/src/http/routes/session.routes.ts:139`.
* Lifecycle metadata service tracks presence, heartbeats, stale cleanup, and emits `presence_cleared`: `apps/server/src/session/session-lifecycle.service.ts:16`, `apps/server/src/session/session-lifecycle.service.ts:45`, `apps/server/src/session/session-lifecycle.service.ts:68`, `apps/server/src/session/session-lifecycle.service.ts:93`.

Persistence and migration evidence:

* Tile persistence schema exists and is region-coordinate keyed: `apps/server/src/persistence/migrations/1720000000000_tiles.js:7`, `apps/server/src/persistence/migrations/1720000000000_tiles.js:59`.
* Region and coordinate lookup indexes already exist: `apps/server/src/persistence/migrations/1720000000000_tiles.js:73`, `apps/server/src/persistence/migrations/1720000000000_tiles.js:74`.
* Repository supports insert/edit and region/coordinate reads needed for snapshot materialization: `apps/server/src/persistence/tile.repository.ts:90`, `apps/server/src/persistence/tile.repository.ts:154`, `apps/server/src/persistence/tile.repository.ts:208`, `apps/server/src/persistence/tile.repository.ts:223`.
* HTTP tile routes support authoritative placement and edit window but no snapshot/replay endpoint exists: `apps/server/src/http/routes/tile.routes.ts:100`, `apps/server/src/http/routes/tile.routes.ts:103`, `apps/server/src/http/routes/tile.routes.ts:144`.

Telemetry and auth evidence:

* Generic telemetry emission exists and can add new event names without sink code changes: `apps/server/src/telemetry/telemetry-sink.ts:15`.
* Tile-specific and session-specific telemetry patterns already established: `apps/server/src/telemetry/telemetry-sink.ts:100`, `apps/server/src/http/routes/session.routes.ts:68`, `apps/server/src/http/routes/session.routes.ts:90`.
* Authenticated principal currently has identity and tenant claims but no explicit role/authorization fields: `packages/shared-types/src/index.ts:3`.
* Middleware only validates token and stores principal; it does not enforce role-level policy: `apps/server/src/http/auth-middleware.ts:4`.

Testing surface evidence:

* Bootstrap lifecycle integration tests exist: `apps/server/tests/integration/session-bootstrap.integration.test.ts:8`.
* Heartbeat lifecycle integration tests exist (including throttle): `apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts:9`, `apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts:78`.
* Startup migration smoke tests validate tile schema/index constraints: `apps/server/tests/integration/startup-migration.smoke.test.ts:33`, `apps/server/tests/integration/startup-migration.smoke.test.ts:125`.
* Tile persistence integration tests validate region queries and coordinate conflict behavior: `apps/server/tests/integration/tile-persistence.integration.test.ts:50`, `apps/server/tests/integration/tile-persistence.integration.test.ts:177`.
* Unit coverage exists for lifecycle cleanup and join-token replay prevention, but not region snapshot replay: `apps/server/tests/unit/session-lifecycle.service.test.ts:5`, `apps/server/tests/unit/join-token.service.test.ts:57`.

Observed gaps from source search:

* No server code currently contains E2-S3 telemetry names (`snapshot_created`, `snapshot_restore_started`, `snapshot_restore_completed`).
* No dedicated snapshot/replay service, repository, migration, route, or command path exists.
* No hash/checksum computation utility currently exists for region tile state validation in server code.

## Key Discoveries

1. Issue intent is fully specified and unambiguous

The GitHub issue body and backlog entry align exactly on acceptance criteria, telemetry, and authorization requirements. This removes ambiguity about expected behavior for #15 and reduces planning risk.

2. The current architecture favors persistence-first recovery

The strongest existing primitives are Kysely-backed tile persistence and region/coordinate queries, not room-state snapshot objects. Recovery should therefore anchor to persisted region tiles rather than Colyseus room memory state.

3. There is no existing snapshot/replay command path

Current routes cover bootstrap/join-token/heartbeat and tile place/edit. There is no operator-only endpoint or internal command for snapshot trigger/restore. This is the central implementation gap.

4. Authorization model currently lacks operator-role semantics

Authenticated principal typing does not include operator role claims. E2-S3 requires role-restricted replay commands, so either role claims must be added to principal mapping or operator authorization must be introduced at a separate boundary.

5. Telemetry infrastructure is ready for E2-S3

`TelemetrySink.emit` supports arbitrary event names and key/value attributes, so E2-S3 telemetry requirements can be satisfied without redesigning sink abstractions.

6. There is a migration pattern suitable for snapshot tables

The project already uses node-pg-migrate with robust startup smoke coverage. Adding immutable snapshot metadata and optional snapshot-item tables follows existing migration and validation patterns.

7. Test harnesses already cover adjacent reliability behavior

Existing integration tests for lifecycle, auth, and persistence provide a template for E2-S3 integration/smoke tests, but there is no current coverage of snapshot creation, replay restore, or hash verification.

8. Replay safety precedent exists in join-token replay detection

Join-token replay prevention (`consumedJoinTokenIds`) demonstrates a local anti-replay pattern that can inform idempotent restore command handling for operator-triggered replay.

## Alternatives

### Alternative A: Metadata-only snapshot with deterministic replay from canonical tiles

Design:

* Add a `region_snapshots` table that stores immutable metadata only (region id, snapshot id, created at, trigger actor, tile count, deterministic hash).
* On snapshot trigger: read current tiles for region from `tiles`, compute deterministic hash, write metadata row.
* On replay restore: identify last snapshot metadata row, reconstruct expected hash from current tiles source-of-truth plus deterministic ordering checks, and execute replay through idempotent command path that rehydrates region state cache (if introduced) or emits restore completion only when hash matches.

Pros:

* Minimal storage growth.
* Aligns with existing `tiles` as canonical data model.
* Fast to implement with current repository patterns.

Cons:

* Replay cannot recover from corruption/loss in `tiles` itself.
* "Restore" is mostly a consistency re-materialization operation unless additional history is tracked.

Best fit when:

* Region recovery means rebuilding in-memory/runtime state from durable canonical rows, not point-in-time rollback of persisted data.

### Alternative B: Full snapshot copy (metadata + immutable snapshot tile rows)

Design:

* Add `region_snapshots` metadata table and `region_snapshot_tiles` immutable snapshot payload table.
* On snapshot trigger: copy region tile set into snapshot payload rows and store hash.
* On replay restore: transactional restore from snapshot payload into `tiles` (replace region rows), verify post-restore hash, then mark restore completed.

Pros:

* True point-in-time restore even if canonical `tiles` drift/corrupt.
* Strongest interpretation of disaster recovery semantics.

Cons:

* Higher write amplification and storage cost.
* More complex migration and restore transaction logic.

Best fit when:

* Recovery expectations include rollback of persisted region data itself after bad writes.

### Alternative C: Event-sourced delta log plus checkpoint snapshots

Design:

* Introduce append-only region event log for tile operations plus periodic snapshots.
* Replay reconstructs region state by checkpoint + event tail application.

Pros:

* Best long-term support for replay, auditability, and deterministic reconstruction.
* Naturally supports future E3 ordered-delta and checksum requirements.

Cons:

* Largest scope and highest complexity for current story estimate (5 points).
* Requires substantial new contracts and testing surface.

Best fit when:

* Team is ready to shift core persistence model toward event-sourcing.

## Selected Approach

Recommended approach: Alternative B (full snapshot copy), implemented in a bounded Phase-1 for #15.

Rationale:

* E2-S3 language uses "restore last consistent snapshot" and "service recovery is predictable," which implies recovery from bad region state, not only in-memory rematerialization.
* Full snapshot copy is the smallest design that reliably satisfies immutable metadata, replay restore, and post-replay hash verification under failure scenarios.
* Existing persistence and test patterns support this without re-architecting into full event sourcing.

Scope guardrails to keep #15 tractable:

* Implement operator-triggered snapshot and restore for one region at a time.
* Use one deterministic region hash algorithm shared by create/restore verification paths.
* Skip cross-region orchestration and asynchronous workers in first pass; model "snapshot worker" as service boundary with synchronous implementation initially.

Assumptions:

* Assumption A1: Region identity is the same `regionId` used by tile routes/repository.
* Assumption A2: Operator role can be asserted from existing token claims after principal extension.
* Assumption A3: Initial replay command path may be HTTP admin route; later can be moved to job worker/queue.

## Implementation Checklist

Database and contracts:

* Add migration for `region_snapshots` and `region_snapshot_tiles` with immutable constraints in `apps/server/src/persistence/migrations`.
* Extend `apps/server/src/persistence/db.ts` with new table typings and select/insert/update helpers.
* Add shared result/command types in `packages/shared-types/src/index.ts` for snapshot trigger and replay outcomes.

Persistence and domain services:

* Add `apps/server/src/persistence/region-snapshot.repository.ts` with:
  * create snapshot metadata row
  * bulk copy tiles into snapshot payload rows
  * load latest snapshot for region
  * transactional restore from snapshot payload to `tiles`
* Add `apps/server/src/domain/region-snapshot.service.ts` implementing deterministic hash generation and orchestration.
* Define deterministic ordering for hashing (recommended: `region_id`, `cell_x`, `cell_y`, then stable JSON serialization of style payload).

HTTP and auth boundaries:

* Add admin routes in `apps/server/src/http/routes/snapshot.routes.ts`:
  * `POST /api/admin/regions/:regionId/snapshot`
  * `POST /api/admin/regions/:regionId/restore-latest`
* Register routes from `apps/server/src/http/app.ts`.
* Extend principal model in `packages/shared-types/src/index.ts` (or mapping layer in auth service) to carry operator-role claim data.
* Add operator authorization guard in route layer (explicit 403 on non-operator).

Telemetry and observability:

* Emit `snapshot_created` after immutable metadata+payload commit.
* Emit `snapshot_restore_started` before transactional restore.
* Emit `snapshot_restore_completed` only after hash validation success.
* Include `region_id`, `snapshot_id`, `tile_count`, `expected_hash`, `actual_hash`, and `duration_ms` attributes.

Startup and recovery wiring:

* Keep startup behavior unchanged in `apps/server/src/index.ts`, but instantiate and inject new snapshot services/repositories into HTTP app dependencies.
* Ensure graceful shutdown remains safe for in-flight restore operations (transaction completion before exit).

## Test Plan

Unit tests:

* Add deterministic hash unit tests for ordering stability and payload normalization in `apps/server/tests/unit/region-snapshot.service.test.ts`.
* Add authz guard unit tests for operator-only replay command handling in route/service tests.

Integration tests:

* Add `apps/server/tests/integration/region-snapshot-replay.integration.test.ts` covering:
  * snapshot trigger writes immutable metadata + payload
  * restore latest replaces mutated region state correctly
  * post-restore hash equals expected hash
  * non-operator request denied with 403
* Reuse database test patterns from existing tile/migration integration tests.

Smoke and ops simulation:

* Add smoke test `apps/server/tests/integration/region-restore-drill.smoke.test.ts`:
  * seed region -> snapshot -> introduce drift -> restore -> verify hash and coordinate set.
* Add ops simulation test (can be integration-level) for "region failure" modeled as forced drift/corruption in region rows.

Telemetry assertions:

* Verify required events emitted in expected order and with required attributes.

Regression adjacency:

* Ensure existing tests remain green:
  * `apps/server/tests/integration/tile-persistence.integration.test.ts`
  * `apps/server/tests/integration/startup-migration.smoke.test.ts`
  * `apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts`

## Risks and Open Questions

Risks:

* Storage growth from snapshot payload copies may increase DB size rapidly in high-change regions.
* Hash correctness risk if serialization is not fully deterministic across runtime environments.
* Authorization risk if operator-role extraction from tokens is underspecified.
* Restore transaction lock contention risk under concurrent tile writes.

Mitigations:

* Add retention policy and cleanup strategy (keep N latest snapshots per region) as follow-up.
* Centralize hash serialization utility with fixed key ordering and explicit tests.
* Define a strict operator-claim contract and enforce in middleware/route guard.
* Use explicit transaction boundaries and temporary write lock strategy during restore.

Open questions:

* Which JWT claim is authoritative for operator role (`roles`, `scp`, custom claim)?
* Should restore block concurrent tile placement globally for a region during replay?
* Is snapshot trigger synchronous in API path acceptable for Sprint 3, or must it dispatch to an async worker immediately?
* What retention window is required for snapshots per region?

## Summary

Status: Complete

Confidence: High for intent/requirements and architecture fit; Medium for operator-claim mapping until token claim contract is confirmed.

Unresolved questions:

* Operator-claim source and mapping contract.
* Required snapshot retention policy and storage budget.
* Exact concurrency semantics for writes during restore.
