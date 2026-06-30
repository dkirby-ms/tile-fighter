---
applyTo: '.copilot-tracking/changes/2026-06-30/e5-s1-creator-placement-preview-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E5-S1 Creator Placement Preview

## Overview

Implement E5-S1 by adding deterministic creator tool-state, pure placement preview evaluation, input sanitization, placement submission adapter, and telemetry emission in apps/client with unit and integration coverage.

## Objectives

### User Requirements

* Given palette open, when shape and color are selected, then preview updates instantly. - Source: docs/layer1-backlog.md (E5-S1 acceptance criteria)
* Given occupied cell hover, when preview appears, then blocked indicator is shown. - Source: docs/layer1-backlog.md (E5-S1 acceptance criteria)
* Given valid cell click, when place command sends, then optimistic indicator appears until ack. - Source: docs/layer1-backlog.md (E5-S1 acceptance criteria)
* Emit telemetry events `palette_opened`, `shape_selected`, `color_selected`, and `placement_preview_shown`. - Source: docs/layer1-backlog.md (E5-S1 telemetry requirements)
* Sanitize client inputs before command submit. - Source: docs/layer1-backlog.md (E5-S1 security and abuse checks)

### Derived Objectives

* Keep E5-S1 deterministic through pure state transitions and pure preview derivation to support stable test outcomes. - Derived from: .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md
* Reuse existing placement contracts and server route semantics without requiring immediate shared-type breaking changes. - Derived from: .copilot-tracking/research/2026-06-30/e5-s1-creator-placement-preview-research.md
* Keep story scope to S1 and log unresolved contract decisions as follow-on work rather than widening into E5-S2+ tasks. - Derived from: planning constraints and backlog sequencing

## Context Summary

### Project Files

* apps/client/src/index.ts - Current export surface where new creator modules will be exported.
* apps/client/src/session/realtime-delta-handler.ts - Existing deterministic ack seam for optimistic resolution.
* apps/client/package.json - Client workspace scripts including tests.
* packages/shared-types/src/index.ts - Existing TilePlaceCommand and TilePlaceResult contracts.
* apps/server/src/http/routes/tile.routes.ts - Authoritative placement submit route and payload validation.
* apps/client/tests/unit - Unit coverage location for reducer/evaluator/sanitization/caller tests.
* apps/client/tests/integration - Integration coverage location for placement flow behavior.

### References

* .copilot-tracking/research/2026-06-30/e5-s1-creator-placement-preview-research.md - Primary S1 research and selected implementation path.
* .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md - Supporting seam analysis and alternative path evaluation.
* docs/layer1-backlog.md - E5-S1 acceptance criteria, telemetry, and security notes.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown rules for planning artifacts.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Writing style guidance for planning artifacts.

## Implementation Checklist

### [ ] Implementation Phase 1: Deterministic creator tool and preview foundations

<!-- parallelizable: false -->

* [ ] Step 1.1: Add deterministic tool-state reducer and creator exports
  * Details: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Lines 11-30)
* [ ] Step 1.2: Add pure placement preview evaluator and explicit reducer plus preview unit coverage
  * Details: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Lines 32-52)
* [ ] Step 1.3: Validate phase changes
  * Run lint, unit tests, and build for @game/client

### [ ] Implementation Phase 2: Submission path, optimistic lifecycle, and telemetry

<!-- parallelizable: false -->

* [ ] Step 2.1: Add input sanitization and placement submit adapter
  * Details: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Lines 62-83)
* [ ] Step 2.2: Add deterministic telemetry adapter for required E5-S1 events
  * Details: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Lines 85-103)
* [ ] Step 2.3: Add optimistic indicator lifecycle with ack-preferred clear policy
  * Details: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Lines 108-132)
* [ ] Step 2.4: Validate phase changes
  * Run lint, unit tests, integration tests, and build for @game/client

### [ ] Implementation Phase 3: Validation

<!-- parallelizable: false -->

* [ ] Step 3.1: Run full project validation
  * Execute lint, build, and test commands for @game/client and workspace-level checks
* [ ] Step 3.2: Fix minor validation issues
  * Iterate on lint, type, and test failures local to E5-S1 scope
* [ ] Step 3.3: Report blocking issues
  * Document unresolved telemetry schema decisions in planning log and follow-on items

## Planning Log

See .copilot-tracking/plans/logs/2026-06-30/e5-s1-creator-placement-preview-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing client workspace scripts and test harness
* Existing placement route semantics in apps/server/src/http/routes/tile.routes.ts
* Existing placement contracts in packages/shared-types/src/index.ts
* Existing realtime ack behavior in apps/client/src/session/realtime-delta-handler.ts

## Success Criteria

* E5-S1 behavior for preview update, blocked indication, and optimistic placement lifecycle is fully specified with deterministic implementation seams. - Traces to: docs/layer1-backlog.md (E5-S1 acceptance criteria)
* Required telemetry and input sanitization requirements are mapped to concrete modules and tests. - Traces to: docs/layer1-backlog.md (E5-S1 telemetry and security requirements)
* Implementation path is validated by client lint/build/tests plus workspace smoke checks. - Traces to: apps/client/package.json and workspace scripts
