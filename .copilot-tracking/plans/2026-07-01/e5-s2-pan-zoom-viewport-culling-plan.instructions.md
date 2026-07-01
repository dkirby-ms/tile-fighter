---
applyTo: '.copilot-tracking/changes/2026-07-01/e5-s2-pan-zoom-viewport-culling-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E5-S2 Pan Zoom and Viewport Culling

## Overview

Implement E5-S2 by adding deterministic client camera state, bounded viewport math, debounced/coalesced viewport diff fetching, visible-tile culling, and telemetry events while reusing existing shared viewport contracts and server abuse bounds.

## Objectives

### User Requirements

* Add pan and zoom behavior that feels smooth and keeps tile content legible. - Source: docs/layer1-backlog.md (Story #26 E5-S2 acceptance criteria)
* Culling must exclude off-screen tiles from draw candidates to reduce render pressure. - Source: docs/layer1-backlog.md (Story #26 E5-S2 acceptance criteria)
* Integrate viewport-based region-diff fetching through existing server contracts. - Source: docs/layer1-backlog.md (Story #26 E5-S2 integration requirement)
* Emit `viewport_changed` and `zoom_level_changed` telemetry events. - Source: docs/layer1-backlog.md (Story #26 telemetry requirements)
* Respect abuse limits and viewport bounds during fetch requests. - Source: docs/layer1-backlog.md (Story #26 security and abuse notes)

### Derived Objectives

* Reuse `RegionDiffViewport`, `RegionDiffRequest`, and `DEFAULT_REGION_DIFF_POLICY` from shared-types rather than introducing client-local viewport schemas. - Derived from: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md
* Keep navigation logic deterministic and pure where possible to align with existing client testing patterns. - Derived from: apps/client/src/creator/tool-state.ts and apps/client/src/creator/placement-preview.ts patterns documented in research
* Add targeted integration and unit coverage first, then layer performance evidence for fps/memory as artifact-backed validation. - Derived from: E5-S2 research findings and existing CI/verify workflow gaps
* Preserve E2-S4 dependency compatibility as a first-class regression gate while delivering E5-S2 changes. - Derived from: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Scope assumptions)

## Context Summary

### Project Files

* apps/client/src/index.ts - Current client export seam where new navigation modules must be exposed.
* apps/client/src/creator/creator-telemetry.ts - Existing telemetry surface to extend or compose for E5-S2 events.
* packages/shared-types/src/index.ts - Existing `RegionDiffViewport`, `RegionDiffRequest`, and default policy contracts.
* apps/server/src/http/routes/region-diff.routes.ts - Existing route-level viewport bounds validation.
* apps/server/src/http/app.ts - Existing region-diff route mount and default policy wiring.
* apps/server/src/persistence/region-diff.repository.ts - Existing viewport-bounded query seam.
* apps/server/tests/integration/region-diff.integration.test.ts - Existing server abuse and viewport bounds coverage.
* .github/workflows/ci.yml - Existing lint/build/test pipeline used as base validation.
* .github/workflows/verify-release.yml - Existing post-deploy checks that currently lack explicit E5-S2 UX/perf proof.

### References

* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md - Primary E5-S2 research and selected approach.
* docs/layer1-backlog.md - Story #26 acceptance criteria, telemetry, abuse constraints, and test intent.
* docs/game-design-document.md - Product expectations around camera navigation, culling, and responsiveness.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown authoring constraints for planning artifacts.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Required writing style guidance for planning artifacts.

## Implementation Checklist

### [x] Implementation Phase 1: Deterministic navigation and viewport math foundations

<!-- parallelizable: false -->

* [x] Step 1.1: Add camera-state reducer and clamps for pan/zoom transitions
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 11-30)
* [x] Step 1.2: Add viewport derivation math that converts camera state into bounded `RegionDiffViewport` values
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 32-50)
* [x] Step 1.3: Add unit tests for camera invariants and viewport bounds normalization
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 52-63)
* [x] Step 1.4: Validate phase changes
  * Run lint, unit tests, and build for @game/client

### [x] Implementation Phase 2: Viewport fetch orchestration and local culling

<!-- parallelizable: false -->

* [x] Step 2.1: Add viewport diff caller with debounce, in-flight coalescing, and latest-wins response handling
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 72-95)
* [x] Step 2.2: Add visible-tile culling derivation for draw candidate reduction
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 97-111)
* [x] Step 2.3: Validate phase changes
  * Run lint, unit tests, integration tests, and build for @game/client

### [x] Implementation Phase 3: Telemetry, integration flow coverage, and harness evidence

<!-- parallelizable: false -->

* [x] Step 3.1: Emit `viewport_changed` and `zoom_level_changed` events at deterministic transition boundaries
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 120-138)
* [x] Step 3.2: Add integration test for camera movement -> bounded viewport request -> deterministic visible-set update
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 140-159)
* [x] Step 3.3: Add E5-S2 perf artifact generation path for fps/memory evidence and document verify-release extension point
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 161-178)
* [x] Step 3.4: Add E2-S4 compatibility regression coverage for impacted navigation and viewport seams
  * Details: .copilot-tracking/details/2026-07-01/e5-s2-pan-zoom-viewport-culling-details.md (Lines 180-196)
* [x] Step 3.5: Validate phase changes
  * Run lint, unit/integration tests, targeted perf harness checks, and E2-S4 compatibility assertions

### [x] Implementation Phase 4: Validation

<!-- parallelizable: false -->

* [x] Step 4.1: Run full project validation
  * Execute lint/build/test for @game/client, E2-S4 regression checks, and workspace-level lint/test/build checks
* [x] Step 4.2: Fix minor validation issues
  * Iterate on localized lint, type, and test failures within E5-S2 scope
* [x] Step 4.3: Report blocking issues
  * Document issues requiring additional research and create follow-on work items rather than widening E5-S2 implementation scope

## Planning Log

See .copilot-tracking/plans/logs/2026-07-01/e5-s2-pan-zoom-viewport-culling-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing shared viewport contracts in packages/shared-types/src/index.ts
* Existing server region-diff bounds enforcement and integration coverage
* Existing client workspace scripts and Vitest harness
* Existing CI and verify-release workflow baseline commands

## Success Criteria

* Camera pan/zoom and viewport derivation behavior are fully specified with deterministic implementation seams and bounded request policy alignment. - Traces to: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md
* Viewport fetch orchestration and visible-tile culling are mapped to concrete modules and test coverage with no shared-contract drift. - Traces to: packages/shared-types/src/index.ts and docs/layer1-backlog.md
* Required telemetry events and performance evidence path are explicitly planned and validation-ready under existing CI conventions. - Traces to: docs/layer1-backlog.md and .github/workflows/ci.yml
* E5-S2 implementation includes explicit E2-S4 compatibility checks to prevent regressions in dependent behavior. - Traces to: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Scope assumptions)