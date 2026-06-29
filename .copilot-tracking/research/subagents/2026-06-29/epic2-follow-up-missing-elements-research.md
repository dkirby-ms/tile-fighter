---
title: Epic 2 Follow-Up Missing Elements Research
description: Implementation-relevant findings for unresolved Epic 2 follow-up items from epic-follow-up-audit.
author: GitHub Copilot Researcher Subagent
ms.date: 2026-06-29
ms.topic: reference
keywords:
  - epic-2
  - backlog
  - throttle
  - jwt
  - region-diff
  - authorization
estimated_reading_time: 14
---

## Scope

Source unresolved items from `.copilot-tracking/research/2026-06-29/epic-follow-up-audit.md`:

1. #14 DR-03 placement throttle policy definition gap.
2. #14 DR-04 test DB skip semantics strategy.
3. #15 DD-02 JWT claim contract formalization.
4. #16 DR-01 region diff delete semantics or tombstones.
5. #16 DR-02 viewport or payload hard limits.
6. #16 DR-03 authorization scope or membership checks for region diff API.

Primary evidence reviewed:

* docs/layer1-backlog.md
* apps/server/src/http/routes/tile.routes.ts
* apps/server/src/http/routes/region-diff.routes.ts
* apps/server/src/domain/region-diff.service.ts
* apps/server/src/http/auth-middleware.ts
* apps/server/src/http/routes/snapshot.routes.ts
* apps/server/tests/integration/* and unit tests for auth, tile, region diff, startup smoke
* `.copilot-tracking/research/subagents/2026-06-29/issue-15-region-snapshot-replay-recovery-research.md`
* `.copilot-tracking/research/subagents/2026-06-29/issue-16-region-diff-retrieval-research.md`
* `.copilot-tracking/details/2026-06-29/issue-14-authoritative-placement-self-edit-window-details.md`

## Current-State Snapshot

* Region diff API already exists with temporary defaults and validation:
  * `MAX_VIEWPORT_AREA = 10_000`
  * `DEFAULT_MAX_TILES = 500`
  * `MAX_MAX_TILES = 1_000`
  * source: apps/server/src/http/routes/region-diff.routes.ts
* Region diff service currently supports latest-wins compaction and passes through `delete` operation values if present in `tile_deltas`, but write paths only emit `upsert`.
  * source: apps/server/src/domain/region-diff.service.ts
  * source: apps/server/src/persistence/tile.repository.ts
* Auth middleware maps operator status using role-first and `scp` fallback.
  * source: apps/server/src/http/auth-middleware.ts
* Snapshot restore route is operator-gated, but region diff route is auth-only (no membership check).
  * source: apps/server/src/http/routes/snapshot.routes.ts
  * source: apps/server/src/http/routes/region-diff.routes.ts
* Integration and smoke tests already use `it.skipIf(!testsCanRun || !db)` pattern when `TEST_DATABASE_URL` connectivity is missing.
  * source: apps/server/tests/integration/startup-migration.smoke.test.ts
  * source: apps/server/tests/integration/region-diff.integration.test.ts
  * source: apps/server/tests/integration/tile-persistence.integration.test.ts

## Findings And Recommendations By Gap

### #14 DR-03 Placement throttle policy definition gap

Recommendation:

* Formalize a server-enforced placement throttle contract in config and route-level enforcement, then mirror it in backlog acceptance language.
* Suggested baseline policy for product decision: account + region key, sliding window, example `N placements / 60s` with 429 on breach.

Likely files to change:

* docs/layer1-backlog.md (explicit throttle values and acceptance criteria text)
* apps/server/src/config/env.ts (new throttle env vars and defaults)
* apps/server/src/http/routes/tile.routes.ts (enforcement hook)
* apps/server/src/http/app.ts (dependency injection for limiter)
* apps/server/src/telemetry/telemetry-sink.ts (throttle-rejected event helper)
* apps/server/tests/integration/tile-persistence.integration.test.ts (429 scenario)
* apps/server/tests/unit or integration for limiter behavior (new/extended)

Rationale:

* Backlog currently states per-account rate-limit requirement but not concrete numbers.
* Lack of explicit policy causes unstable behavior and test ambiguity.

Risk:

* Too strict harms legitimate collaborative bursts.
* Too loose allows write amplification spam.

### #14 DR-04 Test DB skip semantics strategy

Recommendation:

* Standardize and document skip semantics as the intended local-dev fallback while preserving CI strictness.
* Keep existing `skipIf` behavior locally; enforce `TEST_DATABASE_URL` presence in CI integration job so skipped tests are not treated as pass.

Likely files to change:

* docs/layer1-backlog.md (test strategy note)
* README.md or apps/server/README.md (local run behavior and required env)
* .github/workflows/ci.yml (if not already enforcing TEST_DATABASE_URL and non-skip integration gates)
* optionally shared test utility in apps/server/tests (to avoid per-file duplication)

Rationale:

* Current tests already implement graceful local skip.
* Without CI guardrails, skip semantics can mask regressions.

Risk:

* Silent under-testing if CI does not require DB preconditions.

### #15 DD-02 JWT claim contract formalization

Recommendation:

* Freeze a canonical operator claim contract and remove permissive fallback semantics over time.
* Near-term: codify precedence and accepted claim names in shared types + docs.
* Mid-term: tighten middleware to one canonical claim source with migration period.

Likely files to change:

* packages/shared-types/src/index.ts (principal and authorization claim contract)
* apps/server/src/http/auth-middleware.ts (mapping logic and deprecation path)
* docs/layer1-backlog.md (explicit contract note for operator-restricted actions)
* apps/server/tests/unit/auth-middleware.test.ts (claim mapping matrix)
* apps/server/tests/integration/http-auth.integration.test.ts and snapshot auth tests (operator behavior)

Rationale:

* Current role-first + scope fallback exists by design debt marker.
* Security-sensitive admin routes depend on stable claim interpretation.

Risk:

* Contract tightening can break existing tokens if migration is abrupt.

### #16 DR-01 Region diff delete semantics or tombstones

Recommendation:

* Adopt explicit tombstone semantics now for API correctness under stale clients and viewport replay.
* Define that deletes produce `operation: "delete"` with nullable payload fields and monotonic version.

Likely files to change:

* packages/shared-types/src/index.ts (diff contract docs/types for delete payload)
* apps/server/src/persistence/migrations/* (if tile deletion support and delta capture are added)
* apps/server/src/persistence/tile.repository.ts (emit `tile_deltas.operation = delete` on delete path)
* apps/server/src/domain/region-diff.service.ts (ensure delete compaction semantics)
* apps/server/src/http/routes/region-diff.routes.ts (validation and response shaping)
* apps/server/tests/unit/region-diff.service.test.ts (delete compaction test)
* apps/server/tests/integration/region-diff.integration.test.ts (stale client receives delete tombstone)

Rationale:

* Diff responses already allow delete operation but write path never emits it.
* Deferring tombstones creates correctness holes for stale clients after deletions.

Risk:

* If product chooses hard-delete-without-tombstone later, clients may retain ghost tiles.

### #16 DR-02 Viewport or payload hard limits

Recommendation:

* Promote current hard-coded limits to explicit config and product-approved constants.
* Record operational envelope: max viewport area, max tiles, and optional max request frequency.

Likely files to change:

* docs/layer1-backlog.md (explicit limits with rationale)
* apps/server/src/config/env.ts (region diff limit env vars)
* apps/server/src/http/routes/region-diff.routes.ts (read values from config)
* apps/server/src/index.ts and apps/server/src/http/app.ts (inject config)
* apps/server/tests/unit/region-diff.service.test.ts and/or route tests (boundary tests)
* apps/server/tests/integration/region-diff.integration.test.ts (400 for limit violations)

Rationale:

* Limits exist in code but are not product/ops-aligned contractual values.
* Making them configurable supports staged tuning from load results.

Risk:

* Overly large limits increase read amplification and latency spikes.
* Overly small limits increase client churn via excessive paging requests.

### #16 DR-03 Authorization scope or membership checks for region diff API

Recommendation:

* Add explicit region membership/entitlement check for diff reads instead of auth-only access.
* Minimal viable policy: principal must have active session membership for requested region or room mapping.

Likely files to change:

* apps/server/src/http/routes/region-diff.routes.ts (authorization check before service call)
* apps/server/src/session/session-lifecycle.service.ts (expose membership query primitive if needed)
* apps/server/src/http/app.ts (inject lifecycle/membership dependency into diff routes)
* packages/shared-types/src/index.ts (authorization error contract if standardized)
* apps/server/tests/integration/region-diff.integration.test.ts (403 coverage)
* possibly apps/server/tests/unit/session-lifecycle.service.test.ts (membership semantics)

Rationale:

* Current route validates only authentication.
* Product debt note explicitly calls out unresolved membership requirements.

Risk:

* Without membership checks, authenticated users can enumerate or scrape arbitrary region diffs.

## Dependencies And Sequencing Constraints

Proposed sequence:

1. Contract decisions first: JWT claim contract, tombstone semantics, and hard limits.
2. Authorization and policy surfaces second: membership checks + throttle policy.
3. Implementation and wiring third: env, routes, service, repository.
4. Tests and CI semantics fourth: integration boundary tests + DB skip policy in CI docs/workflow.

Hard dependencies:

* Membership checks depend on finalized claim and principal contract.
* Tombstone implementation depends on product decision for deletion behavior.
* Load-limit tuning depends on selected hard-limit defaults and load harness baselines.

## Parallelization Plan

Can be split into parallel phases:

* Phase A: Security and contract hardening
  * JWT claim contract formalization.
  * Region diff authorization membership checks.
* Phase B: Diff correctness and limits
  * Tombstone delete semantics.
  * Viewport/payload hard limits.
* Phase C: Placement policy and test strategy
  * Placement throttle policy.
  * Test DB skip semantics CI/local strategy.

Parallelization caveats:

* Phase A should finalize before Phase B integration tests that assert auth behavior.
* Phase B tombstone decision should finalize before client contract lock.
* Phase C mostly independent, except shared telemetry naming and env config conventions.

## Validation Commands And Test Targets

Workspace and package validation:

* `npm run -w @game/server lint`
* `npm run -w @game/server build`
* `npm run -w @game/server test`

Focused tests likely required after each item:

* `npm run -w @game/server test -- tests/unit/auth-middleware.test.ts`
* `npm run -w @game/server test -- tests/unit/region-diff.service.test.ts`
* `npm run -w @game/server test -- tests/integration/region-diff.integration.test.ts`
* `npm run -w @game/server test -- tests/integration/tile-persistence.integration.test.ts`
* `npm run -w @game/server test -- tests/integration/startup-migration.smoke.test.ts`
* `npm run -w @game/server test:load` (plus a dedicated region-diff load harness if added)

CI behavior check for #14 DR-04:

* Verify CI workflow fails integration stage when DB preconditions are missing, instead of reporting skipped suites as green.

## Decision-Ready Summary

Highest implementation risk if left unresolved:

1. #14 DR-03 placement throttle values (abuse and fairness).
2. #16 DR-03 membership authorization for region diff (data exposure risk).
3. #16 DR-01 tombstone semantics (state correctness for stale clients).

Most execution-ready immediately:

* #14 DR-04 test DB skip semantics documentation and CI gating strategy.
* #16 DR-02 externalizing hard limits from route constants into config.
* #15 DD-02 JWT claim contract codification in shared types and middleware tests.

## Product Decisions Still Required

1. Exact throttle envelope for tile placement:
   * Scope key: per account only, or account + region.
   * Limit and window values.
2. Canonical operator authorization claim source:
   * roles only, scopes only, or migration plan from hybrid.
3. Delete behavior product contract:
   * tombstones required immediately versus deferral.
4. Region diff hard limits:
   * approved `MAX_VIEWPORT_AREA`, `DEFAULT_MAX_TILES`, `MAX_MAX_TILES` values.
5. Membership policy for diff reads:
   * room/session membership required versus any authenticated user in tenant.
6. CI policy for integration DB availability:
   * strict fail if unavailable versus explicit allowed-skip mode by branch type.

## Research Status

Complete for requested scope.
