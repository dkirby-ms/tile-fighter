---
title: E5 Creator Planning Gaps Research
description: Research-only findings for remaining Epic 5 creator UX planning gaps, covering app ownership, backlog expectations, release verification, and sequencing constraints.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
keywords:
  - epic 5
  - creator ux
  - planning gaps
  - accessibility
  - release verification
estimated_reading_time: 7
---

## Research Status

Complete

## Research Topics

* Determine whether any existing app shell, startup coordinator, or downstream consumer already owns the first-tile flow.
* Capture the exact E5 acceptance, telemetry, accessibility, and harness expectations from docs/layer1-backlog.md.
* Describe what .github/workflows/verify-release.yml currently validates and identify the creator UX verification gap.
* Identify existing scripts, tests, or docs that should change E5 implementation sequencing.

## Findings

### 1. Current client ownership and downstream consumers

apps/client is currently a headless library, not a top-level application shell.

Evidence:

* apps/client/src/index.ts:1-33 exports only auth, bootstrap, heartbeat, reconnect, replay checksum, and realtime delta helpers. There is no app-shell, startup coordinator, tool-state, placement caller, camera controller, or accessibility module.
* apps/client/src/session/bootstrap-store.ts:1-79 defines an authenticated bootstrap caller plus reconnect-context storage. Its payload shape only exposes subject identity, server time, and `shellInit.bootstrapState` with retry policy. It does not expose onboarding, first-tile, viewport, palette, or accessibility state.
* README.md:13-17 documents the workspace layout and names apps/server and apps/tools, but not a browser client application surface.
* README.md:1-12 describes the repository as backend infrastructure focused.
* `rg -n "@game/client|from ['\"][^'\"]*client|require\(['\"][^'\"]*client" apps packages docs .github --glob '!**/.copilot-tracking/**'` returned only apps/client/package.json:2. No implementation-facing folder currently imports or consumes `@game/client`.

Conclusion:

* There is no existing in-repo downstream consumer that already owns the first-tile flow.
* E5 planning still needs to define where the creator session coordinator or top-level browser shell will live.
* The nearest reusable startup pieces are the auth state machine, SessionBootstrapStore, join-token caller, reconnect caller, and realtime delta handler, but they are primitives, not the flow owner.

### 2. Exact E5 backlog expectations

Epic-level scope and exit criteria:

* docs/layer1-backlog.md:36 defines E5 scope as palette plus shape picker, placement preview, pan and zoom, onboarding, and accessibility toggles.
* docs/layer1-backlog.md:36 sets the epic exit criteria to first tile placement in under 30 seconds for a new session, with keyboard and reduced-motion usability.
* docs/layer1-backlog.md:36 maps E5 to harness points 2 and 6.

Story-level expectations:

* docs/layer1-backlog.md:311-324 defines E5-S1.
  * Acceptance: instant preview updates after shape and color selection, blocked indicator for occupied cells, optimistic indicator until ack.
  * Telemetry: `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`.
  * Story boundary: client tool state and occupancy preview adapter, dependent on E2-S2.
* docs/layer1-backlog.md:326-339 defines E5-S2.
  * Acceptance: pan without input lag, acceptable legibility under zoom changes, off-screen culling during render pass.
  * Telemetry: `viewport_changed`, `zoom_level_changed`.
  * Story boundary: camera controller plus spatial culling, dependent on E2-S4.
* docs/layer1-backlog.md:341-354 defines E5-S3.
  * Acceptance: tutorial overlay can be skipped or completed in 30 seconds or less, first placement triggers a one-time confirmation callout, p50 time-to-first-tile is 30 seconds or less.
  * Telemetry: `tutorial_started`, `tutorial_completed`, `first_tile_time_recorded`.
  * Story boundary: lightweight onboarding stepper and success metric capture, dependent on E5-S1.
* docs/layer1-backlog.md:356-367 defines E5-S4.
  * Acceptance: keyboard-only placement without pointer, high-contrast readability target, reduced-motion bond animations.
  * Telemetry: `a11y_mode_enabled`, `keyboard_placement_used`.
  * Story boundary: accessibility settings panel plus input map, dependent on E5-S1 and E4-S3.

Sequencing already declared in the backlog:

* docs/layer1-backlog.md:562 places E5-S1 in Sprint 2 with E2-S4, E3-S1, and E3-S2.
* docs/layer1-backlog.md:564 places E5-S2 and E5-S3 in Sprint 4.
* docs/layer1-backlog.md:565 places E5-S4 in Sprint 5.
* docs/layer1-backlog.md:572 defines the internal playable chain through E5-S1 then E5-S2, which means the backlog currently treats first-tile preview and placement as foundational before pan and zoom polish.

Important tension with product intent:

* docs/game-design-document.md:304-310 says the UX should be place-first, with no mandatory tutorials and simple palette selector plus zoom and pan controls.
* docs/game-design-document.md:319-322 still describes a 30-second interactive placement tutorial, one bonding effect example, and no required reading.
* docs/game-design-document.md:311-317 expands accessibility beyond the epic exit criteria to include colorblind-safe palettes, pattern overlays, full keyboard navigation, reduced motion, and readable text scaling.

Implications for planning:

* `first_tile_time_recorded` is required by backlog, but the start and stop boundaries are still not concretely defined in code or docs beyond the p50 goal.
* Keyboard placement and accessibility are not optional polish stories. They are explicit acceptance criteria and telemetry surfaces for E5-S4.
* The GDD promises broader accessibility than the epic exit criteria currently enforce, which should be treated as scope debt or a formal deferral.

### 3. What verify-release currently validates and the remaining gap

Current validation surface in .github/workflows/verify-release.yml:

* .github/workflows/verify-release.yml:1-24 triggers after Release Dev or Release Prod or by manual dispatch.
* .github/workflows/verify-release.yml:33-89 resolves app and telemetry settings, requires verification secrets, and fails fast if verification token inputs are missing.
* .github/workflows/verify-release.yml:91-138 decodes the bearer token payload and validates issuer, audience, token version, tenant, and provenance metadata.
* .github/workflows/verify-release.yml:140-148 verifies `/healthz` and `/readyz`.
* .github/workflows/verify-release.yml:150-161 verifies authenticated access to `/api/protected/profile`.
* .github/workflows/verify-release.yml:163-174 verifies authenticated access to `/api/session/bootstrap` and asserts `"bootstrapState":"token-ready"`.
* .github/workflows/verify-release.yml:176-183 runs `npm run -w @game/server test:load` as an authenticated room-join smoke using `artifacts/verify-room-join-metrics.json`.
* .github/workflows/verify-release.yml:185-205 enforces a playable-shell p50 budget of 5000 ms from that room-join smoke artifact.
* .github/workflows/verify-release.yml:207-226 asserts room membership authority remains in Colyseus room hooks rather than HTTP routes.
* .github/workflows/verify-release.yml:228-260 runs the sustained E3-S4 50 CCU load scenario.
* .github/workflows/verify-release.yml:261-291 enforces the E3-S4 release budget: placement ack median less than or equal to 200 ms and reconnect p95 less than or equal to 3000 ms.
* .github/workflows/verify-release.yml:293-298 uploads artifacts.

Harness documentation matches that scope:

* docs/cicd-harness.md:143-150 lists the current post-deploy verification checks: health, readiness, protected profile route, bootstrap route, room-join smoke, Colyseus room-membership authority, and E3-S4 latency budgets.

Remaining creator UX verification gap:

* There is no verification step for E5-S1 preview and first placement flow.
* There is no verification step for E5-S2 pan and zoom responsiveness or culling behavior.
* There is no verification step for E5-S3 onboarding skip or complete path or `first_tile_time_recorded` measurement.
* There is no verification step for E5-S4 keyboard-only placement, high-contrast readability, reduced-motion mode, or the accessibility audit called out in docs/layer1-backlog.md:364.
* The current 5000 ms playable-shell p50 budget in verify-release proves auth plus bootstrap plus room join health, not the backlog requirement that a new player can place a first tile within 30 seconds.

Conclusion:

* Harness point 6 is only partially satisfied for Epic 5. The repo verifies service readiness and room reliability, but not creator UX completion.

### 4. Existing scripts, tests, and docs that affect implementation sequencing

Existing scripts and tests:

* package.json:9-10 runs root tests and lint across workspaces, so any E5 work added in apps/client participates in monorepo gates.
* apps/client/package.json:6-9 provides `build`, `lint`, and `test`, but the test command uses `vitest run --passWithNoTests`. That means the package will not fail if E5 lands without client tests, unless planning explicitly requires new coverage.
* apps/client/vitest.config.ts:1-9 already provides a Node Vitest harness rooted at apps/client/tests, so E5 test coverage can be added without new tooling.
* apps/client/tests/integration/auth-state-machine.test.ts:1-149 shows the current client integration surface is startup-state-oriented, not UI-oriented.
* apps/server/package.json:8-13 exposes `test:load`, which is already wired into release verification and currently centers creator-adjacent proof on room entry and latency evidence rather than browser UX.

Existing docs that should drive sequencing:

* docs/layer1-backlog.md:562-565 already sequences E5-S1 before E5-S2 and E5-S3, then defers E5-S4 to Sprint 5. Any new plan should either follow that ordering or explicitly justify deviation.
* docs/layer1-backlog.md:572 makes E5-S1 and E5-S2 part of the internal playable chain, which means the first missing implementation seam is not the accessibility panel. It is the creator flow owner for preview plus placement.
* docs/game-design-document.md:304-322 argues for place-first UX, simple controls, and non-mandatory tutorial feel. That pushes E5-S3 toward a skippable assistive overlay rather than a blocking guided flow.
* README.md:13-17 and README.md:1-12 indicate the repo is still backend-first. Planning should account for the fact that there is no existing browser application folder or documented client-shell boot path to extend.
* docs/cicd-harness.md:143-150 shows that post-deploy verification currently stops at bootstrap and room join. If E5 requires harness-point-6 proof, implementation sequencing should include either browser-driven verification or a new creator-flow evidence mechanism before story closure.

Recommended sequencing implication:

* E5 planning should define the owning browser shell or coordinator first.
* After that, E5-S1 should establish placement and preview behavior plus tests.
* E5-S2 and E5-S3 can then compose on top of that owner, with E5-S3 clarified as skippable onboarding.
* E5-S4 should not be closed without deciding whether broader GDD accessibility promises are in-scope, deferred, or split into follow-up work.

## Planning Discrepancies and Unresolved Questions

* There is no planned or implemented location for the top-level creator shell that would consume apps/client primitives and own the first-tile flow.
* `first_tile_time_recorded` is required, but the measurement boundary is unresolved. It is not yet clear whether the timer starts at page load, token-ready, bootstrap success, room join, or first creator interaction.
* Harness-point-6 expectations for Epic 5 are unresolved. The current verify-release workflow cannot prove creator-flow usability, accessibility, or first-tile completion.
* The GDD promises broader accessibility features than E5-S4 explicitly accepts. Planning should decide whether colorblind-safe palettes, pattern overlays, and text scaling are part of E5 or deferred debt.
* The backlog says there should be no mandatory tutorials, but E5-S3 still centers a tutorial overlay. The intended UX contract needs to be normalized before implementation.

## Recommended Next Research

* Identify where the future browser application should live, such as a new app workspace versus expansion of apps/client into a real shell package.
* Define the exact telemetry contract for `first_tile_time_recorded`, including start trigger, stop trigger, dimensions, and whether auth and room join are included.
* Decide what verification artifact should satisfy harness point 6 for E5, such as browser automation, synthetic telemetry assertions, or post-deploy evidence from a creator-flow smoke.
* Review whether shared-types or server routes need explicit viewport or placement helpers before E5-S2 and E5-S3 can be planned precisely.