<!-- markdownlint-disable-file -->
# Release Changes: E5-S2 Pan Zoom and Viewport Culling

**Related Plan**: e5-s2-pan-zoom-viewport-culling-plan.instructions.md
**Implementation Date**: 2026-07-01

## Summary

Implement deterministic camera pan/zoom state, viewport derivation, bounded viewport diff orchestration, visible-tile culling, telemetry, and validation coverage for E5-S2.

## Changes

### Added

* apps/client/src/navigation/camera-state.ts - Added deterministic camera reducer, action handling, and clamp helpers for bounded pan/zoom transitions.
* apps/client/src/navigation/viewport-math.ts - Added pure camera-to-viewport derivation and policy-aware viewport normalization helpers.
* apps/client/tests/unit/camera-state.test.ts - Added camera transition and clamp invariant unit coverage.
* apps/client/tests/unit/viewport-math.test.ts - Added viewport bounds and max-area normalization unit coverage.
* apps/client/src/navigation/viewport-caller.ts - Added bounded viewport diff caller with debounce, in-flight coalescing, and latest-wins response sequencing.
* apps/client/src/navigation/viewport-culling.ts - Added deterministic viewport-intersection culling for visible tile derivation.
* apps/client/tests/unit/viewport-caller.test.ts - Added viewport caller debounce, bounds, and stale response handling unit coverage.
* apps/client/tests/unit/viewport-culling.test.ts - Added visible-set inclusion/exclusion and edge intersection unit coverage.
* apps/client/tests/integration/e5-s2-pan-zoom-culling-flow.test.ts - Added integration coverage for camera transition boundaries, bounded viewport diff requests, and deterministic visible-set updates.
* apps/client/tests/integration/e5-s2-pan-zoom-perf.test.ts - Added perf evidence generation test for E5-S2 fps/memory artifact output.
* apps/client/tests/integration/e2-s4-e5-s2-compatibility.test.ts - Added regression coverage proving E2-S4 compatibility expectations across no-op telemetry and latest-wins viewport call behavior.
* apps/server/artifacts/e5-s2-pan-zoom-budget.json - Added E5-S2 perf artifact target file for fps/memory evidence.

### Modified

* apps/client/src/index.ts - Exported new navigation camera and viewport math modules.
* apps/client/src/index.ts - Exported viewport caller and viewport culling modules.
* apps/client/src/navigation/camera-state.ts - Added deterministic transition-boundary metadata derivation and reducer wrapper.
* apps/client/src/creator/creator-telemetry.ts - Added bounded non-identifying viewport_changed and zoom_level_changed telemetry payloads and transition-boundary emit helper.
* apps/client/tests/unit/camera-state.test.ts - Added boundary/no-op assertions for deterministic transition semantics.
* .github/workflows/verify-release.yml - Added E5-S2 verify-release extension point comment for post-deploy perf artifact assertion wiring.

### Removed

## Additional or Deviating Changes

* No deviations from plan in Phase 1.
* No deviations from plan in Phase 2.
* No deviations from plan in Phase 3.
* Removed unintended generated directory at apps/client/apps/server/artifacts after user instruction to keep only the planned artifact target.

## Release Summary

E5-S2 is fully implemented across deterministic camera state, bounded viewport derivation, debounced/coalesced viewport diff fetching, deterministic visible-set culling, telemetry emission boundaries, and regression/perf validation coverage.

Files affected:
* Added: 12 files
* Modified: 6 files
* Removed: 1 generated directory cleanup (apps/client/apps)

Primary implementation surfaces:
* Client navigation: camera state, viewport math, viewport caller, and viewport culling.
* Telemetry: viewport_changed and zoom_level_changed bounded transition emission helpers.
* Tests: unit, integration flow, perf artifact generation, and E2-S4 compatibility regression.
* Workflow docs: verify-release extension-point note for future E5-S2 post-deploy budget enforcement.

Validation and quality status:
* Client lint/test/build: passed.
* Targeted compatibility test: passed.
* Workspace lint/test/build: passed.

Deployment and follow-on notes:
* E5-S2 budget artifact path is available at apps/server/artifacts/e5-s2-pan-zoom-budget.json.
* Follow-on work remains to formalize numeric perf thresholds and convert verify-release extension note into an enforced gate.
