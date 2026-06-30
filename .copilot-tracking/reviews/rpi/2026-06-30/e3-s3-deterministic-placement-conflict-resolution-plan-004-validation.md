<!-- markdownlint-disable-file -->
# RPI Validation: E3-S3 Deterministic Placement Conflict Resolution (Phase 4)

## Metadata

* Validation Date: 2026-06-30
* Plan: .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md
* Changes Log: .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md
* Research: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md
* Phase Number: 4
* Validator Mode: RPI Validator

## Phase Scope Validated

Phase 4 requirements validated from plan/details:

* Step 4.1: Unit tests for winner rule and command-idempotency branches
* Step 4.2: Integration race simulation for simultaneous claims and same-command retries
* Step 4.3: Load hotspot conflict and retry-storm validation, including telemetry consistency
* Step 4.4: Validation via server unit, integration, and load suites

Primary references:

* .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md:95
* .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md:101
* .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:203
* .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:220
* .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:238

## Checklist-to-Implementation Validation

### Step 4.1 Unit coverage

Result: Partially implemented.

Evidence of completion:

* Unit suite exists and executes (4 tests passed):
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:187
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:361
  * Command run: `npm run -w @game/server test -- tests/unit/tile.repository.command-ledger.test.ts`
* Tests cover replay behavior and no duplicate side effects via repository state counters:
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:355
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:420
* Tests cover mismatch branch and deterministic winner metadata:
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:225
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:309

Gap:

* Step 4.1 success criteria explicitly expects deterministic mismatch conflict code assertion, but unit tests assert repository reason only (`command_payload_mismatch`) and do not assert HTTP conflict code contract.
  * Required criteria: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:212
  * Observed assertion: apps/server/tests/unit/tile.repository.command-ledger.test.ts:302

Assessment: Unit branch behavior is substantially covered, but criteria wording for conflict code assertion is only indirectly covered outside this unit suite.

### Step 4.2 Integration race simulation and retry safety

Result: Partially implemented.

Evidence of completion:

* Integration suite exists and executes (3 tests passed):
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:17
  * Command run: `npm run -w @game/server test -- placement-conflict-resolution.integration.test.ts`
* Same-command retry and payload mismatch tests use real repository path (default repository argument):
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:61
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:238
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:304

Gap:

* The simultaneous-claims race test is not exercising real persistence conflict resolution. It injects a mocked `ITileRepository` (`deterministicRaceRepository`) and verifies HTTP mapping only; database side effects are expected to remain zero (`tileCount == 0`).
  * Mocked repository injection: apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:126
  * App wiring to mocked repo: apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:167
  * Zero persisted tiles assertion: apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:233

Assessment: Retry and mismatch integration coverage is real. Concurrent race behavior is simulated at route-contract level, not integrated through real repository transaction/unique-constraint behavior.

### Step 4.3 Load hotspot/retry-storm and telemetry consistency

Result: Partially implemented.

Evidence of completion:

* Load suite file exists and runs under `test:load` (suite passed in current run).
  * apps/server/package.json:13
  * apps/server/tests/load/placement-conflict-hotspot.load.ts:17
  * Command run: `npm run -w @game/server test:load -- placement-conflict-hotspot.load.ts`
* Retry-storm scenario uses real repository default and validates bounded side effects.
  * apps/server/tests/load/placement-conflict-hotspot.load.ts:61
  * apps/server/tests/load/placement-conflict-hotspot.load.ts:216
  * apps/server/tests/load/placement-conflict-hotspot.load.ts:285

Gaps:

* Hotspot contention scenario uses mocked `ITileRepository` and asserts zero tile writes, so it does not validate real storage conflict arbitration under load.
  * Mocked hotspot repository: apps/server/tests/load/placement-conflict-hotspot.load.ts:125
  * Zero persisted tiles assertion: apps/server/tests/load/placement-conflict-hotspot.load.ts:211
* Step 4.3 success criteria requires telemetry counter consistency; this load suite does not assert telemetry counters for `placement_conflict_detected`/`placement_conflict_resolved`.
  * Required criteria: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:247
  * Observed assertions focus on status/body/DB counts only: apps/server/tests/load/placement-conflict-hotspot.load.ts:189, apps/server/tests/load/placement-conflict-hotspot.load.ts:269

Assessment: Retry-storm side-effect bounding is validated. Hotspot contention and telemetry consistency are not fully evidenced against real repository/telemetry behavior.

### Step 4.4 Phase validation commands

Result: Implemented with current-session evidence.

Evidence:

* Unit test command passed:
  * `npm run -w @game/server test -- tests/unit/tile.repository.command-ledger.test.ts`
* Integration test command passed:
  * `npm run -w @game/server test -- placement-conflict-resolution.integration.test.ts`
* Load command passed:
  * `npm run -w @game/server test:load -- placement-conflict-hotspot.load.ts`

Assessment: Validation commands were executed successfully in this session, but passing status does not eliminate the functional-evidence gaps above.

## Severity-Graded Findings

### Critical

* None.

### Major

1. Concurrent race simulation claim is unsupported at persistence-integration level.

* Why: The key race test for simultaneous same-coordinate claims uses an injected mock repository and explicitly expects no tile persistence.
* Evidence:
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:126
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:167
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:233
* Plan/claim impact:
  * Step 4.2 requires integration race simulation for simultaneous claims: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:222
  * Changes log claims race coverage complete: .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md:18

2. Load hotspot contention is not validated against real repository behavior.

* Why: The hotspot load scenario uses mocked repository behavior and asserts zero persisted tiles.
* Evidence:
  * apps/server/tests/load/placement-conflict-hotspot.load.ts:125
  * apps/server/tests/load/placement-conflict-hotspot.load.ts:211
* Plan/claim impact:
  * Step 4.3 requires hotspot conflict validation: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:240
  * Changes log claims hotspot validation complete: .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md:19

3. Telemetry consistency requirement in load phase is not evidenced.

* Why: No assertions for conflict telemetry counters in the hotspot load suite.
* Evidence:
  * Required criterion: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:247
  * Existing checks are response/DB only: apps/server/tests/load/placement-conflict-hotspot.load.ts:195, apps/server/tests/load/placement-conflict-hotspot.load.ts:269

### Minor

1. Step 4.1 success criterion wording expects deterministic conflict code assertion in unit phase, but unit assertions are at repository-reason level.

* Evidence:
  * Criterion: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:212
  * Test assertion: apps/server/tests/unit/tile.repository.command-ledger.test.ts:302
* Note: HTTP conflict code coverage exists in integration mismatch test (route level), reducing risk:
  * apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:346

### Info

1. Phase 4 test files are executable and currently passing in this environment.

* Unit: 1 file, 4 passed
* Integration: 1 file, 3 passed
* Load command included 5 files, 16 passed, including placement conflict hotspot suite

2. Changes log statement "Phases 1 through 4 are complete" is directionally true for artifact presence and command execution, but overstates evidence depth for race/hotspot realism and telemetry counter checks.

* Claim: .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md:9

## Omissions, Deviations, and Regression Check

* Omission: Missing real persistence-backed concurrent race integration test for same-cell claims.
* Omission: Missing telemetry counter consistency assertions in load hotspot test.
* Deviation: Hotspot/race validation uses mocked repositories in scenarios expected to validate persistence behavior.
* Regression check: No direct regressions identified from Phase 4 test additions; route contract checks for retry/mismatch appear stable.

## Coverage Assessment

* Step 4.1: Partial (branch behavior covered; conflict-code criterion only indirectly covered)
* Step 4.2: Partial (retry/mismatch real; race scenario mocked)
* Step 4.3: Partial (retry-storm real; hotspot mocked; telemetry consistency not asserted)
* Step 4.4: Complete (commands ran and passed)

Overall Phase 4 coverage: Partial (approximately 65-75% against plan/detail intent).

## Phase Verdict

Needs Rework.

Rationale:

* Major evidence gaps remain for the highest-risk Phase 4 outcomes: real concurrent race resolution and hotspot telemetry consistency.
* Current passing tests demonstrate contract behavior and retry idempotency, but do not fully validate the production persistence/telemetry through-line required by Phase 4 criteria.

## Recommended Next Validations

* [ ] Add a persistence-backed integration race test that uses real `TileRepository` for both contenders and asserts exactly one persisted tile plus deterministic loser payload.
* [ ] Replace or complement mocked hotspot load scenario with real repository contention assertions under concurrent requests.
* [ ] Add explicit telemetry counter assertions in load/integration scenarios for `placement_conflict_detected` and `placement_conflict_resolved` parity/invariants.
* [ ] Re-run and archive targeted commands after adding above tests:
  * `npm run -w @game/server test -- placement-conflict-resolution.integration.test.ts`
  * `npm run -w @game/server test:load -- placement-conflict-hotspot.load.ts`

## Clarifying Questions

1. For Phase 4 acceptance, do you require real database conflict arbitration in the race/hotspot tests, or is route-contract simulation with mocked repositories acceptable?
2. What telemetry invariant should be enforced for hotspot scenarios (for example, detected equals resolved, or resolved less than or equal to detected)?
3. Should `test:load` remain broad (`vitest run tests/load`) or be narrowed for phase validation to avoid unrelated suite noise?
