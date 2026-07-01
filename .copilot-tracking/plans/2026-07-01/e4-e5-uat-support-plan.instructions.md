---
applyTo: '.copilot-tracking/changes/2026-07-01/e4-e5-uat-support-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E4-E5 Product Support for UAT Scenarios

## Overview

Implement the product, telemetry, and test changes required so the six E4/E5 manual UAT scenarios can be executed consistently.

## Objectives

### User Requirements

* Plan what is needed to support the UAT scenarios described in the attached research — Source: current session request and `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md`
* Support the six manual E4/E5 UAT rows covering bonds, burst recompute, palette preview, pan/zoom, onboarding, and accessibility — Source: `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md`

### Derived Objectives

* Build the missing E4 bond and E5 UX surfaces in dependency order instead of treating the matrix as documentation-only — Derived from: verified absence of bond/canvas/palette/onboarding/a11y implementation in current client and room state.
* Define a telemetry schema and emission points that make the manual UAT pass/fail conditions observable without bespoke tooling — Derived from: matrix reliance on telemetry sink evidence.

## Context Summary

### Project Files

* `apps/client/src/browser/app.ts` - Browser orchestrator that currently stops at auth/bootstrap/join/place flow.
* `apps/client/src/browser/render.ts` - Current form-based renderer that must evolve into canvas, preview, onboarding, and accessibility UI.
* `apps/client/src/browser/state.ts` - Current client state projection surface for tiles only.
* `apps/client/src/browser/api.ts` - Existing API bridge that will need telemetry-aware UX flows layered on top.
* `apps/server/src/rooms/arena.room.ts` - Current realtime room authority and fanout integration point.
* `apps/server/src/rooms/arena.state.ts` - Current placeholder room state that must be replaced or expanded for tile adjacency and bonds.
* `apps/server/src/http/app.ts` - HTTP composition root for tile placement, region diff, snapshot, and telemetry wiring.
* `apps/server/src/http/routes/session.routes.ts` - Bootstrap, join-token, reconnect, and session telemetry hooks.
* `apps/server/src/telemetry/telemetry-sink.ts` - Current telemetry contract and helper surface.
* `apps/server/tests/` and `apps/client/tests/` - Existing automated test locations for server/client coverage expansion.

### References

* `.copilot-tracking/research/2026-07-01/e4-e5-uat-support-research.md` - Primary planning research for this task.
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Manual UAT row procedures and observability expectations.

### Standards References

* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md` — Markdown requirements for planning artifacts and docs updates.
* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md` — Writing-style requirements for markdown artifacts.

## Implementation Checklist

### [ ] Implementation Phase 1: Bond Domain and Authoritative State Foundation

<!-- parallelizable: false -->

* [ ] Step 1.1: Replace or extend arena state to model tiles, adjacency inputs, and bond outcomes
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 12-30)
* [ ] Step 1.2: Implement deterministic bond evaluation and neighborhood recompute pipeline on the server
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 32-52)
* [ ] Step 1.3: Emit bond and recompute telemetry from authoritative execution points
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 54-72)
* [ ] Step 1.4: Validate server-side deterministic behavior and recompute coverage
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 74-81)

### [ ] Implementation Phase 2: Client Bond Rendering and Interactive Creation UX

<!-- parallelizable: false -->

* [ ] Step 2.1: Extend browser state and realtime projection to carry bond and viewport-ready tile data
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 87-107)
* [ ] Step 2.2: Replace the minimal form renderer with palette, placement preview, optimistic placement, and bond visuals
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 109-127)
* [ ] Step 2.3: Add pan/zoom, culling, and readability behavior for bonded tile clusters
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 129-148)
* [ ] Step 2.4: Emit client interaction telemetry for palette, preview, viewport, and render outcomes
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 150-166)

### [ ] Implementation Phase 3: Onboarding, Accessibility, and Time-to-First-Tile Instrumentation

<!-- parallelizable: false -->

* [ ] Step 3.1: Add onboarding stepper and first-tile timing instrumentation
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 172-189)
* [ ] Step 3.2: Add keyboard navigation, focus treatment, high-contrast mode, and reduced-motion bond variants
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 191-209)
* [ ] Step 3.3: Validate onboarding and accessibility behavior with targeted client tests and manual checks
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 211-216)

### [ ] Implementation Phase 4: Regression Coverage and UAT Support Instrumentation

<!-- parallelizable: true -->

* [ ] Step 4.1: Add automated regression coverage for bond determinism and client interaction telemetry
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 222-239)
* [ ] Step 4.2: Document developer-facing UAT support contracts and observability expectations
  * Details: `.copilot-tracking/details/2026-07-01/e4-e5-uat-support-details.md` (Lines 241-258)

### [ ] Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

* [ ] Step 5.1: Run full project validation across impacted workspaces
  * Execute root lint/build/test across the impacted workspaces.
* [ ] Step 5.2: Fix minor validation issues
  * Iterate on scope-local lint, build, test, and workflow problems only.
* [ ] Step 5.3: Report blocking issues
  * Document any unresolved design choices or environment setup blockers that prevent full UAT execution.

## Planning Log

See `.copilot-tracking/plans/logs/2026-07-01/e4-e5-uat-support-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing auth/bootstrap/join-token/placement server flow remains the base transport for the richer client experience.
* Telemetry sink remains available in `optional` or `required` mode for manual UAT evidence observation.
* Product phases must land before manual UAT rows can be executed meaningfully.

## Success Criteria

* The server exposes deterministic bond outcomes and recompute telemetry that satisfy rows 1 and 2 — Traces to: `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md`
* The browser supports palette preview, optimistic placement, bond rendering, pan/zoom, onboarding, and accessibility flows needed for rows 3 through 6 — Traces to: `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md`
* The telemetry sink receives all E4/E5 event families referenced by the UAT matrix with stable payload contracts — Traces to: `.copilot-tracking/research/2026-07-01/e4-e5-uat-support-research.md`