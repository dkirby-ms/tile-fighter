<!-- markdownlint-disable-file -->
# Release Changes: E3-S1 Reliable Room Join and Rejoin

**Related Plan**: .copilot-tracking/plans/2026-06-30/e3-s1-reliable-room-join-rejoin-plan.instructions.md
**Implementation Date**: 2026-06-30

## Summary

Implementing checkpoint-backed reconnect and rejoin replay with checksum validation in phased delivery.

## Changes

### Added

* apps/server/src/persistence/migrations/1750000000000_session_checkpoints.js - Added checkpoint schema migration with session checkpoint table, indexes, and tile delta TTL fields.
* apps/server/src/persistence/session-checkpoint.repository.ts - Added repository for checkpoint lifecycle operations (create, stale/restore/archive, progression, retention guards).
* apps/server/src/auth/reconnect-token.service.ts - Added reconnect token issue/verify logic with expiry and replay checks.
* apps/server/src/session/session-checkpoint.service.ts - Added checkpoint orchestration for grace-window reconnect and archival transitions.
* apps/server/src/session/session-lifecycle.types.ts - Added session lifecycle reconnect/checkpoint domain types.
* apps/client/src/session/reconnect-caller.ts - Added reconnect API caller with auth and retry classification.
* apps/client/src/session/replay-checksum.ts - Added deterministic replay apply and full-region checksum parity utilities.
* apps/client/tests/unit/reconnect-caller.test.ts - Added reconnect caller unit coverage.
* apps/client/tests/unit/replay-checksum.test.ts - Added deterministic checksum/replay unit coverage.
* apps/server/tests/integration/join-rejoin.integration.test.ts - Added AC-focused integration coverage for join/rejoin replay behavior and security status mapping.
* apps/server/tests/integration/join-rejoin-smoke.test.ts - Added smoke coverage for disconnect/reconnect timing and stale-session behavior.
* apps/server/tests/load/join-rejoin-load.ts - Added mass reconnect load scenario with retention cleanup verification.

### Modified

* apps/server/src/persistence/db.ts - Extended DB table contracts for session checkpoints and `tile_deltas.ttl_expires_at`.
* apps/server/src/persistence/region-diff.repository.ts - Added retention-aware replay window and cleanup helpers that honor protected checkpoint versions.
* apps/server/src/session/session-lifecycle.service.ts - Integrated checkpoint-aware lifecycle transitions and reconnect state handling.
* apps/server/src/rooms/arena.room.ts - Added rejoin-aware room flow hooks for checkpoint lifecycle.
* apps/server/src/http/routes/session.routes.ts - Added reconnect endpoint and full-region checksum scope response contract.
* apps/server/src/http/app.ts - Wired session reconnect route into the HTTP app.
* apps/server/src/domain/region-diff.service.ts - Added replay orchestration support for reconnect flows.
* apps/server/src/index.ts - Registered reconnect/checkpoint services in server boot composition.
* apps/server/src/config/env.ts - Added reconnect and grace configuration surface.
* apps/server/src/auth/auth-service.ts - Integrated reconnect token validation path.
* apps/client/src/index.ts - Exported reconnect and replay checksum client utilities.
* apps/client/src/session/bootstrap-store.ts - Added reconnect context persistence helpers.
* apps/client/src/session/heartbeat-caller.ts - Added reconnect token extraction and handshake support.
* apps/client/tests/unit/heartbeat-caller.test.ts - Extended heartbeat tests for reconnect token handling.
* apps/server/package.json - Updated test/load command wiring for new join-rejoin load profile.
* apps/server/tests/integration/http-auth.integration.test.ts - Added reconnect tenant-isolation assertions.
* apps/server/tests/integration/join-token.integration.test.ts - Extended security assertions to cover reconnect abuse overlap.
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts - Updated app dependency stubs for checkpoint service injection.
* apps/server/tests/integration/session-bootstrap.integration.test.ts - Updated app dependency stubs for checkpoint service injection.
* apps/server/tests/integration/region-diff.integration.test.ts - Updated app dependency stubs for checkpoint service injection.
* apps/server/tests/integration/region-snapshot-replay.integration.test.ts - Updated app dependency stubs for checkpoint service injection.
* apps/server/tests/load/room-join-load.ts - Updated app dependency stubs for checkpoint service injection.
* apps/server/tests/load/region-diff-load.ts - Updated app dependency stubs for checkpoint service injection.

### Removed

## Additional or Deviating Changes

* Phase 1 validation executed with workspace-scoped server commands.
	* `npm run -w @game/server lint` passed.
	* `npm run -w @game/server build` passed.
* Phase 2 validation executed with workspace-scoped server commands.
	* `npm run -w @game/server lint` passed.
	* `npm run -w @game/server build` passed after fixing one strict optional typing issue in session lifecycle service.
* Phase 3 validation executed with workspace-scoped client commands.
	* `npm run -w @game/client lint` passed.
	* `npm run -w @game/client build` passed.
	* `npm run -w @game/client test` passed.
* Phase 4 validation executed with workspace-scoped server test commands.
	* `npm run -w @game/server test` passed.
	* `npm run -w @game/server test:load` passed.
* Phase 5 full-project validation executed from repository root.
	* `npm run lint` passed.
	* `npm run build` passed.
	* `npm run test` passed.

## Release Summary

Implemented E3-S1 checkpoint-backed reconnect and replay with full-region checksum contract across server and client flows, then added reliability and security validation coverage.

Files affected summary:
* Added: 12 files
* Modified: 23 files
* Removed: 0 files

Functional outcomes:
* Added persistence foundation for `session_checkpoints` and `tile_deltas.ttl_expires_at` with retention-aware repository helpers.
* Added server reconnect token verification, checkpoint lifecycle/orchestration, reconnect endpoint wiring, replay orchestration, and checksum scope contract enforcement.
* Added client reconnect caller/reconnect context handling and deterministic replay checksum validation utilities.
* Added integration, smoke, and load tests for join/rejoin reliability and reconnect abuse cases.

Validation outcomes:
* Phase-local server and client lint/build/test commands passed.
* Final root-level `lint`, `build`, and `test` commands passed.

Deployment/infrastructure notes:
* New DB migration required before server startup in environments that have not yet applied it.
* No external infrastructure changes beyond existing PostgreSQL migration workflow.
