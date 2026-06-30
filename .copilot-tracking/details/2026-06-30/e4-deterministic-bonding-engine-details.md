<!-- markdownlint-disable-file -->
# Implementation Details: E4 Deterministic Bonding Engine

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md; .copilot-tracking/research/subagents/2026-06-30/e4-epic-task1-research.md; docs/layer1-backlog.md; .copilot-tracking/github-relationships.md

## Implementation Phase 1: Shared Bond Evaluator and Authoritative Placement Hook

<!-- parallelizable: false -->

### Step 1.1: Add bond types and a pure evaluator in the shared contract layer

Create a shared bonding module that exports the bond type union and a deterministic evaluator function. Keep the evaluator pure, accept the placed tile plus a bounded neighborhood, and canonicalize ordering before rule evaluation so repeated runs produce identical outcomes.

Files:
* packages/shared-types/src/bonding.ts - New bonding rule definitions and evaluator implementation
* packages/shared-types/src/index.ts - Re-export bond types and evaluator for server and future client reuse

Discrepancy references:
* Addresses DD-01 in .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md by choosing the shared-module evaluator path over a server-only implementation

Success criteria:
* The shared module exports `glow-chain`, `blend-gradient`, and `pulse-rhythm` types
* The evaluator returns the same result for equivalent neighborhoods regardless of input order
* The evaluator does not perform I/O or mutate shared state

Context references:
* docs/layer1-backlog.md (Lines 249-263) - E4-S1 acceptance criteria and technical note
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Evidence log and technical scenarios) - Shared-module recommendation and deterministic ordering requirement

Dependencies:
* None beyond the existing shared-types package structure

### Step 1.2: Add bounded neighborhood retrieval and invoke the evaluator after a successful placement commit

Add a small repository helper that collects only the local neighborhood needed by the evaluator, then call the evaluator from the authoritative placement success path after the tile commit has succeeded. Keep the existing placement write path the source of truth and emit the bonding result only from the successful branch.

Files:
* apps/server/src/persistence/tile.repository.ts - Add local neighborhood retrieval helper and return the data needed by the bonding evaluator
* apps/server/src/http/app.ts - Invoke the bonding evaluator after placement success and include the result in the server-side follow-up work

Discrepancy references:
* Addresses DR-01 in .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md by keeping the first implementation focused on server-authoritative behavior rather than client VFX wiring

Success criteria:
* Only nearby tiles are fetched for evaluation input
* Bonding is computed only after a successful authoritative placement commit
* The placement success path remains deterministic and side-effect ordering stays stable

Context references:
* apps/server/src/persistence/tile.repository.ts (Lines 241-343) - Authoritative placement write path
* apps/server/src/http/app.ts (Lines 196-220) - Existing post-commit fanout hook
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Implementation checklist) - Recommended server hook placement

Dependencies:
* Step 1.1 completion

### Step 1.3: Validate phase changes

Run targeted lint and build checks on the shared-types package and the touched server files before expanding to test coverage.

Files:
* packages/shared-types/src/index.ts - Type and export validation target
* apps/server/src/http/app.ts - Server placement hook validation target
* apps/server/src/persistence/tile.repository.ts - Repository helper validation target

Success criteria:
* Shared-types lint and server lint complete without new errors from the bonding changes
* The server build succeeds with the new evaluator import path

Context references:
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Determinism patterns) - Canonical ordering discipline to preserve in the new evaluator

Dependencies:
* Step 1.2 completion

## Implementation Phase 2: Bonding Telemetry and Deterministic Coverage

<!-- parallelizable: true -->

### Step 2.1: Add `bonding_triggered` telemetry support in the server sink

Extend the telemetry sink with a dedicated bonding helper that records the bond type and the placement coordinates using the same deterministic attribute ordering used by other server telemetry events.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add the bonding telemetry method and any supporting payload shape

Discrepancy references:
* Addresses DR-02 in .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md by adding telemetry only on the server side for E4-S1

Success criteria:
* `bonding_triggered` can be emitted with bond type, region, and cell metadata
* The telemetry method is callable from the placement success path without introducing nondeterministic ordering

Context references:
* docs/layer1-backlog.md (Lines 249-263) - Telemetry requirement for E4-S1
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Telemetry gaps) - No existing bonding telemetry method

Dependencies:
* Step 1.2 completion

### Step 2.2: Add unit tests for rule matrix coverage and reorder invariance

Create a unit suite that exercises the three E4-S1 rule cases and verifies that shuffled equivalent neighborhoods produce the same result. Include a property-style corpus of repeated permutations so the test proves deterministic behavior instead of a single example path.

Files:
* apps/server/tests/unit/bonding-evaluator.test.ts - New deterministic rule matrix and reorder-invariance suite

Discrepancy references:
* Addresses DR-03 in .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md by making the determinism assertion explicit in test form

Success criteria:
* Each of the three bond types has a direct unit assertion
* Reordered equivalent inputs always produce the same bond result
* Invalid or out-of-bounds tile attributes are rejected or handled consistently

Context references:
* apps/server/tests/unit/region-diff.service.test.ts (Deterministic ordering pattern) - Example of repeatable sorted-output assertions
* apps/client/tests/unit/replay-checksum.test.ts (Reorder invariance pattern) - Example of permutation-stable deterministic testing

Dependencies:
* Step 1.1 completion

### Step 2.3: Add integration coverage for placement-triggered bonding outcomes

Add an integration test that commits a placement through the server path, observes the resulting bond evaluation, and confirms that the emitted telemetry is tied to the successful placement branch rather than a pre-commit code path.

Files:
* apps/server/tests/integration/tile-bonding-trigger.integration.test.ts - New placement-trigger integration suite

Discrepancy references:
* Addresses DR-04 in .copilot-tracking/plans/logs/2026-06-30/e4-deterministic-bonding-engine-log.md by proving the evaluator is invoked from the authoritative placement path only

Success criteria:
* A successful placement triggers the expected bond type for each scenario corpus
* The integration test confirms telemetry emission only after commit success
* Repeated runs produce identical results for the same fixture inputs

Context references:
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts (Concurrent outcome style) - Existing integration pattern for deterministic server behavior
* .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Technical scenarios) - Scenario A/B/C mapping for E4-S1

Dependencies:
* Steps 1.1 and 1.2 completion

### Step 2.4: Validate phase changes

Run the narrow server unit and integration suites that touch the bonding path before moving to final validation.

Validation commands:
* npm run -w @game/server test -- bonding-evaluator - Runs the new unit corpus for deterministic rule evaluation
* npm run -w @game/server test -- tile-bonding-trigger.integration - Runs the placement-trigger integration suite

## Implementation Phase 3: Validation

<!-- parallelizable: false -->

### Step 3.1: Run full project validation

Execute full lint, build, and test coverage for the modified packages and server path so the bonding engine change is validated end to end.

Validation commands:
* npm run lint - Repo-wide lint sweep
* npm run build - Repo-wide build sweep if present for the workspace
* npm run test - Full test sweep for the workspace

### Step 3.2: Fix minor validation issues

Address small validation failures directly when they are local to the bonding evaluator, server hook, telemetry method, or new tests. Keep any larger follow-up items in the planning log.

### Step 3.3: Report blocking issues

If validation exposes unresolved rule-definition ambiguity or broader contract work, document the blocker and stop short of expanding scope beyond E4-S1.

## Dependencies

* Shared-types package export surface for the evaluator
* Server authoritative placement flow and telemetry sink
* Existing deterministic unit and integration harnesses in apps/server/tests

## Success Criteria

* The bonding evaluator returns stable outcomes for all E4-S1 scenarios and equivalent input permutations
* Placement-triggered bonding emits the required telemetry after commit success and not before
* The new unit and integration suites pass without introducing nondeterministic failures