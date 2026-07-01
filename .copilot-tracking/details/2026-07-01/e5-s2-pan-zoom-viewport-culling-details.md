<!-- markdownlint-disable-file -->
# Implementation Details: E5-S2 Pan Zoom and Viewport Culling

## Context Reference

Sources: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md; docs/layer1-backlog.md; docs/game-design-document.md

## Implementation Phase 1: Deterministic navigation state and viewport math

<!-- parallelizable: false -->

### Step 1.1: Add deterministic camera-state reducer and clamps

Create a pure camera-state reducer supporting pan and zoom actions with explicit clamp rules for zoom floor/ceiling and camera position limits derived from map boundaries. Keep this module deterministic and side-effect free so tests can validate transition sequences.

Files:
* apps/client/src/navigation/camera-state.ts - Reducer, camera action types, clamp helpers, and state transition utilities.
* apps/client/src/index.ts - Export new navigation camera module.

Success criteria:
* Pan updates and zoom updates are deterministic for the same input sequence.
* Zoom values are clamped to policy-safe bounds and cannot produce invalid viewport dimensions.
* No network or telemetry side effects occur inside reducer functions.

Context references:
* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Lines 99-107) - Selected module shape and deterministic approach.
* apps/client/src/creator/tool-state.ts - Existing reducer pattern to mirror.

Dependencies:
* None

### Step 1.2: Add camera-to-viewport derivation and bounds normalization

Implement pure math helpers converting camera state and view dimensions into `RegionDiffViewport` requests. Normalize and bound viewport coordinates and dimensions against `DEFAULT_REGION_DIFF_POLICY` to prevent oversized requests before network transport.

Files:
* apps/client/src/navigation/viewport-math.ts - Camera-to-viewport derivation and policy-bound normalization.
* packages/shared-types/src/index.ts - Existing shared viewport types and policy constants consumed by client code.

Success criteria:
* Derived viewport requests conform to existing `RegionDiffViewport` contract shape.
* Derived viewport area cannot exceed shared max-area constraints.
* Conversion math remains deterministic across repeated runs.

Context references:
* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Lines 80-89) - Shared contract and server-bound evidence.
* packages/shared-types/src/index.ts (Lines 155-193) - Viewport contract and defaults.

Dependencies:
* Step 1.1 completion

### Step 1.3: Add unit coverage for camera and viewport invariants

Create unit tests for clamp behavior, viewport dimension normalization, and bounds conformance to shared policy defaults.

Files:
* apps/client/tests/unit/camera-state.test.ts - Reducer action sequence and clamp tests.
* apps/client/tests/unit/viewport-math.test.ts - Derived viewport bounds and area limit tests.

Success criteria:
* Tests prove clamped zoom/position invariants across edge values.
* Tests prove viewport derivation remains within shared-policy bounds.

Context references:
* docs/layer1-backlog.md - E5-S2 behavior and abuse requirements.

Dependencies:
* Step 1.2 completion

### Step 1.4: Validate phase changes

Run targeted validation commands for navigation foundations.

Validation commands:
* npm run -w @game/client lint - Validate new navigation modules and tests.
* npm run -w @game/client test - Execute unit tests for camera and viewport math.
* npm run -w @game/client build - Ensure new exports compile.

## Implementation Phase 2: Viewport fetch orchestration and culling derivation

<!-- parallelizable: false -->

### Step 2.1: Add viewport caller with debounce and coalescing

Implement a viewport fetch adapter that sends bounded `RegionDiffRequest` payloads to `/api/regions/diff`. Add debounce for burst camera movement, in-flight request coalescing, and latest-wins response handling to avoid stale updates.

Files:
* apps/client/src/navigation/viewport-caller.ts - Debounce, coalescing, request dispatch, and response mapping.
* apps/client/tests/unit/viewport-caller.test.ts - Request bounds, debounce behavior, and stale-response handling tests.
* apps/server/src/http/routes/region-diff.routes.ts - Existing request parser and bounds validation contract to preserve.

Success criteria:
* Burst camera input does not trigger one network call per frame.
* All outgoing requests are bounded before send and accepted by existing server validators.
* Late responses do not override newer viewport state.

Context references:
* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Lines 115-124) - Selected fetch-orchestration approach.
* apps/server/src/http/routes/region-diff.routes.ts (Lines 72-133) - Existing route bounds enforcement.

Dependencies:
* Implementation Phase 1 completion

### Step 2.2: Add visible-set culling derivation

Implement pure visible-tile culling that filters draw candidates based on current viewport and zoom state. Keep culling independent from transport so renderer adapters can consume deterministic visible sets.

Files:
* apps/client/src/navigation/viewport-culling.ts - Visible-set derivation from tiles plus viewport.
* apps/client/tests/unit/viewport-culling.test.ts - Culling inclusion/exclusion tests including edge intersection behavior.

Success criteria:
* Off-screen tiles are excluded from visible-set output.
* Edge-overlap behavior is deterministic and consistent at different zoom levels.

Context references:
* docs/game-design-document.md (Lines 309-333) - Culling and navigation expectations.

Dependencies:
* Step 1.2 completion

### Step 2.3: Validate phase changes

Run targeted validation for fetch orchestration and culling behavior.

Validation commands:
* npm run -w @game/client lint - Validate viewport caller and culling modules.
* npm run -w @game/client test - Execute unit tests for caller and culling behavior.
* npm run -w @game/client build - Confirm navigation exports compile.

## Implementation Phase 3: Telemetry, integration flow, and perf evidence

<!-- parallelizable: false -->

### Step 3.1: Emit deterministic viewport and zoom telemetry

Extend existing client telemetry to emit `viewport_changed` and `zoom_level_changed` only at deterministic transition points. Keep payloads bounded and non-identifying.

Files:
* apps/client/src/creator/creator-telemetry.ts - Add or compose E5-S2 telemetry events.
* apps/client/src/navigation/camera-state.ts - Trigger telemetry at transition boundaries.
* apps/client/tests/unit/camera-state.test.ts - Verify telemetry emission boundaries when applicable.

Success criteria:
* Required telemetry events are emitted with bounded payload shape.
* Event emission does not duplicate on equivalent no-op transitions.

Context references:
* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Lines 49-51) - Telemetry requirements.

Dependencies:
* Step 1.1 completion
* Step 2.1 completion

### Step 3.2: Add E5-S2 integration flow test

Create an integration test that verifies camera movement and zoom changes produce bounded region-diff requests and deterministic visible-set updates.

Files:
* apps/client/tests/integration/e5-s2-pan-zoom-culling-flow.test.ts - End-to-end client behavior for pan/zoom/fetch/culling path.
* apps/client/src/navigation/viewport-caller.ts - Injected caller seam for deterministic integration test doubles.
* apps/client/src/navigation/viewport-culling.ts - Deterministic visible-set assertions.

Discrepancy references:
* DR-01

Success criteria:
* Test validates request bounds against shared policy.
* Test validates visible-set updates track camera movement deterministically.

Context references:
* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Lines 127-131) - Actionable test guidance.

Dependencies:
* Implementation Phase 2 completion

### Step 3.3: Add E5-S2 perf artifact path and verify-release extension note

Add an artifact-producing perf check for fps and memory during pan/zoom/culling scenarios and document where verify-release can enforce this after deployment.

Files:
* apps/client/tests/integration/e5-s2-pan-zoom-perf.test.ts - Perf-oriented scenario test or harness hook.
* apps/server/artifacts/e5-s2-pan-zoom-budget.json - Budget artifact target for E5-S2 evidence.
* .github/workflows/verify-release.yml - Follow-on extension point for post-deploy E5-S2 evidence enforcement.

Discrepancy references:
* DR-02

Success criteria:
* E5-S2 perf artifact is generated consistently in CI-compatible runs.
* Verify-release extension point is documented for post-deploy enforcement without blocking current implementation.

Context references:
* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Lines 92-97) - Current harness gap findings.

Dependencies:
* Step 3.2 completion

### Step 3.4: Add E2-S4 compatibility regression coverage

Add targeted regression assertions proving E5-S2 changes preserve E2-S4 dependency assumptions and behavior.

Files:
* apps/client/tests/integration/e2-s4-e5-s2-compatibility.test.ts - Cross-story compatibility checks for impacted viewport/navigation behavior.
* apps/client/tests/integration/e5-s2-pan-zoom-culling-flow.test.ts - Extended assertions ensuring no behavior drift against E2-S4 assumptions.

Discrepancy references:
* DR-03

Success criteria:
* Compatibility tests verify E2-S4-dependent behavior remains stable after E5-S2 changes.
* Regression coverage is runnable in normal client integration test workflows.

Context references:
* .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Lines 17-24) - E2-S4 compatibility assumption.

Dependencies:
* Step 3.2 completion

### Step 3.5: Validate phase changes

Run targeted validation for telemetry, integration, and perf evidence paths.

Validation commands:
* npm run -w @game/client lint - Validate telemetry and integration harness code.
* npm run -w @game/client test - Execute unit and integration suites including E5-S2 flow.
* npm run -w @game/client build - Confirm full client compile.
* npm run -w @game/client test -- e2-s4-e5-s2-compatibility - Confirm explicit E2-S4 compatibility regression coverage.

## Implementation Phase 4: Full validation and closeout

<!-- parallelizable: false -->

### Step 4.1: Run full project validation

Execute all validation commands for the project:
* npm run -w @game/client lint
* npm run -w @game/client test
* npm run -w @game/client build
* npm run -w @game/client test -- e2-s4-e5-s2-compatibility
* npm run lint
* npm run test
* npm run build

### Step 4.2: Fix minor validation issues

Iterate on lint, type, and test issues in touched E5-S2 surfaces. Keep fixes limited to navigation, telemetry, and test harness seams.

### Step 4.3: Report blocking issues

When failures require architectural or contract expansion beyond E5-S2:
* Document blockers and affected files.
* Add follow-on work items in planning log.
* Recommend additional research and planning rather than widening this implementation phase.

## Dependencies

* Existing shared viewport contract and server bounds enforcement
* Client Vitest harness for unit and integration coverage
* CI and verify-release workflows for artifact integration

## Success Criteria

* E5-S2 implementation steps map directly to deterministic modules, tests, and validation commands.
* Discrepancy-linked steps capture out-of-scope/perf-enforcement risks transparently.
* Plan is implementation-ready without unresolved critical gaps.
