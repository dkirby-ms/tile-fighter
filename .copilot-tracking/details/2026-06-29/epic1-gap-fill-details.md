<!-- markdownlint-disable-file -->
# Implementation Details: Epic 1 Gap Fill

## Context Reference

Sources: Epic 1 issue gap analysis research (.copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md), existing implementation in apps/client/src/session/bootstrap-store.ts, server telemetry patterns in apps/server/src/http/routes/session.routes.ts

## Implementation Phase 1: Client Join-Token Caller

<!-- parallelizable: true -->

### Step 1.1: Create join-token caller in client auth module

Create a new file `apps/client/src/auth/join-token-caller.ts` that implements join-token request logic with bearer attachment and one-time silent retry on 401.

**Pattern reference**: apps/client/src/session/bootstrap-store.ts lines 1-50 (bearer extraction) and lines 60-90 (retry on 401 logic)

Files:
* apps/client/src/auth/join-token-caller.ts (new) - Join-token HTTP caller with retry logic
* packages/shared-types/src/index.ts (read) - Verify shared type signatures for join-token request/response

Discrepancy references:
* Addresses: DR-01 (client join-token caller not implemented)

Success criteria:
* Function exported and callable with roomId parameter
* Bearer token attached to Authorization header via external-id-session token acquisition
* Silent retry once on 401 response
* Throws or rejects on 403, 404, or repeated 401 (fallback to interactive auth required in caller)

Context references:
* apps/client/src/session/bootstrap-store.ts (Lines 1-100) - Reference implementation of bearer extraction and 401 retry pattern
* apps/server/src/http/routes/session.routes.ts (Lines 40-60) - Server join-token POST endpoint contract

Dependencies:
* external-id-session token acquisition available
* Shared HTTP/fetch utilities (if any, or use native fetch)

### Step 1.2: Create heartbeat caller in client session module

Create a new file `apps/client/src/session/heartbeat-caller.ts` that implements heartbeat request logic with bearer attachment and one-time silent retry on 401, mirroring the join-token caller pattern.

Files:
* apps/client/src/session/heartbeat-caller.ts (new) - Heartbeat HTTP caller with retry logic
* packages/shared-types/src/index.ts (read) - Verify shared type signatures for heartbeat request/response

Discrepancy references:
* Addresses: DR-02 (client heartbeat caller not implemented)

Success criteria:
* Function exported and callable with sessionId parameter (or heartbeat metadata struct)
* Bearer token attached to Authorization header via external-id-session token acquisition
* Silent retry once on 401 response
* Throws or rejects on 403, 404, or repeated 401
* Telemetry event names match spec: heartbeat submitted/failed (client-side)

Context references:
* apps/client/src/auth/join-token-caller.ts (Lines TBD) - Join-token pattern established in previous step
* apps/server/src/http/routes/session.routes.ts (Lines 65-85) - Server heartbeat POST endpoint contract
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts (Lines 1-50) - Server heartbeat test expectations

Dependencies:
* join-token-caller implementation complete (Step 1.1)
* external-id-session token acquisition available

### Step 1.3: Export callers from client package index

Update apps/client/src/index.ts to export both new caller functions for consumer packages.

Files:
* apps/client/src/index.ts - Add exports for join-token-caller and heartbeat-caller

Discrepancy references:
* None (derived objective from code organization)

Success criteria:
* Both callers exported as named exports from @game/client package
* Exports named consistently: `joinTokenCaller` and `heartbeatCaller` (or `getJoinToken`, `sendHeartbeat`)

Context references:
* apps/client/src/index.ts (current state)
* packages/shared-types/src/index.ts (verify export patterns)

Dependencies:
* join-token-caller implementation complete (Step 1.1)
* heartbeat-caller implementation complete (Step 1.2)

### Step 1.3: Validate phase changes

Run lint and build validation for modified client files. Skip unit test execution if parallel phases cover the same scope.

Validation commands:
* `npm run lint -- apps/client` - Lint client source only
* `npm run -w @game/client build` - TypeScript compilation for client package

## Implementation Phase 2: Telemetry Event Name Alignment

<!-- parallelizable: false -->

### Step 2.1: Update server join-token telemetry events

Update session.routes.ts to emit telemetry events with corrected names matching issue #10 specification.

Files:
* apps/server/src/http/routes/session.routes.ts - Rename join-token telemetry events

Current state:
```
POST /api/session/join-token route emits:
- session_join_token_issued (should be room_join_token_issued)
- session_join_token_failed (should be room_join_token_rejected)
```

Expected state:
```
POST /api/session/join-token route emits:
- room_join_token_issued (on success)
- room_join_token_rejected (on error)
```

Discrepancy references:
* Addresses: DD-01 (join-token telemetry event names mismatch)

Success criteria:
* Event names updated in session.routes.ts
* All emit calls reference corrected names
* Tests updated to expect new event names

Context references:
* apps/server/src/http/routes/session.routes.ts (lines with telemetry emits for join-token)
* apps/server/src/telemetry/telemetry-sink.ts (Lines 1-30) - Telemetry sink pattern

Dependencies:
* None (isolated change)

### Step 2.2: Update server heartbeat telemetry events

Update arena.room.ts, session-lifecycle.service.ts, and other heartbeat-related modules to emit telemetry events with corrected names matching issue #11 specification.

Files:
* apps/server/src/rooms/arena.room.ts - Rename room lifecycle telemetry events
* apps/server/src/session/session-lifecycle.service.ts - Rename lifecycle service telemetry events
* apps/server/src/http/routes/session.routes.ts - Verify heartbeat telemetry calls

Current state:
```
Room join emits: session_transport_join (should be session_heartbeat per #11)
Room leave emits: session_transport_leave (should be session_ended per #11)
Stale metadata cleanup emits: session_metadata_stale (should be presence_cleared per #11)
```

Expected state:
```
Room join/heartbeat events:
- session_heartbeat (on successful heartbeat ping)
- session_ended (on room leave)
- presence_cleared (on stale metadata cleanup)
```

Discrepancy references:
* Addresses: DD-02 (heartbeat telemetry event names mismatch)

Success criteria:
* Event names updated across arena.room.ts and session-lifecycle.service.ts
* All emit calls reference corrected names
* Tests updated to expect new event names

Context references:
* apps/server/src/rooms/arena.room.ts (lifecycle hook lines)
* apps/server/src/session/session-lifecycle.service.ts (cleanup logic lines)

Dependencies:
* Step 2.1 complete (aligned telemetry naming convention)

### Step 2.3: Update related test expectations

Update test files to expect the renamed telemetry event names.

Files:
* apps/server/tests/integration/join-token.integration.test.ts - Update join-token test assertions
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts - Update heartbeat test assertions
* apps/server/tests/unit/session-lifecycle.service.test.ts - Update lifecycle service test assertions

Discrepancy references:
* Depends on: DD-01, DD-02 (updated event names require test assertion updates)

Success criteria:
* All test assertions use updated event names
* Tests pass with renamed events

Context references:
* apps/server/tests/integration/join-token.integration.test.ts (test expectations for telemetry)
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts (test expectations for telemetry)

Dependencies:
* Step 2.1 and 2.2 complete (event names renamed in source)

## Implementation Phase 3: Client Auth State Machine Completion

<!-- parallelizable: true -->

### Step 3.1: Implement bootstrap-in-flight state transition

Update external-id-session.ts to track silent acquisition attempts and transition to bootstrap-in-flight during token fetch.

Files:
* apps/client/src/auth/external-id-session.ts - Add bootstrap-in-flight transition logic

Current state:
```typescript
type AuthState = 'token-ready' | 'interaction-required' | 'bootstrap-failed' | 'bootstrap-in-flight'
// bootstrap-in-flight and bootstrap-failed are defined but never transitioned into
```

Expected state:
```typescript
// Add state machine logic to transition:
1. idle → bootstrap-in-flight (when silent acquisition begins)
2. bootstrap-in-flight → token-ready (when silent acquisition succeeds)
3. bootstrap-in-flight → interaction-required (when silent acquisition fails, needs interactive login)
```

Discrepancy references:
* Addresses: DR-03 (client state machine not fully implemented)

Success criteria:
* bootstrap-in-flight state transitions occur during silent token acquisition attempts
* Consumers can observe in-flight state to show loading UI if needed
* State correctly transitions to token-ready or interaction-required based on acquisition result

Context references:
* apps/client/src/auth/external-id-session.ts (Lines 1-80) - Current state machine structure
* apps/client/src/session/bootstrap-store.ts (Lines 30-60) - Consumer of token acquisition state

Dependencies:
* None (isolated to auth module)

### Step 3.2: Implement bootstrap-failed state transition

Update error handling in external-id-session.ts to expose bootstrap-failed state as recoverable via interactive auth trigger.

Files:
* apps/client/src/auth/external-id-session.ts - Add bootstrap-failed transition and recovery logic

Expected behavior:
```typescript
1. Unrecoverable errors (e.g., tenant mismatch) → bootstrap-failed
2. bootstrap-failed state exposed as consumer-recoverable via interactive auth call
3. Interactive auth call transitions bootstrap-failed → interaction-required
```

Discrepancy references:
* Addresses: DR-04 (bootstrap-failed state not used; gap in recovery flow)

Success criteria:
* bootstrap-failed state transitioned to on unrecoverable errors
* Recovery method (interactive auth call) available to transition out of bootstrap-failed
* Consumers can trigger recovery flow

Context references:
* apps/client/src/auth/external-id-session.ts (error handling sections)

Dependencies:
* Step 3.1 complete (bootstrap-in-flight transitions establish pattern)

### Step 3.3: Validate phase changes

Run lint and build validation for auth module.

Validation commands:
* `npm run lint -- apps/client/src/auth` - Lint auth module
* `npm run -w @game/client build` - TypeScript compilation for client package

## Implementation Phase 4: Client Test Coverage

<!-- parallelizable: true -->

### Step 4.1: Verify client test infrastructure

Ensure test directories and vitest configuration are available before creating test files.

Files:
* apps/client/tests/unit/ (create if not present)
* apps/client/tests/integration/ (create if not present)
* apps/client/vitest.config.ts (verify or inherit from root)
* apps/client/package.json (verify "test" script exists)

Discrepancy references:
* Prerequisite check for test framework availability

Success criteria:
* Directory structure exists: apps/client/tests/{unit,integration}/
* Vitest configuration accessible (can run `npm run -w @game/client test`)
* npm script resolves without errors

Context references:
* apps/server/tests/ (reference directory structure)
* apps/server/vitest.config.ts (reference vitest configuration)

Dependencies:
* Workspace npm configuration
* Vitest package installed (@game/client dependencies)

### Step 4.2: Create join-token caller tests

Create apps/client/tests/unit/join-token-caller.test.ts with comprehensive test coverage for bearer attachment, silent retry on 401, and fallback scenarios.

Files:
* apps/client/tests/unit/join-token-caller.test.ts (new) - Unit tests for join-token caller

Test cases to cover:
* Bearer token successfully attached to Authorization header
* Silent retry on 401 response
* Fallback behavior on repeated 401 (error thrown for consumer to handle)
* 403 Forbidden response handled (error thrown)
* 404 Not Found response handled (error thrown)
* Successful 200 response with room token
* Network errors handled

Discrepancy references:
* Addresses: DR-05 (no client test coverage for join-token caller)

Success criteria:
* Test file created with coverage for listed scenarios
* All tests pass
* Coverage meets project baseline (if enforced)

Context references:
* apps/server/tests/integration/join-token.integration.test.ts (Lines 1-100) - Reference test structure and coverage expectations
* apps/server/src/auth/join-token.service.ts (Lines 1-50) - Server-side logic to understand expected behaviors

Dependencies:
* join-token-caller implementation complete (Step 1.1)

### Step 4.2: Create heartbeat caller tests

Create apps/client/tests/unit/heartbeat-caller.test.ts with comprehensive test coverage for bearer attachment, silent retry on 401, and fallback scenarios.

Files:
* apps/client/tests/unit/heartbeat-caller.test.ts (new) - Unit tests for heartbeat caller

Test cases to cover (mirror join-token-caller tests):
* Bearer token successfully attached to Authorization header
* Silent retry on 401 response
* Fallback behavior on repeated 401
* 403 Forbidden response handled
* 404 Not Found response handled
* Successful 200 response acknowledging heartbeat
* Network errors handled

Discrepancy references:
* Addresses: DR-06 (no client test coverage for heartbeat caller)

Success criteria:
* Test file created with coverage for listed scenarios
* All tests pass
* Coverage meets project baseline

Context references:
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts (Lines 1-100) - Reference test structure

Dependencies:
* heartbeat-caller implementation complete (Step 1.2)

### Step 4.3: Create auth state machine integration tests

Create apps/client/tests/integration/auth-state-machine.test.ts covering full state transitions including bootstrap-in-flight and bootstrap-failed recovery.

Files:
* apps/client/tests/integration/auth-state-machine.test.ts (new) - Integration tests for state machine

Test scenarios:
* Silent token acquisition path: idle → bootstrap-in-flight → token-ready
* Silent acquisition failure path: idle → bootstrap-in-flight → interaction-required
* Unrecoverable error path: idle → bootstrap-in-flight → bootstrap-failed
* Bootstrap-failed recovery: bootstrap-failed → (interactive auth call) → interaction-required
* Token expiry and refresh cycle

Discrepancy references:
* Addresses: DR-07 (no client integration test coverage for full auth flow)

Success criteria:
* Test file created with scenarios listed
* All state transitions verified through test assertions
* Tests pass

Context references:
* apps/client/src/auth/external-id-session.ts (full state machine)
* apps/client/tests/integration/session-bootstrap.integration.test.ts (if exists) - Reference integration test pattern

Dependencies:
* Step 3.1 and 3.2 complete (state machine fully implemented)

### Step 4.5: Validate phase changes

Run client test suite to verify all new tests pass.

Validation commands:
* `npm run -w @game/client test` - Client test suite

## Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all project-level validation commands.

Validation commands:
* `npm run lint` - Lint all packages and apps
* `npm run -w @game/client build` - Client TypeScript build
* `npm run -w @game/server build` - Server TypeScript build
* `npm run -w @game/client test` - Client test suite
* `npm run -w @game/server test` - Server test suite

### Step 5.2: Verify telemetry event names match issue specs

Manually verify telemetry event names align with issue specifications.

Checklist:
* Join-token events in source code:
  * ✓ `room_join_token_issued` (success path)
  * ✓ `room_join_token_rejected` (error path)
* Heartbeat events in source code:
  * ✓ `session_heartbeat` (successful ping)
  * ✓ `session_ended` (room leave)
  * ✓ `presence_cleared` (stale metadata cleanup)
* Cross-check against:
  * Issue #10 requirements (join-token)
  * Issue #11 requirements (heartbeat)
  * Research document (.copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md)

### Step 5.3: Fix minor validation issues

Iterate on lint errors, TypeScript compilation warnings, and test failures. Apply fixes directly when corrections are straightforward.

Common fix patterns:
* Unused import cleanup
* Type annotation corrections
* Missing return statements
* Test assertion updates

### Step 5.4: Report blocking issues

When validation failures require changes beyond minor fixes, document and escalate rather than attempting large-scale inline fixes.

For each blocking issue:
* Document the issue and affected files
* Provide rationale for why fix exceeds scope
* Recommend additional research and planning
* Avoid refactoring unrelated code to accommodate fixes

## Dependencies

* TypeScript 5.0+ for client and server packages
* Vitest for test execution
* @azure/msal-browser for MSAL token acquisition
* Existing monorepo build infrastructure
* Shared auth patterns from packages/shared-auth

## Success Criteria

* Client join-token caller implemented and tested — Traces to: Issue #10, Phase 1
* Client heartbeat caller implemented and tested — Traces to: Issue #11, Phase 2
* Telemetry event names: `room_join_token_issued`, `room_join_token_rejected`, `session_heartbeat`, `session_ended`, `presence_cleared` — Traces to: Issues #9-11
* Client auth state machine fully transitions through bootstrap-in-flight and bootstrap-failed — Traces to: Phase 3
* Client test suite includes join-token, heartbeat, and state machine coverage — Traces to: Phase 4
* All linting, compilation, and test suites pass
* No blocking validation failures remain
