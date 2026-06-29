<!-- markdownlint-disable-file -->
# Release Changes: Epic 2 Follow-Up Missing Elements Remediation

**Related Plan**: epic2-follow-up-missing-elements-remediation-plan.instructions.md
**Implementation Date**: 2026-06-29

## Summary

Implements remediation for unresolved Epic 2 follow-up policy, contract, authorization, and validation gaps across placement throttling, diff limits and tombstones, JWT claim mapping, and CI integration database semantics.

## Changes

### Added

* apps/server/tests/integration/test-db-guard.ts - Shared DB availability guard helper for integration tests.

### Modified

* .copilot-tracking/plans/logs/2026-06-29/epic2-follow-up-missing-elements-remediation-log.md - Expanded decision register to include status and next-action guidance for each policy decision.
* docs/layer1-backlog.md - Added explicit default policy language for unresolved throttle, diff-limit, tombstone, and authorization decisions.
* README.md - Documented local integration DB skip semantics and CI strictness expectations.
* apps/server/README.md - Added server-level policy defaults and CI DB precondition notes.
* packages/shared-types/src/index.ts - Added shared policy and contract types/defaults for JWT operator claims and region diff behavior.
* apps/server/src/http/routes/region-diff.routes.ts - Aligned diff response metadata surface with updated shared contract.
* .github/workflows/ci.yml - Added CI fail-fast DB precondition guard before server integration tests.
* apps/server/src/config/env.ts - Added placement throttle policy environment configuration.
* apps/server/src/http/app.ts - Wired throttle dependencies into route composition.
* apps/server/src/http/routes/tile.routes.ts - Enforced placement throttling and deterministic 429 response contract.
* apps/server/src/index.ts - Passed throttle configuration through server bootstrap wiring.
* apps/server/src/telemetry/telemetry-sink.ts - Added placement throttle rejection telemetry helper.
* apps/server/tests/integration/startup-migration.smoke.test.ts - Standardized DB skip guard usage.
* apps/server/tests/integration/region-diff.integration.test.ts - Standardized DB skip guard usage.
* apps/server/tests/integration/tile-persistence.integration.test.ts - Added throttle scenario coverage and standardized DB skip guard usage.
* apps/server/src/config/env.ts - Added region diff viewport/payload limit configuration.
* apps/server/src/http/app.ts - Wired region diff limit configuration into route creation.
* apps/server/src/index.ts - Threaded region diff limit configuration through bootstrap path.
* apps/server/src/http/routes/region-diff.routes.ts - Enforced config-driven request limits and aligned policy metadata.
* apps/server/src/persistence/tile.repository.ts - Added delete delta emission (tombstone semantics) for tile removal events.
* apps/server/tests/unit/region-diff.service.test.ts - Added/updated delete semantics and limit behavior coverage.
* apps/server/tests/integration/region-diff.integration.test.ts - Added boundary and delete-tombstone integration assertions with DB guards.
* apps/server/src/http/auth-middleware.ts - Formalized operator claim-source transition logic for deterministic authorization mapping.
* apps/server/src/http/routes/region-diff.routes.ts - Added membership-based authorization guard for diff requests.
* apps/server/src/http/app.ts - Wired membership authorization dependency for region diff route.
* apps/server/src/session/session-lifecycle.service.ts - Added membership query helper for route authorization checks.
* apps/server/tests/unit/auth-middleware.test.ts - Added claim-source matrix coverage for canonical and transitional behavior.
* apps/server/tests/integration/http-auth.integration.test.ts - Added coverage for updated operator-claim authorization behavior.
* apps/server/tests/integration/region-diff.integration.test.ts - Added non-member `403` authorization scenario (DB-guarded).
* apps/server/tests/load/room-join-load.ts - Updated load assertions for throttle-aware outcomes and pre-insert throttling behavior.
* apps/server/tests/load/region-diff-load.ts - Added membership setup to satisfy new region-diff membership authorization.
* apps/server/src/http/app.ts - Added safe fallback for throttle retry-after calculation under strict TypeScript checks.
* apps/server/src/http/routes/tile.routes.ts - Refined typed rejection response branches for TilePlaceResult discriminated union correctness.

### Removed

* None.

## Additional or Deviating Changes

* Added contract metadata compatibility update in region diff route during Phase 1.
	* Required to keep shared-types contract changes build-compatible before Phase 3 route hardening.

* Validation executed with workspace-scoped commands instead of full-root commands during Phase 1.
	* Ran `npm run -w @game/server lint` and `npm run -w @game/server build` per plan details for phase-level validation.

* Phase 2 focused integration validation executed with local DB prerequisites unavailable.
	* `npm run -w @game/server test -- tests/integration/tile-persistence.integration.test.ts` returned skipped tests, consistent with standardized local skip semantics.

* Phase 3 integration validation executed under DB guard skip semantics.
	* `npm run -w @game/server test -- tests/integration/region-diff.integration.test.ts` was skipped locally without TEST_DATABASE_URL.

* Phase 4 integration validation includes DB-guarded skip for region-diff authorization scenarios.
	* Unit and HTTP auth integration passed; region-diff integration remained skipped locally without TEST_DATABASE_URL.

* Full project validation initially failed due strict TypeScript narrowing and load-test expectation drift after throttle/auth changes.
	* Resolved by adjusting route typings and updating load harness fixtures/assertions to match new throttle and membership behavior.

## Release Summary

Completed all planned phases for Epic 2 follow-up remediation.

Files affected summary:
* Added: 1
	* apps/server/tests/integration/test-db-guard.ts
* Modified: 16
	* .github/workflows/ci.yml
	* README.md
	* apps/server/README.md
	* apps/server/src/config/env.ts
	* apps/server/src/http/app.ts
	* apps/server/src/http/auth-middleware.ts
	* apps/server/src/http/routes/region-diff.routes.ts
	* apps/server/src/http/routes/tile.routes.ts
	* apps/server/src/index.ts
	* apps/server/src/persistence/tile.repository.ts
	* apps/server/src/session/session-lifecycle.service.ts
	* apps/server/src/telemetry/telemetry-sink.ts
	* apps/server/tests/integration/http-auth.integration.test.ts
	* apps/server/tests/integration/region-diff.integration.test.ts
	* apps/server/tests/integration/startup-migration.smoke.test.ts
	* apps/server/tests/integration/tile-persistence.integration.test.ts
	* apps/server/tests/load/region-diff-load.ts
	* apps/server/tests/load/room-join-load.ts
	* apps/server/tests/unit/auth-middleware.test.ts
	* apps/server/tests/unit/region-diff.service.test.ts
	* docs/layer1-backlog.md
	* packages/shared-types/src/index.ts

Dependency and infrastructure changes:
* Added CI fail-fast database precondition gate for DB-backed integration jobs.
* Introduced shared DB integration test guard helper for local skip semantics.

Validation outcomes:
* `npm run lint` passed
* `npm run build` passed
* `npm run test` passed (with expected DB-guarded integration skips in local environment)
