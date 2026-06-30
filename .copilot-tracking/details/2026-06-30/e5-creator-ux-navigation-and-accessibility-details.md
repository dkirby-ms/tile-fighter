<!-- markdownlint-disable-file -->
# Implementation Details: E5 Creator UX Navigation and Accessibility

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md; .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md; docs/layer1-backlog.md; docs/game-design-document.md

## Implementation Phase 1: Creator foundation and placement workflow

<!-- parallelizable: false -->

### Step 1.1: Add the creator session composition surface

Create a new creator module tree in apps/client that composes the existing auth, bootstrap, join-token, replay, reconnect, and realtime helpers into a single flow owner for Epic 5. This step should establish the creator-session orchestration seam, define the initial creator state shape, and export the new surface without introducing DOM-specific assumptions.

Files:
* apps/client/src/creator/creator-session.ts - Coordinates startup, placement, onboarding, accessibility, and camera collaborators.
* apps/client/src/creator/tool-state.ts - Defines deterministic creator tool state and reducer primitives for selected shape, color, target cell, and optimistic placement state.
* apps/client/src/index.ts - Exports the new creator composition surface.

Discrepancy references:
* DR-01
* DR-03

Success criteria:
* A single creator-session entrypoint exists for future browser shell ownership.
* Tool-state primitives map directly to shared placement contracts rather than ad hoc UI-only payloads.

Context references:
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 94-158) - Existing client seams, missing creator modules, and contract reuse guidance.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 29-45) - No existing app shell or downstream consumer currently owns the first-tile flow.

Dependencies:
* Existing auth/bootstrap session primitives in apps/client/src/auth and apps/client/src/session
* Shared placement contracts in packages/shared-types/src/index.ts

### Step 1.2: Implement placement preview and placement submission adapters

Add the thin adapters required for E5-S1 so the creator session can derive occupancy-aware previews and submit place commands using shared contracts. Keep committed world-state reconciliation in the existing realtime and replay helpers, and limit the new code to preview state derivation, optimistic placement markers, and submission transport.

Files:
* apps/client/src/creator/placement-preview.ts - Computes preview and blocked-state output from local tool state plus replayed world state.
* apps/client/src/creator/placement-caller.ts - Submits TilePlaceCommand payloads and normalizes TilePlaceResult responses for creator-session.
* apps/client/tests/unit/tool-state.test.ts - Verifies reducer transitions for shape/color/target selection and optimistic placement state.
* apps/client/tests/integration/creator-placement-flow.test.ts - Verifies preview, blocked-state, optimistic placement, and ack reconciliation behavior.

Success criteria:
* Placement preview updates deterministically from local state and replayed occupancy.
* Placement submission uses shared placement contracts and hands committed reconciliation back to realtime/replay helpers.

Context references:
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 188-237) - Selected composition-layer approach and E5-S1 implementation direction.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 55-72) - E5-S1 acceptance criteria, telemetry, and dependency boundary.

Dependencies:
* Step 1.1 completion
* Existing replay and realtime delta helpers in apps/client/src/session

### Step 1.3: Add creator tool and preview telemetry

Instrument the E5-S1 telemetry surfaces directly in the creator-session and tool-state flow. Emit `palette_opened`, `shape_selected`, `color_selected`, and `placement_preview_shown` from the new creator modules so the backlog acceptance and analytics expectations are met alongside preview behavior.

Files:
* apps/client/src/creator/creator-session.ts - Emits creator-flow interaction events at the orchestration boundary.
* apps/client/src/creator/tool-state.ts - Exposes deterministic state transitions that telemetry hooks can observe without duplicating business logic.
* apps/client/tests/unit/tool-state.test.ts - Verifies telemetry-triggering transitions remain stable.
* apps/client/tests/integration/creator-placement-flow.test.ts - Verifies E5-S1 telemetry emission shape and trigger points.

Success criteria:
* E5-S1 telemetry events are emitted from deterministic state transitions rather than ad hoc UI callbacks.
* Placement preview instrumentation is covered by client tests alongside preview behavior.

Context references:
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 57-60) - E5-S1 telemetry requirements.

Dependencies:
* Step 1.2 completion

### Step 1.4: Validate phase changes

Run the client-scoped validation commands after the foundation and placement workflow land.

Validation commands:
* npm run -w @game/client lint - Validates new creator source files.
* npm run -w @game/client test - Runs new unit and integration coverage for E5-S1.
* npm run -w @game/client build - Verifies the exported creator surface compiles.

## Implementation Phase 2: Camera, zoom, spatial culling, and viewport telemetry

<!-- parallelizable: false -->

### Step 2.1: Add deterministic camera state and culling utilities

Implement the E5-S2 math surfaces as deterministic client utilities before any browser-specific rendering layer is added. The camera state should own pan position, zoom level, and bounds, while the culling utility should accept viewport inputs and derive which regions or tiles remain in render scope.

Files:
* apps/client/src/creator/camera-state.ts - Defines pan, zoom, clamping, and viewport normalization behavior.
* apps/client/src/creator/spatial-culling.ts - Computes visible regions or tiles for render-time culling.
* apps/client/tests/unit/camera-state.test.ts - Verifies pan and zoom bounds.
* apps/client/tests/unit/spatial-culling.test.ts - Verifies deterministic culling and viewport math.

Success criteria:
* Camera math is deterministic and bounded by shared viewport constraints.
* Culling logic is testable without a renderer and handles off-screen elimination consistently.

Context references:
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 147-158) - Existing viewport contracts and missing camera/culling surfaces.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 61-64, 76-80) - E5-S2 acceptance criteria and backlog sequencing.

Dependencies:
* Implementation Phase 1 completion
* Shared viewport contracts in packages/shared-types/src/index.ts

### Step 2.2: Add viewport diff transport only if camera state cannot remain local

Keep viewport fetch expansion as a thin adapter rather than a new domain model. If the existing server contracts already support the necessary region-diff requests, add a client transport seam; otherwise, stop and create follow-on planning rather than reshaping server behavior during the same implementation slice.

Files:
* apps/client/src/creator/viewport-diff-caller.ts - Optional request adapter for RegionDiffRequest-driven viewport refreshes.
* apps/client/tests/integration/creator-placement-flow.test.ts - Extends the creator session flow coverage if viewport-driven updates become necessary.

Discrepancy references:
* DR-04

Success criteria:
* Viewport sync logic remains a thin adapter over existing shared contracts.
* Additional server or shared contract work is not introduced silently during client implementation.

Context references:
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 234-235, 252-254) - Camera work is client-heavy, but viewport fetch may still require a thin adapter.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 144-151) - Sequencing should treat viewport fetch expansion as contingent follow-on work.

Dependencies:
* Step 2.1 completion

### Step 2.3: Add viewport and zoom telemetry

Instrument the E5-S2 camera flow so viewport movement and zoom changes emit the backlog-defined telemetry without coupling analytics to renderer code. Keep the event hooks in camera-state or creator-session adapters where state changes are already normalized.

Files:
* apps/client/src/creator/camera-state.ts - Exposes normalized camera transitions that can produce analytics events.
* apps/client/src/creator/creator-session.ts - Emits `viewport_changed` and `zoom_level_changed` from camera updates.
* apps/client/tests/unit/camera-state.test.ts - Verifies telemetry-relevant transition boundaries remain deterministic.
* apps/client/tests/integration/creator-placement-flow.test.ts - Extends coverage if creator-session owns camera event emission.

Success criteria:
* E5-S2 telemetry events fire from bounded camera transitions.
* Camera and viewport analytics are test-covered and remain separate from rendering implementation details.

Context references:
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 61-64) - E5-S2 telemetry requirements.

Dependencies:
* Step 2.1 completion

### Step 2.4: Validate phase changes

Run the client-scoped validation commands after camera, culling, and telemetry work land.

Validation commands:
* npm run -w @game/client lint - Validates new camera and telemetry source files.
* npm run -w @game/client test - Runs new unit and integration coverage for E5-S2.
* npm run -w @game/client build - Verifies the camera and telemetry surfaces compile.

## Implementation Phase 3: Onboarding and first-tile telemetry

<!-- parallelizable: false -->

### Step 3.1: Add a skippable onboarding state machine and confirmation callout

Implement E5-S3 as an assistive, non-blocking overlay that can be skipped or completed quickly. The onboarding state machine should integrate with creator-session without changing core bootstrap contracts and should support a one-time confirmation callout after the first successful placement.

Files:
* apps/client/src/creator/onboarding-state.ts - Defines onboarding steps, skip/completion transitions, and one-time confirmation state.
* apps/client/tests/integration/onboarding-flow.test.ts - Verifies skip path, complete path, and one-time confirmation behavior.

Success criteria:
* Onboarding can be skipped without blocking placement.
* A first-placement confirmation callout appears once and does not regress repeat sessions.

Context references:
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 234-237) - Recommends skippable onboarding above auth/bootstrap helpers.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 65-68, 81-85, 138-140) - E5-S3 acceptance criteria and the place-first, non-mandatory tutorial tension.

Dependencies:
* Implementation Phase 1 completion

### Step 3.2: Define and implement first-tile timing capture

Add the telemetry seam for tutorial and first-tile measurement, but record the exact start and stop triggers as an explicit implementation decision before wiring analytics. If the event contract cannot be resolved from current artifacts, block only the metric boundary decision and keep the onboarding state machine implementation moving.

Files:
* apps/client/src/creator/creator-session.ts - Records tutorial and first-tile events once the metric boundary is chosen.
* apps/client/tests/integration/onboarding-flow.test.ts - Verifies event emission shape and one-time timing capture.
* docs/layer1-backlog.md - Update only if the implementation decision requires clarifying the timing contract for future work.

Discrepancy references:
* DR-02

Success criteria:
* The code contains a single, documented timing boundary for `first_tile_time_recorded`.
* Tutorial telemetry avoids PII and is emitted once per qualifying first-session flow.

Context references:
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 87-91) - The metric is required, but the exact boundary remains unresolved.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 116-125) - Current release verification does not prove first-tile completion.

Dependencies:
* Step 3.1 completion
* Telemetry event contract decision for `first_tile_time_recorded`

## Implementation Phase 4: Accessibility controls and keyboard placement

<!-- parallelizable: false -->

### Step 4.1: Implement local accessibility settings and announcer primitives

Add client-local accessibility state first so reduced-motion, contrast, and assistive announcements can be delivered without waiting for server persistence. Keep persistence and expanded preference sharing out of scope unless a later story requires them.

Files:
* apps/client/src/creator/accessibility-settings.ts - Stores reduced-motion, high-contrast, and related local accessibility toggles.
* apps/client/src/creator/accessibility-announcer.ts - Normalizes screen-reader or status-announcement messages for placement and onboarding milestones.
* apps/client/tests/unit/accessibility-settings.test.ts - Verifies toggle defaults, transitions, and reset behavior.

Success criteria:
* Required reduced-motion and contrast settings are local, deterministic, and test-covered.
* Accessibility announcements can be invoked from creator-session without embedding DOM logic in state reducers.

Context references:
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 65-66, 236-237) - Product intent and recommended client-local accessibility-first approach.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 69-72, 85-91) - E5-S4 required acceptance criteria and broader GDD accessibility promises.

Dependencies:
* Implementation Phase 1 completion
* E4-S3 completion

### Step 4.2: Add keyboard-only placement flow and accessibility integration coverage

Implement the keyboard input map against the creator tool state so placement can be completed without pointer interaction. Cover the flow with integration tests and keep any renderer-level accessibility audit or browser automation as a separate verification slice if the current client package remains headless.

Files:
* apps/client/src/creator/creator-session.ts - Wires keyboard commands into tool state, preview, and placement transitions.
* apps/client/tests/integration/keyboard-placement-flow.test.ts - Verifies keyboard navigation, placement submission, and reduced-motion mode interaction.

Discrepancy references:
* DR-03

Success criteria:
* Keyboard users can complete a placement flow without pointer-only affordances.
* Integration coverage protects E5-S4 telemetry and non-pointer placement behavior.

Context references:
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 69-72, 118-124) - Keyboard placement is required by backlog, but release verification currently does not cover it.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 130-142) - Existing client tests can host this coverage, but the plan must require it explicitly.

Dependencies:
* Step 4.1 completion
* Implementation Phase 1 completion
* Implementation Phase 2 completion
* Implementation Phase 3 completion
* E4-S3 completion

## Implementation Phase 5: Validation and verification expansion

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all validation commands for the project:
* npm run -w @game/client lint
* npm run -w @game/client test
* npm run -w @game/client build
* npm run lint
* npm run test
* npm run build

### Step 5.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures that stay within the touched E5 creator slice. Apply direct fixes when the corrections are isolated to apps/client, packages/shared-types, or narrowly-scoped documentation updates.

### Step 5.3: Expand harness-point-6 proof or report the gap

If implementation introduces a browser-facing creator shell or a deployable verification path, add the minimum release-verification proof needed for first placement, onboarding timing, and keyboard/reduced-motion flows. If the repo still lacks a deployable browser shell, document the remaining harness-point-6 gap and hand off follow-on work rather than inventing a false signal.

Files:
* .github/workflows/verify-release.yml - Add only the E5 verification step that the implemented shell can actually support.
* docs/cicd-harness.md - Update the documented harness surface if verify-release changes.

Discrepancy references:
* DR-03

Success criteria:
* Monorepo validation passes for the modified slice.
* The final handoff clearly states whether harness point 6 is fully satisfied or still partially open.

Context references:
* .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 67-70, 160-184) - Existing CI and release harness surfaces.
* .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 93-125, 142-151) - Current verify-release coverage and the remaining creator UX verification gap.

Dependencies:
* Implementation Phases 1 through 4 completion

## Dependencies

* npm workspace scripts at the repository root
* apps/client Vitest harness
* Existing shared placement and viewport contracts

## Success Criteria

* Epic 5 work has an executable implementation path from creator-session foundation through validation.
