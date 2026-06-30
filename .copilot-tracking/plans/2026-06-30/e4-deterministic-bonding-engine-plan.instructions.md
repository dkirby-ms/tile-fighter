---
applyTo: '.copilot-tracking/plans/2026-06-30/e4-deterministic-bonding-engine-plan.instructions.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E4 Deterministic Bonding Engine

## Overview

Implement a deterministic bonding evaluator in the shared contract layer, invoke it from the authoritative placement success path, emit `bonding_triggered` telemetry, and add deterministic tests that prove rule stability and placement-trigger behavior.

## Objectives

### User Requirements

* Emit `glow-chain` for same-hue adjacency, `blend-gradient` for two-color adjacency, and `pulse-rhythm` for alternating pair patterns - Source: docs/layer1-backlog.md (E4-S1 acceptance criteria)
* Keep bonding outcomes predictable by using a pure evaluator in a shared domain module - Source: docs/layer1-backlog.md (E4-S1 technical notes)
* Emit `bonding_triggered` telemetry with bond type - Source: docs/layer1-backlog.md (E4-S1 telemetry requirements)
* Validate tile attribute bounds as part of the bonding input surface - Source: docs/layer1-backlog.md (E4-S1 security and abuse checks)
* Add unit, integration, and property-style deterministic tests for the bonding engine - Source: docs/layer1-backlog.md (E4-S1 test requirements)

### Derived Objectives

* Keep E4-S1 server-authoritative so the bonding decision is made only after a successful placement commit - Derived from: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md
* Reuse existing canonical ordering and hashing patterns to avoid nondeterministic neighborhood evaluation - Derived from: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md
* Default the initial implementation toward strict orthogonal adjacency unless PD-01 approves a wider local neighborhood for `pulse-rhythm` - Derived from: docs/layer1-backlog.md and validator findings against the research gap
* Limit the initial scope to server telemetry plus shared evaluator code and defer client VFX wiring to later E4 stories - Derived from: docs/layer1-backlog.md and .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md

## Context Summary

### Project Files

* packages/shared-types/src/index.ts - Current shared contract surface; no bond evaluator or bond types yet
* apps/server/src/http/routes/tile.routes.ts - Existing placement request validation surface that currently lacks tile attribute bounds enforcement
* apps/server/src/http/app.ts - Placement success path where bonding can be invoked after commit
* apps/server/src/persistence/tile.repository.ts - Authoritative placement write path and neighborhood data source
* apps/server/src/telemetry/telemetry-sink.ts - Server telemetry extension point for bonding events
* apps/server/tests/unit - Deterministic unit coverage location
* apps/server/tests/integration - Placement-trigger integration coverage location
* apps/server/tests/load - Existing load harness if a later expansion is needed

### References

* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md - Primary research and selected implementation path
* .copilot-tracking/research/subagents/2026-06-30/e4-epic-task1-research.md - Supporting research with alternatives and scenario mapping
* docs/layer1-backlog.md - Epic and story acceptance criteria for E4-S1
* .copilot-tracking/github-relationships.md - E4-S1 dependency on E4-S2 and E4-S4 blocking relationships
* apps/server/tests/unit/region-diff.service.test.ts - Deterministic test style for sorted outputs and repeatable comparisons
* apps/client/tests/unit/replay-checksum.test.ts - Reorder-invariance test pattern that fits the deterministic corpus goal

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown authoring constraints for planning artifacts
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Voice and tone guidance for planning artifacts

## Implementation Checklist

### [ ] Implementation Phase 1: Shared Bond Evaluator, Route Validation, and Authoritative Placement Hook

<!-- parallelizable: false -->

* [ ] Step 1.1: Add bond types and a pure evaluator in the shared contract layer
  * Details: .copilot-tracking/details/2026-06-30/e4-deterministic-bonding-engine-details.md (Lines 12-30)
* [ ] Step 1.2: Add route-level tile attribute bounds validation
  * Details: .copilot-tracking/details/2026-06-30/e4-deterministic-bonding-engine-details.md (Lines 32-53)
* [ ] Step 1.3: Add bounded neighborhood retrieval and invoke the evaluator after a successful placement commit
  * Details: .copilot-tracking/details/2026-06-30/e4-deterministic-bonding-engine-details.md (Lines 55-78)
* [ ] Step 1.4: Validate phase changes
  * Run targeted lint and build checks for shared-types and server files touched in this phase
  * Details: .copilot-tracking/details/2026-06-30/e4-deterministic-bonding-engine-details.md (Lines 80-100)

### [ ] Implementation Phase 2: Bonding Telemetry and Deterministic Coverage

<!-- parallelizable: true -->

* [ ] Step 2.1: Add `bonding_triggered` telemetry support in the server sink
  * Details: .copilot-tracking/details/2026-06-30/e4-deterministic-bonding-engine-details.md (Lines 106-122)
* [ ] Step 2.2: Add unit tests for rule matrix coverage and reorder invariance
  * Details: .copilot-tracking/details/2026-06-30/e4-deterministic-bonding-engine-details.md (Lines 124-142)
* [ ] Step 2.3: Add integration coverage for placement-triggered bonding outcomes
  * Details: .copilot-tracking/details/2026-06-30/e4-deterministic-bonding-engine-details.md (Lines 144-162)
* [ ] Step 2.4: Validate phase changes
  * Run targeted unit and integration tests for the modified bonding path

### [ ] Implementation Phase 3: Validation

<!-- parallelizable: false -->

* [ ] Step 3.1: Run full project validation
  * Execute all lint commands for touched packages
  * Execute build scripts for touched components
  * Run tests that cover the bonding evaluator and placement trigger path
* [ ] Step 3.2: Fix minor validation issues
  * Iterate on lint errors, type errors, and small test failures
  * Keep any larger follow-up work in the planning log instead of widening scope here
* [ ] Step 3.3: Report blocking issues
  * Document any unresolved rule-definition or contract questions
  * Hand off follow-on work that exceeds E4-S1 scope

## Planning Decisions

### PD-01: Bond Neighborhood Geometry for `pulse-rhythm`

The backlog guarantees adjacency-based bond behavior, but the research still leaves room for interpretation on whether `alternating pair pattern` should be evaluated from orthogonal neighbors only, all 8 immediate neighbors, or a wider local window.

| Option | Description | Trade-off |
|--------|-------------|-----------|
| A | Use strict 4-neighbor orthogonal adjacency for all E4-S1 rules | Lowest ambiguity and easiest deterministic implementation, but may underspecify `pulse-rhythm` if design intent expected diagonals |
| B | Use 8-neighbor immediate adjacency for `pulse-rhythm` while keeping other rules orthogonal | Slightly richer pattern vocabulary, but increases evaluator complexity and expands the deterministic input surface |
| C | Use a wider rule-specific local window | Most expressive, but diverges furthest from current backlog wording and should be deferred to later E4 work |

**Recommendation**: Option A because it aligns most closely with the current backlog wording and keeps E4-S1 deterministic scope narrow.

**Impact if deferred**: Implement using Option A as the default and leave the discrepancy open in the planning log so the team can revisit before coding if design intent changes.

## Planning Log

See .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing authoritative placement flow in apps/server/src/persistence/tile.repository.ts and apps/server/src/http/app.ts
* Shared contract package at packages/shared-types for the evaluator export surface
* Server telemetry sink for bond event emission
* Deterministic unit and integration test harnesses already used in apps/server/tests

## Success Criteria

* The shared evaluator returns the expected bond type for each adjacency-based E4-S1 rule case and remains stable under reordered equivalent input - Traces to: docs/layer1-backlog.md (E4-S1 acceptance criteria)
* Successful placement paths emit `bonding_triggered` telemetry exactly once per triggered bond and preserve canonical ordering - Traces to: docs/layer1-backlog.md (E4-S1 telemetry requirements)
* Route validation, unit coverage, and integration coverage prove deterministic behavior across repeated runs and placement-triggered outcomes - Traces to: docs/layer1-backlog.md (E4-S1 test requirements and abuse checks)