<!-- markdownlint-disable-file -->
# Release Changes: E4-E5 Product Support for UAT Scenarios

**Related Plan**: `.copilot-tracking/plans/2026-07-01/e4-e5-uat-support-plan.instructions.md`
**Implementation Date**: 2026-07-01

## Summary

Completed Phases 1-5 for E4/E5 UAT support, covering deterministic server bond domain, client interaction surfaces, onboarding/a11y instrumentation, regression coverage, and full workspace validation.

## Changes

### Added

* `apps/server/src/domain/bond-evaluator.service.ts` - Added deterministic orthogonal adjacency bond evaluation and bounded neighborhood recompute pipeline.
* `apps/server/tests/unit/bonding.service.test.ts` - Added deterministic bond-type and canonical pair-order regression tests.
* `apps/server/tests/unit/recompute.telemetry.test.ts` - Added API-level recompute telemetry emission coverage.
* `apps/client/src/browser/telemetry.ts` - Added client telemetry wrapper for E4/E5 browser interaction events.
* `apps/client/tests/unit/browser-state.test.ts` - Added browser-state regression coverage for deterministic bonds, optimistic acknowledgements, and viewport calculations.
* `apps/client/tests/unit/onboarding-accessibility.test.ts` - Added onboarding progression and accessibility state regression coverage.
* `apps/client/tests/unit/browser-telemetry.test.ts` - Added client telemetry sink emission coverage.

### Modified

* `apps/server/src/http/app.ts` - Wired bond recompute execution and bond/recompute telemetry emission into successful tile placement path.
* `apps/server/src/index.ts` - Registered bond evaluator dependency in app composition root.
* `apps/server/src/rooms/arena.state.ts` - Extended room state schema with authoritative tile and bond collections.
* `apps/server/src/telemetry/telemetry-sink.ts` - Added typed helpers for bond/recompute telemetry event families.
* `packages/shared-types/src/index.ts` - Added shared bond/recompute contract types used by server execution.
* `apps/client/src/browser/app.ts` - Added palette events, preview telemetry, optimistic placement behavior, pan/zoom telemetry, and bond render telemetry wiring.
* `apps/client/src/browser/render.ts` - Implemented SVG canvas surface, palette controls, viewport interaction controls, preview/blocked visuals, and bond rendering/culling behavior.
* `apps/client/src/browser/state.ts` - Extended browser state for palette/preview/viewport/bonds/accessibility and deterministic bond recompute projection.
* `apps/client/src/index.ts` - Wired browser telemetry sink configuration for runtime client event emission.
* `apps/server/README.md` - Added developer-facing E4/E5 UAT telemetry contract documentation and observability setup notes.

### Removed

* None.

## Additional or Deviating Changes

* Added targeted tests named for `bonding` and `recompute` filters to satisfy required Phase 1 validation commands.
	* Needed because filtered command execution is a formal plan gate and prior test suite did not contain matching names.
* Adjusted recompute test route and success status during implementation.
	* Initial draft used `/tiles/place` with `200`; corrected to `/api/tiles/place` with `201` to match current API contract.
* Rebuilt shared-types workspace package during Phase 2 validation.
	* Required to expose newly added shared exports (`ClientInteractionTelemetryEventName`, `ClientPaletteSelection`, `ClientViewportState`) to client build.
* Updated preview-clearing logic in browser state for strict optional typing.
	* Replaced explicit `preview: undefined` patch with immutable property omission to satisfy `exactOptionalPropertyTypes` and readonly state constraints.
* Added lightweight structural typing in render event handling to satisfy workspace lint constraints without relying on global DOM constructor symbols.
	* Needed to preserve lint compatibility while keeping browser event handling behavior unchanged.
* Manual browser checks for contrast and reduced-motion visuals remain pending physical browser execution.
	* Automated and unit validations pass, but final UAT row 6 visual checks still require manual verification.

## Release Summary

Total files affected: 20

Files added:

* `apps/server/src/domain/bond-evaluator.service.ts` - deterministic bond evaluation and neighborhood recompute domain service.
* `apps/server/tests/unit/bonding.service.test.ts` - server bond determinism coverage.
* `apps/server/tests/unit/recompute.telemetry.test.ts` - server recompute telemetry coverage.
* `apps/client/src/browser/telemetry.ts` - client telemetry emit helper.
* `apps/client/tests/unit/browser-state.test.ts` - client state projection and deterministic bond coverage.
* `apps/client/tests/unit/onboarding-accessibility.test.ts` - onboarding/a11y state coverage.
* `apps/client/tests/unit/browser-telemetry.test.ts` - client telemetry sink coverage.

Files modified:

* `apps/server/src/http/app.ts` - authoritative placement now triggers bond recompute and emits bond/recompute events.
* `apps/server/src/index.ts` - composition root wiring for bond evaluator service.
* `apps/server/src/rooms/arena.state.ts` - room state expanded for tile/bond authority.
* `apps/server/src/telemetry/telemetry-sink.ts` - typed bond/recompute telemetry helpers.
* `packages/shared-types/src/index.ts` - shared bond, viewport, palette, and expanded client telemetry event contracts.
* `apps/client/src/browser/app.ts` - onboarding, a11y toggles, keyboard placement, first-tile timing, and expanded client telemetry wiring.
* `apps/client/src/browser/render.ts` - canvas interaction surfaces, onboarding controls, keyboard events, focus-visible treatment, and a11y toggle controls.
* `apps/client/src/browser/state.ts` - onboarding and accessibility state slices with first-tile instrumentation fields.
* `apps/client/src/index.ts` - browser export wiring consistency for new state capabilities.
* `apps/server/README.md` - UAT support telemetry contract documentation.
* `.copilot-tracking/plans/2026-07-01/e4-e5-uat-support-plan.instructions.md` - checklist progress updated through all phases.
* `.copilot-tracking/plans/logs/2026-07-01/e4-e5-uat-support-log.md` - deviations and follow-on work updated.

Files removed:

* None.

Validation summary:

* Passed: `npm run -w @game/server test -- bonding`
* Passed: `npm run -w @game/server test -- recompute`
* Passed: `npm run -w @game/server build`
* Passed: `npm run -w @game/client test -- onboarding`
* Passed: `npm run -w @game/client test -- accessibility`
* Passed: `npm run -w @game/client test`
* Passed: `npm run -w @game/client build`
* Passed: `npm run lint`
* Passed: `npm run build`
* Passed: `npm run test`

Blocking issues:

* None blocking build/test/lint completion. Manual browser visual checks for reduced-motion and high-contrast remain recommended before formal UAT sign-off.
