---
applyTo: '.copilot-tracking/changes/2026-06-29/issue-14-authoritative-placement-self-edit-window-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Issue #14 Authoritative Placement and 10-Minute Self-Edit Window

## Overview

Implement server-authoritative tile placement and a creator-only 10-minute self-edit window through authenticated HTTP routes, repository-backed policy checks, shared contracts, telemetry, and layered tests.

## Objectives

### User Requirements

* Enforce authoritative tile placement on the server and reject occupied coordinates deterministically — Source: GitHub Issue #14 and research file .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md
* Allow the tile creator to edit their own tile only within 10 minutes using trusted server time — Source: GitHub Issue #14 and research file .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md
* Deny edits from non-owners and expired self-edit attempts with explicit rejection reasons — Source: GitHub Issue #14 and research file .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md
* Preserve a per-account placement throttle and surface telemetry for place, reject, and edit outcomes — Source: GitHub Issue #14 and research file .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md
* Add unit, integration, startup smoke, and load coverage for the authoritative placement and edit flow — Source: GitHub Issue #14 and research file .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md

### Derived Objectives

* Introduce a dedicated tile command route module instead of overloading the room flow — Derived from: current HTTP route composition in apps/server/src/http/app.ts:1-26 and lack of tile mutation routes in apps/server/src/http/routes/session.routes.ts:1-132
* Keep owner identity server-derived from authenticated principal context — Derived from: apps/server/src/http/auth-middleware.ts:14-16 and research findings
* Use repository result unions and server clock checks to keep rejection behavior deterministic — Derived from: apps/server/src/persistence/tile.repository.ts:31-123 and research findings
* Add shared DTOs so client and server can agree on tile command and result shapes — Derived from: missing tile contracts in packages/shared-types/src/index.ts:1-19
* Preserve existing persistence telemetry helpers while adding story-level telemetry events — Derived from: apps/server/src/telemetry/telemetry-sink.ts:1-59 and research findings

## Context Summary

### Project Files

* apps/server/src/http/app.ts - Mount point for the new tile route module after auth middleware at lines 1-26.
* apps/server/src/http/routes/session.routes.ts - Reference pattern for validation, in-memory throttles, and telemetry at lines 1-132.
* apps/server/src/http/auth-middleware.ts - Principal source for owner checks and server-owned identity.
* apps/server/src/persistence/tile.repository.ts - Existing insert/select repository surface and conflict-union pattern at lines 1-123.
* apps/server/src/persistence/migrations/1720000000000_tiles.js - Current ownership, timestamp, and unique coordinate constraint schema.
* apps/server/src/telemetry/telemetry-sink.ts - Existing tile persistence telemetry helpers and event payload shape at lines 1-59.
* packages/shared-types/src/index.ts - Shared contract surface that currently lacks tile command/result DTOs.
* apps/server/tests/integration/tile-persistence.integration.test.ts - Existing persistence integration coverage to extend for placement and edit behavior.
* apps/server/tests/unit/tile.repository.test.ts - Existing repository unit coverage to extend for owner and edit-window checks.
* apps/server/tests/integration/startup-migration.smoke.test.ts - Schema smoke coverage to extend if the edit path needs additive columns.
* apps/server/tests/load/room-join-load.ts - Existing load harness candidate for hotspot contention and throttle checks.

### References

* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md - Primary research and selected technical scenario.
* .copilot-tracking/research/subagents/2026-06-29/issue-14-intent-research.md - Follow-up intent research referenced by the primary research.
* docs/layer1-backlog.md - Story-level acceptance and telemetry expectations.
* apps/server/src/http/app.ts:1-26 - Route composition and middleware order.
* apps/server/src/http/routes/session.routes.ts:1-132 - Validation and throttling conventions.
* apps/server/src/persistence/tile.repository.ts:31-123 - Conflict-union repository behavior.
* apps/server/src/telemetry/telemetry-sink.ts:1-59 - Telemetry payload convention.

### Standards References

* .github/instructions/hve-core/markdown.instructions.md - Markdown formatting requirements for planning files.
* .github/instructions/hve-core/writing-style.instructions.md - Tone and clarity conventions for markdown content.
* .github/instructions/shared/hve-core-location.instructions.md - Artifact location resolution when referenced files move.

## Implementation Checklist

### [ ] Implementation Phase 1: Route, Shared Contract, and Policy Surface

<!-- parallelizable: false -->

* [ ] Step 1.1: Add a dedicated tile route module for authoritative placement and edit commands
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 25-49)
* [ ] Step 1.2: Mount the new tile routes in the HTTP app after authentication middleware
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 51-71)
* [ ] Step 1.3: Add shared tile command and result DTOs for placement and edit flows
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 73-97)

### [ ] Implementation Phase 2: Repository, Persistence, and Telemetry

<!-- parallelizable: true -->

* [ ] Step 2.1: Extend tile repository with authoritative insert and bounded update operations
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 99-122)
* [ ] Step 2.2: Add or adjust persistence schema for edit audit metadata if required by the selected implementation
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 124-145)
* [ ] Step 2.3: Add telemetry helpers for tile_placed, tile_place_rejected, and tile_edited
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 147-168)
* [ ] Step 2.4: Validate repository, schema, and telemetry changes
  * Run server lint and build focused on modified files
  * Confirm deterministic conflict mapping and edit-window policy compile cleanly

### [ ] Implementation Phase 3: Tests and Load Coverage

<!-- parallelizable: false -->

* [ ] Step 3.1: Extend repository unit tests for owner, conflict, and edit-window boundaries
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 190-210)
* [ ] Step 3.2: Extend persistence integration tests for place, reject, edit, and expiry scenarios
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 212-232)
* [ ] Step 3.3: Extend startup migration smoke coverage for any additive metadata columns
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 234-253)
* [ ] Step 3.4: Add or update load coverage for placement contention and throttle behavior
  * Details: .copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md (Lines 255-279)

### [ ] Implementation Phase 4: Final Validation

<!-- parallelizable: false -->

* [ ] Step 4.1: Run full workspace validation
  * Execute repository lint, build, and test commands at workspace scope
* [ ] Step 4.2: Fix minor issues surfaced by validation
  * Iterate on local lint, type, or test failures introduced by the plan changes
* [ ] Step 4.3: Report any blocking gaps
  * Document issues that need additional research or product clarification
  * Keep the plan narrow and avoid broad refactors in this phase

## Planning Log

See .copilot-tracking/plans/logs/2026-06-29/issue-14-authoritative-placement-self-edit-window-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing authenticated HTTP app composition in apps/server/src/http/app.ts
* Existing principal propagation in apps/server/src/http/auth-middleware.ts
* Kysely-based persistence layer in apps/server/src/persistence/tile.repository.ts
* PostgreSQL schema migration framework in apps/server/src/persistence/migrations
* Existing telemetry sink in apps/server/src/telemetry/telemetry-sink.ts
* Vitest-based unit, integration, and load test structure in apps/server/tests

## Success Criteria

* Tile placement is server-authoritative and returns deterministic rejection reasons for occupied coordinates — Traces to: GitHub Issue #14 and research file .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md
* Tile self-edit is permitted only to the creator and only while the server-time 10-minute window remains open — Traces to: GitHub Issue #14 and research file .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md
* Shared contracts, telemetry, and repository behavior compile and test cleanly across server and shared packages — Traces to: current architecture in apps/server/src and packages/shared-types/src
* Unit, integration, smoke, and load coverage explicitly exercise place, occupied reject, owner mismatch, and edit expiry cases — Traces to: GitHub Issue #14 acceptance and research findings
* Planning log records selected approach, alternatives, and follow-on work for later scope expansion — Traces to: research recommendations and plan validation needs
