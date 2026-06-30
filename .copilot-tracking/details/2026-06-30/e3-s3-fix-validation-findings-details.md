<!-- markdownlint-disable-file -->
# Implementation Details: E3-S3 Fix Validation Findings

## Context Reference

Sources: 
* e3-s3-deterministic-placement-conflict-resolution-implementation-validation.md
* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md
* apps/server/src/config/env.ts
* apps/server/src/persistence/tile.repository.ts

## Implementation Phase 1: Wire Runtime Replay Window Configuration

<!-- parallelizable: false -->

### Step 1.1: Extract replay window from env config in repository construction

Extract the PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS from environment configuration when constructing the tile repository. Currently the environment variable is mapped in env.ts but not used during repository instantiation in index.ts.

Files:
* apps/server/src/index.ts - Main server entry point where repository is constructed
* apps/server/src/config/env.ts - Environment variable definitions

Implementation:

1. In apps/server/src/index.ts, after loading config via `env()`, extract `PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS`
2. Pass this value to the tile repository constructor
3. Verify the config value is a positive integer (validation already exists in env.ts)

Reference context:
* apps/server/src/config/env.ts defines: `PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS: z.number().int().positive().optional()`
* Current repository constructor in apps/server/src/persistence/tile.repository.ts line ~15 shows default hardcoded value

Success criteria:
* Runtime config value is read from environment
* Config value is passed to repository during construction
* No type errors; code follows existing patterns

Context references:
* apps/server/src/config/env.ts (full file) - Environment schema
* apps/server/src/index.ts (lines 1–50) - Server initialization

Dependencies:
* Config module must be initialized first
* Repository constructor must be updated before this step can complete

### Step 1.2: Update repository constructor to accept replay window parameter

Modify the tile repository constructor to accept an optional replay window parameter with fallback to default.

Files:
* apps/server/src/persistence/tile.repository.ts - Repository class

Implementation:

1. Add optional `replayWindowSeconds?: number` parameter to constructor
2. Use provided value or fallback to DEFAULT_REPLAY_WINDOW_SECONDS constant
3. Store in instance property for use in placement command validation
4. Update constructor documentation to explain the parameter

Reference context:
* Current constructor signature (line ~15)
* DEFAULT_REPLAY_WINDOW_SECONDS constant definition (line ~8)
* Replay window usage in validation logic (search for "replay" in file)

Success criteria:
* Constructor accepts optional replayWindowSeconds parameter
* Fallback behavior maintains backward compatibility
* Internal logic uses instance property instead of hardcoded constant
* TypeScript types are correct

Context references:
* apps/server/src/persistence/tile.repository.ts (lines 1–50) - Constructor and defaults

Dependencies:
* Step 1.1 (config extraction) should complete first
* TypeScript compilation must succeed

### Step 1.3: Add regression test for replay window configuration wiring

Add a test that verifies:
1. Repository is constructed with config-provided replay window
2. Replay window affects placement command validation behavior
3. Different replay window values produce expected behavior differences

Files:
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts - Integration test suite

Implementation:

1. Create new test: "should apply runtime replay window configuration to placement commands"
2. Set up test database
3. Create repository with explicit replay window (e.g., 2 seconds)
4. Create a placement command near the replay window boundary
5. Verify that the window is respected in validation logic
6. Clean up test data

Reference context:
* Existing test structure in placement-conflict-resolution.integration.test.ts
* Replay window application logic in tile.repository.ts
* Test setup utilities and database fixtures

Success criteria:
* Test passes with implemented changes
* Test demonstrates replay window is configurable at runtime
* Test would catch regressions if replay window config is removed
* Test follows existing test patterns and conventions

Context references:
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts (full file) - Test patterns
* apps/server/src/persistence/tile.repository.ts (search "replay") - Validation logic

Dependencies:
* Steps 1.1 and 1.2 must complete
* Test environment setup must be available

### Step 1.4: Validate phase changes

Run lint and test commands for files modified in Phase 1.

Validation commands:
* `npm run lint -- apps/server/src/index.ts apps/server/src/persistence/tile.repository.ts` - Lint modified source files
* `npm run test:integration -- placement-conflict-resolution` - Run placement conflict integration tests
* Check for TypeScript compilation errors

## Implementation Phase 2: Add DB-Backed Contention Tests

<!-- parallelizable: true -->

### Step 2.1: Create new DB-backed race condition test without mocking

Replace the mocked race path test with a real database-backed version that exercises actual transaction concurrency.

Files:
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts - Integration test suite

Implementation:

1. Locate existing mocked race test in placement-conflict-resolution.integration.test.ts
2. Create new test: "should handle concurrent placement commands with real database"
3. Set up test database with one arena
4. Spawn multiple concurrent placement commands targeting the same region (high contention)
5. Use real database transactions without mocks
6. Verify:
   * All commands are assigned deterministic results (no duplicates, no omissions)
   * Command IDs are preserved in replay window
   * Query performance is acceptable under load
7. Clean up test data

Reference context:
* Existing mocked test that can serve as template
* Database test setup utilities
* Arena and region creation patterns
* Transaction handling in tile.repository.ts

Success criteria:
* Test uses real database (not mocks) for race condition scenario
* Test verifies deterministic placement under high concurrency
* Test completes in reasonable time (< 5 seconds typically)
* Test demonstrates that transactional guarantees hold

Context references:
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts (lines with "mocked" or "race")
* apps/server/src/persistence/tile.repository.ts (transaction handling)

Dependencies:
* Database test fixtures must support concurrent transactions
* Phase 1 completion (config wiring) ensures replay window is configurable for test
* Vitest/test setup must be available

### Step 2.2: Create new DB-backed hotspot scenario test without mocking

Create a new load test that exercises high-frequency placement commands against the same hotspot region using real database transactions.

Files:
* apps/server/tests/load/placement-conflict-hotspot.load.ts - Load test suite

Implementation:

1. Create new test function: "hotspot region with concurrent placements and real database"
2. Set up test database with one arena and one region designated as "hotspot"
3. Configure 10–20 concurrent placement operations targeting the hotspot
4. Run for 30–60 seconds (or fixed number of iterations)
5. Use real database (not mocks) for all operations
6. Track:
   * Total placements succeeds
   * Command determinism (no replay conflicts)
   * Response time distribution (p50, p95, p99)
   * Database query performance
7. Verify metrics meet acceptance criteria (e.g., < 100ms p95 latency, 100% determinism)
8. Clean up test data

Reference context:
* Existing hotspot test structure (mocked version)
* Load test patterns and metrics collection
* Database stress testing setup
* Concurrent operation coordination

Success criteria:
* Test uses real database (not mocks) for hotspot scenario
* Test runs multiple concurrent operations successfully
* Test demonstrates system stability under sustained load
* Metrics are collected and reported

Context references:
* apps/server/tests/load/placement-conflict-hotspot.load.ts (full file) - Load test patterns
* apps/server/src/persistence/tile.repository.ts (lines with transaction handling)

Dependencies:
* Database must support concurrent connections
* Load test infrastructure must be available
* Phase 1 completion ensures replay window is tested under load

### Step 2.3: Validate phase changes

Run integration and load test commands for Phase 2 changes.

Validation commands:
* `npm run test:integration -- placement-conflict-resolution` - Run placement conflict integration tests
* `npm run test:load` - Run load tests including hotspot scenario
* Check for performance regressions or timeouts

## Implementation Phase 3: Add Test Coverage and Contract Enforcement

<!-- parallelizable: true -->

### Step 3.1: Add malformed_command_identity negative tests at API boundary

Add explicit test coverage for the malformed_command_identity branch in the HTTP route handler.

Files:
* apps/server/tests/integration/http-auth.integration.test.ts - HTTP authentication tests
* apps/server/src/http/routes/tile.routes.ts - Route handler with malformed branch

Implementation:

1. Locate the malformed_command_identity branch in tile.routes.ts (HTTP POST /tile route)
2. Create new test: "should return 400 error for malformed command identity"
3. Test cases:
   * Missing commandId field in request body
   * commandId is null instead of string
   * commandId is empty string
   * commandId contains invalid characters or format
4. For each test case:
   * Send HTTP request with malformed command identity
   * Verify response status is 400
   * Verify error message indicates malformed command identity
   * Verify no command is persisted in database
5. Clean up test data

Reference context:
* tile.routes.ts route handler for POST /tile (search "malformed_command_identity")
* Existing HTTP test patterns in http-auth.integration.test.ts
* Request/response validation utilities
* Error response format conventions

Success criteria:
* All malformed identity test cases have explicit coverage
* Tests verify 400 error response
* Tests verify no side effects (command not persisted)
* Tests follow existing test patterns

Context references:
* apps/server/src/http/routes/tile.routes.ts (lines with "malformed")
* apps/server/tests/integration/http-auth.integration.test.ts (full file) - Test patterns

Dependencies:
* HTTP test infrastructure must be available
* Route handler must be accessible in test environment

### Step 3.2: Document commandId fallback deprecation decision and timeline

Add documentation to tile.repository.ts explaining the commandId fallback behavior and deprecation decision.

Files:
* apps/server/src/persistence/tile.repository.ts - Repository with fallback logic

Implementation:

1. Locate commandId fallback logic in tile.repository.ts (search for "fallback" or "commandId" handling)
2. Add documentation comment block explaining:
   * Current behavior: commandId is optional; if missing, a fallback ID is generated
   * Shared contract expectation: commandId is required
   * Deprecation timeline: commandId fallback will be removed in version X.Y (or Q1 2027, etc.)
   * Migration guidance: all callers must provide explicit commandId
3. Consider adding a deprecation warning log when fallback is used (non-breaking)
4. Document expected error handling once fallback is removed

Reference context:
* Current fallback implementation in tile.repository.ts
* Shared contract definition in packages/shared-types/src/index.ts
* Project versioning and release planning
* Existing deprecation documentation in codebase (examples)

Success criteria:
* Deprecation timeline is clearly documented
* Migration path is explained for callers
* Comment explains why fallback exists and will be removed
* Documentation follows code comment conventions

Context references:
* apps/server/src/persistence/tile.repository.ts (lines with fallback generation)
* packages/shared-types/src/index.ts (commandId contract definition)

Dependencies:
* Product/architecture decision on deprecation timeline (may need user input)
* No code changes required; documentation only

### Step 3.3: Validate phase changes

Run lint and test commands for Phase 3 changes.

Validation commands:
* `npm run lint -- apps/server/src/persistence/tile.repository.ts apps/server/src/http/routes/tile.routes.ts` - Lint modified source files
* `npm run test:integration -- http-auth` - Run HTTP authentication tests
* Check for TypeScript compilation errors

## Implementation Phase 4: Final Validation

<!-- parallelizable: false -->

### Step 4.1: Run full project validation

Execute all lint and test commands for the entire project:

Validation commands:
* `npm run lint` - Lint all packages (apps/server, apps/client, packages/*)
* `npm run test:unit` in apps/server - Unit tests
* `npm run test:integration` in apps/server - Integration tests
* `npm run test` in apps/client - Client tests
* `npm run build` across all packages - Verify TypeScript compilation

### Step 4.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures. Apply fixes directly when corrections are straightforward and isolated:

* Type errors: Fix using TypeScript compiler guidance
* Lint warnings: Apply auto-fixes where available
* Test failures: Debug and fix root causes
* Performance regressions: Optimize or adjust test expectations

### Step 4.3: Report blocking issues

When validation failures require changes beyond minor fixes:

* Document the issues and affected files
* Provide the user with next steps and recommended action
* Avoid large-scale refactoring within this phase

## Dependencies

* Node.js 18+
* npm 8+
* TypeScript 5.x
* Vitest 0.34+
* Test database (Docker or testcontainers)
* Existing test infrastructure and fixtures

## Success Criteria

* All replay window config changes integrated without errors
* Regression test demonstrates replay window affects behavior
* Race condition test uses real database with deterministic results
* Hotspot test exercises high concurrency with acceptable metrics
* Malformed command identity tests provide comprehensive coverage
* CommandId fallback deprecation clearly documented
* Full project validation passes with no new warnings
* All tests pass (unit, integration, load)
