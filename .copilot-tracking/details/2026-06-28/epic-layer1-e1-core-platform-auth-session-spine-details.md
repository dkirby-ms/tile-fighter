<!-- markdownlint-disable-file -->
# Implementation Details: Epic Layer1 E1 Core Platform and Auth Session Spine

## Context Reference

Sources: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md, docs/layer1-backlog.md, apps/server/src/index.ts, apps/server/src/http/routes/protected.routes.ts, apps/server/src/rooms/arena.room.ts.

## Implementation Phase 1: External ID OAuth Bootstrap Vertical Slice (E1-S1)

<!-- parallelizable: false -->

### Step 1.1: Define the External ID app-registration and authority contract for the shell client and game API

Define the concrete External ID registration contract that implementation will bind to so the shell auth surface, API audience checks, and verification tokens all target the same tenant-owned authority model.

Files:
* docs/layer1-backlog.md - Add explicit E1-S1 technical notes for shell client registration, API audience/app ID URI, authority or user-flow ownership, and token-version expectations.
* docs/cicd-harness.md - Add the External ID registration contract to the CI/CD secret and verification source-of-truth documentation.
* apps/server/src/config/env.ts - Reserve explicit configuration keys for authority, audience, token version, and any narrowed tenant policy required for the dedicated player tenant.
* apps/client/src/auth/msal-config.ts - Planned client binding for authority, client ID, redirect behavior, and API scope selection.

Discrepancy references:
* Addresses DR-EXT-03 by making the External ID app-registration contract an in-scope implementation step rather than an external prerequisite.

Success criteria:
* The plan names the shell client registration, game API registration, API audience/app ID URI, and token-version ownership as implementation outputs.
* Authority selection is explicit: tenant authority and any user-flow ownership needed by the shell are documented.
* Server and client planned config surfaces reference the same audience and authority contract.
* Verification-token provenance requirements align to the same registration contract.

Context references:
* .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 157-181, 192-200) - External ID registration and cross-phase config guidance.
* apps/server/src/config/env.ts (Lines 1-48) - Existing server config surface.

Dependencies:
* Access to the External ID tenant administration model and intended shell deployment origin.

### Step 1.2: Define the shell-to-API OAuth contract for External ID-backed bootstrap

Define the player-auth contract for the game shell so bootstrap starts only after the shell acquires a valid game-API access token from the Microsoft Entra External ID tenant.

Files:
* docs/layer1-backlog.md - Refine E1-S1 acceptance wording for OAuth acquisition, silent renewal, and bounded fallback behavior.
* docs/cicd-harness.md - Document verification-token provenance and the token-ready start point for bootstrap timing.
* apps/server/src/config/env.ts - Preserve the server-side authority/audience/JWKS trust boundary while documenting explicit External ID authority and token-version expectations in implementation notes.

Discrepancy references:
* Addresses DR-EXT-01 by replacing the implicit "client already has a bearer token" assumption with an External ID OAuth contract.

Success criteria:
* E1-S1 explicitly defines auth states: signed-out, acquiring-token-silently, interaction-required, token-ready, bootstrap-in-flight, and bootstrap-failed.
* Silent acquisition is attempted before bootstrap.
* `401` on bootstrap triggers one bounded reacquisition attempt before interactive auth is required.
* The p50 metric start point is defined as token-ready for returning players.

Context references:
* .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 54-78) - External ID tenant model and OAuth acquisition expectations.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 88-143) - E1 scope and selected vertical-slice implementation strategy.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Create the shell auth implementation surface for External ID OAuth

Create the missing player-facing shell auth surface inside the monorepo so the External ID requirement is assigned to concrete implementation targets rather than remaining a policy note.

Files:
* apps/client/package.json - Planned shell workspace package entry for the browser game shell.
* apps/client/src/auth/msal-config.ts - Planned MSAL/authority configuration for the External ID tenant and game API audience.
* apps/client/src/auth/external-id-session.ts - Planned token acquisition state machine for silent acquisition, interactive fallback, and bounded retry handling.
* apps/client/src/session/bootstrap-store.ts - Planned token-ready bootstrap gating and retry coordination for shell init.

Discrepancy references:
* Addresses DR-EXT-01 by assigning the External ID shell acquisition work to concrete client files.

Success criteria:
* The plan names the in-repo shell workspace and the files responsible for OAuth acquisition and bootstrap gating.
* MSAL-based OAuth client configuration is isolated from server JWT validation concerns.
* Bootstrap execution is explicitly gated on token-ready state in the planned client store.
* Interactive auth fallback and silent-acquisition retry boundaries are assigned to one client-side state machine.

Context references:
* .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 79-103, 157-166) - OAuth acquisition and shell-state guidance.
* docs/layer1-backlog.md (Lines 49-55) - E1-S1 client session store and retry expectations.

Dependencies:
* Step 1.2 completion.

### Step 1.4: Harden External ID token validation in shared auth and server config

Turn the External ID validation guidance into concrete server-side work before bootstrap and join-token issuance depend on it.

Files:
* packages/shared-auth/src/index.ts - Add explicit token-version enforcement, exact issuer handling, and tenant-scoped subject normalization rules.
* apps/server/src/auth/auth-service.ts - Wire the stricter validator contract into the server auth surface and normalize any additional claims needed by bootstrap.
* apps/server/src/config/env.ts - Add explicit External ID token-version and authority configuration, and reassess whether `tenantMode` remains necessary for a dedicated player tenant.

Discrepancy references:
* Addresses DR-EXT-02 by converting External ID token-hardening from a research note into implementation work.

Success criteria:
* Shared auth validation is planned to pin one accepted token version.
* Exact issuer and audience expectations are tied to the dedicated External ID tenant and game API audience.
* Subject handling is tenant-scoped so player identity cannot be treated as bare `sub` across authorities.
* The plan explicitly evaluates whether the current `tenantMode` abstraction should be narrowed for player auth.

Context references:
* packages/shared-auth/src/index.ts (Lines 1-114) - Current generic validator contract.
* apps/server/src/auth/auth-service.ts (Lines 1-23) - Current server-side auth integration.
* .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 104-122, 176-181) - Token version, issuer, and tenant-scoped identity guidance.

Dependencies:
* Step 1.1 completion.

### Step 1.5: Add bootstrap API contract on protected routes

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
* Bootstrap contract assumes token-ready caller state rather than performing token acquisition itself.
* Existing protected profile route behavior remains unchanged.

Context references:
* apps/server/src/http/routes/protected.routes.ts (Lines 1-16) - Existing minimal protected route baseline.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 57-58, 72-76) - Missing bootstrap endpoint and E1-S1 requirements.

Dependencies:
* Step 1.3 and Step 1.4 completion.

### Step 1.6: Add bootstrap integration tests, auth-retry expectations, and telemetry assertions

Add integration coverage for authorized and unauthorized bootstrap access, define shell-facing retry expectations, and assert required telemetry/event emission hooks exist for session start and failure paths.

Files:
* apps/server/tests/integration/session-bootstrap.integration.test.ts - New integration suite for bootstrap path.
* apps/server/src/http/routes/session.routes.ts - Emit bootstrap success/failure telemetry hooks.
* docs/layer1-backlog.md - Capture the expected retry and fallback semantics for the shell session store.

Discrepancy references:
* Addresses DR-01 by making E1-S1 acceptance testable and measurable.

Success criteria:
* Integration tests validate status codes and payload contract.
* Success path emits one session-start marker per bootstrap.
* Failure path emits bootstrap-failed marker with safe reason class.
* Story notes distinguish transient IdP failures from interaction-required and API `401` branches.

Context references:
* docs/layer1-backlog.md (Lines 47-61) - E1-S1 acceptance and telemetry requirements.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 179-184) - S1 implementation details.

Dependencies:
* Step 1.5 completion.

### Step 1.7: Add telemetry sink runtime and CI secret wiring

Add explicit telemetry sink configuration so session bootstrap and lifecycle events are operational in runtime and verifiable in non-prod CI execution, and document the provenance of verification tokens minted from the External ID tenant.

Files:
* apps/server/src/config/env.ts - Add telemetry sink env validation schema and defaults.
* docs/cicd-harness.md - Document telemetry sink secret/variable contract for dev/prod/verify workflows.
* .github/workflows/verify-release.yml - Ensure telemetry sink env injection and verification-token expected-claim checks exist for verification runs.

Discrepancy references:
* Addresses DR-05 by implementing telemetry sink dependency identified in research.

Success criteria:
* Runtime fails fast when required telemetry sink configuration is missing in environments where telemetry is mandatory.
* Verification workflow passes telemetry sink values to server process.
* Docs specify ownership and naming for telemetry sink env/secret variables.
* Verification docs record which External ID tenant, audience, and test-player source produced the bearer token used by CI.
* Verification workflow validates the pre-minted token against expected issuer, audience, and token-version assumptions before protected-route smoke runs.

Context references:
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 205-210) - Telemetry sink sequencing dependency.

Dependencies:
* Step 1.6 completion.

### Step 1.8: Validate phase changes

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
* Design notes make explicit that the upstream External ID access token is valid for protected API access only and is not reused as the room credential.
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
* Join-token issuance failure taxonomy distinguishes upstream access-token validation failures (issuer, audience, expiry, tenant mismatch) from room-token failures.
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
* Telemetry distinguishes auth-driven session churn, such as silent-renewal expiry or interaction-required reauth, from room transport failures where feasible.
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

Extend CI/release verification harness to cover existing protected profile route, authenticated bootstrap, and room join token flow in addition to health/readiness checks, while documenting how verification tokens are minted or provisioned from the External ID tenant and validating the expected claims of the pre-minted token used by E1.

Files:
* .github/workflows/verify-release.yml - Add bootstrap and room join verification steps.
* docs/cicd-harness.md - Update verification checklist and required secrets/inputs.
* apps/server/tests/load/room-join-load.ts - Reuse or extend load harness inputs for join-token flow.
* tools/src/index.ts - Planned helper for verifying token provenance and expected claims if workflow logic is extracted from inline bash.

Discrepancy references:
* Addresses DR-04 by explicitly implementing E1-S4 verification gate requirements.

Success criteria:
* Verification workflow checks `/healthz`, `/readyz`, `/api/protected/profile`, authenticated bootstrap, and room-join flow.
* Promotion is blocked on failed protected-profile, bootstrap, or room-join verification.
* Verification run outputs traceable evidence artifact.
* Verification run documents External ID token provenance: issuing tenant, audience, test-player source, and minting path.
* Verification run rejects pre-minted tokens that do not match the expected External ID issuer, audience, or token-version contract for E1.
* Verification includes a regression check that room-membership authority remains in Colyseus lifecycle transitions.

Context references:
* docs/layer1-backlog.md (Lines 92-106) - E1-S4 acceptance criteria.
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 74-75, 196-200).
* .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 123-139, 182-190) - Selected E1 verification depth for pre-minted External ID tokens.

Dependencies:
* Implementation Phase 1, Phase 2, and Phase 3 completion.

### Step 4.2: Define and capture authenticated playable shell p50 metric

Define measurement contract for "authenticated player reaches playable shell" from token-ready state and capture p50 evidence through repeatable non-prod validation run.

Files:
* docs/cicd-harness.md - Add p50 measurement contract and evidence collection method.
* docs/layer1-backlog.md - Align exit criteria wording with measurable contract.
* apps/server/tests/load/room-join-load.ts - Emit timing output needed for p50 calculation.

Discrepancy references:
* Addresses DR-06 by resolving ambiguous playable-shell metric definition.

Success criteria:
* Metric definition includes start/end boundaries, sample size, and environment assumptions.
* Start boundary is token-ready for returning players, with any first interactive sign-in metric tracked separately if required.
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
