---
title: Repo Conventions Research for Issue 14
description: Evidence-backed repository conventions and architecture constraints relevant to authoritative placement and 10-minute self-edit window.
author: Researcher Subagent
ms.date: 2026-06-29
ms.topic: reference
keywords:
  - issue-14
  - conventions
  - architecture
  - testing
  - telemetry
estimated_reading_time: 8
---

## Research topics and questions

1. Is there repository-level Copilot guidance to follow before implementation?
2. What conventions exist for server route design?
3. What testing strategy conventions exist for unit, integration, migration, and load?
4. What migration and persistence conventions exist that affect authoritative placement and edit-window policy?
5. What telemetry naming and payload conventions exist?
6. What shared package contracts are expected across server and client?
7. What constraints or conflicts affect implementation approach for issue #14?

## Goal 1 findings: copilot instructions and nearby guidance

### Repository-level Copilot instruction file

* .github/copilot-instructions.md is not present in this repository (workspace search for **/.github/copilot-instructions.md returned no matches, 2026-06-29).

### Nearby guidance files in .github

* .github contains prompts and workflows only from current workspace listing.
* Available prompt files discovered:
  * .github/prompts/colyseus-azure-scaffold.prompt.md
  * .github/prompts/create-game-design-document.prompt.md
* No additional implementation convention file was discovered under .github that supersedes code-level conventions for issue #14.

## Server route design conventions

### HTTP app composition and middleware ordering

* Express app creation follows a constructor/factory pattern with dependency injection through createHttpApp.
  * Evidence: apps/server/src/http/app.ts:10-18
* Route mounting order is explicit and significant:
  * JSON body parser first.
  * Health routes before auth middleware.
  * Global auth middleware before protected and session routes.
  * Evidence: apps/server/src/http/app.ts:22-31
* Route modules are composed through dedicated factory functions per domain area (health, protected, session).
  * Evidence: apps/server/src/http/app.ts:3-5,23,25,27

### Route module style

* Each route module exports createXRoutes() returning Express Router.
  * Evidence: apps/server/src/http/routes/health.routes.ts:4
  * Evidence: apps/server/src/http/routes/protected.routes.ts:3
  * Evidence: apps/server/src/http/routes/session.routes.ts:45
* Input validation pattern is early return with 400 for missing/invalid body fields.
  * Evidence: apps/server/src/http/routes/session.routes.ts:105-113,143-146
* Rate limiting in route layer uses in-memory Map windows keyed by authenticated identity dimensions and returns 429.
  * Evidence: apps/server/src/http/routes/session.routes.ts:13-43,47-48,55-64,148-158
* Authenticated identity is read from res.locals.principal, set by auth middleware.
  * Evidence: apps/server/src/http/routes/session.routes.ts:51,102,140
  * Evidence: apps/server/src/http/auth-middleware.ts:14-16

### Authority boundary conventions

* Auth middleware validates bearer token and blocks unauthorized requests with 401 JSON payload.
  * Evidence: apps/server/src/http/auth-middleware.ts:10-19
* Room admission is server-authoritative via join-token verification in onAuth.
  * Evidence: apps/server/src/rooms/arena.room.ts:37-43
* Room lifecycle emits joined/leave side effects through lifecycle service, not client trust.
  * Evidence: apps/server/src/rooms/arena.room.ts:45-57

## Testing strategy conventions

### Script-level conventions

* Server package standard scripts:
  * unit/integration test runner: vitest run
  * load test script: tests/load/room-join-load.ts
  * migration up/down scripts via tsx + node-pg-migrate wrapper
  * Evidence: apps/server/package.json:8-15

### Integration test conventions

* Integration tests use Vitest + Supertest for HTTP route behavior and auth boundaries.
  * Evidence: apps/server/tests/integration/http-auth.integration.test.ts:1-4
* App-level dependencies are mocked/stubbed at composition boundary (createHttpApp), then assertions are made on status and payload contracts.
  * Evidence: apps/server/tests/integration/http-auth.integration.test.ts:26-40,78-84,118-126,164-170,204-213
* DB-backed integration tests are skip-safe when DB is unavailable, using skipIf and runtime connectivity probes.
  * Evidence: apps/server/tests/integration/tile-persistence.integration.test.ts:15-29,50,87,127,184

### Migration smoke conventions

* Migration smoke tests verify schema-level guarantees directly in information_schema and pg_indexes.
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:33-40,82-88,99-106,120-126
* Expected tile schema assertions include owner_id, created_at, unique coordinate constraint, and offset checks.
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:52-63,95-97,112-118
* Migration tracking via pgmigrations table is validated.
  * Evidence: apps/server/tests/integration/startup-migration.smoke.test.ts:167-179

### Load test conventions

* Load scenarios are executable TS scripts that can auto-start local server, use real auth/bootstrap/join-token HTTP calls, then room join via Colyseus client.
  * Evidence: apps/server/tests/load/room-join-load.ts:76-87,89-95,140-147,160-193
* Metrics captured include p50 and averages across join samples; output can be persisted as evidence artifact.
  * Evidence: apps/server/tests/load/room-join-load.ts:199-226

## Migrations and persistence conventions

### Migration implementation pattern

* Migrations are JavaScript files under src/persistence/migrations with node-pg-migrate up/down exports.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:6,80
* Runtime migration runner loads root .env and spawns node-pg-migrate with inherited stdio and args.
  * Evidence: apps/server/src/persistence/migrate.ts:6-14

### Existing tile schema constraints relevant to issue #14

* Occupancy uniqueness is enforced at DB level by unique constraint on region_id + cell_x + cell_y.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:58-61
* Ownership and placement timestamp already exist as owner_id and created_at.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:47-55
* No updated_at column exists currently, which impacts edit-window semantics depending on policy choice.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:7-55

### Repository behavior conventions

* Tile repository returns discriminated unions for deterministic conflict handling rather than throwing for expected occupancy conflicts.
  * Evidence: apps/server/src/persistence/tile.repository.ts:32-34,106-115
* Coordinate conflict is mapped from SQLSTATE 23505 with constraint-name-aware matching.
  * Evidence: apps/server/src/persistence/tile.repository.ts:93-105
* Current repository supports insert and read queries only; no update method is present for edits.
  * Evidence: apps/server/src/persistence/tile.repository.ts:40-53,64-157

## Telemetry naming conventions

### General sink contract

* Telemetry API shape is eventName + occurredAt + attributes record.
  * Evidence: apps/server/src/telemetry/telemetry-sink.ts:3-7,19-23
* Event names are snake_case strings.
  * Evidence: apps/server/src/http/routes/session.routes.ts:68,90,121,128
  * Evidence: apps/server/src/telemetry/telemetry-sink.ts:65,88
* Attributes mostly use snake_case keys (for example tile_id, region_id, cell_x).
  * Evidence: apps/server/src/telemetry/telemetry-sink.ts:66-71,89-93
* Sink failure behavior is mode-driven (off, optional, required).
  * Evidence: apps/server/src/telemetry/telemetry-sink.ts:25-34,45-47

### Existing tile telemetry naming

* Current tile persistence telemetry wrappers emit tile_persisted and tile_persist_conflict.
  * Evidence: apps/server/src/telemetry/telemetry-sink.ts:58-73,82-95
* Backlog story E2-S2 expects tile_placed, tile_place_rejected, tile_edited for this feature.
  * Evidence: docs/layer1-backlog.md:141

## Shared package contract conventions

### Cross-package dependency intent

* Server consumes shared packages via @game/shared-types and @game/shared-persistence (and shared-auth package dependency for auth utilities).
  * Evidence: apps/server/src/http/app.ts:2
  * Evidence: apps/server/src/persistence/db.ts:3
  * Evidence: apps/server/package.json:22-24

### Current shared contract surface

* shared-types currently exposes auth principal, match snapshot, and readiness report only; no tile DTO/edit policy contract is defined yet.
  * Evidence: packages/shared-types/src/index.ts:3-25
* shared-persistence currently exports migrationsDirectory and readinessSql only.
  * Evidence: packages/shared-persistence/src/index.ts:1-3

## Constraints affecting issue #14 implementation approach

### Constraints from issue-aligned backlog

* E2-S2 acceptance requires:
  * placement accepted with ack when coordinate empty
  * occupied rejection with explicit occupied reason
  * edit denied after 10 minutes
  * unit + integration + load coverage
  * per-account placement rate-limit and server-side owner check
  * telemetry events tile_placed, tile_place_rejected, tile_edited
  * Evidence: docs/layer1-backlog.md:134-143

### Architecture constraints from current code

* There is no existing tile HTTP route module mounted in app composition; implementation must add a new route module and mount order consistent with current auth boundary.
  * Evidence: apps/server/src/http/app.ts:23-31
* There is no existing tile update method in repository, only insert/select methods.
  * Evidence: apps/server/src/persistence/tile.repository.ts:40-53,64-157
* There is no updated_at field in tile schema to anchor edit timestamps if policy requires last-edit tracking.
  * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:7-55
* Current room logic has no tile placement message handlers, so implementation path should choose HTTP command path, room command path, or both explicitly.
  * Evidence: apps/server/src/rooms/arena.room.ts:28-59

## Conflicts with a likely proposed approach

1. Telemetry naming conflict:
   * Existing helpers emit tile_persisted and tile_persist_conflict, but E2-S2 target events are tile_placed, tile_place_rejected, tile_edited.
   * Evidence: apps/server/src/telemetry/telemetry-sink.ts:65,88
   * Evidence: docs/layer1-backlog.md:141

2. Edit-window implementation gap:
   * Current persistence has created_at but no update operation or update timestamp field, so a self-edit flow cannot be implemented with current repository API alone.
   * Evidence: apps/server/src/persistence/migrations/1720000000000_tiles.js:51-55
   * Evidence: apps/server/src/persistence/tile.repository.ts:40-53

3. Authoritative command-surface mismatch:
   * Current server authority patterns are established for auth/session and room join, but there is no tile placement command surface yet (neither HTTP tile route nor room message handler).
   * Evidence: apps/server/src/http/app.ts:23-31
   * Evidence: apps/server/src/rooms/arena.room.ts:37-43

4. Shared contract mismatch risk:
   * shared-types does not currently define tile command/result contracts, which increases duplication risk across client/server if issue #14 introduces API payloads ad hoc.
   * Evidence: packages/shared-types/src/index.ts:3-25

## Clarifying questions discovered during research

1. Should the 10-minute edit window be measured from original created_at only, or reset on each successful edit?
2. Should placement/edit commands be implemented as HTTP endpoints, Colyseus room messages, or an explicitly mirrored dual-surface contract?
3. Should telemetry for placement conflict keep tile_persist_conflict for persistence diagnostics while also emitting tile_place_rejected for product analytics?
4. Is per-account placement rate limit expected to follow existing in-memory route limiter style, or should it be persisted/distributed for multi-instance deployments?

## Research status

* Status: Complete
* Scope completion: all requested convention areas were researched with code evidence and line references.
