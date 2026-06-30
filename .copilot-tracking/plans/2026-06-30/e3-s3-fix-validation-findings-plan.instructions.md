---
applyTo: '.copilot-tracking/changes/2026-06-30/e3-s3-fix-validation-findings-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E3-S3 Fix Validation Findings

## Overview

Address two major quality gaps and two minor gaps identified in implementation validation. The validation-only fixes are already complete; the remaining checklist below tracks the still-open product work: wire runtime replay window config, add DB-backed contention tests, add malformed command identity test coverage, and establish commandId contract enforcement.

## Objectives

### User Requirements

* Fix implementation quality gaps identified in validation review — Source: e3-s3-deterministic-placement-conflict-resolution-implementation-validation.md

### Derived Objectives

* Major: Wire PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS from env config to repository construction with regression test — Derived from: validation finding #1
* Major: Add at least one non-mocked DB-backed contention scenario for race and hotspot validation — Derived from: validation finding #2
* Minor: Add malformed_command_identity negative tests at API boundary — Derived from: validation finding #3
* Minor: Decide on and enforce commandId fallback deprecation timeline — Derived from: validation finding #4

## Validation Follow-Up Status

* Complete: TypeScript deprecation cleanup in `tsconfig.base.json` (`ignoreDeprecations: "6.0"`) so `npm run test` no longer fails on `baseUrl` warnings.
* Complete: Server Vitest bootstrap fix by adding `apps/server/vitest.global-setup.ts` and setting `fileParallelism: false` in `apps/server/vitest.config.ts` to avoid shared-database suite races.
* Outcome: `npm run test` passes at the workspace level after those fixes.

## Context Summary

### Project Files

* apps/server/src/config/env.ts - Environment variable mapping with PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS
* apps/server/src/index.ts - Server initialization; repository construction point
* apps/server/src/persistence/tile.repository.ts - Repository with default replay window; input contract
* apps/server/src/http/routes/tile.routes.ts - HTTP route handler with malformed_command_identity branch
* apps/server/tests/integration/placement-conflict-resolution.integration.test.ts - Mocked race scenario
* apps/server/tests/load/placement-conflict-hotspot.load.ts - Mocked hotspot scenario
* packages/shared-types/src/index.ts - Shared contract defining commandId requirement

### References

* .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md - Context and design decisions
* /memories/repo/phase1-tile-persistence-complete.md - Phase 1 completion context

### Standards References

* .github/instructions/coding-standards/typescript/typescript.instructions.md — TypeScript code quality and patterns

## Implementation Checklist

### [ ] Implementation Phase 1: Wire Runtime Replay Window Configuration

<!-- parallelizable: false -->

* [ ] Step 1.1: Extract replay window from env config in repository construction
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-fix-validation-findings-details.md (Lines 1–40)
  * File: apps/server/src/index.ts
  * Dependency: apps/server/src/config/env.ts must be loaded first

* [ ] Step 1.2: Update repository constructor to accept replay window parameter
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-fix-validation-findings-details.md (Lines 41–75)
  * File: apps/server/src/persistence/tile.repository.ts

* [ ] Step 1.3: Add regression test for replay window configuration wiring
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-fix-validation-findings-details.md (Lines 76–110)
  * File: apps/server/tests/integration/placement-conflict-resolution.integration.test.ts

* [ ] Step 1.4: Validate phase changes
  * Run `npm run lint` in apps/server
  * Run `npm run test:integration -- placement-conflict-resolution` in apps/server

### [ ] Implementation Phase 2: Add DB-Backed Contention Tests

<!-- parallelizable: true -->

* [ ] Step 2.1: Create new DB-backed race condition test without mocking
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-fix-validation-findings-details.md (Lines 111–160)
  * File: apps/server/tests/integration/placement-conflict-resolution.integration.test.ts

* [ ] Step 2.2: Create new DB-backed hotspot scenario test without mocking
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-fix-validation-findings-details.md (Lines 161–210)
  * File: apps/server/tests/load/placement-conflict-hotspot.load.ts

* [ ] Step 2.3: Validate phase changes
  * Run `npm run test:integration -- placement-conflict-resolution` in apps/server
  * Run `npm run test:load` in apps/server

### [ ] Implementation Phase 3: Add Test Coverage and Contract Enforcement

<!-- parallelizable: true -->

* [ ] Step 3.1: Add malformed_command_identity negative tests at API boundary
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-fix-validation-findings-details.md (Lines 211–250)
  * File: apps/server/tests/integration/http-auth.integration.test.ts

* [ ] Step 3.2: Document commandId fallback deprecation decision and timeline
  * Details: .copilot-tracking/details/2026-06-30/e3-s3-fix-validation-findings-details.md (Lines 251–280)
  * File: apps/server/src/persistence/tile.repository.ts (comment block)

* [ ] Step 3.3: Validate phase changes
  * Run `npm run lint` in apps/server
  * Run `npm run test:integration -- http-auth` in apps/server

### [ ] Implementation Phase 4: Final Validation

<!-- parallelizable: false -->

* [ ] Step 4.1: Run full project validation
  * Execute `npm run lint` across all packages
  * Execute `npm run test:unit` and `npm run test:integration` in apps/server
  * Execute `npm run test` in apps/client

* [ ] Step 4.2: Fix minor validation issues
  * Iterate on lint errors and test failures
  * Apply fixes directly when corrections are straightforward

* [ ] Step 4.3: Report blocking issues
  * Document any issues requiring additional research
  * Provide user with next steps

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-30/e3-s3-fix-validation-findings-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Node.js and npm (configured in monorepo)
* TypeScript 5.x
* Vitest for testing
* Database test fixtures (testcontainers or similar)

## Success Criteria

* Replay window configuration is passed from env config to repository constructor at runtime — Traces to: Major Finding #1
* Regression test verifies replay window affects command placement behavior — Traces to: Major Finding #1
* At least one race condition test uses real database without mocking — Traces to: Major Finding #2
* At least one hotspot test uses real database without mocking — Traces to: Major Finding #2
* Malformed command identity requests produce expected error responses with test coverage — Traces to: Minor Finding #1
* CommandId fallback deprecation documented with clear timeline — Traces to: Minor Finding #2
* All lint checks pass without new warnings
* All integration tests pass
* All load tests pass (or complete successfully with acceptable results)
