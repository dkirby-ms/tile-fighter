<!-- markdownlint-disable-file -->
# Release Changes: E1-S1 Client Shell Gap

**Related Plan**: .copilot-tracking/plans/2026-07-01/e1-s1-client-shell-gap-plan.instructions.md
**Implementation Date**: 2026-07-01

## Summary

Implemented E1-S1 client shell startup end-to-end: runtime startup orchestration, idempotent startup telemetry, non-leaky bootstrap denial mapping, and unit/integration/smoke coverage with full validation.

## Changes

### Added

* apps/client/src/shell/shell-startup-state.ts - Added explicit startup runtime states, transition events, and guarded transition helpers including executable bootstrap-in-flight transitions.
* apps/client/src/shell/shell-startup.ts - Added startup orchestrator that composes auth readiness and bootstrap with deterministic terminal outcomes.
* apps/client/src/shell/shell-telemetry.ts - Added startup telemetry adapter with session_started idempotency and session_bootstrap_failed emission.
* apps/client/tests/unit/shell-startup-state.test.ts - Added unit tests for startup transitions and orchestrator terminal outcomes.
* apps/client/tests/unit/shell-startup-telemetry.test.ts - Added telemetry unit tests for cardinality and denial mapping.
* apps/client/tests/integration/shell-startup-bootstrap.test.ts - Added startup bootstrap integration coverage for success and denial paths.
* apps/client/tests/integration/shell-startup-telemetry.test.ts - Added telemetry cardinality and failure-event integration coverage.
* apps/client/tests/smoke/e1-s1-open-shell.test.ts - Added open-shell smoke coverage for deterministic startup success path.

### Modified

* apps/client/src/index.ts - Exported shell startup orchestrator, state model, and shell telemetry API from package root.
* apps/client/src/session/bootstrap-store.ts - Added structured BootstrapStoreError taxonomy with non-leaky denial codes and status normalization.

### Removed

* None

## Additional or Deviating Changes

* Orchestrator start behavior now resets runtime automatically when invoked from a terminal state.
	* Reason: Required to satisfy startup retry/no-loop test behavior while preserving deterministic transitions.
* Existing unit assertion updated from `bootstrap-failed` to `bootstrap-unavailable`.
	* Reason: Align test expectation with the new explicit failure taxonomy introduced in Phase 2.

## Release Summary

Phases completed: 4/4.

Files affected:
* Added: 8
* Modified: 3
* Removed: 0

Created and expanded a dedicated shell startup module in apps/client with explicit runtime states, deterministic orchestration, and startup telemetry boundaries. Introduced non-leaky bootstrap denial classification in bootstrap store and shell mapping, then validated behavior through unit, integration, and smoke coverage.

Validation outcomes:
* `npm run -w @game/client lint` - Passed
* `npm run -w @game/client test` - Passed
* `npm run -w @game/client build` - Passed
* `npm run lint` - Passed
* `npm run test` - Passed
* `npm run build` - Passed
