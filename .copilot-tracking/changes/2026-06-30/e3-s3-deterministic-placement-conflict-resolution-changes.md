<!-- markdownlint-disable-file -->
# Release Changes: E3-S3 Deterministic Placement Conflict Resolution

**Related Plan**: e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md
**Implementation Date**: 2026-06-30

## Summary

In progress. Phases 1 through 4 are complete: command contract, deterministic validation, transactional command-ledger mapping, telemetry/replay-window controls, and unit/integration/load coverage are implemented and validated.

## Changes

### Added

* apps/server/src/persistence/migrations/1760000000000_placement_commands.js - Added placement command ledger schema with uniqueness and replay-window indexes
* apps/server/tests/unit/tile.repository.command-ledger.test.ts - Added unit coverage for replay, mismatch, deterministic conflict winner, and no-duplicate-side-effects retry behavior
* apps/server/tests/unit/tile.repository.telemetry.test.ts - Added telemetry-focused unit coverage to make telemetry test filter validation actionable
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts - Added integration race/retry/mismatch coverage for deterministic placement conflict behavior
* apps/server/tests/load/placement-conflict-hotspot.load.ts - Added hotspot contention and retry-storm load scenario validation

### Modified

* packages/shared-types/src/index.ts - Added required placement command identity fields/constants (`commandId`, pattern, min/max length) to shared contract
* apps/server/src/http/routes/tile.routes.ts - Added `commandId` request validation and deterministic malformed identity response (`conflictCode: malformed_command_identity`), and threaded `commandId` into placement input
* apps/server/src/config/env.ts - Added runtime config loading for `PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS`
* apps/server/src/domain/combat-simulation.service.ts - Added deterministic canonical placement payload hashing helper (`hashPlacementCommandPayload`) for replay/idempotency logic
* apps/server/src/persistence/db.ts - Added `placement_commands` database typing and exported insert/select/update types
* apps/server/src/persistence/tile.repository.ts - Added transactional replay/mismatch/fresh-command branches, ledger persistence, and deterministic conflict winner metadata mapping
* apps/server/src/session/session-lifecycle.types.ts - Added deterministic placement outcome types for applied/replay/mismatch/conflict branches
* apps/server/src/http/app.ts - Mapped repository replay/mismatch/conflict outcomes to route dependency response shape
* apps/server/src/telemetry/telemetry-sink.ts - Added `placement_conflict_detected` and `placement_conflict_resolved` event emitters with correlation metadata
* apps/server/src/persistence/migrate.ts - Added migration-safe post-migrate purge hook for expired `placement_commands` rows
* apps/server/src/index.ts - Wired telemetry sink into tile repository construction
* apps/server/tests/load/room-join-load.ts - Updated placement command payloads and occupied-response assertions to current deterministic contract requirements
* apps/server/tests/unit/tile.repository.command-ledger.test.ts - Fixed minor lint issue discovered during full-project validation
* apps/server/src/persistence/db.ts - Corrected ledger table generated primary-key typing (`Generated<number>`) for build correctness

### Removed

* None yet

## Additional or Deviating Changes

* DD-01 partially deviated in repository layer: a legacy fallback command identity path (`legacy-...`) was added for non-route callers/test doubles in tile repository
	* Reason: Preserve compatibility for direct repository invocation paths and lightweight test doubles while HTTP route path still requires `commandId`
* Plan validation command drift: `npm run -w @game/server migrate` is not defined in current workspace scripts
	* Reason: Existing server scripts expose `migrate:up` and `migrate:down`; `migrate:up` was used as equivalent migration validation command
* Phase 3 validation command gap: `npm run -w @game/server test -- telemetry` currently has no matching test files
	* Reason: Resolved in Phase 4 by adding telemetry-focused test coverage and validating the command successfully
* Phase 5 full validation initially surfaced minor lint/build issues, both fixed within scope
	* Reason: Root validation (`npm run lint`, `npm run build`, `npm run test`) exposed one test lint warning and one DB typing mismatch; both were corrected and full validation then passed

## Release Summary

Implemented deterministic placement conflict resolution end-to-end for E3-S3.

Total files affected: 19
* Added: 5
* Modified: 14
* Removed: 0

Key outcomes:
* Enforced required command identity (`commandId`) at placement API boundary with deterministic malformed-identity handling.
* Added canonical placement payload hashing and replay-window runtime configuration.
* Introduced transactional `placement_commands` ledger schema and persistence branches for replay/mismatch/fresh command execution.
* Preserved existing unique-coordinate winner arbitration while adding deterministic loser payload mapping (`placement_conflict_idempotent`).
* Added required telemetry events `placement_conflict_detected` and `placement_conflict_resolved` plus replay-window expiry handling and migration-safe purge hook.
* Added unit, integration, and load coverage for deterministic winner, replay/mismatch idempotency, hotspot contention, and retry-storm behavior.
* Completed root-level validation (`npm run lint`, `npm run build`, `npm run test`) after minor in-scope fixes.

Deployment and operations notes:
* Server migration command naming differs from plan wording (`migrate:up` available, `migrate` alias absent).
* Replay-window defaults are implemented, with longer-term SLO/purge cadence still tracked as follow-on planning work.
