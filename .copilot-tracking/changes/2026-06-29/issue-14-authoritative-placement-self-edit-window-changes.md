<!-- markdownlint-disable-file -->
# Release Changes: Issue #14 Authoritative Placement and 10-Minute Self-Edit Window

**Related Plan**: issue-14-authoritative-placement-self-edit-window-plan.instructions.md
**Implementation Date**: 2026-06-29

## Summary

Implementation in progress for authoritative tile placement and 10-minute creator self-edit policy. Phase 1 completed with new authenticated tile command routes, route mounting in app composition, and shared DTO/result unions.

## Changes

### Added

* apps/server/src/http/routes/tile.routes.ts - Added authenticated tile placement and tile edit endpoints with deterministic rejection mapping and server-derived principal ownership.

### Modified

* apps/server/src/http/app.ts - Mounted tile routes after auth middleware and wired dependencies to repository-backed placement and policy checks.
* apps/server/src/index.ts - Passed db and tileRepository to HTTP app dependencies.
* packages/shared-types/src/index.ts - Added shared tile place/edit command and result contracts with explicit rejection reasons.
* apps/server/src/persistence/tile.repository.ts - Added bounded edit operation with deterministic owner mismatch and edit-window expiry result unions anchored to created_at.
* apps/server/src/telemetry/telemetry-sink.ts - Added story-level telemetry helpers for tile_placed, tile_place_rejected, and tile_edited while preserving existing persistence events.
* apps/server/tests/unit/tile.repository.test.ts - Added repository unit coverage for owner mismatch, edit-window expiry, boundary checks, and success edit path.
* apps/server/tests/integration/tile-persistence.integration.test.ts - Added integration scenarios for owner edit success, non-owner reject, and expired edit rejection.
* apps/server/tests/load/room-join-load.ts - Added load-focused tests for coordinate contention occupied rejects and throttle path pressure.
* apps/server/vitest.config.ts - Expanded test include pattern to ensure load test discovery for explicit load test execution.

### Removed

* None

## Additional or Deviating Changes

* Tile route mounting in app composition is conditional on db and tileRepository dependencies being present.
	* This preserves compatibility for contexts that instantiate the HTTP app without persistence wiring while maintaining auth-first route ordering.
* No additive migration was introduced for edit audit metadata in Phase 2.
	* The selected implementation enforces the 10-minute self-edit policy using existing created_at and owner_id fields as specified by plan/research minimal path.
* Startup migration smoke file was intentionally left unchanged in Phase 3.
	* No schema migration was added, so new column assertions would have been invalid and out of scope.

## Release Summary

Implemented server-authoritative tile placement and creator-only 10-minute self-edit window with deterministic rejection outcomes, shared command/result contracts, story-level telemetry, and layered test coverage.

Files affected:
* Added: apps/server/src/http/routes/tile.routes.ts
* Modified: apps/server/src/http/app.ts
* Modified: apps/server/src/index.ts
* Modified: apps/server/src/persistence/tile.repository.ts
* Modified: apps/server/src/telemetry/telemetry-sink.ts
* Modified: packages/shared-types/src/index.ts
* Modified: apps/server/tests/unit/tile.repository.test.ts
* Modified: apps/server/tests/integration/tile-persistence.integration.test.ts
* Modified: apps/server/tests/load/room-join-load.ts
* Modified: apps/server/vitest.config.ts

Validation:
* Workspace lint: passed (`npm run lint`)
* Workspace build: passed (`npm run build`)
* Workspace tests: passed (`npm run test`) with expected integration skips where test database is unavailable.

Deployment and infrastructure notes:
* No schema migration added for this issue; policy enforcement uses existing `created_at` and `owner_id` columns.
* Existing persistence telemetry events were preserved while adding story-level placement/edit events.
