---
title: Persistence Schema and Test Coverage Research for Server-Authoritative Placement
description: Evidence-based analysis of current tile persistence schema, test coverage, and migration/test recommendations for a 10-minute self-edit window and server-authoritative placement.
author: Researcher Subagent
ms.date: 2026-06-29
ms.topic: reference
keywords:
  - tile persistence
  - test coverage
  - migration strategy
  - server authority
  - edit window
estimated_reading_time: 8
---

## Research Scope

* Inspect persistence models, repository, and migrations for fields supporting ownership and edit window enforcement.
* Identify current integration and unit tests for placement, auth, and tile-related behavior.
* Propose additional tests for server-authoritative placement and 10-minute self-edit enforcement.
* Outline migration strategy if schema changes are required.

## Questions

* Which current tile fields can support ownership and a bounded edit window?
* Which tests currently validate tile placement and authentication behavior around placement flows?
* What test gaps exist for update/edit authorization and time-window enforcement?
* What migration approach minimizes risk if new columns or constraints are needed?

## Current Persistence Schema Findings

### Tiles schema and typed model

* The `tiles` table currently includes ownership and creation timestamp fields: `owner_id` and `created_at`.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:47
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:51
  * Evidence: apps/server/src/persistence/db.ts:23
  * Evidence: apps/server/src/persistence/db.ts:24
* No `updated_at`, `last_modified_at`, `modified_by`, or revision/version field exists in the table type.
  * Evidence: apps/server/src/persistence/db.ts:13
  * Evidence: apps/server/src/persistence/db.ts:24
* A unique coordinate constraint exists on `(region_id, cell_x, cell_y)`, which enforces one tile per coordinate.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:59
* Offset bounds are enforced at DB level for placement shape offsets.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:64
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:68

### Repository capabilities and limitations

* The tile repository currently supports only insert and read operations.
  * Evidence: apps/server/src/persistence/tile.repository.ts:40
  * Evidence: apps/server/src/persistence/tile.repository.ts:44
  * Evidence: apps/server/src/persistence/tile.repository.ts:48
* There is no tile update method (no edit operation) in repository interface or implementation.
  * Evidence: apps/server/src/persistence/tile.repository.ts:37
  * Evidence: apps/server/src/persistence/tile.repository.ts:64
  * Evidence: apps/server/src/persistence/tile.repository.ts:142
* Conflict handling maps unique-constraint failures to deterministic `coordinate_conflict`.
  * Evidence: apps/server/src/persistence/tile.repository.ts:101
* Insert result returns `id` and `createdAt`, but no edit metadata.
  * Evidence: apps/server/src/persistence/tile.repository.ts:33
  * Evidence: apps/server/src/persistence/tile.repository.ts:89

### Server authority boundaries in current code

* Room authentication is server-side via join token verification in `ArenaRoom.onAuth`.
  * Evidence: apps/server/src/rooms/arena.room.ts:37
* Current room state and simulation do not model tile placement/edit messages yet.
  * Evidence: apps/server/src/rooms/arena.state.ts:3
  * Evidence: apps/server/src/domain/combat-simulation.service.ts:4
* HTTP routes currently expose session bootstrap, join-token, and heartbeat, but no tile placement/update endpoint.
  * Evidence: apps/server/src/http/routes/session.routes.ts:50
  * Evidence: apps/server/src/http/routes/session.routes.ts:101

## Test Coverage Findings

### Tile persistence tests (integration)

* Integration tests validate tile insertion, coordinate conflict behavior, region isolation, and coordinate lookup.
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:65
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:87
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:220
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:259
* Integration tests verify owner persistence on insert/read.
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:84
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:265
* Integration tests do not cover tile updates or edit-window checks.
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:6

### Tile repository tests (unit)

* Unit tests cover successful insert mapping, deterministic conflict mapping, read-by-region, and read-by-coordinate.
  * Evidence: apps/server/tests/unit/tile.repository.test.ts:10
  * Evidence: apps/server/tests/unit/tile.repository.test.ts:51
  * Evidence: apps/server/tests/unit/tile.repository.test.ts:182
  * Evidence: apps/server/tests/unit/tile.repository.test.ts:246
* Unit tests do not include edit/update methods, because repository has no update API.
  * Evidence: apps/server/tests/unit/tile.repository.test.ts:6

### Auth and session-related tests relevant to server authority

* HTTP auth integration validates unauthorized access handling and authenticated profile/session bootstrap/join-token behavior.
  * Evidence: apps/server/tests/integration/http-auth.integration.test.ts:18
  * Evidence: apps/server/tests/integration/http-auth.integration.test.ts:86
  * Evidence: apps/server/tests/integration/http-auth.integration.test.ts:172
* Join-token integration tests validate authenticated issuance and invalid room input handling.
  * Evidence: apps/server/tests/integration/join-token.integration.test.ts:18
  * Evidence: apps/server/tests/integration/join-token.integration.test.ts:87
  * Evidence: apps/server/tests/integration/join-token.integration.test.ts:125
* Room auth unit test validates join-token verification in room auth flow.
  * Evidence: apps/server/tests/unit/room-auth.test.ts:11
* Auth coverage is strong for session entry, but there is no tile mutation auth test surface yet.

### Migration smoke tests

* Smoke tests verify tiles table existence, schema fields, unique constraint, check constraints, and indexes.
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:30
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:62
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:84
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:100
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:119

## Impact Assessment for 10-Minute Self-Edit and Server-Authoritative Placement

### What already supports the requirement

* Ownership tracking exists via `owner_id`.
* Creation time exists via `created_at`.
* Coordinate uniqueness prevents multiple tiles at same coordinate.
* Existing auth/session flow can provide authenticated subject identity needed for ownership checks.

### What is missing for robust enforcement

* No update path in repository or API/room message handling for edits.
* No persisted edit metadata for subsequent edits (`updated_at` and optionally `updated_by`).
* No server-side rule implementation for: only owner can edit and only within 10 minutes of initial placement.
* No tests that assert rejection codes/reasons for unauthorized editor or expired edit window.

## Proposed Test Cases

### New unit tests

* Repository update success for owner within 10-minute window.
  * Setup: tile created at `now - 9m`; update requested by owner.
  * Expect: update applied; `updated_at` changed; returned result indicates success.
* Repository update denied for non-owner.
  * Setup: tile owner differs from caller subject.
  * Expect: deterministic `forbidden_owner_mismatch` result.
* Repository update denied for window expiry.
  * Setup: tile created at `now - 10m - 1s`; caller is owner.
  * Expect: deterministic `edit_window_expired` result.
* Repository update no-op/not-found path.
  * Setup: missing coordinate or tile ID.
  * Expect: deterministic `not_found` result.

### New integration tests

* End-to-end placement then self-edit inside window.
  * Expect: placement success, edit success, persisted tile reflects updated fields.
* End-to-end edit rejected after 10 minutes.
  * Use controllable clock or explicit DB timestamp setup.
  * Expect: 403/409 (depending on API contract) with stable error code.
* End-to-end edit rejected for non-owner.
  * Place as subject A, edit as subject B.
  * Expect: authorization rejection and no data mutation.
* Server-authoritative coordinate immutability rule (if required).
  * If edits should not move tile coordinates, assert coordinate changes are rejected.
* Concurrency safety test around deadline boundary.
  * Two edit attempts at boundary; only one valid according to server clock.

### Migration smoke test extensions

* Assert new columns exist (for example `updated_at`, optional `updated_by`, optional `edit_window_expires_at`).
* Assert defaults/nullability/indexes match intended query paths.
* Assert data backfill behavior for existing rows if migration sets derived fields.

## Migration Strategy Recommendation

### Suggested schema evolution

* Add minimally required edit metadata columns in a new migration, for example:
  * `updated_at timestamptz null`
  * `updated_by text null` (optional but useful for auditability)
* Keep `created_at` as the anchor for initial 10-minute window logic.
* Consider a generated or explicit `edit_window_expires_at` only if query performance or rule clarity needs it.

### Compatibility and rollout approach

* Use additive migration first (safe forward-compatible change).
* Deploy code that can read old rows where new columns are null.
* Introduce update API/repository logic after migration is applied.
* Optionally backfill `updated_at = created_at` for historical rows if analytics or sorting needs it.
* Keep rollback simple by avoiding destructive changes in initial migration.

### Enforcement location

* Enforce owner + 10-minute window in server-side domain/service logic before persistence write.
* Keep DB as integrity guardrail (constraints/indexes), not primary source of temporal auth logic.
* Use deterministic error codes in repository/service layer to stabilize tests and client handling.

## Clarifying Questions

* Should the 10-minute window be based strictly on placement `created_at`, or reset on every valid self-edit?
* Are edits limited to style fields (`color`, `shape`, `style_payload`, offsets), or can coordinates change?
* Should edit denials be represented as HTTP `403`, `409`, or domain-specific room message errors?
* Is auditability required beyond owner checks (for example, edit history table)?

## Summary

* Current schema and tests cover placement insert/read/conflict and ownership persistence, but not edit/update semantics.
* Ownership and creation timestamp are present and sufficient to start 10-minute self-edit enforcement.
* Implementing server-authoritative placement/edit requires new update paths, explicit server-side policy checks, and focused unit/integration tests for owner and window rules.
