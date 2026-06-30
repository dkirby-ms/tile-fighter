<!-- markdownlint-disable-file -->
# Implementation Details: E5-S1 Creator Placement Preview

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e5-s1-creator-placement-preview-research.md; .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md; docs/layer1-backlog.md

## Implementation Phase 1: Deterministic creator state and preview model

<!-- parallelizable: false -->

### Step 1.1: Add deterministic creator tool-state reducer

Create a reducer-driven state model for selected shape, selected color, hovered target cell, palette visibility, and optimistic placement status. Keep transitions pure and deterministic so telemetry and integration flows can observe stable transition boundaries.

Files:
* apps/client/src/creator/tool-state.ts - Reducer, actions, and deterministic transition helpers.
* apps/client/tests/unit/tool-state.test.ts - Deterministic reducer transition tests for palette, shape, color, hover, and optimistic state actions.
* apps/client/src/index.ts - Export tool-state module.

Success criteria:
* Tool state transitions are pure and do not perform network I/O.
* State model includes explicit blocked and optimistic flags that downstream preview and placement adapters can use.

Context references:
* .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md (Lines 56-74) - Recommended reducer-style seam.
* docs/layer1-backlog.md (Lines 313-318) - E5-S1 acceptance behavior.

Dependencies:
* Existing client export patterns in apps/client/src/index.ts

### Step 1.2: Add pure placement preview evaluator

Create a pure evaluator that derives preview status from tool-state input plus occupancy input. Support at least: ready preview, blocked preview, invalid-input preview. Keep this module transport-agnostic and deterministic.

Files:
* apps/client/src/creator/placement-preview.ts - Pure preview derivation.
* apps/client/tests/unit/placement-preview.test.ts - Preview status matrix tests.

Success criteria:
* Occupied target always yields blocked preview status.
* Invalid shape/color/coordinates yield invalid-input status and prevent placement submission.

Context references:
* .copilot-tracking/research/2026-06-30/e5-s1-creator-placement-preview-research.md (Lines 35-43) - E5-S1 preview and blocked requirements.

Dependencies:
* Step 1.1 completion

### Step 1.3: Validate phase changes

Run targeted validation for deterministic state and preview modules.

Validation commands:
* npm run -w @game/client lint - Validate new creator state and preview modules.
* npm run -w @game/client test - Run unit tests for tool-state and preview derivation.
* npm run -w @game/client build - Confirm new exports compile.

## Implementation Phase 2: Placement submission, optimistic state, and telemetry

<!-- parallelizable: false -->

### Step 2.1: Add placement input sanitization and submit caller

Implement input guards before placement command submit and add a submit adapter that uses existing placement contracts. Keep server-facing payload compatible with TilePlaceCommand and map responses to deterministic local outcomes.

Files:
* apps/client/src/creator/placement-input.ts - Input sanitization for shape/color/cell/offset/style payload bounds.
* apps/client/src/creator/placement-caller.ts - Placement submit adapter for POST /api/tiles/place.
* apps/client/tests/unit/placement-input.test.ts - Sanitization acceptance and rejection matrix.
* apps/client/tests/unit/placement-caller.test.ts - Response mapping tests.

Discrepancy references:
* DR-01

Success criteria:
* Invalid input is rejected client-side before submit.
* Valid payloads map to existing shared command/result contracts with no schema drift.

Context references:
* .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md (Lines 33-41) - Existing contract and validation seams.
* packages/shared-types/src/index.ts (Lines 56-117) - Placement command/result contract.

Dependencies:
* Step 1.1 completion

### Step 2.2: Add deterministic telemetry adapter for E5-S1 events

Add a small telemetry adapter invoked from reducer transitions and preview lifecycle events. Emit required E5-S1 events without attaching to UI-specific callbacks.

Files:
* apps/client/src/creator/creator-telemetry.ts - E5-S1 telemetry adapter and event payload shape.
* apps/client/src/creator/tool-state.ts - Transition-level hooks for palette_opened, shape_selected, color_selected.
* apps/client/src/creator/placement-preview.ts - Hook for placement_preview_shown emission boundaries.
* apps/client/tests/integration/e5-s1-placement-flow.test.ts - Verifies event emission sequence.

Discrepancy references:
* DR-02

Success criteria:
* Required telemetry events emit exactly once per deterministic transition.
* Event payloads remain bounded and avoid user-identifying data.

Context references:
* docs/layer1-backlog.md (Lines 320-321) - Required telemetry events.

Dependencies:
* Step 1.2 completion
* Step 2.1 completion

### Step 2.3: Add optimistic indicator lifecycle with ack-aware resolution

Wire optimistic placement state to placement submit lifecycle and reconcile with placement response and realtime ack boundary using an ack-preferred clear policy. Keep current realtime ack ordering behavior unchanged.

Policy:
* On successful placement HTTP response, keep optimistic indicator active until matching realtime ack is observed.
* On terminal HTTP failure responses (for example occupied, throttled, payload mismatch), clear optimistic indicator immediately.
* If realtime ack arrives before HTTP success handling completes, prefer ack resolution and treat later success handling as idempotent.

Files:
* apps/client/src/creator/tool-state.ts - Pending placement and resolution transitions.
* apps/client/src/session/realtime-delta-handler.ts - Optional callback seam for ack-aware optimistic resolution if needed.
* apps/client/tests/integration/e5-s1-placement-flow.test.ts - Optimistic indicator appears until ack/result resolution.

Discrepancy references:
* DR-03

Success criteria:
* Optimistic indicator appears on valid placement submit.
* Optimistic indicator resolves deterministically with ack-preferred precedence and immediate clear on terminal HTTP failure.

Context references:
* docs/layer1-backlog.md (Line 317) - Optimistic indicator requirement.
* .copilot-tracking/research/2026-06-30/e5-s1-creator-placement-preview-research.md (Lines 92-94) - Clear-boundary decision candidates.

Dependencies:
* Step 2.1 completion
* Existing realtime ack behavior in apps/client/src/session/realtime-delta-handler.ts

### Step 2.4: Validate phase changes

Run targeted validation for submit, telemetry, and optimistic lifecycle.

Validation commands:
* npm run -w @game/client lint - Validate creator submit, telemetry, and state modules.
* npm run -w @game/client test - Run unit and integration tests for E5-S1 flow.
* npm run -w @game/client build - Confirm creator exports and types compile.

## Implementation Phase 3: Full validation and scope closeout

<!-- parallelizable: false -->

### Step 3.1: Run full project validation

Execute all validation commands for the project:
* npm run -w @game/client lint
* npm run -w @game/client test
* npm run -w @game/client build
* npm run lint
* npm run test

### Step 3.2: Fix minor validation issues

Iterate on lint errors, type errors, and test failures in the touched E5-S1 modules. Keep fixes localized to apps/client and related shared contracts only if a small type adjustment is necessary.

### Step 3.3: Report blocking issues

When unresolved decisions exceed E5-S1 scope:
* Document the blocker in the planning log.
* Recommend a follow-on story or contract hardening item.
* Do not widen implementation into E5-S2+ within this story.

## Dependencies

* apps/client creator module additions
* Existing placement server route and shared contracts
* Existing client test harness

## Success Criteria

* E5-S1 deterministic state and preview behavior is fully specified for implementation.
* Telemetry and sanitization requirements are mapped to concrete code seams and tests.
* Validation steps are executable and aligned with the workspace scripts.
