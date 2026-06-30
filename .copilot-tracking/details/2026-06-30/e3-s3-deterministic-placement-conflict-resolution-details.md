<!-- markdownlint-disable-file -->
# Implementation Details: E3-S3 Deterministic Placement Conflict Resolution

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md; GitHub issue #19; /memories/repo/phase1-tile-persistence-complete.md; /memories/repo/ci-notes.md

## Implementation Phase 1: Placement Command Contract and Validation

<!-- parallelizable: false -->

### Step 1.1: Extend placement command schema with commandId

Add command identity to shared command contracts and ensure all server placement entry points accept and validate it.

Files:
* packages/shared-types/src/index.ts - Extend TilePlaceCommand with required commandId field and exported helper types
* apps/server/src/http/routes/tile.routes.ts - Validate commandId format/length and include deterministic error code for malformed command identity

Success criteria:
* Tile placement commands require commandId in server-facing contract
* Invalid commandId inputs receive deterministic validation error response

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 49-53) - Missing commandId in current contract
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 119-128) - Required API contract update

Dependencies:
* Existing tile placement request parsing in apps/server/src/http/routes/tile.routes.ts

### Step 1.2: Define canonical command payload hashing and replay-window configuration

Implement deterministic payload hashing inputs and replay-window configuration used by persistence-layer idempotency checks.

Files:
* apps/server/src/config/env.ts - Add PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS and related validation defaults
* apps/server/src/domain/combat-simulation.service.ts - Add canonical hashing helper for placement command identity and payload consistency checks

Success criteria:
* Canonical payload hash function is deterministic for semantically identical payloads
* Replay-window settings are explicit and loaded at process startup

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 130-141) - Replay window and command ID guidance
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 244-249) - Hash canonicalization risk and mitigation

Dependencies:
* Step 1.1 completion

### Step 1.3: Validate phase changes

Run lint and build commands for modified shared/server files.

Validation commands:
* npm run -w @game/shared-types lint - Shared types lint scope
* npm run -w @game/server lint - Server lint scope
* npm run -w @game/server build - Server build scope

## Implementation Phase 2: Transactional Placement Command Ledger

<!-- parallelizable: false -->

### Step 2.1: Add placement command ledger schema and migration

Create durable ledger storage for idempotent command handling with expiry metadata and indexes.

Files:
* apps/server/src/persistence/migrations - Add migration for placement_commands table, constraints, and replay-window index
* apps/server/src/persistence/db.ts - Add PlacementCommandsTable type and database type exports

Discrepancy references:
* Addresses DR-02 from .copilot-tracking/plans/logs/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-log.md by implementing bounded replay retention primitives

Success criteria:
* placement_commands table includes uniqueness on (region_id, actor_id, command_id)
* Table persists request_hash, outcome fields, optional winner metadata, response snapshot, and expires_at

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 122-125) - Required ledger schema shape
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 230-243) - Sequence and test implications

Dependencies:
* Implementation Phase 1 completion

### Step 2.2: Integrate replay, mismatch, and fresh-command branches into placement transaction

Update the placement transaction flow to short-circuit replayed commands, reject payload mismatches, and persist deterministic outcomes for fresh attempts.

Files:
* apps/server/src/persistence/tile.repository.ts - Add ledger lookup/upsert and transactional outcome persistence around tile insert conflict winner arbitration
* apps/server/src/session/session-lifecycle.types.ts - Extend placement result types for replayed, mismatch, and deterministic conflict outcomes

Discrepancy references:
* Addresses DD-01 and DD-02 from .copilot-tracking/plans/logs/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-log.md

Success criteria:
* Same commandId with identical hash returns stored response and causes no duplicate side effects
* Same commandId with different hash returns deterministic mismatch conflict code
* Fresh command path still uses coordinate unique constraint winner arbitration

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 106-116) - Transaction-level branch model
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 145-168) - Selected approach and winner strategy

Dependencies:
* Step 2.1 completion

### Step 2.3: Enforce deterministic HTTP response mapping for loser, replay, and mismatch outcomes

Map persistence outcomes to stable response codes and payloads, including idempotent conflict code for loser commands and replay-safe response replay.

Deterministic loser payload contract:
* HTTP status: 409
* Body fields: `reason`, `conflictCode`, `commandId`, `regionId`, `cell`, `winner`
* `conflictCode` value for loser path: `placement_conflict_idempotent`
* `winner` object fields: `ownerId`, `tileId`, `resolvedAt`

Files:
* apps/server/src/http/routes/tile.routes.ts - Add response handling branches for replayed and mismatch outcomes plus loser conflict code mapping

Discrepancy references:
* Addresses DR-01 from .copilot-tracking/plans/logs/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-log.md by codifying deterministic loser conflict payload/code mapping

Success criteria:
* Loser command response includes deterministic conflict code required by story acceptance criteria
* Loser response payload shape is stable and documented for client integration
* Replay response returns same business outcome and shape as original successful or conflict response

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 38-45) - Outstanding conflict payload clarification
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 60-63) - Current occupied-only behavior gap

Dependencies:
* Step 2.2 completion

### Step 2.4: Validate phase changes

Run migration checks and server tests focused on placement persistence and API mapping.

Validation commands:
* npm run -w @game/server migrate - Verify migration applies cleanly
* npm run -w @game/server test -- tile.repository - Server targeted persistence tests
* npm run -w @game/server test -- http-auth.integration - Ensure auth + placement route behavior remains stable

## Implementation Phase 3: Conflict Telemetry and Abuse Checks

<!-- parallelizable: true -->

### Step 3.1: Add placement conflict telemetry event emitters

Extend telemetry sink to emit required events with deterministic correlation attributes.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add placement_conflict_detected and placement_conflict_resolved helper methods
* apps/server/src/persistence/tile.repository.ts - Emit telemetry around conflict detection and persisted resolution outcomes

Success criteria:
* placement_conflict_detected emits once per detected conflict attempt
* placement_conflict_resolved emits with final deterministic outcome metadata

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 70-73) - Telemetry gaps
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 126-128) - Required telemetry events

Dependencies:
* Implementation Phase 2 completion

### Step 3.2: Add replay-window enforcement and purge policy hooks

Ensure expired command IDs are handled according to configured replay window and ledger cleanup policy.

Files:
* apps/server/src/persistence/tile.repository.ts - Respect expires_at checks during command replay lookup
* apps/server/src/persistence/migrate.ts - Register migration-safe cleanup/purge strategy or SQL task invocation hook

Discrepancy references:
* Addresses DR-02 from .copilot-tracking/plans/logs/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-log.md

Success criteria:
* Expired command IDs do not replay stale outcomes outside allowed window
* Cleanup strategy is documented in code-level comments or migration helper naming

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 43-46) - Replay window open question
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 240-243) - Ledger growth risk

Dependencies:
* Step 3.1 completion

### Step 3.3: Validate phase changes

Run lint and targeted tests for telemetry and replay-window behavior.

Validation commands:
* npm run -w @game/server lint - Server lint scope
* npm run -w @game/server test -- telemetry - Server telemetry-focused tests
* npm run -w @game/server test -- heartbeat-lifecycle.integration - Session safety regression check

## Implementation Phase 4: Unit, Integration, and Load Verification

<!-- parallelizable: false -->

### Step 4.1: Add unit tests for winner rule and command-idempotency branches

Create unit tests for deterministic winner outcome mapping, replayed command branch, and payload mismatch branch.

Files:
* apps/server/tests/unit/tile.repository.command-ledger.test.ts - New unit suite for replay/mismatch/fresh command outcomes

Success criteria:
* Unit tests assert same commandId retry has no duplicate write side effects
* Unit tests assert mismatch branch returns deterministic conflict code

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 230-235) - Unit test requirements

Dependencies:
* Implementation Phases 2 and 3 completion

### Step 4.2: Add integration race simulation for same-coordinate contention and retry safety

Implement integration tests for simultaneous claims, loser deterministic code mapping, and retry with same commandId across request attempts.

Files:
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts - New integration suite for concurrent placement conflict resolution

Success criteria:
* Concurrent same-coordinate claims produce one winner and deterministic loser responses
* Retry with identical commandId returns replay response with no duplicate side effects

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 84-90) - Existing race baseline and missing idempotency coverage
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 230-235) - Integration requirements

Dependencies:
* Step 4.1 completion

### Step 4.3: Add load hotspot conflict test for retry storms and telemetry consistency

Extend load testing with hotspot contention and same-command retry storm scenarios to verify no duplicate side effects and stable conflict telemetry rates.

Files:
* apps/server/tests/load/placement-conflict-hotspot.load.ts - New load scenario for conflict/retry storm validation

Success criteria:
* Load test confirms bounded side effects under repeated same-command retries
* Telemetry counters for conflict detected/resolved remain internally consistent

Context references:
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 75-77) - Existing load gap
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 230-235) - Load requirements

Dependencies:
* Step 4.2 completion

### Step 4.4: Validate phase changes

Run full server test scopes touching unit, integration, and load coverage.

Validation commands:
* npm run -w @game/server test -- unit
* npm run -w @game/server test -- integration
* npm run -w @game/server test:load

## Implementation Phase 5: Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all validation commands for the project:
* npm run lint
* npm run build
* npm run test

### Step 5.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures. Apply fixes directly when corrections are straightforward and isolated.

### Step 5.3: Report blocking issues

When validation failures require changes beyond minor fixes:
* Document the issues and affected files.
* Provide the user with next steps.
* Recommend additional research and planning rather than inline fixes.
* Avoid large-scale refactoring within this phase.

## Dependencies

* E2-S2 transactional tile persistence and conflict mapping remain in place
* Existing region version and delta append behavior in placement transaction remains canonical
* Server telemetry sink and load test harness are available in current monorepo

## Success Criteria

* All issue #19 acceptance criteria are mapped to concrete transaction and API behaviors
* Replay with same commandId is side-effect free and deterministic in unit/integration/load coverage
* Required telemetry and replay-window abuse checks are implemented and verifiable
