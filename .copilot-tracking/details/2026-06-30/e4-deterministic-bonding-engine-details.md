<!-- markdownlint-disable-file -->
# Implementation Details: E4 Deterministic Bonding Engine

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md; .copilot-tracking/research/subagents/2026-06-30/e4-epic-task1-research.md; docs/layer1-backlog.md; .copilot-tracking/github-relationships.md

## Implementation Phase 1: Shared Bond Evaluator, Route Validation, and Authoritative Placement Hook

<!-- parallelizable: false -->

### Step 1.1: Add bond types and a pure evaluator in the shared contract layer

Implement a shared bonding module that exports the bond type union and a deterministic evaluator function. Keep the evaluator pure, normalize tile input before evaluation, and implement the neighborhood geometry selected by PD-01, defaulting to strict orthogonal adjacency if no further decision is provided.

Files:
* packages/shared-types/src/bonding.ts - New bonding rule definitions, input normalization helpers, and evaluator implementation
* packages/shared-types/src/index.ts - Re-export bond types and evaluator for server and future client reuse

Success criteria:
* The shared module exports `glow-chain`, `blend-gradient`, and `pulse-rhythm` types
* The evaluator returns the same result for equivalent adjacency inputs regardless of input order
* The evaluator does not perform I/O or mutate shared state

Context references:
* docs/layer1-backlog.md (Lines 249-263) - E4-S1 acceptance criteria and pure evaluator requirement
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md - Selected shared-module approach and deterministic ordering requirement

Dependencies:
* None beyond the existing shared-types package structure

### Step 1.2: Add route-level tile attribute bounds validation

Extend the placement request validation path so the server explicitly bounds and validates tile attributes before repository writes or bonding evaluation run. Keep ownership authoritative and treat malformed attributes as request errors rather than evaluator concerns.

Files:
* apps/server/src/http/routes/tile.routes.ts - Tighten tile placement validation for shape, color, coordinates, and any bounded style inputs used by bonding
* packages/shared-types/src/index.ts - Add or align shared constants and types if the route should consume canonical bounds from the shared contract layer

Discrepancy references:
* Resolves DR-01 in .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md by assigning the abuse-check requirement to the actual request-validation path

Success criteria:
* Tile placement rejects out-of-bounds or malformed attributes with deterministic 400 responses
* Bounds validation happens before placement persistence or telemetry emission
* The same bounds surface can be reused by bonding tests

Context references:
* apps/server/src/http/routes/tile.routes.ts (Lines 1-121) - Current route only checks string and integer presence
* docs/layer1-backlog.md (Lines 249-263) - Input bounds validation requirement

Dependencies:
* Step 1.1 completion only if shared bounds constants are introduced; otherwise independent within Phase 1

### Step 1.3: Add bounded neighborhood retrieval and invoke the evaluator after a successful placement commit

Add a repository helper that collects the bounded local neighborhood required by the PD-01 geometry decision, then call the evaluator from the authoritative placement success path after the tile commit succeeds. Emit bond outcomes only from the successful branch and keep the geometry bounded to the minimum window required by the chosen rule interpretation.

Files:
* apps/server/src/persistence/tile.repository.ts - Add local neighborhood retrieval helper and return the data needed by the bonding evaluator
* apps/server/src/http/app.ts - Invoke the bonding evaluator after placement success and stage the result for telemetry or fanout

Discrepancy references:
* Tracks DD-01 in .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md until PD-01 is confirmed or accepted by default

Success criteria:
* Only the tiles required by the selected bounded neighborhood are fetched for evaluation input
* Bonding is computed only after a successful authoritative placement commit
* Placement side-effect ordering stays deterministic across repeated runs

Context references:
* apps/server/src/persistence/tile.repository.ts (Lines 241-343) - Authoritative placement write path
* apps/server/src/http/app.ts (Lines 196-220) - Existing post-commit fanout hook
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md - Recommended server hook placement

Dependencies:
* Step 1.1 completion
* Step 1.2 completion for validated input assumptions

### Step 1.4: Validate phase changes

Run targeted lint and build checks on the shared-types package and the touched server files before expanding to telemetry and test coverage.

Validation commands:
* npm run -w @game/shared-types lint - Shared contract and evaluator export validation
* npm run -w @game/shared-types build - Shared contract compilation check
* npm run -w @game/server lint - Route, repository, and HTTP placement hook validation
* npm run -w @game/server build - Server compilation check for evaluator imports and route validation changes

Success criteria:
* Shared-types lint and build complete without new errors from the bonding changes
* Server lint and build succeed with the new evaluator import path and route validation updates

Context references:
* package.json (Lines 1-18) - Workspace script entrypoints
* apps/server/package.json (Lines 1-31) - Server lint and build commands
* packages/shared-types/package.json (Lines 1-12) - Shared-types lint and build commands

Dependencies:
* Step 1.3 completion

## Implementation Phase 2: Bonding Telemetry and Deterministic Coverage

<!-- parallelizable: true -->

### Step 2.1: Add `bonding_triggered` telemetry support in the server sink

Extend the telemetry sink with a dedicated bonding helper that records the bond type and placement coordinates using stable attribute ordering consistent with existing server telemetry events.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add the bonding telemetry method and supporting payload shape

Success criteria:
* `bonding_triggered` can be emitted with bond type, region, and cell metadata
* The telemetry method is callable from the placement success path without introducing nondeterministic ordering

Context references:
* docs/layer1-backlog.md (Lines 249-263) - Telemetry requirement for E4-S1
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md - No existing bonding telemetry method

Dependencies:
* Step 1.3 completion

### Step 2.2: Add unit tests for rule matrix coverage and reorder invariance

Create a unit suite that exercises the three E4-S1 rule cases and verifies that shuffled equivalent neighborhoods produce the same result. Include a property-style deterministic invariant corpus that repeatedly permutes valid inputs, normalizes equivalent tile sets, and confirms stable results across bounded input variations, plus invalid-input cases tied to the new bounds constants or route validation expectations.

Files:
* apps/server/tests/unit/bonding-evaluator.test.ts - New deterministic rule matrix and reorder-invariance suite
* apps/server/tests/unit/tile.routes.test.ts - Add or extend validation coverage for out-of-bounds tile attributes if no route test exists yet

Success criteria:
* Each of the three bond types has a direct unit assertion
* Reordered equivalent inputs always produce the same bond result
* Property-style invariant cases prove normalization and result stability across repeated bounded-input permutations
* Invalid or out-of-bounds tile attributes are rejected or handled consistently

Context references:
* apps/server/tests/unit/region-diff.service.test.ts - Example of repeatable sorted-output assertions
* apps/client/tests/unit/replay-checksum.test.ts - Example of permutation-stable deterministic testing

Dependencies:
* Steps 1.1 and 1.2 completion

### Step 2.3: Add integration coverage for placement-triggered bonding outcomes

Add an integration test that commits a placement through the server path, observes the resulting bond evaluation, and confirms that both telemetry emission and validation behavior are tied to the authoritative success branch rather than a pre-commit code path.

Files:
* apps/server/tests/integration/tile-bonding-trigger.integration.test.ts - New placement-trigger integration suite

Success criteria:
* A successful placement triggers the expected bond type for each scenario corpus
* The integration test confirms telemetry emission only after commit success
* Invalid placement input fails before persistence and does not emit bonding telemetry
* Repeated runs produce identical results for the same fixture inputs

Context references:
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts - Existing integration pattern for deterministic server behavior
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md - Scenario A/B/C mapping for E4-S1

Dependencies:
* Steps 1.1, 1.2, and 1.3 completion

### Step 2.4: Validate phase changes

Run the narrow server unit and integration suites that touch the bonding path before moving to final validation.

Validation commands:
* npm run -w @game/server test -- bonding-evaluator - Runs the unit and property-style deterministic invariant corpus
* npm run -w @game/server test -- tile.routes - Runs route-level bounds validation coverage if the suite is added or extended
* npm run -w @game/server test -- tile-bonding-trigger.integration - Runs the placement-trigger integration suite

## Implementation Phase 3: Validation

<!-- parallelizable: false -->

### Step 3.1: Run full project validation

Execute full lint, build, and test coverage for the modified packages and server path so the bonding engine change is validated end to end.

Validation commands:
* npm run lint - Repo-wide lint sweep
* npm run build - Repo-wide build sweep
* npm run test - Full test sweep for the workspace

### Step 3.2: Fix minor validation issues

Address small validation failures directly when they are local to the bonding evaluator, route validation, server hook, telemetry method, or new tests. Keep larger follow-up items in the planning log.

### Step 3.3: Report blocking issues

If validation exposes unresolved contract or downstream client-integration work, document the blocker and stop short of expanding scope beyond E4-S1.

## Dependencies

* Shared-types package export surface for the evaluator and bounds constants
* Server authoritative placement flow, route validation path, and telemetry sink
* Existing deterministic unit and integration harnesses in apps/server/tests

## Success Criteria

* The bonding evaluator returns stable outcomes for all E4-S1 scenarios and equivalent bounded-neighborhood permutations
* Placement-triggered bonding emits the required telemetry after commit success and not before
* Route validation rejects malformed tile attributes before persistence or bonding side effects
* The unit suite includes explicit property-style invariants for normalization and reorder stability, and the new unit and integration suites pass without introducing nondeterministic failures