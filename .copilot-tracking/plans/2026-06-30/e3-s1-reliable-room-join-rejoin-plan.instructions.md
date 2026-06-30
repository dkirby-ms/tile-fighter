---
applyTo: '.copilot-tracking/changes/2026-06-30/e3-s1-reliable-room-join-rejoin-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E3-S1 Reliable Room Join and Rejoin

## Overview

Implement checkpoint-backed reconnect and rejoin replay with checksum validation so players can recover identity and state without desync after interruptions.

## Objectives

### User Requirements

* Deliver story E3-S1 acceptance criteria for first join initialization, transient reconnect with same identity, and rejoin replay checksum match — Source: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
* Include reconnect token validation and stale token rejection security checks — Source: GitHub issue #17 (story layer1 E3-S1)
* Cover integration, smoke drop/reconnect, and load mass reconnect test expectations — Source: GitHub issue #17 (story layer1 E3-S1)

### Derived Objectives

* Introduce durable server-side session checkpoints to remove in-memory-only reconnect fragility — Derived from: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
* Add delta retention and checkpoint archival jobs so replay guarantees hold under disconnect/rejoin timing — Derived from: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
* Add deterministic telemetry for join/rejoin outcomes and replay checksum validation to support harness mapping points 2 and 6 — Derived from: .copilot-tracking/research/2026-06-29/e3-epic-research.md
* Standardize replay checksum authority on full-region canonical hashing for both server and client validation paths — Derived from: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md

## Context Summary

### Project Files

* apps/server/src/rooms/arena.room.ts - Current join/auth lifecycle entrypoint for room admission and leave events
* apps/server/src/session/session-lifecycle.service.ts - Presence and heartbeat lifecycle logic to be extended with checkpoint orchestration
* apps/server/src/persistence/db.ts - Server database types; must include new session checkpoint table typing
* apps/server/src/persistence/migrations - Migration location for checkpoint and delta TTL schema changes
* apps/server/src/domain/region-diff.service.ts - Replay source for deterministic delta sequencing
* apps/server/src/persistence/region-diff.repository.ts - Delta query/retention implementation surface
* apps/server/src/http/routes - Expected location for reconnect endpoint and replay route wiring
* apps/server/src/telemetry/telemetry-sink.ts - Telemetry event sink that must emit E3-S1 reconnect/replay events
* apps/client/src/session/heartbeat-caller.ts - Client auth caller that currently handles heartbeat and requires reconnect/replay integration
* apps/client/src/auth/join-token-caller.ts - Client token caller pattern for authenticated request retries
* apps/server/tests/integration - Target folder for join/rejoin integration and smoke tests
* apps/server/tests/load - Target folder for mass reconnect load coverage

### References

* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md - Primary E3-S1 implementation research and acceptance criteria decomposition
* .copilot-tracking/research/2026-06-29/e3-epic-research.md - Epic-level dependency chain, harness mapping, and risk framing
* .copilot-tracking/research/subagents/2026-06-30/e3-s1-planning-gap-research.md - Planning-gap validation and command verification
* /memories/repo/ci-notes.md - Workspace command conventions and CI caveats

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md — Markdown authoring requirements for .md planning files
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md — Writing style requirements for markdown content

## Implementation Checklist

### [x] Implementation Phase 1: Data Contract and Persistence Foundation

<!-- parallelizable: false -->

* [x] Step 1.1: Create checkpoint schema and migration
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 9-28)
* [x] Step 1.2: Extend DB typings and repository APIs for checkpoint reads/writes and retention-aware delta operations
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 29-45)
* [x] Step 1.3: Validate phase changes
  * Run lint and build commands for modified files
  * Skip if validation conflicts with parallel phases

### [x] Implementation Phase 2: Server Reconnect and Replay Orchestration

<!-- parallelizable: false -->

* [x] Step 2.1: Implement session checkpoint lifecycle service and grace-state transitions
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 52-72)
* [x] Step 2.2: Add reconnect endpoint/token validation and stale token rejection handling
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 73-92)
* [x] Step 2.3: Integrate replay orchestration and telemetry in room/session flows
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 93-111)
* [x] Step 2.4: Lock checksum authority contract to full-region canonical scope in reconnect/replay APIs
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 112-122)
* [x] Step 2.5: Validate phase changes
  * Run lint and build commands for modified files
  * Skip if validation conflicts with parallel phases

### [x] Implementation Phase 3: Client Recovery and Checksum Validation

<!-- parallelizable: false -->

* [x] Step 3.1: Extend client session callers for reconnect handshake and replay retrieval
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 118-133)
* [x] Step 3.2: Implement deterministic client replay apply and checksum comparison flow
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 134-150)
* [x] Step 3.3: Validate phase changes
  * Run lint and build commands for modified files
  * Skip if validation conflicts with parallel phases

### [x] Implementation Phase 4: Reliability Validation and Operational Hardening

<!-- parallelizable: false -->

* [x] Step 4.1: Add integration and smoke coverage for AC1/AC2/AC3
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 157-177)
* [x] Step 4.2: Add mass reconnect load scenario and retention cleanup checks
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 178-196)
* [x] Step 4.3: Add explicit security-abuse test assertions for reconnect flows
  * Details: .copilot-tracking/details/2026-06-30/e3-s1-reliable-room-join-rejoin-details.md (Lines 197-214)
* [x] Step 4.4: Validate phase changes
  * Run lint and build commands for modified files
  * Skip if validation conflicts with parallel phases

### [x] Implementation Phase 5: Validation

<!-- parallelizable: false -->

* [x] Step 5.1: Run full project validation
  * Execute all lint commands (`npm run lint`, language linters)
  * Execute build scripts for all modified components
  * Run test suites covering modified code
* [x] Step 5.2: Fix minor validation issues
  * Iterate on lint errors and build warnings
  * Apply fixes directly when corrections are straightforward
* [x] Step 5.3: Report blocking issues
  * Document issues requiring additional research
  * Provide user with next steps and recommended planning
  * Avoid large-scale fixes within this phase

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-30/e3-s1-reliable-room-join-rejoin-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing E1-S2 join-token implementation and verification path
* Existing E2-S4 region diff ordering guarantees
* PostgreSQL migrations and Kysely typing updates in server workspace
* Shared server/client checksum algorithm contract for replay determinism

## Success Criteria

* AC1/AC2/AC3 for E3-S1 are covered by implemented server/client flows and passing integration tests — Traces to: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
* Reconnect token validation and stale token rejection paths are tested and instrumented — Traces to: GitHub issue #17 (story layer1 E3-S1)
* Join/rejoin smoke and mass reconnect load checks run in server test pipeline with acceptable latency and failure characteristics — Traces to: .copilot-tracking/research/2026-06-29/e3-epic-research.md
* Retention/archival jobs preserve replay safety for active or stale checkpoints while cleaning expired data — Traces to: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
* Replay checksum validation uses full-region canonical scope across server/client implementations and tests — Traces to: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
* Telemetry verification includes `session_checkpoint_archived` and `delta_retention_cleanup_executed` in automated validation — Traces to: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
