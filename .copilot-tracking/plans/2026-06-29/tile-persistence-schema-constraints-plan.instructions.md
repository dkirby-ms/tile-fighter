---
applyTo: '.copilot-tracking/changes/2026-06-29/tile-persistence-schema-constraints-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Tile Persistence Schema and Constraints (Issue #13)

## Overview

Implement durable tile occupancy schema with deterministic conflict handling, repository abstraction, and comprehensive test coverage for tile persistence in the tile-fighter game server.

## Objectives

### User Requirements

* Persist tile placement with shape, color, position, owner, and created_at fields — Source: GitHub Issue #13 (dkirby-ms/tile-fighter#13)
* Reject duplicate coordinate inserts deterministically with conflict response — Source: GitHub Issue #13 (dkirby-ms/tile-fighter#13)
* Create migration indexes for region and coordinate lookup — Source: GitHub Issue #13 (dkirby-ms/tile-fighter#13)
* Emit tile_persisted and tile_persist_conflict telemetry events — Source: GitHub Issue #13 (dkirby-ms/tile-fighter#13)
* Add unit, integration, and startup smoke test coverage — Source: GitHub Issue #13 (dkirby-ms/tile-fighter#13)

### Derived Objectives

* Extend ServerDatabase typing with tiles table schema — Derived from: persistence architectural pattern in apps/server/src/persistence/db.ts
* Implement tile repository with parameterized Kysely queries — Derived from: existing persistence patterns and security requirement for server-owned owner identity
* Ensure SQLSTATE 23505 conflict mapping to coordinate_conflict result — Derived from: deterministic error handling requirement from research
* Support hybrid authorization model with cell grid coordinates and visual offset expression — Derived from: game design requirements clarified in research
* Maintain server-owned owner identity enforcement (not client-controlled) — Derived from: security requirement from research findings

## Context Summary

### Project Files

* apps/server/src/persistence/migrations/1710000000000_init.js - Existing baseline migration pattern; tile migration will follow this convention
* apps/server/src/persistence/db.ts - ServerDatabase type definition; requires tiles table schema extension
* apps/server/src/persistence/tile.repository.ts - NEW: Tile repository implementation with Kysely queries
* apps/server/src/domain/combat-simulation.service.ts - Domain service; no changes required (state remains transient)
* apps/server/src/rooms/arena.state.ts - Runtime room state; no changes required (state remains in-memory)
* apps/server/src/http/routes/session.routes.ts - Current routes focus on bootstrap/join-token/heartbeat; NEW: tile placement endpoint planned in follow-on work
* apps/server/src/telemetry/telemetry-sink.ts - Existing telemetry sink; emit tile_persisted and tile_persist_conflict events
* packages/shared-types/src/index.ts - Shared types; add tile DTO and persistence result contracts if needed

### References

* Research file: .copilot-tracking/research/2026-06-29/story-layer1-e2-s1-tile-persistence-schema-and-constraints-research.md (Complete technical scenarios, schema design, and examples)
* Issue tracker: GitHub Issue #13 acceptance criteria
* Design document: docs/game-design-document.md (Tile entity model and game mechanics)
* Backlog: docs/layer1-backlog.md (E2-S1 entry mirrors Issue #13 requirements)

### Standards References

* apps/server/src/persistence/ - Existing Kysely + node-pg-migrate patterns
* apps/server/tests/ - Existing unit/integration/load test split convention
* apps/server/src/persistence/db.ts - TypeScript type definition convention for database schemas

## Implementation Checklist

### [x] Implementation Phase 1: Schema and Migration

<!-- parallelizable: false -->

* [x] Step 1.1: Create tiles table migration
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 15-60)
  * File: apps/server/src/persistence/migrations/1720000000000_tiles.js
* [x] Step 1.2: Extend ServerDatabase typing
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 65-95)
  * File: apps/server/src/persistence/db.ts
* [x] Step 1.3: Validate schema and migration
  * Run database migration in local dev environment
  * Verify table structure: `\d tiles` in psql
  * Verify indexes: `\di tiles*` in psql
  * Verify constraints: `\d tiles` includes region_coordinate_unique and offset range checks

### [x] Implementation Phase 2: Repository Implementation

<!-- parallelizable: true -->

* [x] Step 2.1: Implement tile repository
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 100-145)
  * File: apps/server/src/persistence/tile.repository.ts
* [x] Step 2.2: Add tile repository exports
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 150-155)
  * File: apps/server/src/persistence/db.ts (exports section)
* [x] Step 2.3: Validate phase changes
  * Run `npm run lint --filter=server` in apps/server
  * Run `npm run build --filter=server` in apps/server
  * Skip full test execution; unit/integration tests run in Phase 3

### [x] Implementation Phase 3: Telemetry Integration

<!-- parallelizable: true -->

* [x] Step 3.1: Add tile telemetry events
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 160-175)
  * File: apps/server/src/telemetry/telemetry-sink.ts
* [x] Step 3.2: Update tile repository to emit telemetry
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 180-190)
  * File: apps/server/src/persistence/tile.repository.ts (telemetry integration)
* [x] Step 3.3: Validate phase changes
  * Run `npm run lint --filter=server` in apps/server
  * Run `npm run build --filter=server` in apps/server

### [x] Implementation Phase 4: Test Coverage

<!-- parallelizable: false -->

* [x] Step 4.1: Unit tests for tile repository
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 195-240)
  * File: apps/server/tests/unit/tile.repository.test.ts
* [x] Step 4.2: Integration tests for tile persistence
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 245-295)
  * File: apps/server/tests/integration/tile-persistence.integration.test.ts
* [x] Step 4.3: Startup migration smoke test
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 300-325)
  * File: apps/server/tests/integration/startup-migration.smoke.test.ts
* [x] Step 4.4: Validate test coverage
  * Run `npm run test --filter=server` in apps/server
  * All tile-related tests should pass
  * Verify migration smoke test succeeds

### [ ] Implementation Phase 5: Shared Types (Optional)

<!-- parallelizable: false -->

* [ ] Step 5.1: Add tile DTO and result contracts (if shared)
  * Details: .copilot-tracking/details/2026-06-29/tile-persistence-schema-constraints-details.md (Lines 330-345)
  * File: packages/shared-types/src/index.ts
  * Rationale: Only required if tile contracts are shared across client and server; deferred if tile endpoints remain server-internal for v0
  * **SKIPPED**: Tile endpoints remain server-internal for v0; shared types deferred until HTTP routes are implemented
* [ ] Step 5.2: Validate shared types
  * Run `npm run build --filter=shared-types`

### [x] Implementation Phase 6: Final Validation

<!-- parallelizable: false -->

* [x] Step 6.1: Run full project validation
  * Execute `npm run lint` at workspace root
  * Execute `npm run build` at workspace root
  * Execute `npm run test` at workspace root
* [x] Step 6.2: Fix minor validation issues
  * Iterate on lint errors and build warnings
  * Apply fixes directly when corrections are straightforward
* [x] Step 6.3: Report blocking issues
  * Document issues requiring additional research
  * Provide user with next steps and recommended planning
  * Avoid large-scale fixes within this phase
* [x] Step 6.4: Verify migration executes cleanly
  * Start local dev database
  * Run migrations in order
  * Confirm tiles table exists with all constraints and indexes

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-29/tile-persistence-schema-constraints-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* PostgreSQL database with Kysely ORM
* node-pg-migrate for migration framework
* Existing server infrastructure (DB initialization in apps/server/src/index.ts)
* Vitest for unit and integration testing

## Success Criteria

* Tiles table exists in development database with all required fields and constraints — Traces to: GitHub Issue #13
* Duplicate coordinate inserts yield deterministic conflict response — Traces to: GitHub Issue #13 (deterministic duplicate-coordinate conflict requirement)
* Repository abstraction provides parameterized Kysely queries — Traces to: security requirement for server-owned owner identity enforcement
* Unit tests cover tile repository insert/select/conflict scenarios — Traces to: GitHub Issue #13 (unit test coverage requirement)
* Integration tests cover full persistence lifecycle and startup migration — Traces to: GitHub Issue #13 (integration and startup smoke coverage requirement)
* Telemetry events tile_persisted and tile_persist_conflict are emitted — Traces to: GitHub Issue #13 (telemetry requirement)
* All workspace linting and build passes without errors — Traces to: repository quality standards
