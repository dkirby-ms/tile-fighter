<!-- markdownlint-disable-file -->
# Implementation Details: Tile Persistence Schema and Constraints (Issue #13)

## Context Reference

Sources: 
* GitHub Issue #13 (dkirby-ms/tile-fighter#13)
* Research file: .copilot-tracking/research/2026-06-29/story-layer1-e2-s1-tile-persistence-schema-and-constraints-research.md
* Design file: docs/game-design-document.md
* Backlog file: docs/layer1-backlog.md

## Implementation Phase 1: Schema and Migration

<!-- parallelizable: false -->

### Step 1.1: Create tiles table migration

Create a new migration file that defines the tiles table with all required fields, constraints, and indexes based on the schema design finalized in research.

**Migration File: `apps/server/src/persistence/migrations/1720000000000_tiles.js`**

The migration should:
1. Create tiles table with columns: id (bigserial PK), region_id (text NOT NULL), cell_x (integer NOT NULL), cell_y (integer NOT NULL), offset_x (double precision default 0), offset_y (double precision default 0), shape (text NOT NULL), color (text NOT NULL), style_payload (jsonb default '{}'::jsonb), owner_id (text NOT NULL), created_at (timestamptz default now())
2. Add unique constraint on (region_id, cell_x, cell_y) named tiles_region_coordinate_unique
3. Add check constraints for offset_x range [-0.49, 0.49] and offset_y range [-0.49, 0.49]
4. Create index on region_id (tiles_region_lookup_idx)
5. Create composite index on (region_id, cell_x, cell_y) (tiles_coordinate_lookup_idx)

Reference existing pattern in apps/server/src/persistence/migrations/1710000000000_init.js for migration structure.

Files:
* apps/server/src/persistence/migrations/1720000000000_tiles.js - NEW: Migration file with DDL

Success criteria:
* Migration file uses node-pg-migrate exports pattern (exports.up, exports.down)
* All fields match research schema exactly
* Constraints and indexes are named consistently
* Down migration properly reverses all changes

Dependencies:
* None; migration runs independently

### Step 1.2: Extend ServerDatabase typing

Extend the ServerDatabase type definition to include the tiles table schema so Kysely provides full type safety for tile queries.

**File: `apps/server/src/persistence/db.ts`**

Update the Database type to:
1. Import Selectable, Insertable, Updateable from 'kysely'
2. Define TilesTable interface with all columns and their types
3. Add tiles: TilesTable to the Database interface
4. Export TilesTable, TilesInsert, TilesSelect, TilesUpdate types for repository use

Reference existing match_events table typing as pattern.

Files:
* apps/server/src/persistence/db.ts - MODIFY: Add tiles table type definition

Success criteria:
* TilesTable interface exports properly from db.ts
* Kysely type checking works for tile queries
* All column types match migration (e.g., cell_x: number, offset_x: number, created_at: string)
* Insert/Select/Update types are exported

Dependencies:
* Step 1.1: Migration file must exist first

### Step 1.3: Validate schema and migration

Verify migration executes successfully and schema matches requirements.

Validation commands:
* Start local database: `docker-compose up` (ensure database service is running)
* Run migrations: `npm run migrate --filter=server` or equivalent migration runner command in apps/server
* Inspect schema: Connect to local database and run `\d tiles` and `\di tiles*` in psql

Success criteria:
* tiles table exists in local database
* All columns present with correct types
* tiles_region_coordinate_unique constraint exists
* tiles_region_lookup_idx and tiles_coordinate_lookup_idx indexes exist
* Check constraints for offset ranges are present

Dependencies:
* Step 1.1 and 1.2 complete
* Local PostgreSQL database running

## Implementation Phase 2: Repository Implementation

<!-- parallelizable: true -->

### Step 2.1: Implement tile repository

Create tile repository module with parameterized Kysely queries for insert and select operations, including deterministic conflict error mapping.

**File: `apps/server/src/persistence/tile.repository.ts`**

The repository should:
1. Import Db type, TilesTable, TilesInsert, TilesSelect from db.ts
2. Import Database from 'kysely'
3. Define InsertTileInput type with required fields (regionId, cellX, cellY, offsetX, offsetY, shape, color, stylePayload, ownerId)
4. Define InsertTileResult as union: { ok: true; tile: { id: number; createdAt: string } } | { ok: false; reason: "coordinate_conflict" }
5. Implement insert method that:
   * Uses parameterized Kysely query: db.insertInto('tiles').values(input).executeTakeFirstOrThrow()
   * Catches SQLSTATE 23505 (unique violation) with constraint name matching "tiles_region_coordinate_unique"
   * Maps constraint violation to { ok: false, reason: "coordinate_conflict" }
   * Returns { ok: true, tile: { id, createdAt } } on success
6. Implement select methods for region/coordinate lookups using indexed queries
7. Use tileSink parameter for telemetry (to be added in Phase 3)

Reference existing pattern if any repository exists in apps/server/src/persistence/.

Files:
* apps/server/src/persistence/tile.repository.ts - NEW: Repository implementation

Success criteria:
* All queries use parameterized inputs via Kysely (no string interpolation)
* SQLSTATE 23505 is caught and mapped to coordinate_conflict
* Insert returns union result type with ok flag
* Kysely types resolve without @ts-ignore directives
* Repository exports TileRepository class or factory function

Dependencies:
* Step 1.2: ServerDatabase type definition must be complete

### Step 2.2: Add tile repository exports

Export tile repository types and factory from persistence module entry point so server modules can import it.

**File: `apps/server/src/persistence/db.ts`**

Update exports section:
1. Export TileRepository class/factory from tile.repository
2. Export InsertTileInput and InsertTileResult types
3. Update ServerDatabase export or create factory that includes tileRepository method

Files:
* apps/server/src/persistence/db.ts - MODIFY: Add tile repository exports

Success criteria:
* TileRepository can be imported from 'src/persistence/db.ts'
* Types InsertTileInput, InsertTileResult are exported and usable by other modules
* No circular imports between db.ts and tile.repository.ts

Dependencies:
* Step 2.1: Tile repository file exists

### Step 2.3: Validate phase changes

Verify code compiles and lint passes for phase 2 changes.

Validation commands:
* Lint server: `npm run lint --filter=server`
* Build server: `npm run build --filter=server`

Success criteria:
* No TypeScript compilation errors
* No lint errors in modified/new files
* All imports resolve correctly

Dependencies:
* Step 2.1 and 2.2 complete

## Implementation Phase 3: Telemetry Integration

<!-- parallelizable: true -->

### Step 3.1: Add tile telemetry events

Extend telemetry sink to support tile_persisted and tile_persist_conflict events.

**File: `apps/server/src/telemetry/telemetry-sink.ts`**

The telemetry sink should:
1. Define event type: tile_persisted with properties { tileId: number; regionId: string; ownerId: string; timestamp: string }
2. Define event type: tile_persist_conflict with properties { regionId: string; cellX: number; cellY: number; timestamp: string }
3. Add emit methods for each event type
4. Maintain existing event types (do not break existing telemetry)

Reference existing telemetry event patterns in apps/server/src/telemetry/telemetry-sink.ts.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - MODIFY: Add tile event definitions

Success criteria:
* tile_persisted and tile_persist_conflict events are defined
* Event types include required properties
* Telemetry sink maintains backward compatibility
* Events can be emitted without runtime errors

Dependencies:
* None; telemetry integration is independent

### Step 3.2: Update tile repository to emit telemetry

Inject telemetry sink into tile repository and emit events on insert/conflict.

**File: `apps/server/src/persistence/tile.repository.ts`**

Update tile repository:
1. Add telemetrySink as optional parameter to repository factory
2. On successful insert: emit tile_persisted event with { tileId: id, regionId, ownerId, timestamp }
3. On coordinate_conflict: emit tile_persist_conflict event with { regionId, cellX, cellY, timestamp }
4. Handle case where telemetrySink is undefined (optional integration)

Files:
* apps/server/src/persistence/tile.repository.ts - MODIFY: Add telemetry event emission

Success criteria:
* Repository accepts telemetrySink as injected dependency
* Events are emitted with correct properties
* Telemetry integration is optional (non-breaking)
* No runtime errors when telemetrySink is undefined

Dependencies:
* Step 3.1: Telemetry sink events must be defined
* Step 2.1: Tile repository file exists

### Step 3.3: Validate phase changes

Verify lint and build pass for telemetry integration changes.

Validation commands:
* Lint server: `npm run lint --filter=server`
* Build server: `npm run build --filter=server`

Success criteria:
* No TypeScript compilation errors
* No lint errors in modified files
* Telemetry imports resolve correctly

Dependencies:
* Step 3.1 and 3.2 complete

## Implementation Phase 4: Test Coverage

<!-- parallelizable: false -->

### Step 4.1: Unit tests for tile repository

Create unit tests for tile repository insert/select/conflict handling.

**File: `apps/server/tests/unit/tile.repository.test.ts`**

Test suite should cover:
1. Successful tile insert returns { ok: true } with id and createdAt
2. Insert with duplicate coordinate returns { ok: false, reason: "coordinate_conflict" }
3. Insert validates owner_id is server-owned (not client-controlled)
4. Insert validates offset_x and offset_y are within range [-0.49, 0.49]
5. Select by region returns all tiles in that region
6. Select by coordinate returns exact tile or undefined
7. Schema constraints are enforced at DB level (e.g., NOT NULL fields)

Follow existing test patterns in apps/server/tests/unit/ (e.g., vitest with describe/it).

Files:
* apps/server/tests/unit/tile.repository.test.ts - NEW: Unit test file

Success criteria:
* All tile repository functions have test coverage
* Conflict scenario is tested (SQLSTATE 23505 mapping)
* Tests pass with `npm run test --filter=server`
* Test file follows vitest conventions

Dependencies:
* Step 2.1: Tile repository implementation exists

### Step 4.2: Integration tests for tile persistence

Create integration tests that verify tile persistence lifecycle with real database.

**File: `apps/server/tests/integration/tile-persistence.integration.test.ts`**

Test suite should cover:
1. Tile insert persists to database
2. Tile select retrieves persisted tile with all fields
3. Duplicate coordinate insert fails with deterministic conflict response
4. Region and coordinate indexes support efficient lookups
5. Telemetry events are emitted on insert and conflict
6. Multiple tiles in different regions do not conflict
7. Same coordinate in different regions can coexist

Follow existing integration test patterns in apps/server/tests/integration/ (with test database setup).

Files:
* apps/server/tests/integration/tile-persistence.integration.test.ts - NEW: Integration test file

Success criteria:
* Tests use real database connection (not mocks)
* All persistence scenarios are tested
* Tests pass with `npm run test --filter=server`
* Test database is cleaned up between tests

Dependencies:
* Step 1.1: Migration exists and runs
* Step 2.1: Tile repository implementation exists
* Step 3.2: Telemetry integration complete

### Step 4.3: Startup migration smoke test

Create smoke test that verifies migration runs successfully on server startup.

**File: `apps/server/tests/integration/startup-migration.smoke.test.ts`**

Test should:
1. Start fresh test database
2. Run all migrations including tiles migration
3. Verify tiles table exists with all constraints and indexes
4. Verify server can query tiles table without errors
5. Verify server startup completes successfully

Follow existing startup test patterns if any exist in apps/server/tests/.

Files:
* apps/server/tests/integration/startup-migration.smoke.test.ts - NEW: Smoke test file

Success criteria:
* Test verifies migration executes in correct order
* tiles table exists after migration
* Constraints and indexes are present
* Test passes with `npm run test --filter=server`

Dependencies:
* Step 1.1: Migration file exists

### Step 4.4: Validate test coverage

Run all tests and verify tile-related tests pass.

Validation commands:
* Run tests: `npm run test --filter=server`
* Check coverage: `npm run test --filter=server -- --coverage` (if coverage enabled)

Success criteria:
* All tile repository unit tests pass
* All tile persistence integration tests pass
* Startup migration smoke test passes
* No test failures or timeouts

Dependencies:
* Step 4.1, 4.2, 4.3 complete

## Implementation Phase 5: Shared Types (Optional)

<!-- parallelizable: false -->

### Step 5.1: Add tile DTO and result contracts (if shared)

Add tile data transfer objects and persistence result types to shared-types package if tile contracts need to be shared between client and server.

**Decision Point**: Determine if tile endpoint response contracts should be added to shared-types.

**File: `packages/shared-types/src/index.ts`**

If shared contracts are needed:
1. Export TileDTO type with fields: { id: number; regionId: string; cellX: number; cellY: number; offsetX: number; offsetY: number; shape: string; color: string; stylePayload: Record<string, unknown>; ownerId: string; createdAt: string }
2. Export PlaceTileRequest type with fields for tile placement endpoint
3. Export PlaceTileResult type as union: { ok: true; tile: TileDTO } | { ok: false; reason: "coordinate_conflict" | "validation_error" }

Files:
* packages/shared-types/src/index.ts - MODIFY: Add tile types (if needed)

Success criteria:
* Tile DTO matches repository schema
* Result type supports both success and error cases
* Types can be imported by server and client
* No circular imports

Dependencies:
* Decision: Are tile contracts shared in v0?

### Step 5.2: Validate shared types

Build and verify shared-types package compiles without errors.

Validation commands:
* Build shared types: `npm run build --filter=shared-types`

Success criteria:
* Shared types compile without errors
* Dependent packages (client, server) resolve new types correctly

Dependencies:
* Step 5.1 complete (if shared types are added)

## Implementation Phase 6: Final Validation

<!-- parallelizable: false -->

### Step 6.1: Run full project validation

Execute all project linting, build, and test commands to ensure complete implementation passes quality gates.

Validation commands:
* Full lint: `npm run lint` (at workspace root)
* Full build: `npm run build` (at workspace root)
* Full test: `npm run test` (at workspace root)

Success criteria:
* No lint errors or warnings in tile-related files
* All packages build without errors
* All tests pass including tile repository, tile persistence, and migration smoke tests

Dependencies:
* All implementation phases complete

### Step 6.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures that are straightforward to fix.

Minor fixes include:
* Lint style violations (spacing, naming, import order)
* Unused imports or variables
* Deprecation warnings

Success criteria:
* No remaining lint errors
* Build completes without warnings
* No test failures

Dependencies:
* Step 6.1 results

### Step 6.3: Report blocking issues

Document issues that require additional research or planning beyond the scope of this task.

Blocking issues may include:
* Test environment setup problems requiring infrastructure changes
* Schema conflicts with existing migrations
* TypeScript type conflicts with existing code
* Performance issues requiring index tuning

Success criteria:
* All blocking issues are documented with clear description and impact
* Recommended next steps are provided to user
* Implementation is considered complete if all non-blocking items pass

Dependencies:
* Step 6.2 results

### Step 6.4: Verify migration executes cleanly

Run migrations in order on local database to confirm tiles table is created correctly.

Manual verification steps:
1. Start local PostgreSQL: `docker-compose up` or equivalent
2. Run migrations in order (should include: 1710000000000_init.js, 1720000000000_tiles.js)
3. Connect to database: `psql -U <user> -d <database>`
4. Verify tiles table: `\d tiles` (should show all columns, constraints, indexes)
5. Verify indexes: `\di tiles*` (should show region_lookup and coordinate_lookup indexes)
6. Verify constraints: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='tiles'` (should include unique, check constraints)

Success criteria:
* tiles table exists with all required columns
* tiles_region_coordinate_unique unique constraint exists
* tiles_region_lookup_idx and tiles_coordinate_lookup_idx indexes exist
* Check constraints for offset ranges exist
* No errors during migration execution

Dependencies:
* All migration and schema implementation complete
* Local database running
