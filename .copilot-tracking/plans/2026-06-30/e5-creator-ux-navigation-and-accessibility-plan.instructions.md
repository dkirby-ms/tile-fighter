---
applyTo: '.copilot-tracking/changes/2026-06-30/e5-creator-ux-navigation-and-accessibility-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E5 Creator UX Navigation and Accessibility

## Overview

Implement Epic 5 as a creator composition layer inside apps/client that adds placement workflow, camera and culling logic, onboarding, and accessibility controls on top of the existing session and shared-contract primitives.

## Objectives

### User Requirements

* Deliver palette, shape, preview, pan and zoom, onboarding, and accessibility work for Epic 5 inside the current repo surface. — Source: .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 6-20)
* Preserve the backlog expectations for first tile in under 30 seconds and keyboard plus reduced-motion usability. — Source: docs/layer1-backlog.md (Lines 311-367)
* Reuse existing placement, replay, reconnect, bootstrap, and viewport contracts rather than replacing them. — Source: .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 105-158)

### Derived Objectives

* Introduce a creator-session flow owner because the repo does not currently contain a browser shell or downstream consumer that owns first-tile flow. — Derived from: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 29-45)
* Require client tests for each E5 slice because apps/client currently permits `--passWithNoTests`. — Derived from: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 128-133)
* Treat harness-point-6 proof as part of completion criteria or explicit follow-on work instead of assuming current verify-release coverage is enough. — Derived from: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 93-125)

## Context Summary

### Project Files

* apps/client/src/index.ts - Current client public surface; does not yet expose creator modules.
* apps/client/src/session/bootstrap-store.ts - Current startup and reconnect bootstrap primitive.
* apps/client/src/session/realtime-delta-handler.ts - Existing committed world-state reconciliation seam.
* apps/client/src/session/replay-checksum.ts - Existing deterministic world-state primitive for placement preview and reconnect consistency.
* apps/client/tests/integration/auth-state-machine.test.ts - Existing client integration test pattern for session-oriented flows.
* apps/client/vitest.config.ts - Existing client test harness.
* packages/shared-types/src/index.ts - Shared placement and viewport contracts.
* .github/workflows/verify-release.yml - Current post-deploy verification surface that stops short of creator UX proof.

### References

* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md - Primary E5 repo research and selected implementation approach.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md - Follow-up research covering ownership, telemetry, and verification gaps.
* docs/layer1-backlog.md - Epic 5 story breakdown, telemetry, sequencing, and dependencies.
* docs/game-design-document.md - Product intent for place-first onboarding and broader accessibility promises.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md — Markdown requirements for plan artifacts.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md — Repository writing-style guidance for markdown artifacts.

## Implementation Checklist

### [ ] Implementation Phase 1: Creator foundation and placement workflow

<!-- parallelizable: false -->

* [ ] Step 1.1: Add the creator session composition surface
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 12-35)
* [ ] Step 1.2: Implement placement preview and placement submission adapters
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 37-57)
* [ ] Step 1.3: Validate phase changes
  * Run lint, test, and build commands for the @game/client workspace

### [ ] Implementation Phase 2: Camera, zoom, and spatial culling

<!-- parallelizable: false -->

* [ ] Step 2.1: Add deterministic camera state and culling utilities
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 72-92)
* [ ] Step 2.2: Add viewport diff transport only if camera state cannot remain local
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 94-114)

### [ ] Implementation Phase 3: Onboarding and first-tile telemetry

<!-- parallelizable: true -->

* [ ] Step 3.1: Add a skippable onboarding state machine and confirmation callout
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 120-140)
* [ ] Step 3.2: Define and implement first-tile timing capture
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 142-164)

### [ ] Implementation Phase 4: Accessibility controls and keyboard placement

<!-- parallelizable: true -->

* [ ] Step 4.1: Implement local accessibility settings and announcer primitives
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 170-192)
* [ ] Step 4.2: Add keyboard-only placement flow and accessibility integration coverage
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 193-214)

### [ ] Implementation Phase 5: Validation and verification expansion

<!-- parallelizable: false -->

* [ ] Step 5.1: Run full project validation
  * Execute all lint, build, and test commands for the modified client slice and the repo
* [ ] Step 5.2: Fix minor validation issues
  * Iterate on lint, build, and test failures that stay within the touched E5 slice
* [ ] Step 5.3: Expand harness-point-6 proof or report the gap
  * Details: .copilot-tracking/details/2026-06-30/e5-creator-ux-navigation-and-accessibility-details.md (Lines 234-254)

## Planning Log

See .copilot-tracking/plans/logs/2026-06-30/e5-creator-ux-navigation-and-accessibility-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* apps/client source and test workspaces
* packages/shared-types placement and viewport contracts
* Root npm workspace lint, test, and build commands
* Existing release verification workflow if harness-point-6 proof is expanded

## Success Criteria

* The repo has an implementation path for E5-S1 through E5-S4 that reuses existing client/session primitives and shared contracts. — Traces to: .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 188-237)
* Creator-flow ownership, telemetry, and verification gaps are either implemented or explicitly tracked as discrepancies with follow-on work. — Traces to: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 114-151)
* Client validation includes new unit and integration coverage rather than relying on `--passWithNoTests`. — Traces to: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 128-133)