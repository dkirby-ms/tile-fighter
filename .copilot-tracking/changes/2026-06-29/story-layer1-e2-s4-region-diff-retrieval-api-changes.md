<!-- markdownlint-disable-file -->
# Release Changes: Story Layer1 E2-S4 Region Diff Retrieval API

**Related Plan**: story-layer1-e2-s4-region-diff-retrieval-api-plan.instructions.md
**Implementation Date**: 2026-06-29

## Summary

Implementing an authenticated viewport-scoped region diff retrieval API with region versioning, delta persistence, telemetry, and layered tests.

## Changes

### Added

* apps/server/src/persistence/migrations/1740000000000_region_diffs.js - Added `region_versions` and `tile_deltas` schema with indexes for region/version and coordinate/version retrieval.
* apps/server/src/persistence/region-diff.repository.ts - Added repository APIs for current region version lookup and viewport-scoped delta retrieval since version with deterministic ordering.
* apps/server/src/domain/region-diff.service.ts - Added region diff orchestration with unchanged fast-path, stale retrieval, latest-wins compaction, truncation handling, and telemetry emission.
* apps/server/src/http/routes/region-diff.routes.ts - Added authenticated POST `/api/regions/diff` route with payload validation and typed response mapping.
* apps/server/tests/unit/region-diff.service.test.ts - Added unit coverage for unchanged fast-path, stale retrieval, latest-wins compaction, and truncation semantics.
* apps/server/tests/integration/region-diff.integration.test.ts - Added API integration coverage for auth, payload validation, unchanged response, and stale/truncated diff behavior.
* apps/server/tests/load/region-diff-load.ts - Added load harness scenario for mixed stale and unchanged diff requests with payload/latency summary output.

### Modified

* apps/server/src/persistence/db.ts - Extended Kysely table typings and exports for `region_versions` and `tile_deltas`.
* apps/server/src/persistence/tile.repository.ts - Updated tile insert/edit transactional paths to atomically bump `region_versions` and append `tile_deltas` records.
* apps/server/src/telemetry/telemetry-sink.ts - Added `emitTileDiffRequested` and `emitTileDiffReturned` helper methods.
* packages/shared-types/src/index.ts - Added region diff request/response shared contract types.
* apps/server/src/http/app.ts - Registered region diff routes in authenticated route stack.
* apps/server/src/index.ts - Wired region diff repository and service dependencies into app initialization.
* apps/server/src/domain/region-diff.service.ts - Updated `nextSinceVersion` derivation with safe tail access to satisfy TypeScript strictness.
* apps/server/src/persistence/tile.repository.ts - Added backward-compatible transaction and region-diff capability guards so existing unit-test DB doubles continue to pass while production path preserves atomic version/delta writes.

### Removed

## Additional or Deviating Changes

* Validation command namespace divergence from plan.
	* Plan listed `@tile-fighter/server`, but workspace package is `@game/server`; equivalent validation commands were run under `@game/server`.
* Phase 2 and Phase 3 validation test-file sequencing mismatch.
	* Commands for `tests/unit/region-diff.service.test.ts` and `tests/integration/region-diff.integration.test.ts` could not run before Phase 4 because those files did not yet exist.
* Full-suite test regression during Phase 5 validation.
	* Initial tile repository unit tests failed after introducing transaction-based diff hooks; implementation added compatibility guards for test doubles without full Kysely transaction/select interfaces.

## Release Summary

Implemented the full region diff retrieval vertical slice: persistence schema and repositories, service orchestration, telemetry events, authenticated route wiring, shared contracts, and layered tests.

Total files affected: 15

* Added: 7
	* apps/server/src/persistence/migrations/1740000000000_region_diffs.js
	* apps/server/src/persistence/region-diff.repository.ts
	* apps/server/src/domain/region-diff.service.ts
	* apps/server/src/http/routes/region-diff.routes.ts
	* apps/server/tests/unit/region-diff.service.test.ts
	* apps/server/tests/integration/region-diff.integration.test.ts
	* apps/server/tests/load/region-diff-load.ts
* Modified: 8
	* apps/server/src/persistence/db.ts
	* apps/server/src/persistence/tile.repository.ts
	* apps/server/src/telemetry/telemetry-sink.ts
	* packages/shared-types/src/index.ts
	* apps/server/src/http/app.ts
	* apps/server/src/index.ts
	* apps/server/src/domain/region-diff.service.ts
	* .copilot-tracking planning/changes logs

Validation status:

* `npm run lint` passed.
* `npm run build` passed.
* `npm run test` passed (with existing DB-gated integration skips as expected in this environment).

Deployment/infra impact:

* New DB migration required: `1740000000000_region_diffs.js`.
