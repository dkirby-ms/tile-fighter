---
title: E3-S3 Phase 2 Validation Report
description: Validation of Phase 2 checklist implementation against changes log, research, and repository evidence
ms.date: 2026-06-30
ms.topic: how-to
---
<!-- markdownlint-disable-file -->

## Validation Scope

* Plan: `.copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md`
* Changes log: `.copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md`
* Research: `.copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md`
* Phase: `2`
* Through-line: Transactional idempotency ledger and deterministic conflict mapping

## Method

* Read plan Phase 2 checklist and detailed implementation notes.
* Matched each Step 2.x item to concrete code and tests.
* Verified implementation in repository files, not only changes log claims.
* Checked script-level validation command availability for Step 2.4 evidence.

## Phase 2 Checklist Coverage

### Step 2.1: Add placement command ledger schema and database types

Status: Implemented

Evidence:
* Ledger table migration created with required fields and indexes in `apps/server/src/persistence/migrations/1760000000000_placement_commands.js:7`.
* Uniqueness constraint `(region_id, actor_id, command_id)` present in `apps/server/src/persistence/migrations/1760000000000_placement_commands.js:61`.
* Replay-window indexes present in `apps/server/src/persistence/migrations/1760000000000_placement_commands.js:66`, `apps/server/src/persistence/migrations/1760000000000_placement_commands.js:70`, and `apps/server/src/persistence/migrations/1760000000000_placement_commands.js:74`.
* DB typing for `placement_commands` added in `apps/server/src/persistence/db.ts:89` and registered in `apps/server/src/persistence/db.ts:113`.

Assessment:
* Meets Phase 2.1 checklist and research schema expectations.

### Step 2.2: Implement replay/mismatch/fresh-command transaction branches in persistence

Status: Partially implemented (functional with deviation)

Evidence:
* Command-ledger lookup and lock path in `apps/server/src/persistence/tile.repository.ts:266`.
* Deterministic mismatch branch in `apps/server/src/persistence/tile.repository.ts:278` and `apps/server/src/persistence/tile.repository.ts:562`.
* Replay mapping branch in `apps/server/src/persistence/tile.repository.ts:286` and `apps/server/src/persistence/tile.repository.ts:513`.
* Fresh-command ledger insert/update paths in `apps/server/src/persistence/tile.repository.ts:303`, `apps/server/src/persistence/tile.repository.ts:352`, and `apps/server/src/persistence/tile.repository.ts:623`.
* Unit coverage for replay, mismatch, conflict metadata, and retry-no-duplicate behavior in `apps/server/tests/unit/tile.repository.command-ledger.test.ts:188`, `apps/server/tests/unit/tile.repository.command-ledger.test.ts:225`, `apps/server/tests/unit/tile.repository.command-ledger.test.ts:309`, and `apps/server/tests/unit/tile.repository.command-ledger.test.ts:361`.

Assessment:
* Core transactional branches exist and are covered by tests.
* Deviation exists: repository silently synthesizes legacy command IDs when missing (see Findings).

### Step 2.3: Map deterministic HTTP outcomes for loser, replay, and mismatch responses

Status: Implemented

Evidence:
* Route-level `commandId` validation and malformed identity response in `apps/server/src/http/routes/tile.routes.ts:116`, `apps/server/src/http/routes/tile.routes.ts:155`, and `apps/server/src/http/routes/tile.routes.ts:158`.
* Mismatch response mapping with deterministic conflict code in `apps/server/src/http/routes/tile.routes.ts:213`.
* Deterministic loser conflict mapping `placement_conflict_idempotent` in `apps/server/src/http/routes/tile.routes.ts:224`.
* HTTP app maps repository mismatch and occupied outcomes for route consumption in `apps/server/src/http/app.ts:143` and `apps/server/src/http/app.ts:161`.
* Shared contract includes required deterministic conflict codes in `packages/shared-types/src/index.ts:93` and `packages/shared-types/src/index.ts:109`.
* Integration test assertions for loser and mismatch payload contracts in `apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:219`, `apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:345`, and `apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:346`.

Assessment:
* Meets Phase 2.3 payload/response contract requirements.

### Step 2.4: Validate phase changes (migration + targeted tests)

Status: Partially evidenced

Evidence:
* Plan/details specify migration command `npm run -w @game/server migrate` in `.copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:141`.
* Server workspace scripts do not define `migrate`; they define `migrate:up`/`migrate:down` in `apps/server/package.json:14`.
* Changes log explicitly records this command drift in `.copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md:46`.

Assessment:
* Equivalent migration capability exists, but the documented Phase 2 validation command is inaccurate.
* Validation evidence is present as narrative, but strict checklist command traceability is incomplete.

## Findings by Severity

### Critical

* None.

### Major

1. Repository allows implicit `commandId` fallback, deviating from explicit command identity requirement

Evidence:
* Fallback generation in `apps/server/src/persistence/tile.repository.ts:175` and `apps/server/src/persistence/tile.repository.ts:180`.
* Shared contract requires `commandId` as first-class input in `packages/shared-types/src/index.ts:57`.
* Research selected approach emphasizes explicit command identity for deterministic idempotency and collision safety in `.copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md`.

Why this matters:
* Non-HTTP callers can bypass strict identity semantics, weakening consistency of idempotent behavior and making misuse harder to detect.

Recommendation:
* Remove legacy fallback for production paths, or gate it behind explicit compatibility configuration with telemetry and sunset criteria.

### Minor

1. Phase 2 validation command in details is not executable as written

Evidence:
* Declared command in `.copilot-tracking/details/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-details.md:141`.
* Actual script names in `apps/server/package.json:14`.
* Drift acknowledged in `.copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md:46`.

Why this matters:
* Reduces auditability of whether the exact planned validation procedure was followed.

Recommendation:
* Align plan/details/checklist command text with actual workspace scripts (`migrate:up`) and capture command outputs in the changes log.

### Info

1. Core Phase 2 behavior is well covered by targeted unit/integration tests, with strong evidence for replay, mismatch, and deterministic loser mapping

Evidence:
* `apps/server/tests/unit/tile.repository.command-ledger.test.ts:188`
* `apps/server/tests/unit/tile.repository.command-ledger.test.ts:225`
* `apps/server/tests/unit/tile.repository.command-ledger.test.ts:361`
* `apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:219`
* `apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:345`

## Omissions, Regressions, Unsupported Claims

* Omission: No hard enforcement at repository boundary for missing `commandId` in all call paths.
* Unsupported claim risk: Phase 2 Step 2.4 command-level validation trace is not strictly reproducible from documented command text.
* No direct regression detected in deterministic conflict mapping behavior from Phase 2 scope.

## Coverage Summary

* Checklist items fully implemented: 2 / 4 (Step 2.1, Step 2.3)
* Checklist items partially satisfied: 2 / 4 (Step 2.2, Step 2.4)
* Checklist items missing: 0 / 4

Approximate coverage: 75%

## Phase Verdict

Verdict: Needs Rework

Rationale:
* Core implementation exists and is largely correct.
* One major behavioral deviation (implicit command identity fallback) and one minor validation-traceability issue prevent a full Pass for Phase 2.

## Clarifying Questions

1. Should repository-level callers be required to provide `commandId` with no fallback, or is temporary compatibility fallback intentionally in-scope for this phase?
2. For validation traceability, should future changes logs include exact command outputs for Phase 2 checklist commands (especially migration/test commands)?
