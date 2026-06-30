<!-- markdownlint-disable-file -->
# RPI Validation: E3-S3 Deterministic Placement Conflict Resolution (Phase 3)

## Metadata

* Validation Date: 2026-06-30
* Plan: .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md
* Changes Log: .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md
* Research: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md
* Phase Number: 3
* Validator Mode: RPI Validator

## Phase Scope Validated

Phase 3 requirements validated from plan and detail artifacts:

* Step 3.1: Add placement conflict telemetry event emitters and integration points.
* Step 3.2: Enforce replay-window checks and cleanup hooks for ledger growth control.
* Step 3.3: Validate phase changes with lint and targeted telemetry/replay checks.

Primary references:

* .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md:82
* .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md:86
* .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md:88
* .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:149
* .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:168

## Checklist-to-Implementation Validation

### Step 3.1 Telemetry emitters and integration points

Result: Implemented with evidence.

Evidence:

* Telemetry event helpers exist:
  * apps/server/src/telemetry/telemetry-sink.ts:164 (`emitPlacementConflictDetected`)
  * apps/server/src/telemetry/telemetry-sink.ts:189 (`emitPlacementConflictResolved`)
* Repository integration points emit both required events:
  * apps/server/src/persistence/tile.repository.ts:387 (detected on fresh conflict)
  * apps/server/src/persistence/tile.repository.ts:425 (resolved on fresh conflict)
  * apps/server/src/persistence/tile.repository.ts:529 (resolved on replayed conflict)
* Unit tests cover fresh conflict telemetry emission counts:
  * apps/server/tests/unit/tile.repository.telemetry.test.ts:7
  * apps/server/tests/unit/tile.repository.telemetry.test.ts:127
  * apps/server/tests/unit/tile.repository.telemetry.test.ts:128

Assessment: Meets Step 3.1 intent.

### Step 3.2 Replay-window enforcement and purge hooks

Result: Partially implemented.

Evidence of implemented portions:

* Replay-window branch logic exists:
  * apps/server/src/persistence/tile.repository.ts:274 (`existing.expires_at > now` replay path)
  * apps/server/src/persistence/tile.repository.ts:289 (`existing.expires_at <= now` stale reset path)
* Ledger expiration timestamp is consistently recalculated:
  * apps/server/src/persistence/tile.repository.ts:575
  * apps/server/src/persistence/tile.repository.ts:604
  * apps/server/src/persistence/tile.repository.ts:637
* Migration hook purges expired command rows:
  * apps/server/src/persistence/migrate.ts:11
  * apps/server/src/persistence/migrate.ts:22
  * apps/server/src/persistence/migrate.ts:23

Gaps found:

* Runtime replay-window config is defined but not wired into repository construction:
  * Config definition and mapping exist:
    * apps/server/src/config/env.ts:34
    * apps/server/src/config/env.ts:120
  * Repository accepts configurable replay window:
    * apps/server/src/persistence/tile.repository.ts:170
    * apps/server/src/persistence/tile.repository.ts:171
  * Bootstrap does not pass `runtimeConfig.placementCommandReplayWindowSeconds`:
    * apps/server/src/index.ts:35
* No direct automated test evidence for expired-command replay-window behavior:
  * Existing command-ledger tests show only non-expired ledger rows (`2099-01-01`), not expired branch coverage:
    * apps/server/tests/unit/tile.repository.command-ledger.test.ts:212
    * apps/server/tests/unit/tile.repository.command-ledger.test.ts:276
  * Search across server tests found no explicit placement-command expiry scenario test.

Assessment: Step 3.2 is functionally present but not fully validated against configured runtime behavior or expiry-branch tests.

### Step 3.3 Validation of phase changes

Result: Partial evidence only.

Evidence:

* Telemetry-focused unit test file exists and validates conflict telemetry emission:
  * apps/server/tests/unit/tile.repository.telemetry.test.ts:1
* Changes log states a prior telemetry command gap was resolved in later phase work:
  * .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md:48

Gap:

* No execution artifacts were provided in this validation scope to prove all Step 3.3 commands were run for Phase 3 specifically.

Assessment: Validation evidence is incomplete from artifact-only inspection.

## Severity-Graded Findings

### Major

1. Replay-window runtime configuration is not applied at server bootstrap.

* Requirement impact: Violates intent to enforce replay-window checks according to configured window policy.
* Expected by plan/details: Step 3.2 references configured replay window and abuse controls.
* Evidence:
  * apps/server/src/config/env.ts:34
  * apps/server/src/config/env.ts:120
  * apps/server/src/persistence/tile.repository.ts:170
  * apps/server/src/persistence/tile.repository.ts:171
  * apps/server/src/index.ts:35
* Why this matters: Production behavior is pinned to default 900 seconds regardless of `PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS` settings.

2. Replay-window expiry branch lacks direct test coverage.

* Requirement impact: Abuse-control behavior is not sufficiently evidenced in tests for expired command identities.
* Evidence:
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:212
  * apps/server/tests/unit/tile.repository.command-ledger.test.ts:276
  * apps/server/src/persistence/tile.repository.ts:289
* Why this matters: Expiry handling is high-risk for deterministic idempotency guarantees and stale replay prevention.

### Info

1. Changes log claim that Phase 3 controls are implemented and validated is only partially supported for replay-window controls.

* Evidence:
  * .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md:9
  * apps/server/src/index.ts:35
* Note: Telemetry controls are implemented and evidenced, but replay-window configurability/test evidence remains incomplete.

## Omissions, Deviations, and Regression Check

* Omission: No explicit expired-command replay-window test case in unit/integration suites.
* Deviation: Configurable replay window is declared but not wired into repository initialization.
* Regression signal: No direct regression found in telemetry emitters; telemetry integration appears additive and scoped.

## Coverage Assessment

* Phase 3.1 (Telemetry): Complete.
* Phase 3.2 (Replay-window + cleanup): Partial.
* Phase 3.3 (Validation evidence): Partial.
* Overall Phase 3 coverage: Partial (approximately 70-80% evidenced).

## Phase Verdict

Needs Rework.

Rationale:

* Major correctness/configuration gap in replay-window runtime wiring.
* Missing direct test evidence for replay-window expiry path required by abuse-control objectives.

## Recommended Next Validations

* [ ] Add and run unit test for expired command replay-window branch (`existing.expires_at <= now`) and assert stale outcomes do not replay.
* [ ] Wire `runtimeConfig.placementCommandReplayWindowSeconds` into `createTileRepository` at bootstrap and verify with test asserting custom window behavior.
* [ ] Re-run targeted Phase 3 validations and capture command outputs for traceability:
  * `npm run -w @game/server lint`
  * `npm run -w @game/server test -- telemetry`
  * Add/execute replay-window-expiry focused test selector.
* [ ] Reconcile changes-log “implemented and validated” wording with evidence after rerun.

## Clarifying Questions

1. Should replay-window duration be fully environment-driven in all runtime environments, or is a fixed 900-second policy intentionally required in production?
2. Is a migration-time purge hook sufficient for abuse-control expectations, or is a recurring operational purge cadence required between migrations?
3. Do you want validation to require attached command output artifacts for each phase checklist validation command going forward?
