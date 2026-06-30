<!-- markdownlint-disable-file -->
# Implementation Details: Story Layer1 E2-S3 Region Snapshot and Replay Recovery

## Context Reference

Sources: .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md, docs/layer1-backlog.md, and existing server patterns in apps/server/src/http/routes/session.routes.ts, apps/server/src/persistence/tile.repository.ts, and apps/server/src/telemetry/telemetry-sink.ts.

## Implementation Phase 1: Data Model and Persistence Foundation

<!-- parallelizable: false -->

### Step 1.1: Add region snapshot schema migration

Create a new migration that introduces immutable metadata and payload tables for region snapshots.

Files:
* apps/server/src/persistence/migrations/<timestamp>_region_snapshots.js - Create `region_snapshots` and `region_snapshot_tiles` with indexes and FK constraints.

Discrepancy references:
* Addresses DR-01 by defining baseline schema needed to implement replay restore semantics.

Success criteria:
* Migration creates snapshot metadata table keyed by `snapshot_id` with immutable `region_id`, `created_by`, `tile_count`, and `expected_hash`.
* Migration creates snapshot payload table keyed by (`snapshot_id`, `tile_id` or positional tuple) with copied tile fields.
* Index exists for latest-by-region lookup and snapshot payload fetch by `snapshot_id`.

Context references:
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md (Lines 152-237) - Preferred approach and data model guidance.
* apps/server/src/persistence/migrations/1720000000000_tiles.js (Lines 7-87) - Existing migration style and tile schema fields to mirror.

Dependencies:
* Existing node-pg-migrate wiring in apps/server/src/persistence/migrate.ts.

### Step 1.2: Implement region snapshot repository

Add a repository module for snapshot write/read/restore primitives and transaction-safe replacement of region tiles.

Files:
* apps/server/src/persistence/region-snapshot.repository.ts - Insert snapshot metadata, bulk insert snapshot payload rows, load latest snapshot by region, and restore in transaction.
* apps/server/src/persistence/db.ts - Extend typings as needed for new tables.

Discrepancy references:
* Addresses DR-02 by adding bounded APIs for creation and restore rather than overloading tile repository APIs.

Success criteria:
* Repository exposes typed methods for `createSnapshot`, `getLatestSnapshotForRegion`, and `restoreRegionFromSnapshot`.
* Restore operation is transactional and replaces only target region rows.
* Query path supports deterministic ordering for hash verification inputs.

Context references:
* apps/server/src/persistence/tile.repository.ts (Lines 31-245) - Repository style and result pattern.
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md (Lines 239-268) - Recommended service and repository boundary.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Validate persistence changes

Run migration and focused tests for persistence changes before proceeding to service and route wiring.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/integration/startup-migration.smoke.test.ts - Validate migration applies cleanly.
* npm run --workspace @tile-fighter/server test -- tests/unit/tile.repository.test.ts - Ensure tile repository behavior remains stable.

## Implementation Phase 2: Snapshot Service and Telemetry

<!-- parallelizable: true -->

### Step 2.1: Add deterministic region hash utility and service orchestration

Implement deterministic hash generation and domain orchestration for create and restore operations.

Files:
* apps/server/src/domain/region-snapshot.service.ts - Service boundary with `createSnapshot` and `restoreLatest` methods.
* apps/server/src/domain/region-hash.ts - Stable normalization and SHA-256 hashing utility for region tile rows.

Discrepancy references:
* Addresses DR-03 by codifying post-restore verification and deterministic hashing.

Success criteria:
* Hash utility sorts rows deterministically and hashes normalized payload.
* Service emits expected result payload (snapshot id, expected hash, actual hash, counts) for route layer.
* Restore path fails when recomputed hash does not match stored expected hash.

Context references:
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md (Lines 118-150) - Hash approach and normalization expectations.
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md (Lines 239-268) - Service contract sketch.

Dependencies:
* Implementation Phase 1 completion.

### Step 2.2: Emit required snapshot replay telemetry

Add story-required telemetry events and attribute payloads around create and restore flow.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add helper functions or event wrappers for `snapshot_created`, `snapshot_restore_started`, and `snapshot_restore_completed`.
* apps/server/src/domain/region-snapshot.service.ts - Call telemetry helpers at create/start/completion points.

Discrepancy references:
* Addresses DR-04 by implementing acceptance telemetry not present in current server.

Success criteria:
* Event names exactly match story acceptance expectations.
* Event attributes include region_id, snapshot_id, tile_count, expected_hash, actual_hash when applicable, and duration_ms.
* Failure path includes telemetry for restore mismatch or no-snapshot condition.

Context references:
* apps/server/src/telemetry/telemetry-sink.ts (Lines 1-59) - Existing event helper patterns.
* docs/layer1-backlog.md (Lines 79-98) - Story telemetry acceptance intent.

Dependencies:
* Step 2.1 completion.

### Step 2.3: Validate service and telemetry phase

Run targeted server tests for service logic and event emission.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/unit/region-snapshot.service.test.ts - Validate create/restore and hash behavior.
* npm run --workspace @tile-fighter/server lint - Validate TypeScript and lint compliance for new modules.

## Implementation Phase 3: HTTP Surface and Operator Authorization

<!-- parallelizable: true -->

### Step 3.1: Add operator role mapping to principal model

Extend shared and server auth mapping to interpret operator capability from JWT claims.

Files:
* packages/shared-types/src/index.ts - Add principal role shape and operator capability signal.
* apps/server/src/http/auth-middleware.ts - Map authoritative claim(s) into principal role flags.

Discrepancy references:
* Addresses DR-05 by making operator restriction enforceable in code.
* Deviates through DD-01 if claim fallback is required while canonical claim is undecided.

Success criteria:
* Principal type and runtime mapping expose an explicit operator check.
* Non-operator principals cannot pass operator guard logic.
* Current auth integration tests continue to pass with updated principal shape.

Context references:
* apps/server/src/http/auth-middleware.ts (Lines 4-35) - Current principal mapping.
* packages/shared-types/src/index.ts (Lines 3-19) - Current principal contract.

Dependencies:
* None. Can run in parallel with Phase 2 because files are independent.

### Step 3.2: Implement snapshot admin routes and app wiring

Create operator-guarded route handlers for snapshot creation and restore latest commands.

Files:
* apps/server/src/http/routes/snapshot.routes.ts - Route handlers and operator guard.
* apps/server/src/http/app.ts - Mount snapshot routes within authenticated API surface.

Discrepancy references:
* Addresses DR-06 by introducing bounded replay command surface.

Success criteria:
* Snapshot create endpoint accepts region id and actor context from principal.
* Restore latest endpoint enforces operator-only access and returns verification payload.
* Route layer converts domain failures to stable HTTP responses.

Context references:
* apps/server/src/http/routes/session.routes.ts (Lines 1-132) - Route validation and telemetry style.
* apps/server/src/http/app.ts (Lines 1-26) - Route registration order.

Dependencies:
* Step 3.1 completion.
* Implementation Phase 2 completion.

### Step 3.3: Validate route and auth phase

Run focused integration suite for HTTP auth and command behavior.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/integration/http-auth.integration.test.ts - Validate auth behavior remains intact.
* npm run --workspace @tile-fighter/server test -- tests/integration/region-snapshot-replay.integration.test.ts - Validate end-to-end snapshot and replay commands.

## Implementation Phase 4: Test Matrix and Operational Drill Coverage

<!-- parallelizable: false -->

### Step 4.1: Add unit and integration tests for snapshot/replay lifecycle

Build comprehensive tests for immutable snapshot creation, restore correctness, and hash verification.

Files:
* apps/server/tests/unit/region-snapshot.service.test.ts - Unit tests for hashing, mismatch handling, and no-snapshot behavior.
* apps/server/tests/integration/region-snapshot-replay.integration.test.ts - Integration tests for create, restore, authz denial, and mismatch scenarios.

Discrepancy references:
* Addresses DR-07 by implementing missing coverage for acceptance-level behavior.

Success criteria:
* Unit tests cover hash determinism and mismatch failures.
* Integration tests verify latest snapshot selection and region replacement correctness.
* Integration tests verify non-operator restore denial.

Context references:
* apps/server/tests/integration/tile-persistence.integration.test.ts (Lines 1-201) - Existing integration setup pattern.
* apps/server/tests/integration/http-auth.integration.test.ts (Lines 1-178) - Authz test pattern.

Dependencies:
* Implementation Phases 1-3 completion.

### Step 4.2: Add restore drill smoke and optional load simulation

Add a smoke drill that introduces drift and validates replay recovery from latest snapshot.

Files:
* apps/server/tests/integration/region-restore-drill.smoke.test.ts - Simulate drift and validate replay recovery hash equality.
* apps/server/tests/load/room-join-load.ts - Optional scenario extension to include replay operation checkpoints.

Discrepancy references:
* Addresses DR-08 by adding operational confidence checks beyond standard integration tests.

Success criteria:
* Smoke test validates create -> drift -> restore -> hash match lifecycle.
* Load harness changes are optional and isolated to avoid instability.

Context references:
* apps/server/tests/integration/startup-migration.smoke.test.ts (Lines 1-98) - Smoke test conventions.
* apps/server/tests/load/room-join-load.ts (Lines 1-145) - Load harness conventions.

Dependencies:
* Step 4.1 completion.

### Step 4.3: Validate test phase changes

Run the new and adjacent suites for confidence before global validation.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/unit/region-snapshot.service.test.ts tests/integration/region-snapshot-replay.integration.test.ts tests/integration/region-restore-drill.smoke.test.ts

## Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute complete quality gates after all implementation phases.

Validation commands:
* npm run lint
* npm run build
* npm run test

### Step 5.2: Fix minor validation issues

Address straightforward lint, type, and test breakages introduced by this work while preserving scope boundaries.

### Step 5.3: Report blocking issues

If unresolved blockers remain, document exact failures, impacted files, and recommended follow-on planning rather than broad refactoring.

## Dependencies

* PostgreSQL migration pipeline via node-pg-migrate.
* Existing Kysely repository infrastructure and transaction support.
* Existing auth middleware principal propagation.
* Existing telemetry sink event pipeline.
* Vitest unit and integration harness under apps/server/tests.

## Success Criteria

* Region snapshots persist immutable metadata and payload rows and can be restored by latest snapshot lookup.
* Restore operation verifies post-restore hash against expected snapshot hash.
* Replay command path is restricted to operator principals.
* Required telemetry events are emitted for create/start/completion and failure scenarios.
* Unit, integration, and smoke tests for snapshot and replay recovery pass consistently.
