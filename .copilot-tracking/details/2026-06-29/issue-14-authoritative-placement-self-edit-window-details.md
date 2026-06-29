<!-- markdownlint-disable-file -->
# Implementation Details: Issue #14 Authoritative Placement and 10-Minute Self-Edit Window

## Context Reference

Sources:
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md
* .copilot-tracking/research/subagents/2026-06-29/issue-14-intent-research.md
* apps/server/src/http/app.ts:1-26
* apps/server/src/http/routes/session.routes.ts:1-132
* apps/server/src/http/auth-middleware.ts:1-24
* apps/server/src/persistence/tile.repository.ts:1-123
* apps/server/src/persistence/migrations/1720000000000_tiles.js:1-83
* apps/server/src/telemetry/telemetry-sink.ts:1-59
* packages/shared-types/src/index.ts:1-19
* apps/server/tests/unit/tile.repository.test.ts:1-80
* apps/server/tests/integration/tile-persistence.integration.test.ts:1-120
* apps/server/tests/integration/startup-migration.smoke.test.ts:1-80
* apps/server/tests/load/room-join-load.ts:1-120

## Implementation Phase 1: Route, Shared Contract, and Policy Surface

<!-- parallelizable: false -->

### Step 1.1: Add a dedicated tile route module for authoritative placement and edit commands

Create a new HTTP route module that owns tile placement and tile edit requests. The route should authenticate through the existing middleware chain, read the server-derived principal from res.locals, validate inputs, call repository/service methods, and emit stable response codes for success, occupied placement, forbidden owner mismatch, and expired edit-window rejections.

Files:
* apps/server/src/http/routes/tile.routes.ts - New route module for tile placement and edit commands.
* apps/server/src/http/routes/index.ts or equivalent export surface if one exists - Only if the route module needs a central export.

Discrepancy references:
* DD-01: The plan chooses HTTP authoritative commands rather than room-message mutation because the current architecture already uses authenticated HTTP command flows.

Success criteria:
* The route accepts only server-authenticated requests.
* Placement requests can be rejected deterministically when a coordinate is occupied.
* Edit requests can be rejected deterministically for non-owners and expired windows.
* Route code reuses the same validation and error style as the existing session route.

Context references:
* apps/server/src/http/routes/session.routes.ts:1-132 - Existing validation and throttle conventions.
* apps/server/src/http/auth-middleware.ts:14-16 - Server-derived principal source.
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Scenario A and Implementation Details) - Selected route-based approach.

Dependencies:
* Existing auth middleware must continue to populate res.locals.principal.
* Repository methods for place and edit need to be defined before route code can be finalized.

### Step 1.2: Mount the new tile routes in the HTTP app after authentication middleware

Register the new tile route module in the HTTP app after the auth middleware and alongside the other protected route groups. Keep route ordering explicit so tile commands remain behind auth and are available to protected clients only.

Files:
* apps/server/src/http/app.ts - Add createTileRoutes import and mount the router after auth middleware.

Discrepancy references:
* DD-01: Route placement is a deliberate deviation from any room-message implementation path.

Success criteria:
* The new route module is mounted in the app composition.
* Health and other existing routes continue to mount in the same order.
* The change does not weaken auth middleware ordering.

Context references:
* apps/server/src/http/app.ts:1-26 - Current middleware and route composition.
* apps/server/src/http/routes/session.routes.ts:1-132 - Existing protected command surface.

Dependencies:
* Step 1.1 should define the route factory signature.

### Step 1.3: Add shared tile command and result DTOs for placement and edit flows

Define shared request and response contracts for tile place and edit commands so client and server can use the same shapes. Keep the contracts narrow and deterministic, with explicit rejection reasons for occupied, forbidden-owner, and edit-window-expired outcomes.

Files:
* packages/shared-types/src/index.ts - Add tile command payloads, success payloads, and discriminated union result types.

Discrepancy references:
* DR-01: Shared tile DTOs were missing from the current codebase.

Success criteria:
* Tile request and result unions are exported from shared-types.
* The contracts cover the exact rejection reasons needed by the server policy.
* Existing shared exports remain intact.

Context references:
* packages/shared-types/src/index.ts:1-19 - Current shared export surface.
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Shared contract gap) - Research finding that tile DTOs are absent.

Dependencies:
* Step 1.1 should define the transport semantics the DTOs need to represent.

## Implementation Phase 2: Repository, Persistence, and Telemetry

<!-- parallelizable: true -->

### Step 2.1: Extend tile repository with authoritative insert and bounded update operations

Add repository methods for placing and editing tiles with deterministic return unions. Placement should preserve the existing coordinate-conflict mapping. Edit should check owner identity, enforce the 10-minute server-time window from created_at, and update only the allowed mutable fields. Keep the repository focused on persistence and policy decisions that require database reads.

Files:
* apps/server/src/persistence/tile.repository.ts - Add place and edit methods, query helpers, and result unions.
* apps/server/src/persistence/db.ts - Extend table typing if the repository needs additional fields or helper exports.

Discrepancy references:
* DD-02: The plan keeps the created_at anchor for the edit window and does not add a reset-on-edit semantics path.

Success criteria:
* Repository methods return discriminated unions for success and rejection cases.
* Coordinate conflicts still map to the same stable rejection reason.
* Edit methods return a distinct rejection for owner mismatch and window expiry.
* The implementation uses parameterized Kysely queries.

Context references:
* apps/server/src/persistence/tile.repository.ts:1-123 - Existing insert/select and conflict-union shape.
* apps/server/src/persistence/migrations/1720000000000_tiles.js:1-83 - Existing owner and created_at schema.
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Implementation Details) - Created_at as the authoritative edit anchor.

Dependencies:
* Shared DTOs and route behavior should be decided before final result shapes are frozen.

### Step 2.2: Add or adjust persistence schema for edit audit metadata if required by the selected implementation

Review whether the edit path needs additive columns for operational metadata such as updated_at and updated_by. The research says the policy can be enforced without schema changes, but this step leaves room for additive audit fields if the repository implementation or tests need them.

Files:
* apps/server/src/persistence/migrations/<new>.js - Optional additive migration for edit audit metadata.
* apps/server/src/persistence/db.ts - Extend table typing if new columns are introduced.

Discrepancy references:
* DD-03: The plan treats audit metadata as optional because the authoritative policy works from created_at alone.

Success criteria:
* The decision to add or skip audit columns is explicit in the implementation log.
* If columns are added, migration and typing stay aligned.
* If columns are skipped, the plan still supports the full edit policy from existing schema.

Context references:
* apps/server/src/persistence/migrations/1720000000000_tiles.js:47-61 - Existing columns and constraints.
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Persistence) - Minimal path uses created_at only.

Dependencies:
* Step 2.1 determines whether audit fields are necessary.

### Step 2.3: Add telemetry helpers for tile_placed, tile_place_rejected, and tile_edited

Extend the telemetry sink with story-level helpers or emit conventions that wrap the existing event payload pattern. Keep the existing persistence telemetry helpers available so the new story events do not break current observability contracts.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add tile_placed, tile_place_rejected, and tile_edited helpers or equivalent emit wrappers.
* apps/server/src/persistence/tile.repository.ts - Emit telemetry at the place and edit call sites if the design keeps emission near the repository.

Discrepancy references:
* DD-04: The plan preserves existing tile_persisted and tile_persist_conflict helpers instead of replacing them.

Success criteria:
* Story-level telemetry events exist for success and rejection paths.
* Existing persistence telemetry helpers remain usable.
* Telemetry payloads include enough attributes to distinguish placement, rejection, and edit outcomes.

Context references:
* apps/server/src/telemetry/telemetry-sink.ts:1-59 - Existing event payload shape and tile persistence helpers.
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Configuration Examples) - Story events requested by research.

Dependencies:
* Step 2.1 defines the route/repository boundary where telemetry should be emitted.

### Step 2.4: Validate repository, schema, and telemetry changes

Run the narrow validation set for the touched server files before moving to tests. Prefer the cheapest compile and lint commands that exercise the modified server code.

Validation commands:
* `npm run lint --filter=server` - Lint the server package and catch syntax or style issues in the touched files.
* `npm run build --filter=server` - Typecheck and compile the server package.

Success criteria:
* The server package lints cleanly.
* The server package builds cleanly.
* The modified repository, telemetry, and schema code compile together without type errors.

Dependencies:
* Steps 2.1, 2.2, and 2.3 complete.

## Implementation Phase 3: Tests and Load Coverage

<!-- parallelizable: false -->

### Step 3.1: Extend repository unit tests for owner, conflict, and edit-window boundaries

Add focused unit tests around the repository result unions and the edit policy boundaries. Verify the owner mismatch path, the 10-minute expiration path, and the coordinate-conflict path each return the expected discriminated result.

Files:
* apps/server/tests/unit/tile.repository.test.ts - Add place and edit coverage.

Discrepancy references:
* DD-02: The unit tests will assert the created_at anchor rather than any reset-on-edit behavior.

Success criteria:
* Unit tests cover successful placement and deterministic occupied rejection.
* Unit tests cover owner mismatch and expired self-edit rejection.
* Tests remain focused on repository behavior and do not depend on client UI.

Context references:
* apps/server/tests/unit/tile.repository.test.ts:1-80 - Existing repository unit coverage entry point.
* apps/server/src/persistence/tile.repository.ts:1-123 - Existing result-union contract.

Dependencies:
* Step 2.1 must be implemented first.

### Step 3.2: Extend persistence integration tests for place, reject, edit, and expiry scenarios

Broaden the integration suite to execute the authoritative placement and edit flow end to end against the database. Cover successful placement, occupied rejection, allowed self-edit inside the window, and expired or unauthorized edit attempts.

Files:
* apps/server/tests/integration/tile-persistence.integration.test.ts - Add authoritative placement and edit lifecycle scenarios.

Discrepancy references:
* DD-01: Integration tests validate the route-based authoritative path rather than room-message mutation.

Success criteria:
* Integration tests cover the place and edit success paths.
* Integration tests cover occupied and expired/self-edit rejections.
* The tests use trusted server time or controlled clocks for the 10-minute boundary.

Context references:
* apps/server/tests/integration/tile-persistence.integration.test.ts:1-120 - Existing persistence integration coverage.
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Technical Scenarios) - Required acceptance cases.

Dependencies:
* Steps 1.1, 1.2, 1.3, and 2.1 must be in place.

### Step 3.3: Extend startup migration smoke coverage for any additive metadata columns

If the implementation adds edit audit metadata, assert those columns are present in the migration smoke test. If the implementation does not add metadata columns, update the smoke test only if it needs to confirm the base tile schema still matches the authoritative policy.

Files:
* apps/server/tests/integration/startup-migration.smoke.test.ts - Add schema assertions only if new columns exist.

Discrepancy references:
* DD-03: Audit columns are optional and therefore may not require smoke-test changes.

Success criteria:
* Smoke coverage reflects the chosen schema shape.
* The migration test stays aligned with the final schema and does not assert nonexistent columns.

Context references:
* apps/server/tests/integration/startup-migration.smoke.test.ts:1-80 - Existing migration smoke entry point.
* apps/server/src/persistence/migrations/1720000000000_tiles.js:1-83 - Current schema baseline.

Dependencies:
* Step 2.2 determines whether this step requires a schema assertion update.

### Step 3.4: Add or update load coverage for placement contention and throttle behavior

Use the existing load harness or a new load entry point to stress occupied-coordinate contention and per-account placement throttling. Keep the scenario narrow so it exercises the server-authoritative rejection paths without introducing unrelated room behavior.

Files:
* apps/server/tests/load/room-join-load.ts or a new load test file - Add authoritative placement contention coverage.

Discrepancy references:
* DD-05: The load focus is on tile placement contention, not room join load, because the issue asks for authoritative placement and throttle coverage.

Success criteria:
* The load test can provoke occupied rejection behavior under contention.
* The load test can exercise per-account throttling or at least the code path that enforces it.
* The harness documents the chosen load scenario clearly.

Context references:
* apps/server/tests/load/room-join-load.ts:1-120 - Existing load harness candidate.
* .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Implementation Impact) - Load contention is a required follow-on.

Dependencies:
* Step 1.1 and Step 2.1 must be available to drive the scenario.

## Implementation Phase 4: Final Validation

<!-- parallelizable: false -->

### Step 4.1: Run full workspace validation

Execute workspace-level lint, build, and test commands after all targeted changes are in place. Keep the validation broad enough to catch interaction regressions between server, shared-types, and tests.

Validation commands:
* `npm run lint` - Workspace lint.
* `npm run build` - Workspace build.
* `npm run test` - Workspace test suite.

### Step 4.2: Fix minor issues surfaced by validation

Address isolated lint, type, or test failures introduced by the implementation. Keep fixes small and local to the touched tile-authoritative placement slice.

### Step 4.3: Report any blocking gaps

If validation exposes missing product decisions or broad regressions, capture them in the planning log instead of widening scope. Preserve the implementation plan as the source of truth and note any follow-on work required.

## Dependencies

* Server route composition and auth middleware
* Existing persistence repository and migration framework
* Shared contract package for DTO exports
* Vitest unit, integration, and load harnesses
* Optional clock control for edit-window boundary testing

## Success Criteria

* Placement rejects occupied coordinates deterministically and with stable reason codes.
* Only the creator can edit a tile, and only within the 10-minute server-time window.
* Telemetry records the authoritative place, reject, and edit outcomes without removing existing persistence events.
* Tests cover unit, integration, smoke, and load scenarios for the selected route-based implementation.
