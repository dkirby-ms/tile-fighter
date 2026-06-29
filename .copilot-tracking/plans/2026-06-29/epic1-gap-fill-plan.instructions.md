---
applyTo: '.copilot-tracking/changes/2026-06-29/epic1-gap-fill-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Epic 1 Gap Fill

## Overview

Close the Epic 1 implementation gaps by adding client-side join-token and heartbeat callers with retry/fallback logic, updating telemetry event names to match issue specifications, completing the client auth state machine, and adding comprehensive client-side test coverage.

## Objectives

### User Requirements

* Implement client-side join-token caller with bearer attachment and one-time silent retry on 401 — Source: Issue #10 updated requirements in research document
* Implement client-side heartbeat caller with bearer attachment and one-time silent retry on 401 — Source: Issue #11 updated requirements in research document
* Add dedicated client test coverage for retry/fallback behavior — Source: Issue #9-11 test coverage gap identified in research
* Align telemetry event names across client and server to match issue specifications — Source: Issue #9-11 telemetry contract analysis in research document
* Complete client auth state machine transitions (bootstrap-in-flight, bootstrap-failed) — Source: external-id-session.ts implementation gap in research

### Derived Objectives

* Maintain consistency with existing shared auth patterns (bearer extraction, silent retry on 401) — Derived from: apps/client/src/session/bootstrap-store.ts existing implementation
* Ensure telemetry alignment between client callers and server event emitters — Derived from: Centralized telemetry sink pattern in apps/server/src/telemetry/telemetry-sink.ts
* Extend shared-types to export new client caller types if needed — Derived from: Monorepo package organization
* Validate client auth flows remain backward-compatible with server auth middleware — Derived from: apps/server/src/http/auth-middleware.ts existing contracts

## Context Summary

### Project Files

* apps/client/src/auth/external-id-session.ts - External ID token acquisition state machine (gap: states not fully used)
* apps/client/src/auth/msal-config.ts - MSAL configuration with API scope definition
* apps/client/src/session/bootstrap-store.ts - Session bootstrap caller with bearer attachment and 401 retry pattern (reference implementation)
* apps/server/src/auth/auth-service.ts - Runtime auth config including join-token and heartbeat route definitions
* apps/server/src/http/routes/session.routes.ts - HTTP routes for join-token and heartbeat (telemetry event emitters)
* apps/server/src/auth/join-token.service.ts - Server-side join-token logic
* apps/server/src/session/session-lifecycle.service.ts - Server-side heartbeat handler
* apps/server/tests/integration/join-token.integration.test.ts - Server join-token tests (reference for coverage expectations)
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts - Server heartbeat tests (reference for coverage expectations)
* packages/shared-auth/src/index.ts - Shared JWT validation and auth utilities
* packages/shared-types/src/index.ts - Shared type definitions

### References

* .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md - Complete gap analysis with telemetry mismatches and missing implementations

### Standards References

* .github/instructions/coding-standards/typescript/typescript.instructions.md — TypeScript coding standards for client code
* Epic 1 planning artifacts (.copilot-tracking/plans/2026-06-28/) — Existing architecture decisions and auth patterns

## Implementation Checklist

### [ ] Implementation Phase 1: Client Join-Token Caller

<!-- parallelizable: true -->

* [ ] Step 1.1: Create join-token caller in client auth module
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 30-80)
  * Add apps/client/src/auth/join-token-caller.ts with bearer extraction and silent retry logic
  * Follow bootstrap-store.ts as reference implementation pattern
* [ ] Step 1.2: Create heartbeat caller in client session module
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 85-130)
  * Add apps/client/src/session/heartbeat-caller.ts with bearer extraction and silent retry logic
  * Mirror join-token-caller pattern for consistency
* [ ] Step 1.3: Export callers from client package index
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 135-145)
  * Update apps/client/src/index.ts to export both new caller functions
* [ ] Step 1.4: Validate phase changes
  * Run lint for modified client files (`npm run lint -- apps/client`)
  * Verify TypeScript compilation succeeds (`npm run -w @game/client build`)
  * Skip unit test execution if parallel phases cover the same scope

### [ ] Implementation Phase 2: Telemetry Event Name Alignment

<!-- parallelizable: false -->

* [ ] Step 2.1: Update server join-token telemetry events
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 150-170)
  * Rename `session_join_token_issued` → `room_join_token_issued` in session.routes.ts
  * Rename `session_join_token_failed` → `room_join_token_rejected` in session.routes.ts
* [ ] Step 2.2: Update server heartbeat telemetry events
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 175-195)
  * Rename `session_transport_join` → `session_heartbeat` in arena.room.ts
  * Rename `session_transport_leave` → `session_ended` in arena.room.ts
  * Rename `session_metadata_stale` → `presence_cleared` in session-lifecycle.service.ts
* [ ] Step 2.3: Update related test expectations
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 200-215)
  * Update test assertions in join-token.integration.test.ts for renamed events
  * Update test assertions in heartbeat-lifecycle.integration.test.ts for renamed events

### [ ] Implementation Phase 3: Client Auth State Machine Completion

<!-- parallelizable: false (both steps modify external-id-session.ts; implement sequentially or coordinate in code review) -->

* [ ] Step 3.1: Implement bootstrap-in-flight state transition
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 220-250)
  * Add silent acquisition state tracking in external-id-session.ts
  * Transition to bootstrap-in-flight during token fetch attempt
* [ ] Step 3.2: Implement bootstrap-failed state transition
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 255-280)
  * Update error handling to transition to bootstrap-failed state
  * Expose bootstrap-failed as recoverable via interactive auth trigger
* [ ] Step 3.3: Validate phase changes
  * Run lint for auth module (`npm run lint -- apps/client/src/auth`)
  * Verify TypeScript compilation succeeds

### [ ] Implementation Phase 4: Client Test Coverage

<!-- parallelizable: true (parallel execution of test file creation; requires Phase 3 for state machine tests) -->

* [ ] Step 4.1: Verify client test infrastructure
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 275-285)
  * Create apps/client/tests/unit/ and apps/client/tests/integration/ directories if not present
  * Verify vitest configuration available (apps/client/vitest.config.ts or inherited from root)
  * Verify npm test script is configured in apps/client/package.json
* [ ] Step 4.2: Create join-token caller tests
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 285-330)
  * Add apps/client/tests/unit/join-token-caller.test.ts
  * Cover bearer attachment, silent retry on 401, and fallback scenarios
* [ ] Step 4.3: Create heartbeat caller tests
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 335-375)
  * Add apps/client/tests/unit/heartbeat-caller.test.ts
  * Cover bearer attachment, silent retry on 401, and fallback scenarios
* [ ] Step 4.4: Create auth state machine integration tests
  * Details: .copilot-tracking/details/2026-06-29/epic1-gap-fill-details.md (Lines 380-415)
  * Add apps/client/tests/integration/auth-state-machine.test.ts
  * Cover full state transitions including bootstrap-in-flight and bootstrap-failed
* [ ] Step 4.5: Validate phase changes
  * Run client test suite (`npm run -w @game/client test`)
  * Verify all tests pass

### [ ] Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

* [ ] Step 5.1: Run full project validation
  * Execute `npm run lint` (all packages and apps)
  * Execute `npm run -w @game/client build`
  * Execute `npm run -w @game/server build`
  * Execute `npm run -w @game/client test`
  * Execute `npm run -w @game/server test`
* [ ] Step 5.2: Verify telemetry event names match issue specs
  * Confirm join-token events: `room_join_token_issued`, `room_join_token_rejected`
  * Confirm heartbeat events: `session_heartbeat`, `session_ended`, `presence_cleared`
  * Cross-check against issue #9, #10, #11 in research document
* [ ] Step 5.3: Fix minor validation issues
  * Iterate on lint errors and TypeScript compilation warnings
  * Apply fixes directly when corrections are straightforward
* [ ] Step 5.4: Report blocking issues
  * Document any validation failures that require changes beyond minor fixes
  * Provide next steps and recommended planning for complex issues

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-29/epic1-gap-fill-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* TypeScript 5.0+
* @azure/msal-browser (MSAL client library for token acquisition)
* Existing shared-auth patterns and utilities
* Vitest for client test execution

## Success Criteria

* Client join-token caller implemented with bearer attachment and 401 retry — Traces to: Issue #10 updated requirements
* Client heartbeat caller implemented with bearer attachment and 401 retry — Traces to: Issue #11 updated requirements
* Telemetry event names aligned across server: `room_join_token_issued`, `room_join_token_rejected`, `session_heartbeat`, `session_ended`, `presence_cleared` — Traces to: Issues #9-11 telemetry specifications
* Client auth state machine fully transitions through bootstrap-in-flight and bootstrap-failed states — Traces to: external-id-session.ts gap analysis
* Client test suite includes join-token caller, heartbeat caller, and state machine integration tests — Traces to: Client test coverage gap
* All linting, TypeScript compilation, and test suites pass
