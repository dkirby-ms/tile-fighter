---
applyTo: '.copilot-tracking/changes/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Story Layer1 E2-S4 Region Diff Retrieval API

## Overview

Implement an authenticated viewport-scoped region diff retrieval API that returns incremental tile deltas by since-version, backed by region versioning and tile delta persistence, with telemetry and layered tests.

## Objectives

### User Requirements

* Add a region diff retrieval API that supports viewport-scoped reads and returns empty responses when client version is current — Source: GitHub issue #16 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md
* Return incremental updates when client version is stale — Source: GitHub issue #16 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md
* Enforce request bounds and payload controls to reduce abuse risk — Source: GitHub issue #16 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md
* Emit telemetry events tile_diff_requested and tile_diff_returned for observability — Source: .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md
* Add unit, integration, and load coverage for the new diff behavior — Source: GitHub issue #16 and .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md

### Derived Objectives

* Implement a dedicated region diff vertical slice (migration, repository, service, routes, tests) to avoid coupling with snapshot logic — Derived from: selected approach in research and existing server module boundaries
* Keep route shape aligned with current POST JSON endpoint conventions in server HTTP routes — Derived from: apps/server/src/http/routes/tile.routes.ts pattern and research alternative analysis
* Use append-only tile deltas plus region watermark versioning for deterministic since-version retrieval — Derived from: selected approach in research lines 165-236
* Defer unresolved product decisions (delete semantics, concrete limits, membership authorization scope) with explicit defaults and follow-on work — Derived from: open questions in research lines 36-45

## Context Summary

### Project Files

* docs/layer1-backlog.md - Layer1 story intent and acceptance context.
* apps/server/src/http/app.ts - Auth middleware ordering and route registration surface.
* apps/server/src/http/routes/tile.routes.ts - Route validation and error mapping conventions.
* apps/server/src/persistence/db.ts - Kysely table typing location for schema additions.
* apps/server/src/persistence/tile.repository.ts - Existing tile write/read transaction patterns.
* apps/server/src/telemetry/telemetry-sink.ts - Telemetry helper and event emission style.
* packages/shared-types/src/index.ts - Shared request/response contract exports.
* apps/server/tests/integration/http-auth.integration.test.ts - Auth behavior integration pattern.
* apps/server/tests/load/room-join-load.ts - Load harness conventions.

### References

* .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md - Primary research with selected approach, alternatives, and test guidance.
* https://github.com/dkirby-ms/tile-fighter/issues/16 - Story acceptance source.

### Standards References

* .github/instructions/hve-core/markdown.instructions.md — Markdown planning artifact requirements.
* .github/instructions/hve-core/writing-style.instructions.md — Writing style for planning artifacts.
* .github/instructions/shared/hve-core-location.instructions.md — Artifact path fallback guidance.

## Implementation Checklist

### [x] Implementation Phase 1: Data Model and Persistence Foundation

<!-- parallelizable: false -->

* [x] Step 1.1: Add migration for region version and tile delta tables
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 12-32)
* [x] Step 1.2: Implement diff repository and transactional write-path versioning hooks
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 34-56)
* [x] Step 1.3: Validate persistence changes
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 58-63)

### [x] Implementation Phase 2: Diff Service and Telemetry

<!-- parallelizable: true -->

Conditional note: Step 2.1 and Step 2.2 depend on Phase 1, but this phase can proceed in parallel with Phase 3 Step 3.1 because files do not overlap.

* [x] Step 2.1: Implement region diff service orchestration and response assembly
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 70-90)
* [x] Step 2.2: Add diff telemetry helper methods and instrumentation
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 91-112)
* [x] Step 2.3: Validate service and telemetry behavior
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 113-119)

### [x] Implementation Phase 3: HTTP Contract and Route Wiring

<!-- parallelizable: true -->

Conditional note: Step 3.1 can execute in parallel with Phase 2. Steps 3.2 and 3.3 must run after Phase 2 completion.

* [x] Step 3.1: Add shared request/response contract types
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 125-145)
* [x] Step 3.2: Add region diff route and app wiring
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 146-171)
* [x] Step 3.3: Validate route and contract behavior
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 172-178)

### [x] Implementation Phase 4: Test Matrix and Load Harness

<!-- parallelizable: false -->

* [x] Step 4.1: Add unit and integration diff behavior tests
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 184-206)
* [x] Step 4.2: Add load scenario for stale and unchanged diff requests
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 207-226)
* [x] Step 4.3: Validate new test and load suites
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 227-233)

### [x] Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

* [x] Step 5.1: Run full project validation
  * Execute `npm run lint`, `npm run build`, and `npm run test`
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 239-247)
* [x] Step 5.2: Fix minor lint, type, and test issues introduced by implementation
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 248-251)
* [x] Step 5.3: Report unresolved blockers and follow-on planning needs
  * Details: .copilot-tracking/details/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-details.md (Lines 252-254)

## Planning Log

See .copilot-tracking/plans/logs/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Story dependencies for prior tile persistence and snapshot baseline are completed.
* PostgreSQL and node-pg-migrate pipeline in apps/server/src/persistence/migrations.
* Kysely transaction support in apps/server/src/persistence.
* Auth middleware in apps/server/src/http/auth-middleware.ts.
* Telemetry sink in apps/server/src/telemetry/telemetry-sink.ts.
* Vitest harness under apps/server/tests for unit, integration, and load suites.

## Success Criteria

* Region diff endpoint returns empty payload when sinceVersion equals current region version — Traces to: issue #16 acceptance and research selected approach.
* Region diff endpoint returns incremental stale updates with deterministic compaction semantics — Traces to: issue #16 acceptance and research lines 165-236.
* Persistence writes maintain region version and append deltas atomically on tile mutations — Traces to: selected data model in research.
* Telemetry events tile_diff_requested and tile_diff_returned emit required attributes — Traces to: research telemetry requirements.
* Unit, integration, and load tests for diff retrieval pass under CI-aligned commands — Traces to: issue #16 and repository test conventions.
