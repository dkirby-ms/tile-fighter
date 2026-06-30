---
applyTo: '.copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E3-S3 Deterministic Placement Conflict Resolution

## Overview

Implement deterministic concurrent placement conflict resolution using a transactional command ledger so retries with the same command identity are replay-safe and side-effect free.

## Objectives

### User Requirements

* Deliver deterministic winner rule for simultaneous claims — Source: GitHub issue #19 acceptance criteria
* Return idempotent conflict code for loser command outcomes — Source: GitHub issue #19 acceptance criteria
* Define deterministic loser conflict response payload contract for client compatibility — Source: GitHub issue #19 acceptance criteria
* Guarantee retry with same command id has no duplicate side effects — Source: GitHub issue #19 acceptance criteria
* Add telemetry events placement_conflict_detected and placement_conflict_resolved — Source: GitHub issue #19 telemetry requirements
* Add command id replay-window abuse checks — Source: GitHub issue #19 security and abuse checks
* Provide unit, integration, and load test coverage for winner rule, race simulation, and hotspot conflict behavior — Source: GitHub issue #19 test requirements

### Derived Objectives

* Preserve existing DB unique coordinate constraint as deterministic winner arbiter while adding explicit idempotency behavior — Derived from: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md
* Add durable placement command ledger keyed by region/actor/command identity within existing transaction boundary — Derived from: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md
* Use canonical command payload hashing to distinguish true retries from command-id collisions — Derived from: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md

## Context Summary

### Project Files

* packages/shared-types/src/index.ts - Shared placement command contract currently missing commandId
* apps/server/src/http/routes/tile.routes.ts - Placement API response mapping and validation path
* apps/server/src/persistence/tile.repository.ts - Core transactional mutation and coordinate conflict behavior
* apps/server/src/persistence/db.ts - Database typing surface for new ledger table
* apps/server/src/persistence/migrations - Migration location for placement command ledger schema
* apps/server/src/telemetry/telemetry-sink.ts - Telemetry helper extension point for required conflict events
* apps/server/tests/unit - Unit verification scope for deterministic branch outcomes
* apps/server/tests/integration - Race simulation verification scope
* apps/server/tests/load - Hotspot conflict and retry storm load verification scope

### References

* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md - Primary research and selected approach rationale
* .copilot-tracking/research/subagents/2026-06-30/e3-s3-codebase-investigation.md - Supporting codebase evidence
* .copilot-tracking/research/subagents/2026-06-30/e3-s3-alternatives-analysis.md - Alternative evaluation backing selected path
* /memories/repo/ci-notes.md - Workspace command and validation conventions

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown authoring constraints for planning artifacts
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Writing-style conventions for planning artifacts

## Implementation Checklist

### [x] Implementation Phase 1: Command Contract and Deterministic Validation

<!-- parallelizable: false -->

* [x] Step 1.1: Extend placement command contract with commandId and route validation
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 12-28)
* [x] Step 1.2: Add canonical payload hashing and replay-window configuration
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 30-46)
* [x] Step 1.3: Validate phase changes
  * Run lint and build commands for modified files
  * Skip if validation conflicts with parallel phases

### [x] Implementation Phase 2: Transactional Idempotency Ledger and Conflict Mapping

<!-- parallelizable: false -->

* [x] Step 2.1: Add placement command ledger schema and database types
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 60-77)
* [x] Step 2.2: Implement replay/mismatch/fresh-command transaction branches in placement persistence
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 79-99)
* [x] Step 2.3: Map deterministic HTTP outcomes for loser, replay, and mismatch responses
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 101-115)
* [x] Step 2.4: Validate phase changes
  * Run migration and targeted placement tests

### [x] Implementation Phase 3: Telemetry and Replay-Window Abuse Controls

<!-- parallelizable: false -->

* [x] Step 3.1: Add required placement conflict telemetry emitters and integration points
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 129-145)
* [x] Step 3.2: Enforce replay-window checks and cleanup hooks for ledger growth control
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 147-165)
* [x] Step 3.3: Validate phase changes
  * Run lint and targeted telemetry/replay checks

### [x] Implementation Phase 4: Unit, Integration, and Load Coverage

<!-- parallelizable: false -->

* [x] Step 4.1: Add unit tests for deterministic winner and idempotency branches
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 179-193)
* [x] Step 4.2: Add integration race simulation for simultaneous claims and same-command retries
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 195-210)
* [x] Step 4.3: Add load hotspot conflict and retry-storm validation
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md (Lines 212-227)
* [x] Step 4.4: Validate phase changes
  * Run server unit, integration, and load test suites

### [x] Implementation Phase 5: Validation

<!-- parallelizable: false -->

* [x] Step 5.1: Run full project validation
  * Execute all lint commands (npm run lint, language linters)
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

See .copilot-tracking/plans/logs/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* E2-S2 tile persistence transaction boundary and coordinate conflict mapping are already in production code
* Existing migration and database typing workflow in apps/server/src/persistence remains available
* Server telemetry sink and server test/load harness are available in current monorepo

## Success Criteria

* Simultaneous same-coordinate placement requests resolve to one deterministic winner with stable loser conflict outcome mapping — Traces to: GitHub issue #19 acceptance criteria
* Retry with same commandId returns replay-safe deterministic result and produces no duplicate side effects — Traces to: GitHub issue #19 acceptance criteria
* Required conflict telemetry events are emitted with correlation metadata for detection and resolution — Traces to: GitHub issue #19 telemetry requirements
* Replay-window abuse controls are implemented with bounded ledger-retention behavior — Traces to: GitHub issue #19 security and abuse checks
* Unit, integration, and load tests cover winner rule, race behavior, and retry-storm correctness — Traces to: GitHub issue #19 test requirements
