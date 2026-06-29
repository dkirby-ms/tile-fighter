<!-- markdownlint-disable-file -->
# Implementation Details: Epic 2 Follow-Up Missing Elements Remediation

## Context Reference

Sources: .copilot-tracking/research/2026-06-29/epic-follow-up-audit.md, .copilot-tracking/research/subagents/2026-06-29/epic2-follow-up-missing-elements-research.md, .copilot-tracking/research/2026-06-29/epic2-follow-up-missing-elements-remediation-research.md, docs/layer1-backlog.md, and /memories/repo/ci-notes.md.

## Implementation Phase 1: Policy and Contract Baseline

<!-- parallelizable: false -->

### Step 1.0: Capture unresolved policy decisions with owners and defaults

Create a short decision register entry for each unresolved product or ops decision so downstream implementation steps have explicit guidance and fallback behavior.

Files:
* .copilot-tracking/plans/logs/2026-06-29/epic2-follow-up-missing-elements-remediation-log.md - Add decision register entries for throttle values, JWT claim source, tombstones, hard limits, membership model, and CI DB semantics.

Discrepancy references:
* Addresses DR-01 through DR-05 in planning log by assigning status, owner, due date, and default implementation behavior.

Success criteria:
* Every unresolved decision has a recorded owner and decision due date.
* Every unresolved decision has a default implementation fallback explicitly documented.

Context references:
* .copilot-tracking/research/2026-06-29/epic2-follow-up-missing-elements-remediation-research.md (Research Gaps Requiring Product or Ops Decision section).

Dependencies:
* None.

### Step 1.1: Refine backlog and docs for explicit unresolved policy decisions

Update backlog text and implementation-facing docs to explicitly state currently unresolved decision points and selected defaults for this remediation cycle.

Files:
* docs/layer1-backlog.md - Add explicit acceptance language for throttle policy, diff hard limits, tombstones, authz scope, and DB skip semantics.
* README.md - Add concise reference to integration DB prerequisites and local skip semantics where relevant.
* apps/server/README.md - Add server-specific behavior for policy defaults, CI expectations, and environment variables.

Discrepancy references:
* Addresses DR-03 (#14), DR-04 (#14), DR-01 (#16), DR-02 (#16), DR-03 (#16).

Success criteria:
* Each unresolved item from the audit is represented as explicit backlog acceptance or explicit deferred follow-on note.
* Docs distinguish local developer behavior from CI-required behavior for DB-dependent integration tests.

Context references:
* .copilot-tracking/research/2026-06-29/epic-follow-up-audit.md (Cross-Epic Summary and Recommendations sections).
* docs/layer1-backlog.md (Lines 132-176) - Existing E2-S2 and E2-S4 story language.

Dependencies:
* None.

### Step 1.2: Define shared contract updates for JWT claims and region diff delete/limit semantics

Update shared types to lock contract language for operator claims, diff operation semantics, and limit fields consumed by route and tests.

Files:
* packages/shared-types/src/index.ts - Add claim contract notes/types and region diff semantics fields (including delete/tombstone semantics decision state).

Discrepancy references:
* Addresses DD-02 (#15), DR-01 (#16), DR-02 (#16).

Success criteria:
* Shared types expose one canonical operator claim contract or clearly documented staged transition contract.
* Region diff request/response types include explicit limits and operation semantics that match backlog decisions.

Context references:
* apps/server/src/http/auth-middleware.ts - Current role-first + scope fallback behavior.
* apps/server/src/http/routes/region-diff.routes.ts - Existing request and response semantic surface.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Validate policy and contract baseline

Run targeted checks to ensure docs and shared types compile and remain lint-clean before branching into parallel implementation lanes.

Validation commands:
* npm run -w @game/server lint
* npm run -w @game/server build

## Implementation Phase 2: Placement and Quality Controls Lane

<!-- parallelizable: false -->

### Step 2.1: Implement configurable placement throttle policy and telemetry rejections

Add runtime-configurable placement throttling and deterministic rejection behavior with telemetry emission.

Files:
* apps/server/src/config/env.ts - Add throttle environment variables and defaults.
* apps/server/src/http/routes/tile.routes.ts - Enforce throttle policy before placement mutation path.
* apps/server/src/http/app.ts - Inject throttle dependency/config into route wiring.
* apps/server/src/telemetry/telemetry-sink.ts - Add throttle rejection telemetry helper.
* apps/server/tests/integration/tile-persistence.integration.test.ts - Add acceptance tests for throttled rejection behavior.

Discrepancy references:
* Addresses DR-03 (#14).

Success criteria:
* Placement policy is configurable by environment and not hardcoded in route logic.
* Breach path returns deterministic throttle error contract and emits telemetry event.
* Integration tests cover accepted, rejected, and recovery window scenarios.

Context references:
* .copilot-tracking/research/subagents/2026-06-29/epic2-follow-up-missing-elements-research.md - Throttle recommendation and impacted files.

Dependencies:
* Implementation Phase 1 completion.

### Step 2.2: Implement test DB skip strategy standardization with CI guardrails

Normalize integration DB skip semantics across tests and ensure CI enforces DB preconditions when integration suites are expected to run.

Files:
* apps/server/tests/integration/startup-migration.smoke.test.ts - Align with shared skip guard pattern if needed.
* apps/server/tests/integration/region-diff.integration.test.ts - Align skip guard semantics if needed.
* apps/server/tests/integration/tile-persistence.integration.test.ts - Align skip guard semantics if needed.
* .github/workflows/ci.yml - Enforce DB precondition requirement for integration job or explicit skip mode declaration.
* apps/server/README.md - Document CI and local semantics.

Discrepancy references:
* Addresses DR-04 (#14).

Success criteria:
* Local developer workflows can skip DB-dependent integration tests with explicit guard behavior.
* CI configuration prevents a false-green where required DB-backed tests are silently skipped.

Context references:
* /memories/repo/ci-notes.md - Existing CI and workspace command constraints.

Dependencies:
* Implementation Phase 1 completion.

### Step 2.3: Validate placement and CI policy lane

Run focused tests and static checks for placement and CI-documentation updates.

Validation commands:
* npm run -w @game/server test -- tests/integration/tile-persistence.integration.test.ts
* npm run -w @game/server lint

## Implementation Phase 3: Region Diff Correctness and Limits Lane

<!-- parallelizable: false -->

### Step 3.1: Externalize and enforce region diff viewport and payload limits from config

Replace hardcoded region diff limits with env-driven config and keep request validation deterministic.

Files:
* apps/server/src/config/env.ts - Add region diff limit variables and defaults.
* apps/server/src/http/routes/region-diff.routes.ts - Replace route-local constants with injected/config values.
* apps/server/src/http/app.ts - Wire config into diff route registration.
* apps/server/tests/integration/region-diff.integration.test.ts - Add boundary tests for configured limits.

Discrepancy references:
* Addresses DR-02 (#16).

Success criteria:
* Route enforces limit values from config with clear 400 responses for violations.
* Tests assert behavior at boundary and out-of-bound values.

Context references:
* apps/server/src/http/routes/region-diff.routes.ts - Existing MAX_VIEWPORT_AREA and MAX_MAX_TILES defaults.

Dependencies:
* Implementation Phase 1 completion.

### Step 3.2: Implement finalized delete/tombstone semantics in persistence and diff assembly

Apply selected delete semantics (mandatory tombstones or explicit defer with guardrails) in persistence and diff response assembly.

Files:
* apps/server/src/persistence/tile.repository.ts - Emit delete deltas or explicit non-support path per decided contract.
* apps/server/src/domain/region-diff.service.ts - Ensure compaction handles delete operations according to contract.
* packages/shared-types/src/index.ts - Finalize operation contract fields if additional detail required.
* apps/server/tests/unit/region-diff.service.test.ts - Add delete compaction semantics tests.
* apps/server/tests/integration/region-diff.integration.test.ts - Add stale-client deletion scenario coverage.

Discrepancy references:
* Addresses DR-01 (#16).

Success criteria:
* Delete semantics behavior is explicitly represented in repository/service logic and tests.
* Client-visible diff contract is stable and documented.

Context references:
* .copilot-tracking/research/subagents/2026-06-29/epic2-follow-up-missing-elements-research.md - Tombstone recommendation and risks.

Dependencies:
* Step 3.1 completion.

### Step 3.3: Validate diff correctness and limit controls

Run focused tests for region diff correctness, limit enforcement, and load characteristics.

Validation commands:
* npm run -w @game/server test -- tests/unit/region-diff.service.test.ts
* npm run -w @game/server test -- tests/integration/region-diff.integration.test.ts
* npm run -w @game/server test -- tests/load/region-diff-load.ts

## Implementation Phase 4: Auth Contract and Membership Authorization Lane

<!-- parallelizable: false -->

### Step 4.1: Formalize JWT operator claim contract and transition behavior

Replace ambiguous claim interpretation with a contract-defined mapping strategy and explicit migration handling.

Files:
* apps/server/src/http/auth-middleware.ts - Implement finalized claim mapping behavior.
* packages/shared-types/src/index.ts - Keep principal claim contract in shared types.
* apps/server/tests/unit/auth-middleware.test.ts - Add claim matrix coverage for canonical and transitional token shapes.
* apps/server/tests/integration/http-auth.integration.test.ts - Validate auth behavior for operator-protected routes.

Discrepancy references:
* Addresses DD-02 (#15).

Success criteria:
* Operator authorization behavior is deterministic for documented token claim formats.
* Transitional behavior is either removed or explicitly bounded and tested.

Context references:
* .copilot-tracking/research/subagents/2026-06-29/epic2-follow-up-missing-elements-research.md - JWT contract guidance.

Dependencies:
* Implementation Phase 1 completion.

### Step 4.2: Add region membership authorization checks for region diff API

Enforce region diff access using membership-aware authorization, not authentication alone.

Files:
* apps/server/src/http/routes/region-diff.routes.ts - Add membership authorization check before diff retrieval.
* apps/server/src/session/session-lifecycle.service.ts - Expose membership query function if needed.
* apps/server/src/http/app.ts - Inject membership dependency for route wiring.
* apps/server/tests/integration/region-diff.integration.test.ts - Add 403 coverage for authenticated non-members.

Discrepancy references:
* Addresses DR-03 (#16).

Success criteria:
* Authenticated non-members cannot retrieve region diffs.
* Authorized members still pass existing unchanged/stale diff paths.

Context references:
* apps/server/src/http/routes/snapshot.routes.ts - Existing operator-gated route pattern.

Dependencies:
* Step 4.1 completion.

### Step 4.3: Validate auth and membership lane

Run focused auth and membership tests and ensure no regressions in related integration paths.

Validation commands:
* npm run -w @game/server test -- tests/unit/auth-middleware.test.ts
* npm run -w @game/server test -- tests/integration/http-auth.integration.test.ts
* npm run -w @game/server test -- tests/integration/region-diff.integration.test.ts

## Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all project-level validation commands after all implementation lanes merge.

Validation commands:
* npm run lint
* npm run build
* npm run test

### Step 5.2: Fix minor validation issues

Resolve straightforward lint/type/test failures that are directly caused by remediation changes. Avoid broad refactors in this phase.

### Step 5.3: Report blocking issues

If failures require substantial redesign or new product decisions, document blockers, impacted files, and recommended follow-on planning.

## Dependencies

* Product/ops decisions for exact numeric limits and tombstone policy.
* Existing DB-backed integration infrastructure and CI secrets.
* Server workspace tooling under @game/server.

## Success Criteria

* All six unresolved Epic 2 follow-up elements have concrete implementation and validation steps.
* Sequencing dependencies between placement, diff correctness, and auth lanes are explicitly enforced after Phase 1 contracts are complete.
* Final validation includes lint, build, and full test execution with no critical unresolved blockers.
