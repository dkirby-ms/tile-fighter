<!-- markdownlint-disable-file -->
# Task Research: story(layer1) E2-S1 tile persistence schema and constraints (Issue #13)

Research objective: determine what is needed to implement the tile persistence schema and database constraints described by GitHub Issue #13 in dkirby-ms/tile-fighter.

## Task Implementation Requests

* Identify concrete schema, migration, and constraint changes needed for Issue #13.
* Identify impacted server modules, shared types, and tests.
* Recommend one implementation approach with rationale and execution checklist.

## Scope and Success Criteria

* Scope: repository analysis for persistence, migrations, room/session domain, and related tests; issue analysis for acceptance intent.
* Assumptions: issue #13 is on main repository branch and current workspace mirrors repository state closely.
* Success Criteria:
  * Explicit required DDL and migration shape is documented.
  * Constraint and indexing recommendations are tied to gameplay/state requirements.
  * Test coverage additions are specified for integration and unit scope.

## Outline

1. Collect authoritative issue requirements and existing persistence architecture.
2. Map where tile state is represented (or missing) across server and shared packages.
3. Evaluate implementation alternatives for schema and constraints.
4. Select one approach and provide implementation-ready guidance.

## Potential Next Research

* Confirm expected tile/state cardinality and lifecycle from design docs.
  * Reasoning: drives key shape, uniqueness constraints, and archival strategy.
  * Reference: docs/game-design-document.md

## Research Executed

### File Analysis

* docs/layer1-backlog.md
  * E2-S1 backlog entry mirrors Issue #13 acceptance criteria: persist tile fields, deterministic duplicate-coordinate conflict, and region/coordinate indexes.
* apps/server/src/persistence/migrations/1710000000000_init.js
  * Current schema creates only match_events table and room_id/tick index; no tiles table exists.
* apps/server/src/persistence/db.ts
  * ServerDatabase currently types only match_events, so tile persistence requires DB type extension.
* apps/server/src/index.ts
  * DB runtime is already initialized and attached to server startup, so repository integration can reuse existing connection path.
* apps/server/src/rooms/arena.state.ts
  * Runtime state is in-memory combat counters only; no tile entity model.
* apps/server/src/domain/combat-simulation.service.ts
  * Simulation mutates transient state only; no persistence writes.
* apps/server/src/http/routes/session.routes.ts
  * Session routes include bootstrap/join-token/heartbeat only; no tile placement persistence route currently exists.
* packages/shared-types/src/index.ts
  * Shared contracts currently focus on auth/session/readiness/match tick snapshot; no tile persistence contract.
* apps/server/tests/**
  * No tests currently validate tile schema, repository conflict mapping, or startup migration smoke for tiles.

### Code Search Results

* Search term: tile persistence table
  * Result: no existing tile repository/table implementation under apps/server/src.
* Search term: match_events
  * Result: concentrated in initial migration and DB typing; confirms persistence surface is minimal today.
* Search term: createDatabaseRuntime
  * Result: runtime wiring present in startup path, enabling straightforward repository insertion.
* Search term: migration/integration tests
  * Result: no existing tile migration conflict coverage.

### External Research

* GitHub issue fetch: dkirby-ms/tile-fighter#13
  * Confirmed requirements:
    * Persist shape, color, position, owner, created_at
    * Duplicate coordinate insert yields deterministic conflict response
    * Migration creates region and coordinate lookup indexes
    * Add unit + integration + startup smoke coverage
    * Emit tile_persisted and tile_persist_conflict telemetry
    * Enforce parameterized queries and server-owned owner identity

### Project Conventions

* Standards referenced: existing Kysely + node-pg-migrate patterns in apps/server/src/persistence.
* Instructions followed: Task Researcher mode constraints (research-only edits in .copilot-tracking/research/).

## Key Discoveries

### Project Structure

* Persistence currently has a single baseline migration and one typed DB map.
* Server runtime already wires DB and route modules; tile persistence can be introduced as an additional repository/service without startup redesign.
* Domain and room state are transient, so Issue #13 is foundational schema/repository work rather than state synchronization work.

### Implementation Patterns

* Existing persistence favors explicit migrations and typed DB table contracts.
* Integration entry points are centralized (server bootstrap), enabling incremental repository injection.
* Existing tests are grouped by unit/integration/load, so tile story tests should follow this split.

### Complete Examples

```ts
type InsertTileInput = {
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: Record<string, unknown>;
  ownerId: string; // server derived from authenticated principal
};

type InsertTileResult =
  | { ok: true; tile: { id: number; createdAt: string } }
  | { ok: false; reason: "coordinate_conflict" };
```

### API and Schema Documentation

* Required table fields from issue/backlog: shape, color, position, owner, created_at.
* Required deterministic conflict behavior: unique occupancy constraint on coordinate within region.
* Required indexing: region and coordinate lookup support.

### Finalized Hybrid Decisions

* Authoritative placement model:
  * integer grid coordinates `cell_x`, `cell_y`
  * `CELL_SIZE = 1.0` (render zoom does not affect authority model)
* Visual expression model:
  * `offset_x`, `offset_y` constrained to $-0.49 \le offset \le 0.49$
  * `style_payload` stored as `jsonb`
* World bounds:
  * unbounded for v0 (with explicit hook for future per-region bounds)
* Legal placement remains deterministic from authoritative occupancy only; style payload never overrides legality.

### Configuration Examples

```sql
create table tiles (
  id bigserial primary key,
  region_id text not null,
  cell_x integer not null,
  cell_y integer not null,
  offset_x double precision not null default 0,
  offset_y double precision not null default 0,
  shape text not null,
  color text not null,
  style_payload jsonb not null default '{}'::jsonb,
  owner_id text not null,
  created_at timestamptz not null default now()
);

alter table tiles
  add constraint tiles_region_coordinate_unique unique (region_id, cell_x, cell_y);

alter table tiles
  add constraint tiles_offset_x_range check (offset_x >= -0.49 and offset_x <= 0.49);

alter table tiles
  add constraint tiles_offset_y_range check (offset_y >= -0.49 and offset_y <= 0.49);

create index tiles_region_lookup_idx on tiles (region_id);
create index tiles_coordinate_lookup_idx on tiles (region_id, cell_x, cell_y);
```

## Technical Scenarios

### Tile persistence schema and constraints

Issue #13 requires durable tile occupancy with deterministic conflict handling. The current system has no tile table and no tile persistence path; therefore the minimal viable implementation is a dedicated tiles table with strict coordinate uniqueness per region plus repository-level error translation.

**Requirements:**

* Persist tile placement with shape/color/position/owner/created_at.
* Reject duplicate coordinate inserts deterministically.
* Create migration indexes for region and coordinate lookup.
* Implement repository and parameterized DB access.
* Ensure owner identity is server-derived, not client-controlled.
* Add unit, integration, and startup smoke coverage.
* Emit tile_persisted and tile_persist_conflict events.

**Preferred Approach:**

* Canonical hybrid table with unique constraint on (region_id, cell_x, cell_y), offset range checks, jsonb style payload, and repository mapping of SQLSTATE 23505 + constraint name to coordinate_conflict.

```text
apps/server/src/persistence/migrations/<next>_tiles.js
apps/server/src/persistence/db.ts
apps/server/src/persistence/tile.repository.ts
apps/server/tests/unit/tile.repository.test.ts
apps/server/tests/integration/tile-persistence.integration.test.ts
apps/server/tests/integration/startup-migration.smoke.test.ts
packages/shared-types/src/index.ts (if tile DTO/result contracts are shared)
```

**Implementation Details:**

1. Add a new migration creating tiles table and indexes, including unique coordinate occupancy constraint.
2. Extend ServerDatabase typing with tiles table schema.
3. Implement tile repository insert with parameterized Kysely query and deterministic conflict mapping.
4. Emit persistence telemetry on success/conflict in the application service path.
5. Add tests:
   * Unit: repository conflict translation and persisted payload mapping.
   * Integration: migration creates table/indexes and duplicate insert returns deterministic conflict.
   * Smoke: startup migration path succeeds with the new migration in place.
6. Keep owner identity sourced from authenticated server principal only.
7. Lock constants in code/config:
  * `CELL_SIZE = 1.0`
  * `MAX_VISUAL_OFFSET = 0.49`
  * authoritative integer coordinates (`cell_x`, `cell_y`)
  * unbounded world for v0

```ts
if (error.code === "23505" && error.constraint === "tiles_region_coordinate_unique") {
  return { ok: false, reason: "coordinate_conflict" } as const;
}
throw error;
```

#### Considered Alternatives

* Alternative A (selected): canonical tiles table + unique occupancy constraint.
  * Benefits: lowest complexity, direct AC coverage, deterministic conflict by design, easy indexing and testability.
  * Tradeoffs: no built-in historical revision trail.
* Alternative B (not selected): event-sourced tile placement events + projection/read model.
  * Benefits: strong historical/audit model.
  * Tradeoffs: significantly higher complexity and risk for E2-S1, more moving parts for deterministic conflict guarantees.

## Selected Approach

Select Alternative A with hybrid expression support: canonical tiles table with strict DB uniqueness on (region_id, cell_x, cell_y), offset constraints, jsonb style payload, and repository-level deterministic conflict translation.

Rationale:
* Exactly matches Issue #13 acceptance criteria and technical notes.
* Aligns with current architecture maturity (single DB runtime, minimal persistence layer today).
* Supports bounded implementation scope for this story while preserving future extension options (history/edit windows in later stories).

## Risks and Mitigations

* Risk: non-deterministic conflict behavior if relying on DB message text.
  * Mitigation: match SQLSTATE 23505 and specific constraint name.
* Risk: owner spoofing if owner_id accepted from client payload.
  * Mitigation: derive owner_id from authenticated principal on server.
* Risk: unclear region identifier semantics can create index/churn.
  * Mitigation: lock canonical region_id definition before migration rollout.
* Risk: deploy-time migration regressions.
  * Mitigation: add startup migration smoke test in CI path.

## Open Questions

* What is canonical region_id (room id vs world shard id)?
* Should shape/color constraints be DB-level now (CHECK/enum) or app-level only in E2-S1?
* Should owner_id remain a single tenant-scoped subject string or be normalized fields?
* For E2-S2 edits, will tiles mutate in-place or use revision rows?

## Resolved Decisions

* Adopt hybrid model: strict authoritative occupancy + flexible expression payload.
* Use integer authoritative grid coordinates: `cell_x`, `cell_y`.
* Set `CELL_SIZE = 1.0`.
* Set maximum visual offsets to $\pm 0.49$ per axis.
* Store expression payload in `jsonb` (`style_payload`).
* Start with unbounded world coordinates for v0.

## Evidence Log

* docs/layer1-backlog.md:117-130
  * Backlog acceptance details mirror Issue #13 requirements.
* apps/server/src/persistence/migrations/1710000000000_init.js:7
  * Baseline migration creates match_events only.
* apps/server/src/persistence/migrations/1710000000000_init.js:31
  * Existing index is for match_events room/tick only.
* apps/server/src/persistence/db.ts:13-14
  * ServerDatabase has only match_events table typing.
* apps/server/src/index.ts:21-22
  * DB runtime initialized at startup.
* apps/server/src/rooms/arena.state.ts:3-11
  * In-memory combat state only.
* apps/server/src/domain/combat-simulation.service.ts:4-12
  * Simulation updates transient fields, no persistence.
* apps/server/src/http/routes/session.routes.ts:50
  * Session bootstrap route present; no tile route module.
* apps/server/src/http/routes/session.routes.ts:101
  * Join token route present.
* apps/server/src/http/routes/session.routes.ts:139
  * Heartbeat route present.
* GitHub issue dkirby-ms/tile-fighter#13
  * Story acceptance, telemetry, and security requirements confirmed.
