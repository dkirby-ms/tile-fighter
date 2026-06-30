<!-- markdownlint-disable-file -->
# Research: Epic 2 Follow-Up Missing Elements Remediation

## Scope

Plan remediation work for unresolved items identified in:

* .copilot-tracking/research/2026-06-29/epic-follow-up-audit.md
* .copilot-tracking/research/subagents/2026-06-29/epic2-follow-up-missing-elements-research.md

Targeted unresolved items:

* DR-03 (#14): Placement throttle policy definition
* DR-04 (#14): Test DB availability and skip semantics strategy
* DD-02 (#15): JWT claim contract formalization
* DR-01 (#16): Region diff delete semantics and tombstones
* DR-02 (#16): Viewport and payload hard limits
* DR-03 (#16): Region diff authorization scope and membership checks

## Verified Context

* Backlog currently states required controls but leaves key values and policy contracts ambiguous for E2-S2 and E2-S4.
* Region diff route currently has hardcoded defaults for max viewport area and max tiles, not product/ops-approved config.
* Region diff route currently enforces authentication but not region or room membership authorization.
* Auth middleware currently uses role-first plus scope fallback behavior for operator privileges.
* Integration test suites already contain local skip guards when integration DB prerequisites are unavailable.
* Repository workspace package name is @game/server and must be used for targeted workspace commands.

## Impacted Files (Likely)

Backlog and docs:

* docs/layer1-backlog.md
* README.md
* apps/server/README.md
* .github/workflows/ci.yml

Server config and auth:

* apps/server/src/config/env.ts
* apps/server/src/http/auth-middleware.ts
* packages/shared-types/src/index.ts
* apps/server/src/http/app.ts

Placement throttling:

* apps/server/src/http/routes/tile.routes.ts
* apps/server/src/telemetry/telemetry-sink.ts

Region diff policy and authorization:

* apps/server/src/http/routes/region-diff.routes.ts
* apps/server/src/domain/region-diff.service.ts
* apps/server/src/session/session-lifecycle.service.ts

Delete semantics and delta/tombstones:

* apps/server/src/persistence/tile.repository.ts
* apps/server/src/persistence/migrations/* (if data-shape changes required)

Tests:

* apps/server/tests/unit/auth-middleware.test.ts
* apps/server/tests/integration/http-auth.integration.test.ts
* apps/server/tests/integration/region-diff.integration.test.ts
* apps/server/tests/integration/tile-persistence.integration.test.ts
* apps/server/tests/load/region-diff-load.ts

## Implementation Path Evaluation

### Selected Path

Policy-first remediation with staged hardening:

1. Clarify and lock contracts in backlog/docs and shared types.
2. Implement enforcement in server routes and services.
3. Add/adjust tests and CI behavior to prevent silent policy drift.

Why selected:

* Resolves the highest risk ambiguities before implementation details diverge.
* Prevents route-level fixes from being blocked by unresolved policy semantics.
* Aligns with existing modular boundaries in server routes, middleware, config, and persistence.

### Alternate Path A (Rejected)

Implement all technical controls first and defer policy docs update.

Trade-offs:

* Faster code delivery short-term.
* High risk of undocumented behavior and subsequent rework.

Rejection rationale:

* Research already identifies policy ambiguity as core debt.

### Alternate Path B (Rejected)

Open separate stories for each unresolved item and avoid integrated remediation plan.

Trade-offs:

* Better issue isolation.
* Higher coordination overhead and delayed risk reduction.

Rejection rationale:

* Follow-up scope is tightly coupled around auth, policy limits, and diff correctness.

## Parallelization Feasibility

Parallelizable lanes after policy contract alignment:

* Lane A: Placement throttle policy and enforcement
* Lane B: Region diff hard limits and tombstone semantics
* Lane C: JWT claim contract + membership authorization checks

Sequencing constraints:

* JWT claim contract must be finalized before locking authz test assertions.
* Tombstone semantics must be decided before finalizing diff response contract and tests.
* CI DB skip strategy should be finalized before final validation criteria is declared complete.

## Validation Strategy

Phase-level and final validation should use:

* npm run -w @game/server lint
* npm run -w @game/server build
* npm run -w @game/server test
* Focused test commands for auth middleware, region-diff integration, tile-persistence integration

CI-specific verification:

* Ensure integration workflow fails when TEST_DATABASE_URL preconditions are required but missing.
* Preserve local skip semantics while preventing CI false-green outcomes.

## Research Gaps Requiring Product or Ops Decision

* Exact placement throttle values and keying model.
* Canonical JWT operator claim source (roles-only vs scopes-only vs staged migration).
* Mandatory-now vs deferred tombstone semantics for delete events.
* Approved hard caps for viewport area and max payload tile count.
* Required membership model for region diff access.
* CI policy for DB-precondition enforcement versus explicit allowed-skip mode.
