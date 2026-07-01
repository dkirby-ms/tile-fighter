<!-- markdownlint-disable-file -->
# Release Changes: E5-S1 Creator Placement Preview

**Related Plan**: e5-s1-creator-placement-preview-plan.instructions.md
**Implementation Date**: 2026-06-30

## Summary

Implement E5-S1 deterministic creator placement preview in apps/client with reducer-driven tool state, pure preview evaluation, sanitized placement submission, optimistic lifecycle handling, telemetry events, and tests.

## Changes

### Added

* apps/client/src/creator/tool-state.ts - Added deterministic creator tool-state reducer with pure transitions for palette, selection, hover, blocked preview flag, and optimistic pending placement.
* apps/client/src/creator/placement-preview.ts - Added pure preview derivation with ready/blocked/invalid-input status and occupancy lookup helpers.
* apps/client/src/creator/placement-input.ts - Added pure placement input sanitization for command identity, bounds checks, and style payload constraints before submit.
* apps/client/src/creator/placement-caller.ts - Added deterministic tile placement submit adapter for POST /api/tiles/place with typed success/failure mapping.
* apps/client/src/creator/creator-telemetry.ts - Added bounded creator telemetry adapter for E5-S1 required events.
* apps/client/tests/unit/tool-state.test.ts - Added deterministic reducer transition coverage for palette, shape, color, hover, blocked flag, and optimistic lifecycle actions.
* apps/client/tests/unit/placement-preview.test.ts - Added preview evaluator matrix coverage for ready, blocked, and invalid-input outcomes.
* apps/client/tests/unit/placement-input.test.ts - Added sanitization acceptance and rejection matrix tests.
* apps/client/tests/unit/placement-caller.test.ts - Added placement caller response mapping and failure-classification tests.
* apps/client/tests/integration/e5-s1-placement-flow.test.ts - Added deterministic E5-S1 flow integration coverage for telemetry boundaries and optimistic ack-preferred lifecycle.

### Modified

* apps/client/src/index.ts - Exported new creator state and preview modules plus related types.
* apps/client/src/session/realtime-delta-handler.ts - Added optional ack observer callback seam without changing existing ordered apply and ack behavior.
* apps/client/tests/unit/realtime-delta-handler.test.ts - Added coverage for ack observer callback emission.

### Removed

* None

## Additional or Deviating Changes

* placement-input sanitization was adjusted to report invalid command identity alongside other input issues even when style payload validation fails.
	* reason: unit validation expected full error reporting per invalid input matrix and this preserves deterministic client-side rejection diagnostics.

## Release Summary

Phases completed: 3 of 3.

Validation status:
* `npm run -w @game/client lint` - passed
* `npm run -w @game/client test` - passed (11 files, 84 tests)
* `npm run -w @game/client build` - passed
* `npm run lint` - passed
* `npm run test` - passed (workspace, including server suite)

Files affected:
* Added: 9
* Modified: 3
* Removed: 0

Deployment and compatibility notes:
* No server contract changes were required for E5-S1.
* Existing shared placement command/result semantics remain unchanged.
* Telemetry schema remains local and bounded pending follow-on contract definition.
