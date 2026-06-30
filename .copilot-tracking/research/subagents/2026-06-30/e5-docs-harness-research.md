---
title: E5 Docs and Harness Research
description: Research-only subagent note for epic E5 creator UX navigation and accessibility, covering documentation promises, harness mapping, CI implications, and verification gaps.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
keywords:
  - epic e5
  - creator ux
  - accessibility
  - harness
  - verification
estimated_reading_time: 8
---

## Research Scope

Status: Complete

Topics investigated:

* Epic #5 documented scope and exit criteria
* Harness mapping points 2 and 6 for E5
* Existing repo promises and measurable surfaces related to onboarding, keyboard flow, reduced motion, pan/zoom, and culling
* Current test, CI, and verification coverage that can support or block E5 delivery

## Sources Reviewed

Primary evidence sources:

* docs/layer1-backlog.md:24-40
* docs/layer1-backlog.md:309-366
* docs/game-design-document.md:300-340
* docs/game-design-document.md:538-538
* docs/cicd-harness.md:135-140
* README.md:73-75
* .github/workflows/ci.yml:1-88
* .github/workflows/verify-release.yml:154-255
* .github/workflows/nonprod-load.yml:1-93
* package.json:6-18
* apps/client/package.json:6-18
* tsconfig.base.json:2-26
* .copilot-tracking/github-issues/sprint/layer1-mvp/issues-plan.md:60-68
* .copilot-tracking/github-relationships.md:29-33
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md:1-69

Supporting implementation-surface checks:

* apps/client/src/index.ts:1-30
* apps/client/tests/integration/auth-state-machine.test.ts:1-130

## Key Findings

### 1. E5 is fully defined in planning artifacts, but not yet represented by explicit client implementation surfaces

The backlog defines E5 as palette and shape selection, placement preview, pan and zoom, onboarding, and accessibility toggles with harness mapping 2 and 6.

Evidence:

* docs/layer1-backlog.md:36-36
* docs/layer1-backlog.md:313-365
* .copilot-tracking/github-issues/sprint/layer1-mvp/issues-plan.md:60-68
* .copilot-tracking/github-relationships.md:29-33

Repo search found no E5-specific implementation strings in apps/client/src or apps/client/tests for palette, onboarding, keyboard-only placement, reduced motion, pan/zoom, or culling. The exported client surface is still auth/session/reconnect/replay focused.

Evidence:

* apps/client/src/index.ts:1-30

Implication:

* E5 is currently a documented contract and dependency plan, not a shipped feature slice.

### 2. Product intent contains one notable tension around onboarding

The game design document says users should start creating within 30 seconds and also says there should be no mandatory tutorials, but the onboarding flow still describes a 30-second interactive placement tutorial.

Evidence:

* docs/game-design-document.md:306-309
* docs/game-design-document.md:319-323
* docs/game-design-document.md:538-538
* docs/layer1-backlog.md:343-349

Implication:

* E5-S3 should likely be implemented as skippable or assistive onboarding rather than a required gate. That aligns with the backlog acceptance criteria, which already allow skip-or-complete behavior.

### 3. Accessibility scope is explicit and broader than the epic exit criteria alone

The GDD promises colorblind-safe palettes, high-contrast mode, pattern overlays, full keyboard navigation, reduced motion, and readable text scaling. The epic exit criteria mention keyboard usability and reduced motion, but the documented product surface is larger.

Evidence:

* docs/game-design-document.md:311-317
* docs/layer1-backlog.md:358-365

Implication:

* If E5 delivery is scoped narrowly to keyboard and reduced motion only, there will still be documented accessibility debt against colorblind support, contrast, pattern overlays, and text scaling.

### 4. Harness point 2 currently means deterministic build, strict TypeScript, and required test gates, not UX-specific determinism

The backlog maps E5 to harness point 2. In the repo, point 2 is materially enforced by workspace build and test commands, strict TypeScript settings, and CI running lint, test, and build after a lockfile-true install.

Evidence:

* docs/layer1-backlog.md:36-36
* docs/layer1-backlog.md:499-506
* package.json:10-17
* apps/client/package.json:6-9
* tsconfig.base.json:2-26
* .github/workflows/ci.yml:43-88

Implication:

* E5 can satisfy harness point 2 only if its new client logic is expressed in testable reducers, camera math, input maps, and rendering-adjacent adapters that fit the existing TypeScript and Vitest gates.

### 5. Harness point 6 currently verifies auth, bootstrap, room join smoke, and latency budgets, but not creator UX flows

Post-deploy verification today checks liveness, readiness, protected profile, bootstrap token-ready state, authenticated room join smoke, playable-shell p50, room-membership authority, and E3-S4 load evidence. None of these steps validate first-tile placement time, keyboard-only placement, reduced-motion behavior, or viewport culling.

Evidence:

* docs/cicd-harness.md:135-140
* docs/cicd-harness.md:149-160
* .github/workflows/verify-release.yml:154-255
* .github/workflows/nonprod-load.yml:43-93

Implication:

* E5 currently has no direct post-deploy verification gate, despite being mapped to harness point 6.
* Meeting the documented harness mapping will require adding creator-flow verification evidence or redefining what point 6 means for this epic.

### 6. The repo already measures a faster bootstrap budget than E5 requires, but not the full time-to-first-tile journey

Existing verification asserts a playable-shell p50 budget of 5000 ms for authenticated bootstrap and room join smoke. E5 requires first tile placement in under 30 seconds p50 for a new session. That metric starts later in current verification than the full E5 journey requires.

Evidence:

* docs/layer1-backlog.md:36-36
* .github/workflows/verify-release.yml:190-219

Implication:

* The current harness can prove token-ready shell entry is healthy, but it cannot prove that a new player can discover tools, understand onboarding, navigate the editor, and place a tile inside the E5 budget.

### 7. Existing client tests are infrastructure-oriented and provide useful patterns, but they do not yet cover creator UX behaviors

The current client integration suite focuses on auth state transitions. The client package test command exists and can host E5 coverage, but no current tests exercise editor interaction or accessibility workflows.

Evidence:

* apps/client/package.json:6-9
* apps/client/tests/integration/auth-state-machine.test.ts:1-130

Implication:

* E5 test work will need new integration tests for preview and placement flow, tutorial skip path, and keyboard-only tool usage rather than extending existing auth-only coverage.

### 8. Pan/zoom and culling have product and backlog commitments, but no current measurable contract in CI or verification

The GDD promises zoom/pan controls and spatial partition culling, while E5-S2 adds viewport fetch integration and perf expectations for FPS and memory budget. No current workflow, harness artifact, or script captures viewport performance or visible-region correctness.

Evidence:

* docs/game-design-document.md:309-309
* docs/game-design-document.md:331-333
* docs/layer1-backlog.md:328-336

Implication:

* E5-S2 is the weakest current harness fit. It has a stated perf requirement but no existing automation surface in CI or verify-release to enforce it.

### 9. Telemetry requirements for E5 are defined in backlog, but the repo does not yet show a client-side measurement path for them

The backlog calls for telemetry events for palette use, preview visibility, viewport movement, tutorial milestones, accessibility mode enablement, and keyboard placement. Current visible client exports do not expose telemetry helpers or creator-flow measurement surfaces.

Evidence:

* docs/layer1-backlog.md:320-320
* docs/layer1-backlog.md:335-335
* docs/layer1-backlog.md:350-350
* docs/layer1-backlog.md:365-365
* apps/client/src/index.ts:1-30

Implication:

* The epic exit criterion for first-tile p50 will need a new client-side timing origin and event sink contract, or a server-observable approximation will need to be explicitly defined.

## Current Repo Promises and Measurements Relevant to E5

What the repo already promises:

* Layer 1 MVP includes pan/zoom as part of the base playable outcome: docs/layer1-backlog.md:26-26
* E5 scope and story breakdown are already stable enough to guide implementation slices: docs/layer1-backlog.md:36-36 and docs/layer1-backlog.md:309-366
* Product UX principle is place-first within 30 seconds: docs/game-design-document.md:306-306
* Product accessibility baseline includes keyboard navigation, high contrast, reduced motion, colorblind-safe palettes, pattern overlays, and text scaling: docs/game-design-document.md:313-317

What the repo already measures or gates:

* Workspace-wide deterministic build and test execution through npm workspace scripts: package.json:10-17
* Strict TypeScript safety across packages and apps: tsconfig.base.json:2-26
* CI runs lockfile-true install, audit, lint, DB-backed tests, and build: .github/workflows/ci.yml:43-88
* Post-deploy verification checks authenticated bootstrap and room join smoke with playable-shell p50 evidence: .github/workflows/verify-release.yml:177-219
* Non-production scheduled load and release verification already produce artifact-backed server-side evidence for room join and load reliability: .github/workflows/nonprod-load.yml:43-93 and .github/workflows/verify-release.yml:245-255

What the repo does not currently measure for E5:

* First-tile placement time for a new user session
* Keyboard-only completion of tile placement
* Reduced-motion variant behavior
* High-contrast readability or colorblind-safe palette behavior
* Pan/zoom responsiveness or culling correctness/perf budgets

## Testing, CI, and Verification Implications

### Testing

Recommended minimum test expansion implied by current artifacts:

* Unit tests for tool state reducer and camera math, matching the existing TypeScript plus Vitest workflow: docs/layer1-backlog.md:319-319 and docs/layer1-backlog.md:334-334
* Client integration tests for preview plus place, onboarding skip/complete, and keyboard-only placement: docs/layer1-backlog.md:319-319, docs/layer1-backlog.md:349-349, docs/layer1-backlog.md:364-364
* Accessibility-focused smoke or audit coverage for mode toggles: docs/layer1-backlog.md:364-364

Risk:

* apps/client/package.json:9-9 uses `vitest run --passWithNoTests`, so the client package can pass without any E5 coverage unless tests are added and enforced.

### CI

Current fit:

* CI can already block on TypeScript, lint, and tests for E5 code paths: .github/workflows/ci.yml:56-88

Gap:

* There is no client-specific typecheck or E2E-style UX check beyond the generic workspace build and tests.
* No CI evidence artifact exists for first-tile timing, keyboard flow, or accessibility state changes.

Consequence:

* If E5 ships only with unit and integration tests, harness point 2 can be partially satisfied, but the user-facing exit criteria remain under-proven.

### Post-Deploy Verification

Current fit:

* verify-release already has a mechanism for artifact-backed evidence and threshold enforcement: .github/workflows/verify-release.yml:199-255

Gap:

* The current verification workflow is server-entry and room-join centered. It does not drive the client UX needed to validate palette flow, onboarding speed, keyboard navigation, or reduced motion.

Consequence:

* Harness point 6 for E5 likely needs either:
  * a browser-driven verification path that exercises creator UX in a deployed environment, or
  * an explicit decision that E5 point 6 is satisfied by indirect evidence only, which would weaken the documented exit criteria.

## Open Questions

* What is the canonical runtime for the E5 editor surface: plain DOM and canvas, WebGL view layer, or another rendering abstraction not yet present in the repo?
* Where should first-tile timing start for E5 measurement: page load, token-ready bootstrap, room join success, or first editor interaction?
* Should E5 harness point 6 require browser automation in deployed environments, or is telemetry plus synthetic room-join evidence considered sufficient?
* Which accessibility items are launch-blocking for Layer 1: only keyboard and reduced motion, or the broader GDD set including pattern overlays and text scaling?

## Recommended Next Research

* Inspect planned or active frontend architecture decisions before implementation starts, especially any rendering stack choice for editor interactions.
* Define the measurement contract for `first_tile_time_recorded`, including start point, end point, and whether it is per-account, per-session, or first-run only.
* Decide whether browser automation should be added for harness point 6 creator-flow verification.
* Reconcile the GDD tension between no mandatory tutorials and the 30-second interactive onboarding flow before writing acceptance tests.

## Executive Summary

Epic E5 is well specified in docs and backlog artifacts, but the repository currently enforces only generic build, type-safety, and server-centric verification gates. The repo already promises place-first creation, pan/zoom, and accessibility behavior, yet it does not currently measure the E5 exit criteria directly. The main delivery risk is not missing documentation. It is the absence of a creator-flow verification path that can prove under-30-second first-tile placement and keyboard plus reduced-motion usability after deployment.