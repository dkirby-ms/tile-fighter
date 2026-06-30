<!-- markdownlint-disable-file -->
# Implementation Details: E3-S1 Reliable Room Join and Rejoin

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md; .copilot-tracking/research/2026-06-29/e3-epic-research.md; .copilot-tracking/research/subagents/2026-06-30/e3-s1-planning-gap-research.md; GitHub issue #17

## Implementation Phase 1: Data Contract and Persistence Foundation

<!-- parallelizable: false -->

### Step 1.1: Create checkpoint schema and migration

Add a new migration to create `session_checkpoints`, add required indexes for active/stale checkpoint lookups, and add `ttl_expires_at` support on `tile_deltas` to enforce retention boundaries.

Files:
* apps/server/src/persistence/migrations/1750000000000_session_checkpoints.js - New migration for checkpoint table, indexes, and tile delta TTL column/index
* apps/server/src/persistence/migrate.ts - Ensure migration is discovered/executed by startup flow if explicit registration is needed by current pattern

Discrepancy references:
* Addresses DR-01 from .copilot-tracking/plans/logs/2026-06-30/e3-s1-reliable-room-join-rejoin-log.md

Success criteria:
* Migration applies cleanly on empty and existing test databases
* New table/indexes and TTL column exist with expected constraints

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 1139-1297) - Proposed schema and migration pattern
* apps/server/src/persistence/migrations/1740000000000_region_diffs.js (Lines 1-200) - Existing migration style reference

Dependencies:
* Existing migration naming and SQL style conventions in server workspace

### Step 1.2: Extend DB typings and repository APIs for checkpoint reads/writes and retention-aware delta operations

Add `SessionCheckpointsTable` typing in DB contract and implement repository methods for create, fetch active/stale by identity/session, update checkpoint progression, archive on grace expiry, and retention query helpers for minimum protected versions.

Files:
* apps/server/src/persistence/db.ts - Add table typing and exports for `session_checkpoints`
* apps/server/src/persistence/region-diff.repository.ts - Add retention-aware helpers and optional replay-window queries
* apps/server/src/persistence/session-checkpoint.repository.ts - New repository encapsulating checkpoint persistence operations

Discrepancy references:
* Addresses DR-02 from .copilot-tracking/plans/logs/2026-06-30/e3-s1-reliable-room-join-rejoin-log.md

Success criteria:
* Repository API supports checkpoint lifecycle operations required by AC2/AC3
* TypeScript compiles for server workspace with no any-casts in checkpoint flows

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 75-190) - AC-driven persistence needs
* apps/server/src/persistence/region-diff.repository.ts (Lines 1-260) - Existing delta query patterns

Dependencies:
* Step 1.1 completion

### Step 1.3: Validate phase changes

Run lint and build commands for files modified in this phase. This validation remains phase-local and does not conflict with other phases.

Validation commands:
* npm run -w @game/server lint - Server lint scope
* npm run -w @game/server build - Server build scope

## Implementation Phase 2: Server Reconnect and Replay Orchestration

<!-- parallelizable: false -->

### Step 2.1: Implement session checkpoint lifecycle service and grace-state transitions

Extend lifecycle orchestration to create checkpoint on first join, mark stale on disconnect/timeout, restore within grace, and archive on grace expiry. Include deterministic reconnect failure reasons.

Files:
* apps/server/src/session/session-lifecycle.service.ts - Integrate checkpoint state transitions with existing presence model
* apps/server/src/session/session-checkpoint.service.ts - New service for checkpoint domain logic
* apps/server/src/session/session-lifecycle.types.ts - Optional new shared types for checkpoint/reconnect state machine

Discrepancy references:
* Addresses DR-03 from .copilot-tracking/plans/logs/2026-06-30/e3-s1-reliable-room-join-rejoin-log.md

Success criteria:
* Session lifecycle can distinguish active, stale-within-grace, archived, and missing-checkpoint states
* Disconnect/reconnect transitions are deterministic and logged via telemetry

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 389-529) - Checkpoint lifecycle and grace policy
* apps/server/src/session/session-lifecycle.service.ts (Lines 1-260) - Existing presence flow

Dependencies:
* Implementation Phase 1 completion

### Step 2.2: Add reconnect endpoint/token validation and stale token rejection handling

Introduce reconnect API with signed token verification, replay nonce checks, status-code mapping (401/403/404/410), and per-session reconnect rate limiting.

Files:
* apps/server/src/http/routes/session.routes.ts - Add reconnect endpoint contract and response schema
* apps/server/src/auth/reconnect-token.service.ts - New service for reconnect token issue/verify and JTI replay protection
* apps/server/src/http/app.ts - Route wiring if needed by current composition

Discrepancy references:
* Addresses DR-04 from .copilot-tracking/plans/logs/2026-06-30/e3-s1-reliable-room-join-rejoin-log.md

Success criteria:
* Reconnect path returns expected status codes for expired, replayed, missing, and stale checkpoints
* Security telemetry/logging captures invalid signature and replay incidents

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 915-1015) - Security requirements and validation behaviors
* apps/server/src/auth/join-token.service.ts (Lines 1-220) - Token service implementation baseline

Dependencies:
* Step 2.1 completion

### Step 2.3: Integrate replay orchestration and telemetry in room/session flows

Connect room/session join flows to checkpoint restore and replay dispatch from `lastConfirmedVersion + 1`, emit required E3-S1 telemetry events (`room_joined`, `room_rejoined`, `room_rejoin_failed`, replay started/completed, checksum mismatch proxy events).

Files:
* apps/server/src/rooms/arena.room.ts - Rejoin-aware join path and room lifecycle hooks
* apps/server/src/domain/region-diff.service.ts - Replay orchestration entrypoints and sequencing guarantees
* apps/server/src/telemetry/telemetry-sink.ts - Ensure event schemas/attributes for reconnect lifecycle

Success criteria:
* Server can replay deltas deterministically for reconnect/rejoin flows
* Telemetry covers all required E3-S1 event names and failure reasons, including `session_checkpoint_archived` and `delta_retention_cleanup_executed`

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 1020-1133) - Telemetry event contracts
* .copilot-tracking/research/2026-06-29/e3-epic-research.md (Lines 58-83) - Harness mapping relevance

Dependencies:
* Step 2.2 completion

### Step 2.4: Lock checksum authority contract to full-region canonical scope in reconnect/replay APIs

Define one authoritative checksum scope for E3-S1 replay validation: full-region canonical checksum parity between server and client. Ensure reconnect/replay endpoint payloads and replay logic do not rely on viewport-scoped checksum authority.

Files:
* apps/server/src/domain/region-hash.ts - Confirm canonical hash contract exposed for replay validation
* apps/server/src/http/routes/session.routes.ts - Include checksum scope metadata or assumptions in reconnect response contract
* apps/client/src/session/replay-checksum.ts - Enforce full-region checksum usage for final replay validation

Success criteria:
* Server and client compute checksum over identical full-region canonical tile set
* Replay mismatch handling cannot be triggered by viewport-window differences alone

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 533-719) - Checksum algorithm and replay validation expectations
* .copilot-tracking/research/subagents/2026-06-30/e3-s1-planning-gap-research.md (Lines 1-60) - Identified checksum scope gap

Dependencies:
* Step 2.3 completion

### Step 2.5: Validate phase changes

Run lint and build commands for files modified in this phase.

Validation commands:
* npm run -w @game/server lint - Server lint scope
* npm run -w @game/server build - Server build scope

## Implementation Phase 3: Client Recovery and Checksum Validation

<!-- parallelizable: false -->

### Step 3.1: Extend client session callers for reconnect handshake and replay retrieval

Add client reconnect path that requests/uses reconnect tokens, invokes reconnect endpoint, and fetches replay deltas beginning from checkpoint version.

Files:
* apps/client/src/session/heartbeat-caller.ts - Add reconnect handshake trigger and token propagation
* apps/client/src/session/bootstrap-store.ts - Persist transient reconnect context/session identity safely
* apps/client/src/session/reconnect-caller.ts - New caller wrapper for reconnect-specific request flow

Success criteria:
* Client can re-establish session identity within grace period without full fresh join
* Error paths distinguish re-auth required vs stale-session fresh join fallback

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 530-646) - Replay flow contract
* apps/client/src/auth/join-token-caller.ts (Lines 1-220) - Existing authenticated caller retry pattern

Dependencies:
* Implementation Phase 2 completion

### Step 3.2: Implement deterministic client replay apply and checksum comparison flow

Apply replay deltas in ordered sequence, compute deterministic checksum over resulting tile state, compare with server checksum, and emit failure/success telemetry via existing transport hooks.

Files:
* apps/client/src/session/replay-checksum.ts - New deterministic checksum/replay utility
* apps/client/src/index.ts - Wire replay validation result into user-visible session recovery path if needed
* apps/client/tests/unit/heartbeat-caller.test.ts - Extend tests for reconnect and replay paths
* apps/client/tests/unit/replay-checksum.test.ts - New checksum determinism tests

Success criteria:
* Replay checksum mismatch is detected and surfaced reliably
* Replay checksum match updates checkpoint progression path successfully

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 646-719) - Deterministic checksum requirements
* apps/server/src/domain/region-hash.ts (Lines 1-180) - Server hash baseline for parity

Dependencies:
* Step 3.1 completion

### Step 3.3: Validate phase changes

Run lint and build commands for files modified in this phase.

Validation commands:
* npm run -w @game/client lint - Client lint scope
* npm run -w @game/client build - Client build scope
* npm run -w @game/client test - Client unit scope

## Implementation Phase 4: Reliability Validation and Operational Hardening

<!-- parallelizable: false -->

### Step 4.1: Add integration and smoke coverage for AC1/AC2/AC3

Implement end-to-end server integration tests for first join checkpoint creation, reconnect within grace, and replay checksum validation; add smoke tests for drop/reconnect timing.

Files:
* apps/server/tests/integration/join-rejoin.integration.test.ts - New AC-level integration suite
* apps/server/tests/integration/join-rejoin-smoke.test.ts - New smoke drop/reconnect suite
* apps/server/tests/integration/test-db-guard.ts - Extend guard helpers if new DB env assumptions are introduced

Discrepancy references:
* Addresses DR-05 from .copilot-tracking/plans/logs/2026-06-30/e3-s1-reliable-room-join-rejoin-log.md

Success criteria:
* Integration tests verify all three E3-S1 acceptance criteria behaviors
* Smoke test captures reconnect SLA and non-desync assertions

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 736-910) - Proposed test matrix
* GitHub issue #17 - Required test categories

Dependencies:
* Implementation Phases 2 and 3 completion

### Step 4.2: Add mass reconnect load scenario and retention cleanup checks

Add load scenario for concurrent reconnect churn and ensure retention/archival jobs preserve replay-critical deltas while cleaning expired data.

Files:
* apps/server/tests/load/join-rejoin-load.ts - New load profile for mass reconnect acceptance
* apps/server/src/session/session-checkpoint-cleanup.job.ts - New cleanup scheduler or integrate with existing timed jobs
* apps/server/src/persistence/region-diff.repository.ts - Retention verification helpers used by tests

Success criteria:
* Load test demonstrates stable reconnect behavior under target concurrency profile
* Cleanup execution never removes deltas required by active/stale checkpoints

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 886-1133) - Load and retention requirements
* apps/server/tests/load/room-join-load.ts (Lines 1-260) - Existing load test style baseline

Dependencies:
* Step 4.1 completion

### Step 4.3: Add explicit security-abuse test assertions for reconnect flows

Add targeted assertions for reconnect token tampering, replay abuse, tenant isolation boundaries, and status code mapping in integration coverage.

Files:
* apps/server/tests/integration/join-rejoin.integration.test.ts - Add tampered signature, replayed token, and stale token status assertions
* apps/server/tests/integration/http-auth.integration.test.ts - Add tenant isolation checks for reconnect/checkpoint access
* apps/server/tests/integration/join-token.integration.test.ts - Extend overlap checks where reconnect flow reuses token verification utilities

Success criteria:
* Integration suite asserts 401 for invalid signature/expired token, 403 for replayed token, 404 for missing checkpoint, and 410 for stale archived checkpoint
* Tenant-scoped subject cannot retrieve or restore checkpoints outside its own identity boundary

Context references:
* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 909-1015) - Security and abuse check matrix
* GitHub issue #17 - Security and abuse checks requirement

Dependencies:
* Step 4.2 completion

### Step 4.4: Validate phase changes

Run lint, tests, and load entry checks for files modified in this phase.

Validation commands:
* npm run -w @game/server test - Server integration/unit scope
* npm run -w @game/server test:load - Server load scope

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

* PostgreSQL-backed server test environment (`TEST_DATABASE_URL` or `DATABASE_URL` per repository guard rules)
* Existing join token issuance and verification from E1-S2
* Existing deterministic region diff query semantics from E2-S4

## Success Criteria

* E3-S1 acceptance criteria are fully represented in automated test suites and pass in validation runs.
* Reconnect and replay behavior is deterministic and auditable via telemetry events.
* Data retention/archival behavior preserves replay integrity while enforcing bounded storage policy.
* Full-region checksum authority is consistent across server/client replay validation paths and test assertions.
* Security test suite explicitly validates reconnect abuse/status matrix and tenant isolation boundaries.
