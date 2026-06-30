---
title: RPI Validation - E3-S3 Deterministic Placement Conflict Resolution - Phase 001
description: Validation report comparing Phase 1 plan requirements against implemented code, tests, and changes log evidence.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
---

## Validation Scope

Phase validated: 1

Inputs:

* Plan: .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md
* Changes log: .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md
* Research: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md
* Details spec: .copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md

Validation method:

* Extracted Phase 1 checklist requirements from plan and details docs
* Compared claimed changes to repository implementation and tests
* Verified current lint/build status using Phase 1 validation commands

## Phase 1 Requirement Mapping

| Phase 1 step | Requirement | Evidence in code/tests | Assessment |
|--------------|-------------|------------------------|------------|
| 1.1 | Extend placement command schema with required commandId and route validation | packages/shared-types/src/index.ts:50-61, apps/server/src/http/routes/tile.routes.ts:97-121, apps/server/src/http/routes/tile.routes.ts:155-161 | Implemented with caveats |
| 1.2 | Add canonical payload hashing and replay-window configuration | apps/server/src/domain/combat-simulation.service.ts:4-50, apps/server/src/config/env.ts:33, apps/server/src/config/env.ts:68, apps/server/src/config/env.ts:120 | Implemented |
| 1.3 | Validate phase changes with shared/server lint and server build commands | Executed successfully: npm run -w @game/shared-types lint, npm run -w @game/server lint, npm run -w @game/server build | Implemented |

## Findings

### Major

1. Required command identity is not enforced uniformly across all server placement entry paths

Evidence:

* apps/server/src/persistence/tile.repository.ts:175-181 introduces a fallback command identity (`legacy-...`) when `commandId` is missing
* This diverges from the Phase 1 detail statement that server placement entry points should require command identity and validate it

Impact:

* Non-route callers can bypass strict required-command identity semantics
* Replay identity can become synthetic rather than client-stable for those paths

Recommendation:

* Make `commandId` required at repository boundary for placement operations, or explicitly scope and document fallback as temporary compatibility behavior with a removal milestone

2. Existing integration test coverage contains placement requests without commandId, indicating contract drift risk

Evidence:

* apps/server/tests/integration/tile-persistence.integration.test.ts:562 posts to `/api/tiles/place` without `commandId`
* Same test block expects `201` responses for placement operations using payloads that do not include `commandId`

Impact:

* When DB-backed integration tests run in environments where skip guards allow execution, behavior may mismatch expectations after Phase 1 contract enforcement
* Indicates incomplete test migration for the new contract

Recommendation:

* Update remaining placement route tests to include `commandId`
* Add a migration checklist for any test helper still generating legacy placement payloads

### Minor

1. Missing explicit automated assertion for malformed command identity response path

Evidence:

* Route implements deterministic malformed identity behavior (`conflictCode: malformed_command_identity`) at apps/server/src/http/routes/tile.routes.ts:155-159
* No corresponding direct test assertion located in current unit/integration test search for malformed command identity token

Impact:

* Contract regression risk for the malformed-identity branch

Recommendation:

* Add route-level test asserting `400` and `conflictCode: malformed_command_identity` for short, oversized, and regex-invalid `commandId` values

### Info

1. Changes log claims for Phase 1 core implementation are largely substantiated

Evidence:

* Contract constants and field additions are present in shared types
* Route-level validation and threading into placement input are present
* Hashing and replay-window config are implemented
* Phase 1 lint/build commands currently pass in workspace

## Coverage Assessment

Overall Phase 1 coverage: Partial (approximately 85%)

Coverage notes:

* Checklist implementation exists for all three Phase 1 steps
* Two major gaps remain around strictness consistency and downstream test alignment
* One minor gap remains in explicit validation-branch test coverage

## Deviations and Unsupported or Weakly Supported Claims

* The changes log notes a legacy fallback command identity path in repository logic. This is accurate and verified.
* No unsupported claim was found for Step 1.2 or Step 1.3.
* Phase-level completion claim should be treated as conditional until the major findings are resolved.

## Phase Verdict

Needs Rework

Rationale:

* Core Phase 1 implementation is present and lint/build validated
* Major contract-consistency and test-alignment findings prevent a full pass

## Recommended Next Validations

* Validate Phase 1 again after removing or strictly scoping repository `legacy-...` command identity fallback
* Re-run integration suites that post to `/api/tiles/place` with a real test DB after updating all payloads to include `commandId`
* Add and run deterministic malformed-command-identity route tests
* Execute full workspace validation (`npm run lint`, `npm run build`, `npm run test`) after the above updates

## Clarifying Questions

1. Should missing `commandId` be rejected at repository/service boundaries as a hard invariant, or is compatibility fallback intentionally required for a defined transition period?
2. If fallback is intentional, what is the deprecation timeline and which callers are approved to use it?
3. Do you want malformed command identity coverage in unit route tests, integration tests, or both?