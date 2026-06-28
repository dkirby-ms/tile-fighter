<!-- markdownlint-disable-file -->
# Implementation Details: Epic Layer1 E1 Core Platform and Auth Session Spine

## Context Reference

Sources: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md, docs/layer1-backlog.md, apps/server/src/index.ts, apps/server/src/http/routes/protected.routes.ts, apps/server/src/rooms/arena.room.ts.

## Implementation Phase 1: Session Bootstrap Vertical Slice (E1-S1)

<!-- parallelizable: false -->

### Step 1.1: Add bootstrap API contract on protected routes

Create a dedicated authenticated bootstrap route that returns shell-init payload for the logged-in principal and initial session metadata needed by the playable shell.

Files:
* apps/server/src/http/routes/session.routes.ts - New protected session routes module with bootstrap endpoint.
* apps/server/src/http/app.ts - Register session routes under authenticated route stack.
* apps/server/src/http/routes/protected.routes.ts - Keep backward compatibility for profile endpoint while introducing bootstrap contract.

Discrepancy references:
* Addresses DR-01 by implementing missing bootstrap endpoint discovered in research.

Success criteria:
* Authenticated request to bootstrap endpoint returns a normalized payload (subject, tenant context, server time, shell init metadata).
* Unauthorized request returns non-leaky auth error path via existing middleware.
* Existing protected profile route behavior remains unchanged.

Context references:
* apps/server/src/http/routes/protected.routes.ts (Lines 1-16) - Existing minimal protected route baseline.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 57-58, 72-76) - Missing bootstrap endpoint and E1-S1 requirements.

Dependencies:
* Existing auth middleware and principal injection contract.

### Step 1.2: Add bootstrap integration tests and telemetry assertions

Add integration coverage for authorized and unauthorized bootstrap access and assert required telemetry/event emission hooks exist for session start and failure paths.

Files:
* apps/server/tests/integration/session-bootstrap.integration.test.ts - New integration suite for bootstrap path.
* apps/server/src/http/routes/session.routes.ts - Emit bootstrap success/failure telemetry hooks.

Discrepancy references:
* Addresses DR-01 by making E1-S1 acceptance testable and measurable.

Success criteria:
* Integration tests validate status codes and payload contract.
* Success path emits one session-start marker per bootstrap.
* Failure path emits bootstrap-failed marker with safe reason class.

Context references:
* docs/layer1-backlog.md (Lines 47-61) - E1-S1 acceptance and telemetry requirements.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 179-184) - S1 implementation details.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Add telemetry sink runtime and CI secret wiring

Add explicit telemetry sink configuration so session bootstrap and lifecycle events are operational in runtime and verifiable in non-prod CI execution.

Files:
* apps/server/src/config/env.ts - Add telemetry sink env validation schema and defaults.
* docs/cicd-harness.md - Document telemetry sink secret/variable contract for dev/prod/verify workflows.
* .github/workflows/verify-release.yml - Ensure telemetry sink env injection exists for verification runs.

Discrepancy references:
* Addresses DR-05 by implementing telemetry sink dependency identified in research.

Success criteria:
* Runtime fails fast when required telemetry sink configuration is missing in environments where telemetry is mandatory.
* Verification workflow passes telemetry sink values to server process.
* Docs specify ownership and naming for telemetry sink env/secret variables.

Context references:
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 205-210) - Telemetry sink sequencing dependency.

Dependencies:
* Step 1.2 completion.

### Step 1.4: Validate phase changes

Run focused tests and type checks for bootstrap slice.

Validation commands:
* npm run -w @game/server test -- session-bootstrap.integration.test.ts
* npm run -w @game/server build

## Implementation Phase 2: Join Token Issuance and Room Admission (E1-S2)

<!-- parallelizable: false -->

### Step 2.1: Implement short-lived room join token service

Introduce a dedicated service to mint and verify short-lived room join credentials with bounded claims and replay protection primitives for Colyseus-compatible room admission.

Files:
* apps/server/src/auth/join-token.service.ts - New join token mint/verify service.
* apps/server/src/auth/auth-service.ts - Extend auth service with join-token issuance/verification entry points.
* apps/server/src/config/env.ts - Add required env config for join token signing secret and TTL bounds.

Discrepancy references:
* Addresses DR-02 by adding dedicated join-token lifecycle that is missing today.

Success criteria:
* Join tokens include room identifier, subject, expiry, and nonce/jti.
* Token verification rejects expired and malformed tokens.
* TTL remains <= 120 seconds by default policy.
* Issuance/verification contract is scoped to room admission and does not define a second room-membership state machine.

Context references:
* apps/server/src/rooms/arena.room.ts (Lines 24-27) - Current direct access-token room auth path.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 59-60, 185-190) - Join-token gap and required behavior.

Dependencies:
* Implementation Phase 1 completion.

### Step 2.2: Add join token issuance endpoint and switch room auth contract

Expose protected join-token issuance route and update room `onAuth` path to validate room join tokens instead of raw access tokens, while preserving Colyseus lifecycle as the source of room-membership truth.

Files:
* apps/server/src/http/routes/session.routes.ts - Add join-token issuance endpoint.
* apps/server/src/index.ts - Wire join-token service dependencies through server bootstrap and room registration.
* apps/server/src/rooms/arena.room.ts - Validate room join token contract in `onAuth`.

Discrepancy references:
* Addresses DR-02 by converting room entry to explicit scoped credential model.

Success criteria:
* Authenticated client can request room join token for allowed room context.
* Room join rejects token room mismatch and replay attempts.
* Existing startup path remains stable.
* Room admission integrates with existing Colyseus auth/lifecycle path without introducing parallel room tracking state.

Context references:
* apps/server/src/index.ts (Lines 17-56) - Existing bootstrap wiring points.
* docs/layer1-backlog.md (Lines 62-76) - E1-S2 acceptance criteria.

Dependencies:
* Step 2.1 completion.

### Step 2.3: Add unit and integration coverage for join token flow

Add coverage for mint/verify behavior, replay handling, room mismatch rejection, and end-to-end join path.

Files:
* apps/server/tests/unit/join-token.service.test.ts - Unit tests for token service.
* apps/server/tests/integration/join-token.integration.test.ts - Integration tests for issuance and room join.
* apps/server/tests/unit/room-auth.test.ts - Extend existing room auth tests to new token contract.

Success criteria:
* Expiry, replay, malformed, and room mismatch scenarios are tested.
* Valid join token path passes integration test.

Context references:
* apps/server/tests/unit/room-auth.test.ts - Existing room auth baseline.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 185-190).

Dependencies:
* Step 2.2 completion.

### Step 2.4: Validate phase changes

Validation commands:
* npm run -w @game/server test -- join-token.integration.test.ts
* npm run -w @game/server test -- join-token.service.test.ts
* npm run -w @game/server build

## Implementation Phase 3: Colyseus Lifecycle and Presence Hygiene (E1-S3)

<!-- parallelizable: false -->

### Step 3.1: Implement non-authoritative lifecycle adapter for liveness tracking

Add a lightweight lifecycle adapter that derives multiplayer liveness from Colyseus room lifecycle hooks (`onJoin`, `onLeave`, disconnect/reconnect path), tracks auxiliary heartbeat metadata, and exposes cleanup hooks for non-authoritative presence management.

Files:
* apps/server/src/session/session-lifecycle.service.ts - New session heartbeat lifecycle manager.
* apps/server/src/config/env.ts - Add heartbeat TTL and cleanup interval configuration.
* apps/server/src/index.ts - Initialize lifecycle adapter scheduler and ensure graceful shutdown integration.

Discrepancy references:
* Addresses DR-03 by implementing missing heartbeat lifecycle manager.

Success criteria:
* Lifecycle adapter ingests Colyseus lifecycle transitions and maps them to presence metadata updates.
* Session heartbeat updates last-seen metadata without becoming room-membership authority.
* Stale metadata is detectable via TTL policy.
* Lifecycle cleanup process starts and stops with application lifecycle.

Context references:
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 61, 191-195) - Missing lifecycle manager and E1-S3 requirements.
* apps/server/src/index.ts (Lines 62-71) - Graceful shutdown integration points.

Dependencies:
* Implementation Phase 2 completion.

### Step 3.2: Add heartbeat endpoint/channel integration and stale-metadata cleanup behavior

Integrate heartbeat updates through protected HTTP route or room channel as auxiliary telemetry/presence metadata, and apply stale-metadata cleanup behavior without mutating active room membership outside Colyseus lifecycle transitions.

Files:
* apps/server/src/http/routes/session.routes.ts - Add heartbeat endpoint.
* apps/server/src/rooms/arena.room.ts - Emit heartbeat and disconnect lifecycle events.
* apps/server/src/session/session-lifecycle.service.ts - Implement stale cleanup and event emission.

Success criteria:
* Heartbeat requests update liveness state for authenticated session.
* Timeout path clears stale presence/session metadata.
* Session end path emits lifecycle telemetry.
* Room membership transitions continue to be driven by Colyseus lifecycle events.

Context references:
* docs/layer1-backlog.md (Lines 77-91) - E1-S3 acceptance criteria and telemetry.

Dependencies:
* Step 3.1 completion.

### Step 3.3: Add lifecycle test suites

Add unit and integration coverage for timeout, cleanup, and lifecycle event behavior.

Files:
* apps/server/tests/unit/session-lifecycle.service.test.ts - Unit tests for timeout and cleanup logic.
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts - Integration tests for heartbeat and stale-session cleanup.

Success criteria:
* Timeout and stale-metadata cleanup semantics are verified in deterministic tests.
* Heartbeat happy path and stale-session path both covered.
* Tests assert that active room membership is not managed by the lifecycle adapter.

Context references:
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 191-195).

Dependencies:
* Step 3.2 completion.

### Step 3.4: Validate phase changes

Validation commands:
* npm run -w @game/server test -- heartbeat-lifecycle.integration.test.ts
* npm run -w @game/server test -- session-lifecycle.service.test.ts
* npm run -w @game/server build

## Implementation Phase 4: Verification Gate and p50 Evidence (E1-S4)

<!-- parallelizable: false -->

### Step 4.1: Expand verification harness for protected route, bootstrap, and room join flow

Extend CI/release verification harness to cover existing protected profile route, authenticated bootstrap, and room join token flow in addition to health/readiness checks.

Files:
* .github/workflows/verify-release.yml - Add bootstrap and room join verification steps.
* docs/cicd-harness.md - Update verification checklist and required secrets/inputs.
* apps/server/tests/load/room-join-load.ts - Reuse or extend load harness inputs for join-token flow.

Discrepancy references:
* Addresses DR-04 by explicitly implementing E1-S4 verification gate requirements.

Success criteria:
* Verification workflow checks `/healthz`, `/readyz`, `/api/protected/profile`, authenticated bootstrap, and room-join flow.
* Promotion is blocked on failed protected-profile, bootstrap, or room-join verification.
* Verification run outputs traceable evidence artifact.
* Verification includes a regression check that room-membership authority remains in Colyseus lifecycle transitions.

Context references:
* docs/layer1-backlog.md (Lines 92-106) - E1-S4 acceptance criteria.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 74-75, 196-200).

Dependencies:
* Implementation Phase 1, Phase 2, and Phase 3 completion.

### Step 4.2: Define and capture authenticated playable shell p50 metric

Define measurement contract for "authenticated player reaches playable shell" and capture p50 evidence through repeatable non-prod validation run.

Files:
* docs/cicd-harness.md - Add p50 measurement contract and evidence collection method.
* docs/layer1-backlog.md - Align exit criteria wording with measurable contract.
* apps/server/tests/load/room-join-load.ts - Emit timing output needed for p50 calculation.

Discrepancy references:
* Addresses DR-06 by resolving ambiguous playable-shell metric definition.

Success criteria:
* Metric definition includes start/end boundaries, sample size, and environment assumptions.
* Validation run produces a p50 value and stores evidence in CI artifacts/logs.

Context references:
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 38-42, 197-200).

Dependencies:
* Step 4.1 completion.

### Step 4.3: Validate phase changes

Validation commands:
* npm exec prettier --check .github/workflows/*.yml docs/cicd-harness.md docs/layer1-backlog.md
* npm run -w @game/server test:load

## Implementation Phase 5: Full Validation and Epic Closure Readiness

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all validation commands for modified code paths:
* npm run lint
* npm run test
* npm run build
* npm run -w @game/server test:load

### Step 5.2: Fix minor validation issues

Address straightforward lint, type, test, and workflow format findings discovered during full validation.

### Step 5.3: Report blocking issues and closure evidence gaps

When non-minor issues remain, record blockers, affected files, and recommended follow-on planning before declaring epic readiness.

## Dependencies

* Node/npm workspace tooling and test runtime.
* Existing CI/release workflow infrastructure.
* Environment secret provisioning for join-token signing and verification runs.

## Success Criteria

* E1-S1 to E1-S4 capabilities are implemented with tests and CI verification coverage.
* Room admission uses dedicated short-lived join credentials rather than raw access tokens.
* Heartbeat lifecycle and stale-session cleanup are measurable and validated.
* Epic exit evidence includes protected flow smoke checks plus playable-shell p50 result.
