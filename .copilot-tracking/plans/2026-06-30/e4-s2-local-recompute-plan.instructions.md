---
applyTo: '.copilot-tracking/plans/2026-06-30/e4-s2-local-recompute-plan.instructions.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E4-S2 Local Bond Recompute Coordinator

## Overview

Implement a server-side bounded recompute coordinator that coalesces local bond recalculation work after successful placements, suppresses redundant bond events when adjacency is unchanged, and emits queue telemetry for burst-lag and skip behavior.

## Objectives

### User Requirements

* Recalculate only local neighborhoods so bonding stays fast — Source: docs/layer1-backlog.md (E4-S2 acceptance criteria)
* Avoid redundant bond events when adjacency does not change — Source: docs/layer1-backlog.md (E4-S2 acceptance criteria)
* Keep recompute queue lag within budget under burst placement — Source: docs/layer1-backlog.md (E4-S2 acceptance criteria)
* Protect the queue from flood abuse by account/IP — Source: docs/layer1-backlog.md (E4-S2 security and abuse checks)
* Add unit, integration, and load coverage for neighborhood bounds, event dedupe, and burst behavior — Source: docs/layer1-backlog.md (E4-S2 test requirements)

### Derived Objectives

* Introduce a server-side BondRecomputeCoordinator in apps/server/src/domain rather than extending realtime fanout — Derived from: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md
* Use a coalescing key rooted in region plus affected local cell, with last-emitted fingerprint suppression, so repeated placements do not re-emit unchanged bond state — Derived from: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md
* Keep bond evaluation pure by reusing packages/shared-types/src/bonding.ts and only queueing server-side recompute work — Derived from: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md and docs/layer1-backlog.md
* Thread queue limits through the existing server config bootstrap so burst behavior is observable and bounded — Derived from: apps/server/src/index.ts and apps/server/src/config/env.ts

## Context Summary

### Project Files

* apps/server/src/http/app.ts - Current placement success path where recompute work is enqueued after commit
* apps/server/src/persistence/tile.repository.ts - Existing bounded orthogonal neighborhood helper for local bond input
* apps/server/src/domain/delta-fanout.service.ts - Closest bounded-queue and cleanup analogue for queue behavior
* apps/server/src/telemetry/telemetry-sink.ts - Existing bond and throttle telemetry surface that will gain recompute events
* apps/server/src/index.ts - Server bootstrap for queue limit wiring
* apps/server/src/config/env.ts - Environment schema for recompute queue limits and flood-protection controls
* apps/server/tests/unit - Unit harness for coordinator, dedupe, and skip behavior
* apps/server/tests/integration - Integration harness for placement-triggered recompute correctness
* apps/server/tests/load - Load harness for burst-lag validation

### References

* .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md - Primary research and selected implementation path
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md - E4-S1 grounding, local neighborhood helper, and deterministic evaluator context
* docs/layer1-backlog.md - E4-S2 story intent, telemetry, and abuse constraints (Lines 264-271)
* apps/server/src/http/app.ts - Current post-commit placement flow (Lines 196-245)
* apps/server/src/persistence/tile.repository.ts - Local neighborhood query helper (Lines 920-956)
* apps/server/src/domain/delta-fanout.service.ts - Bounded queue analogue (Lines 62-181, 214-259)
* apps/server/tests/load/placement-conflict-hotspot.load.ts - Burst-load pattern for queue-lag validation (Lines 17-217)

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown authoring constraints for planning artifacts
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Voice and tone guidance for planning artifacts

## Implementation Checklist

### Phase 1: Queue Coordinator and Server Wiring

<!-- parallelizable: false -->

* [x] Step 1.1: Add a server-side BondRecomputeCoordinator with coalescing and last-emitted fingerprint suppression
  * Details: .copilot-tracking/details/2026-06-30/e4-s2-local-recompute-details.md (Lines 14-48)
* [x] Step 1.2: Thread recompute enqueue calls through the authoritative placement success path and wire queue limits from server bootstrap
  * Details: .copilot-tracking/details/2026-06-30/e4-s2-local-recompute-details.md (Lines 50-82)
* [x] Step 1.3: Validate phase changes
  * Run targeted lint and build checks for the new coordinator, HTTP wiring, and config path

### Phase 2: Telemetry, Tests, and Load Validation

<!-- parallelizable: true -->

* [x] Step 2.1: Add recompute telemetry and flood-protection hooks at the server edge
  * Details: .copilot-tracking/details/2026-06-30/e4-s2-local-recompute-details.md (Lines 86-114)
* [x] Step 2.2: Add unit coverage for queue coalescing, skip behavior, and lag-bound invariants
  * Details: .copilot-tracking/details/2026-06-30/e4-s2-local-recompute-details.md (Lines 116-150)
* [x] Step 2.3: Add integration coverage for repeated placements and no-redundant-event behavior
  * Details: .copilot-tracking/details/2026-06-30/e4-s2-local-recompute-details.md (Lines 152-180)
* [x] Step 2.4: Add burst-load coverage for queue lag and skip rate
  * Details: .copilot-tracking/details/2026-06-30/e4-s2-local-recompute-details.md (Lines 182-206)
* [x] Step 2.5: Validate phase changes
  * Run focused unit, integration, and load checks for the recompute path

### Phase 3: Final Validation

<!-- parallelizable: false -->

* [x] Step 3.1: Run full project validation
  * Execute repo lint, build, and relevant test suites
* [x] Step 3.2: Fix minor validation issues
  * Resolve local lint, type, or test issues introduced by the recompute changes
* [x] Step 3.3: Report blocking issues
  * Document any unresolved scope questions or larger follow-on work in the planning log

## Planning Log

See .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md for discrepancy tracking, implementation paths considered, and follow-on work.

## Dependencies

* apps/server/src/http/app.ts
* apps/server/src/config/env.ts
* apps/server/src/index.ts
* apps/server/src/telemetry/telemetry-sink.ts
* apps/server/src/domain/delta-fanout.service.ts
* apps/server/src/persistence/tile.repository.ts

## Success Criteria

* Only local neighborhood work is enqueued and drained for a placement, with duplicate pending work coalesced by region/local-cell key — Traces to: docs/layer1-backlog.md (E4-S2 acceptance criteria)
* Recompute telemetry records started, completed, and skipped cases without emitting redundant bond events for unchanged adjacency — Traces to: docs/layer1-backlog.md (E4-S2 telemetry and no-redundant-event criteria)
* Unit, integration, and load suites demonstrate bounded queue behavior under burst placement and queue lag remains within the defined budget — Traces to: docs/layer1-backlog.md (E4-S2 test and performance criteria)