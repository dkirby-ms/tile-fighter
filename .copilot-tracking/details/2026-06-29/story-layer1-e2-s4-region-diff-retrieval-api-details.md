<!-- markdownlint-disable-file -->
# Implementation Details: Story Layer1 E2-S4 Region Diff Retrieval API

## Context Reference

Sources: .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md, docs/layer1-backlog.md, and server patterns in apps/server/src/http/routes/tile.routes.ts, apps/server/src/persistence/tile.repository.ts, and apps/server/src/telemetry/telemetry-sink.ts.

## Implementation Phase 1: Data Model and Persistence Foundation

<!-- parallelizable: false -->

### Step 1.1: Add region diff persistence schema migration

Create a new migration that introduces region version state and append-only tile delta records needed for incremental retrieval.

Files:
* apps/server/src/persistence/migrations/<timestamp>_region_diffs.js - Create region_versions and tile_deltas tables with indexes.

Discrepancy references:
* Addresses DR-01 by adding storage structures required for since-version reads.

Success criteria:
* Migration creates region_versions with region_id, current_version, and updated_at.
* Migration creates tile_deltas with region/version/coordinate, operation, payload columns, and changed_at.
* Index exists for region/version filtering and optional coordinate-compaction read support.

Context references:
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 92-142) - Suggested schema and indexes.
* apps/server/src/persistence/migrations/1720000000000_tiles.js (Lines 7-87) - Migration style and tile field compatibility.

Dependencies:
* Existing migration runner in apps/server/src/persistence/migrate.ts.

### Step 1.2: Implement diff repository and write-path versioning hooks

Add persistence methods for current-version lookup and diff retrieval, plus write-path updates that append deltas in the same transaction as tile mutations.

Files:
* apps/server/src/persistence/region-diff.repository.ts - Add read APIs for current version and deltas since version.
* apps/server/src/persistence/tile.repository.ts - Update mutation paths to increment region version and append tile_deltas atomically.
* apps/server/src/persistence/db.ts - Extend Kysely table typings for region_versions and tile_deltas.

Discrepancy references:
* Addresses DR-02 by introducing explicit diff repository boundaries.

Success criteria:
* Repository supports getCurrentRegionVersion and getTileDeltasSince methods scoped by viewport.
* Tile mutation transactions append delta rows and advance region_versions consistently.
* Retrieval query includes deterministic ordering for compaction and response assembly.

Context references:
* apps/server/src/persistence/tile.repository.ts (Lines 31-245) - Existing transactional style and query conventions.
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 165-236) - Preferred persistence strategy.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Validate persistence phase

Run migration and focused tests before layering service and HTTP route work.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/integration/startup-migration.smoke.test.ts
* npm run --workspace @tile-fighter/server test -- tests/integration/tile-persistence.integration.test.ts

## Implementation Phase 2: Diff Service and Telemetry

<!-- parallelizable: true -->

### Step 2.1: Implement region diff service orchestration

Create domain orchestration for unchanged fast-path, stale delta retrieval, coordinate compaction, and payload truncation.

Files:
* apps/server/src/domain/region-diff.service.ts - Add service methods for validate-and-assemble diff response.

Discrepancy references:
* Supports DR-01 by keeping compaction and response assembly compatible with unresolved delete semantics.

Success criteria:
* Service returns empty diff with currentVersion equal to sinceVersion when unchanged.
* Service compacts multiple deltas per coordinate to latest-wins within response window.
* Service returns nextSinceVersion, isEmpty, and truncated flags consistently.

Context references:
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 143-236) - Service contract and assembly guidance.

Dependencies:
* Implementation Phase 1 completion.

### Step 2.2: Add region diff telemetry helpers and instrumentation

Add story-required telemetry events and route/service instrumentation attributes.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add emitTileDiffRequested and emitTileDiffReturned helpers.
* apps/server/src/domain/region-diff.service.ts - Emit telemetry for request and result lifecycle.

Discrepancy references:
* Supports DR-02 by adding observability signals needed to tune future hard limits.

Success criteria:
* Event names exactly match tile_diff_requested and tile_diff_returned.
* Attributes include region_id, since_version, current_version, viewport_area, tile_count, truncated, duration_ms.
* Telemetry remains compatible with existing sink conventions.

Context references:
* apps/server/src/telemetry/telemetry-sink.ts (Lines 1-220) - Existing event helper and payload conventions.

Dependencies:
* Step 2.1 completion.

### Step 2.3: Validate service and telemetry phase

Run focused service tests and lint checks for newly introduced domain/telemetry logic.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/unit/region-diff.service.test.ts
* npm run --workspace @tile-fighter/server lint

## Implementation Phase 3: HTTP Contract and Route Wiring

<!-- parallelizable: true -->

### Step 3.1: Add shared request and response contracts

Define shared API contracts for region diff retrieval payloads and response semantics.

Files:
* packages/shared-types/src/index.ts - Add RegionDiffRequest, RegionDiffTileDelta, and RegionDiffResponse shapes.

Discrepancy references:
* Supports DR-01 and DR-02 by making delete operations and limit semantics explicit in shared contracts.

Success criteria:
* Shared types include viewport bounds, sinceVersion, maxTiles, operation enum, and response metadata.
* Types are exported and consumable by server and client packages.

Context references:
* packages/shared-types/src/index.ts (Lines 1-60) - Existing shared contract export style.
* .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 67-116) - Proposed contract examples.

Dependencies:
* None. Can run in parallel with Implementation Phase 2.

### Step 3.2: Implement region diff route and register in app

Create authenticated region diff route with payload guards, abuse control checks, and domain mapping.

Files:
* apps/server/src/http/routes/region-diff.routes.ts - Add POST /api/regions/diff handler and validation.
* apps/server/src/http/app.ts - Register route under authenticated API routes.
* apps/server/src/index.ts - Wire service dependencies if app factory needs new constructor parameters.

Discrepancy references:
* Supports DR-02 and DR-03 by enforcing explicit validation and preserving a future authorization-scope extension point.
* May implement DD-01 default decisions if unresolved product decisions remain (delete semantics, limits, auth scope).

Success criteria:
* Endpoint validates regionId, sinceVersion, viewport bounds, and maxTiles values.
* Endpoint returns 400 for malformed payloads and 401 for unauthenticated requests via existing middleware.
* Endpoint delegates diff assembly to service and returns typed response structure.

Context references:
* apps/server/src/http/routes/tile.routes.ts (Lines 1-172) - Existing JSON guard and error mapping style.
* apps/server/src/http/app.ts (Lines 1-140) - Route registration and middleware order.

Dependencies:
* Step 3.1 completion.
* Implementation Phase 2 completion.

### Step 3.3: Validate route and contract phase

Run focused integration tests for auth, validation, and version-based response behavior.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/integration/http-auth.integration.test.ts
* npm run --workspace @tile-fighter/server test -- tests/integration/region-diff.integration.test.ts

## Implementation Phase 4: Test Matrix and Load Harness

<!-- parallelizable: false -->

### Step 4.1: Add unit and integration coverage for diff retrieval behavior

Implement full test matrix for unchanged, stale, truncation, and invalid-request scenarios.

Files:
* apps/server/tests/unit/region-diff.service.test.ts - Unit tests for unchanged/stale/compaction/truncation logic.
* apps/server/tests/integration/region-diff.integration.test.ts - Integration tests for auth, validation, and endpoint response behavior.

Discrepancy references:
* Supports DR-01, DR-02, and DR-03 by validating behavior under unresolved product-decision defaults.

Success criteria:
* Unit tests verify latest-wins compaction and correct nextSinceVersion semantics.
* Integration tests verify unchanged response returns empty tiles and stale response returns incremental deltas.
* Integration tests verify malformed viewport and sinceVersion values return 400.

Context references:
* apps/server/tests/unit/join-token.service.test.ts (Lines 1-140) - Unit pattern.
* apps/server/tests/integration/join-token.integration.test.ts (Lines 1-200) - Integration API pattern.

Dependencies:
* Implementation Phases 1-3 completion.

### Step 4.2: Add load scenario for region diff endpoint

Add a lightweight load harness to measure read amplification and truncation behavior under concurrent stale requests.

Files:
* apps/server/tests/load/region-diff-load.ts - Load scenario invoking diff endpoint with stale/unchanged mix.

Discrepancy references:
* Supports DR-02 by providing initial read-amplification signals for future hard-limit calibration.

Success criteria:
* Load harness runs with existing load tooling conventions.
* Scenario reports response-size and latency summary for stale versus unchanged requests.

Context references:
* apps/server/tests/load/room-join-load.ts (Lines 1-180) - Existing load harness structure.

Dependencies:
* Step 4.1 completion.

### Step 4.3: Validate test and load phase

Run new suites and ensure they are stable under CI-like invocation.

Validation commands:
* npm run --workspace @tile-fighter/server test -- tests/unit/region-diff.service.test.ts tests/integration/region-diff.integration.test.ts
* npm run --workspace @tile-fighter/server test -- tests/load/region-diff-load.ts

## Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute complete workspace quality checks after all implementation phases.

Validation commands:
* npm run lint
* npm run build
* npm run test

### Step 5.2: Fix minor validation issues

Address straightforward lint, type, and test failures introduced by this story while preserving scope boundaries.

### Step 5.3: Report blocking issues

If validation reveals blockers beyond minor fixes, document exact failures, impacted files, and recommended follow-on planning.

## Dependencies

* PostgreSQL migration and node-pg-migrate pipeline.
* Existing Kysely repository infrastructure and transaction support.
* Existing auth middleware principal propagation.
* Existing telemetry sink event pipeline.
* Vitest unit/integration/load harness under apps/server/tests.

## Success Criteria

* Incremental region diff retrieval works with unchanged fast-path and stale delta payloads.
* Diff endpoint is authenticated, validated, and bounded by request limits.
* Tile mutation paths maintain region version and delta log consistency.
* Telemetry events for diff request and result are emitted with required attributes.
* Unit, integration, and load tests for diff behavior pass in CI-aligned commands.