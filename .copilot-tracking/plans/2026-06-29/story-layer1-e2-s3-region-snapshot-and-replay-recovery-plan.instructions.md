---
applyTo: '.copilot-tracking/changes/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Story Layer1 E2-S3 Region Snapshot and Replay Recovery

## Overview

Implement server-side region snapshot creation and replay recovery with immutable snapshot storage, deterministic hash verification, operator-restricted restore commands, telemetry, and layered tests.

## Objectives

### User Requirements

* Persist immutable snapshot metadata and immutable payload rows for a target region — Source: GitHub Issue #15 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md
* Restore a region from its latest consistent snapshot and verify post-restore hash correctness — Source: GitHub Issue #15 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md
* Restrict replay restore operations to operator principals — Source: GitHub Issue #15 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md
* Emit snapshot lifecycle telemetry (`snapshot_created`, `snapshot_restore_started`, `snapshot_restore_completed`) with operational attributes — Source: docs/layer1-backlog.md and .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md
* Add unit, integration, and smoke coverage for create, restore, authz, and verification paths — Source: GitHub Issue #15 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md

### Derived Objectives

* Implement a new snapshot vertical slice (migration, repository, service, routes, tests) instead of extending unrelated room state modules — Derived from: research findings and current server layering in apps/server/src
* Keep first implementation synchronous with explicit service boundaries so asynchronous worker migration remains possible later — Derived from: selected approach in research lines 178-180
* Use deterministic row normalization for hash stability across snapshot create and restore verification — Derived from: hash sketch and acceptance verification intent in research lines 118-150
* Treat retention and advanced lock policy as follow-on scope to keep this story bounded to recovery correctness — Derived from: open questions in research lines 285-289

## Context Summary

### Project Files

* docs/layer1-backlog.md - Story acceptance intent for E2-S3 including telemetry and operator-only replay commands.
* apps/server/src/persistence/migrations/1720000000000_tiles.js - Existing schema and migration style to mirror for snapshot tables.
* apps/server/src/persistence/tile.repository.ts - Existing region data read patterns and persistence conventions.
* apps/server/src/http/auth-middleware.ts - Principal extraction and authorization context source.
* apps/server/src/http/app.ts - Route registration surface for snapshot endpoints.
* apps/server/src/telemetry/telemetry-sink.ts - Event emission conventions and payload style.
* packages/shared-types/src/index.ts - Shared principal typing where operator semantics will be represented.
* apps/server/tests/integration/startup-migration.smoke.test.ts - Migration smoke pattern.
* apps/server/tests/integration/http-auth.integration.test.ts - Auth behavior test pattern.
* apps/server/tests/integration/tile-persistence.integration.test.ts - Existing persistence integration harness.

### References

* .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md - Primary research, selected architecture, alternatives, and open questions.
* https://github.com/dkirby-ms/tile-fighter/issues/15 - Issue acceptance intent and scope anchor.

### Standards References

* .github/instructions/hve-core/markdown.instructions.md — Markdown planning artifact requirements.
* .github/instructions/hve-core/writing-style.instructions.md — Writing style for planning documents.
* .github/instructions/shared/hve-core-location.instructions.md — Artifact path fallback guidance.

## Implementation Checklist

### [x] Implementation Phase 1: Data Model and Persistence Foundation

<!-- parallelizable: false -->

* [x] Step 1.1: Add migration for `region_snapshots` and `region_snapshot_tiles`
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 12-33)
* [x] Step 1.2: Implement region snapshot repository with transactional restore operations
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 34-56)
* [x] Step 1.3: Validate persistence changes through migration smoke and repository-adjacent tests
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 57-66)

### [x] Implementation Phase 2: Snapshot Service and Telemetry

<!-- parallelizable: true -->

Conditional note: This phase can execute in parallel with Phase 3 Step 3.1 only. Steps depending on Phase 2 outputs remain sequential.

* [x] Step 2.1: Add deterministic hash utility and snapshot domain service orchestration
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 72-94)
* [x] Step 2.2: Implement required telemetry events for create and restore lifecycle
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 95-113)
* [x] Step 2.3: Validate service and telemetry behavior through focused unit/lint runs
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 114-121)

### [x] Implementation Phase 3: HTTP Surface and Operator Authorization

<!-- parallelizable: true -->

Conditional note: Step 3.1 can run in parallel with Phase 2, while Steps 3.2-3.3 must wait for Phase 2 completion.

* [x] Step 3.1: Extend principal role mapping for operator authorization checks
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 127-146)
* [x] Step 3.2: Add operator-guarded snapshot routes and mount them in the app
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 147-166)
* [x] Step 3.3: Validate route/auth behavior through focused integration suites
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 167-174)

### [x] Implementation Phase 4: Test Matrix and Operational Drill Coverage

<!-- parallelizable: false -->

* [x] Step 4.1: Add unit and integration tests for snapshot/replay lifecycle and authz
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 180-200)
* [x] Step 4.2: Add restore drill smoke test and optional load-harness extension
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 201-218)
* [x] Step 4.3: Validate test-phase changes with targeted test command set
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 219-224)

### [x] Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

* [x] Step 5.1: Run full workspace validation (`npm run lint`, `npm run build`, `npm run test`)
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 230-235)
* [x] Step 5.2: Fix minor lint, type, and test issues introduced by implementation
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 236-238)
* [x] Step 5.3: Report unresolved blockers and follow-on planning needs
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-details.md (Lines 239-243)

## Planning Log

See .copilot-tracking/plans/logs/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Story dependency E2-S2 must be completed and verified before starting this plan's implementation phases.
* PostgreSQL and node-pg-migrate migration pipeline in apps/server/src/persistence/migrations.
* Kysely database access and transaction primitives in apps/server/src/persistence.
* Auth principal propagation in apps/server/src/http/auth-middleware.ts.
* Telemetry sink in apps/server/src/telemetry/telemetry-sink.ts.
* Vitest harness in apps/server/tests for unit, integration, smoke, and load suites.

## Success Criteria

* Snapshot create path persists immutable metadata and payload rows that can be retrieved for latest-by-region restore — Traces to: issue acceptance and research selected approach.
* Restore latest path transactionally replaces region rows and passes deterministic post-restore hash verification — Traces to: issue acceptance and research verification requirement.
* Replay route is operator-restricted with stable denial behavior for non-operator principals — Traces to: issue acceptance and research auth requirement.
* Snapshot lifecycle telemetry events are emitted with expected story attributes — Traces to: docs/layer1-backlog.md and research telemetry requirements.
* Unit, integration, and smoke tests for create, restore, hash mismatch, and authz denial pass in CI-aligned commands — Traces to: issue acceptance and repository testing conventions.
