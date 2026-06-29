<!-- markdownlint-disable-file -->

## Issue Requirements

Source of truth issue: dkirby-ms/tile-fighter#13

Title:
story(layer1): E2-S1 tile persistence schema and constraints

Issue body requirements:
- Persist tile entities with ownership and timestamps for durable world state
- Acceptance criteria:
  - Tile placement persistence stores shape, color, position, owner, created_at
  - Duplicate coordinate insert yields deterministic conflict response
  - Migration creates indexes for region and coordinate lookup
- Technical notes: DB migration and repository implementation
- Test requirements:
  - Unit: repository
  - Integration: migration + conflict
  - Smoke: startup migration
- Telemetry events: tile_persisted, tile_persist_conflict
- Security checks: parameterized queries and server-owned owner id
- Dependency: E1-S1

Backlog mirror confirms the same for E2-S1 in docs/layer1-backlog.md:117-130.

## Current State Findings

Persistence and schema today:
- Only one migration exists and it creates match_events:
  - apps/server/src/persistence/migrations/1710000000000_init.js:7
  - apps/server/src/persistence/migrations/1710000000000_init.js:31
- No tile table, no coordinate uniqueness constraints, no region indexes specific to tiles
- DB typing only includes match_events in ServerDatabase:
  - apps/server/src/persistence/db.ts:5
  - apps/server/src/persistence/db.ts:13-14
- Runtime DB wiring exists and is shared globally:
  - apps/server/src/persistence/db.ts:22
  - apps/server/src/index.ts:21-22
  - apps/server/src/index.ts:35

Room and gameplay state today:
- Arena state is purely in-memory simulation counters (tick and health), no tile model:
  - apps/server/src/rooms/arena.state.ts:3-11
  - apps/server/src/domain/combat-simulation.service.ts:4-12
- Arena room initializes in-memory state and simulation interval, but does not persist:
  - apps/server/src/rooms/arena.room.ts:31-33
- Existing HTTP routes are bootstrap/join-token/heartbeat only, no tile placement API:
  - apps/server/src/http/routes/session.routes.ts:50
  - apps/server/src/http/routes/session.routes.ts:101
  - apps/server/src/http/routes/session.routes.ts:139
  - apps/server/src/http/app.ts:23-27

Testing and contracts today:
- No current tests reference match_events or DB runtime in tests:
  - apps/server/tests/** search for match_events|ServerDatabase|createDatabaseRuntime returned no hits
- No tile domain types in shared-types package (only auth/session/readiness and match tick snapshot):
  - packages/shared-types/src/index.ts:13
  - packages/shared-types/src/index.ts:19
- Migration tooling is available via node-pg-migrate scripts:
  - apps/server/package.json:14-15
  - apps/server/src/persistence/migrate.ts:11

## Gaps

Functional gaps against issue #13:
- Missing tile persistence table and constraints
- Missing repository implementation for insert/read conflict handling
- Missing deterministic conflict translation layer from DB uniqueness error
- Missing indexes for region and coordinate lookup on tile data
- Missing tile telemetry emissions for persistence success/conflict
- Missing tests required by story (repository unit, migration+conflict integration, startup migration smoke)

Architectural gaps:
- No tile model in shared types or server domain
- No command handler path yet that persists tile placement and enforces server-owned owner identity
- No fixture/helpers for DB integration tests around tile persistence

## Required Changes

1. Add tile schema migration
- New migration file in apps/server/src/persistence/migrations (next timestamp)
- Create table proposal (minimum fields implied by AC):
  - id (bigserial pk)
  - region_id (text not null)
  - cell_x (integer not null)
  - cell_y (integer not null)
  - offset_x (double precision not null default 0)
  - offset_y (double precision not null default 0)
  - shape (text or constrained enum-like check)
  - color (text or constrained format)
  - style_payload (jsonb not null default '{}'::jsonb)
  - owner_id (text not null) (server-resolved tenantScopedSubject)
  - created_at (timestamptz not null default now())
  - updated_at (timestamptz not null default now()) optional but recommended for forward compatibility
- Constraints/indexes:
  - Unique constraint on (region_id, cell_x, cell_y) for deterministic occupancy conflict
  - Check constraints for offsets: each axis between -0.49 and 0.49
  - Index on (region_id) for region scans/diffs
  - Optional covering index on (region_id, cell_x, cell_y, created_at) for read-heavy paths

2. Lock authoritative constants and coordinate model
- CELL_SIZE = 1.0
- Integer authoritative coordinates (cell_x, cell_y)
- Unbounded world for v0 (future per-region bounds hook)

3. Extend Kysely DB typing
- Update apps/server/src/persistence/db.ts:
  - Add TilesTable type
  - Add tiles table to ServerDatabase export

4. Add repository implementation
- New file likely: apps/server/src/persistence/tile.repository.ts
- Repository responsibilities:
  - insertTile(command): returns persisted row DTO
  - map PG unique violation (SQLSTATE 23505) on (region_id, cell_x, cell_y) to deterministic domain conflict (for stable API behavior)
  - use Kysely parameterized inserts/selects only
- Ensure owner_id is passed from trusted server principal, not client payload

5. Integrate telemetry at persistence boundary
- Emit tile_persisted on successful insert
- Emit tile_persist_conflict on uniqueness conflict
- Most natural injection points:
  - repository caller in command handler (future E2-S2), or
  - repository wrapper service if introduced now

6. Add tests and fixtures
- Unit test:
  - New file likely: apps/server/tests/unit/tile.repository.test.ts
  - Cases: insert success payload mapping, conflict translation, owner handling behavior
- Integration test:
  - New file likely: apps/server/tests/integration/tile-persistence.integration.test.ts
  - Cases: migration creates tiles table/indexes, duplicate coordinate returns deterministic conflict
- Smoke/startup migration:
  - New file likely: apps/server/tests/integration/startup-migration.smoke.test.ts (or existing smoke harness extension)
  - Validate server startup/readiness after migrations include tile schema
- Test data/setup:
  - Add helper(s) for isolated test DB schema reset and migration apply

## Alternatives

### Alternative A: Canonical tiles table with strict unique coordinate constraint (recommended)

Design:
- Single authoritative tiles table with one row per occupied coordinate
- Enforce occupancy by unique (region_id, cell_x, cell_y)
- Preserve artistic flexibility via style_payload jsonb + visual offsets within strict bounds
- Repository catches uniqueness violation and maps to deterministic conflict result

Pros:
- Minimal change set for E2-S1 acceptance criteria
- Deterministic conflict naturally backed by DB constraint
- Efficient lookup for region and coordinate with straightforward indexes
- Easy to test and reason about

Cons:
- Less flexible for future audit/history unless additional event table is added later
- Updates/edits need careful policy handling in E2-S2+

### Alternative B: Event-sourced tile_placement_events + projection/read model

Design:
- Append placement events only
- Build latest occupancy via projection table/materialized view
- Conflict detection via projection uniqueness or transactional check

Pros:
- Strong auditability/history from day one
- Better alignment with future replay/snapshot workflows (E2-S3)

Cons:
- Higher implementation complexity for current story
- More moving parts for deterministic conflict behavior
- Harder to satisfy quick, low-risk E2-S1 delivery with current codebase maturity

## Recommended Approach

Recommendation: Alternative A.

Why:
- Matches current architecture simplicity (single DB runtime + minimal persistence surface)
- Directly satisfies issue #13 acceptance criteria with least risk
- Keeps migration + repository scope bounded to story estimate (3 points)
- Leaves room to layer event history later without blocking E2-S1

Suggested deterministic conflict contract:
- Repository returns typed result union:
  - { ok: true, tile: ... }
  - { ok: false, reason: "coordinate_conflict" }
- Translate DB unique violation code 23505 + index/constraint name guard into coordinate_conflict

Locked v0 constants:
- CELL_SIZE = 1.0
- MAX_VISUAL_OFFSET = 0.49 (applies to each axis: offset_x, offset_y)
- style_payload stored as jsonb
- authoritative coordinates are integer grid cells

## Risks/Pitfalls

- Conflict non-determinism if relying on generic DB error strings instead of SQLSTATE + constraint name
- Owner spoofing risk if API accepts owner from client payload instead of deriving from authenticated principal
- Divergence risk if region key semantics are not standardized before indexing
- Missing startup migration coverage could allow deploy-time failures despite passing unit tests
- Future edit window (E2-S2) may require updated_at semantics; omitting updated_at now may force migration churn soon

## Open Questions

- What is canonical region identifier for Layer 1 tile world:
  - roomId, shard key, or explicit region_id independent of room
- Should shape/color be constrained now (CHECK constraint or enum table) or validated in app only for E2-S1
- Should owner_id store tenantScopedSubject exactly (recommended) or normalized split fields (tenant_id + subject)
- Is tile update/edit in E2-S2 expected to mutate same row or insert new revision rows
- Which existing smoke harness should host startup migration verification (current integration suite vs CI-specific script)

Resolved decisions from strategy workshop:
- Use hybrid persistence model (strict occupancy + flexible expression metadata)
- Authoritative cell size is 1.0
- World is unbounded for v0
- Visual offsets are bounded at +/-0.49
- Expression metadata uses jsonb

## Evidence Log

Issue and backlog evidence:
- GitHub issue fetch (dkirby-ms/tile-fighter#13):
  - Title and AC explicitly require shape/color/position/owner/created_at persistence, duplicate coordinate deterministic conflict, and region+coordinate indexes
  - Test requirements and telemetry/security requirements captured exactly
  - Comments list was empty at fetch time
- docs/layer1-backlog.md:117-130 mirrors E2-S1 details
- docs/layer1-backlog.md:126 states telemetry events tile_persisted and tile_persist_conflict

Current persistence implementation evidence:
- apps/server/src/persistence/migrations/1710000000000_init.js:7 creates match_events only
- apps/server/src/persistence/migrations/1710000000000_init.js:31 creates index on match_events(room_id, tick)
- apps/server/src/persistence/db.ts:13-14 ServerDatabase includes only match_events
- apps/server/src/persistence/db.ts:22 and apps/server/src/index.ts:21-22 show DB runtime available for repository integration
- apps/server/src/persistence/migrate.ts:11 invokes node-pg-migrate CLI

Transient state and missing tile path evidence:
- apps/server/src/rooms/arena.state.ts:3-11 contains tick/player health only
- apps/server/src/domain/combat-simulation.service.ts:4-12 mutates in-memory combat fields only
- apps/server/src/rooms/arena.room.ts:31-33 initializes/simulates state without DB interactions
- apps/server/src/http/routes/session.routes.ts:50,101,139 include only bootstrap/join-token/heartbeat routes
- apps/server/src/http/app.ts:23-27 wires health/protected/session routes, no tile route module

Tests and coverage evidence:
- apps/server/tests/** search for match_events|ServerDatabase|createDatabaseRuntime returned no results
- apps/server/tests/** search for tile-related persistence terms returned only occurrences inside audience string api://tile-fighter-server, not tile schema logic
- apps/server/package.json:14-15 confirms migration scripts exist but no tile-specific test targets

Command/search output summaries used:
- rg scan over apps/server/src, apps/server/tests, packages found persistence concentrated in db.ts + initial migration only
- grep_search for tile terms in apps/server/src returned no tile domain/persistence modules
- grep_search in tests found no DB schema/repository assertions for tile persistence
