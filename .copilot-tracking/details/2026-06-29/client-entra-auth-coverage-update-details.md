<!-- markdownlint-disable-file -->
# Implementation Details: Client Entra Auth Coverage Update

## Context Reference

Sources: .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md, docs/layer1-backlog.md, apps/client/src/auth/external-id-session.ts, apps/client/src/session/bootstrap-store.ts, apps/server/src/http/routes/session.routes.ts.

## Implementation Phase 1: Add Client Auth Story Coverage

<!-- parallelizable: false -->

### Step 1.1: Add explicit story text for client Entra sign-in bootstrap integration behavior

Add story language that makes startup auth-state handling explicit for the browser client before server bootstrap execution.

Files:
* docs/layer1-backlog.md - Add or refine E1-S1 acceptance criteria for silent token acquisition, interaction-required fallback, and one bounded silent reacquire on bootstrap 401.
* docs/cicd-harness.md - Clarify that token-ready is the start point for returning-player bootstrap timing and verification evidence.

Discrepancy references:
* Addresses DR-01 in .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md.

Success criteria:
* Story text explicitly distinguishes signed-out, token-acquiring, interaction-required, token-ready, and bootstrap-in-flight states.
* Retry policy is bounded to one silent reacquire attempt on bootstrap 401.

Context references:
* .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 117-166) - Proposed story candidates and rationale.
* apps/client/src/auth/external-id-session.ts (Lines 34-75) - Existing client token lifecycle behavior baseline.

Dependencies:
* None.

### Step 1.2: Add explicit story text for authenticated client API caller behavior across bootstrap, join-token, and heartbeat

Add story language that makes bearer-token usage explicit for all client-authenticated session API calls, not only bootstrap.

Files:
* docs/layer1-backlog.md - Add client acceptance criteria for Authorization bearer headers on bootstrap, join-token, and heartbeat requests.
* docs/layer1-backlog.md - Add unauthorized fallback expectations after bounded retry (transition to interaction-required).

Discrepancy references:
* Addresses DR-02 in .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md.

Success criteria:
* Acceptance criteria include bearer requirements for all three calls: bootstrap, join-token, heartbeat.
* Acceptance criteria include 401 retry behavior and terminal interaction-required state.

Context references:
* .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 94-99, 148-166).
* apps/server/src/http/routes/session.routes.ts (Lines 52-89) - Authenticated server call surfaces.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Map acceptance criteria to concrete client and server evidence locations

Tie the new story acceptance criteria to concrete implementation/test evidence so planning remains verifiable.

Files:
* docs/layer1-backlog.md - Add technical notes mapping to client auth/session modules and server route contracts.
* docs/cicd-harness.md - Add verification checks confirming protected-route token behavior for bootstrap and join-token paths.
* apps/server/tests/integration/http-auth.integration.test.ts - Reference as current server auth behavior evidence anchor.

Success criteria:
* Each new acceptance criterion points to at least one implementation and one validation surface.
* Story text avoids ambiguous "token already available" assumptions.
* Story text explicitly calls out client test expectations for bearer header attachment and bounded 401 retry semantics.

Context references:
* .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 67-99).
* apps/client/src/session/bootstrap-store.ts (Lines 36-54) - Existing bootstrap bearer pattern.

Dependencies:
* Step 1.2 completion.

### Step 1.4: Promote client-side test expectations to explicit acceptance criteria coverage

Ensure the plan requires client-side validation for authenticated caller behavior, not only server-side integration evidence.

Files:
* docs/layer1-backlog.md - Add acceptance criteria requiring tests for bearer header attachment on bootstrap, join-token, and heartbeat caller paths.
* docs/layer1-backlog.md - Add acceptance criteria requiring one bounded silent reacquire retry on 401 and terminal interaction-required state on repeated unauthorized.
* docs/cicd-harness.md - Add verification note indicating client-side test suite coverage is required for auth caller semantics.

Discrepancy references:
* Addresses DR-04 in .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md.

Success criteria:
* Plan artifacts explicitly require client-side tests that verify Authorization bearer header attachment for bootstrap, join-token, and heartbeat calls.
* Plan artifacts explicitly require client-side tests for one bounded silent reacquire retry on 401.
* Plan artifacts explicitly require client-side tests for interaction-required terminal fallback after repeated unauthorized responses.

Context references:
* .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 148-166).

Dependencies:
* Step 1.3 completion.

## Implementation Phase 2: Align Epic Plan and Discrepancy Tracking

<!-- parallelizable: false -->

### Step 2.1: Update epic planning language so client-side bearer behavior is explicit

Update the epic plan narrative to include explicit client authenticated-caller coverage and remove any residual implied ownership between E1-S1 and E1-S2.

Files:
* .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md - Add explicit language indicating client-side authenticated API-caller behavior is in scope for story coverage.
* .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md - Add or refine lines where story acceptance maps to concrete files/tests.

Discrepancy references:
* Addresses DR-03 in .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md.

Success criteria:
* Epic plan and details unambiguously assign client ownership for token lifecycle and authenticated calling behavior.
* No step text leaves join-token and heartbeat bearer behavior implicit.

Context references:
* .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md (Lines 58-83, 98-116).
* .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 174-177).

Dependencies:
* Implementation Phase 1 completion.

### Step 2.2: Record path decisions and residual risk in planning log entries

Capture selected path, alternatives, and residual risks in planning logs to make the coverage update traceable.

Files:
* .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md - Maintain DR/DD/IP/WI records for this update.
* .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md - Add an implementation deviation note if language updates alter step interpretation.

Discrepancy references:
* Addresses DR-03 in .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md.

Success criteria:
* Planning log clearly states why client coverage was added and what ambiguity was removed.
* Any deferred decisions are captured as follow-on work items.

Context references:
* .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 101-172).

Dependencies:
* Step 2.1 completion.

## Implementation Phase 3: Validation

<!-- parallelizable: false -->

### Step 3.1: Run full planning validation with Plan Validator and resolve critical/major findings

Run plan validation against this update set and resolve all critical and major discrepancies.

Validation commands:
* Run Plan Validator subagent using:
  * Research: .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md
  * Plan: .copilot-tracking/plans/2026-06-29/client-entra-auth-coverage-update-plan.instructions.md
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md
  * Log: .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md

### Step 3.2: Confirm no unresolved major gap remains for client Entra login/token-to-server usage

After validation passes, verify final artifacts document client auth behavior across login, bootstrap, join-token, and heartbeat routes with bounded fallback behavior.

Success criteria:
* Validation reports no critical or major findings.
* Planning log discrepancy section reflects final resolved state.

## Dependencies

* Availability of Plan Validator subagent.

## Success Criteria

* Planning artifacts fully account for the client auth gap findings from 2026-06-29 research.
