<!-- markdownlint-disable-file -->
# PR Review Status: epic1

## Review Status

* Phase: Phase 3 - Collaborative Review (active)
* Last Updated: 2026-06-29T14:39:00Z
* Summary: RI-01 through RI-04 implemented and validated with passing server and client test suites.

## Branch and Metadata

* Normalized Branch: `epic1`
* Source Branch: `epic1`
* Base Branch: `main`
* Linked Work Items: #1, #9, #10, #11
* Active PR: #81

## Execution Log

* Ran branch and diff scope discovery:
  * `git rev-parse --abbrev-ref HEAD`
  * `git merge-base main HEAD`
  * `git log --oneline --no-decorate main..HEAD`
  * `git diff --name-status main...HEAD`
* Generated fallback PR reference artifact (pr-reference skill unavailable in current toolset):
  * Wrote `.copilot-tracking/pr/review/epic1/pr-reference.xml` with commit list and full diff from `git diff main...HEAD`.
* Generated diff hunk index:
  * Wrote `.copilot-tracking/pr/review/epic1/hunk-map.tsv` from `git diff -U0 main...HEAD`.
* Pulled requirement sources:
  * GitHub issue details for #1, #9, #10, #11.
  * PR details for #81.
* Deep-read reviewed implementation and tests for Epic 1 scope in client auth/session, server session routes, room auth, telemetry/lifecycle, verification workflow, and backlog contract.
* Implemented blocker fixes:
  * Updated `.github/workflows/verify-release.yml` to validate room-membership authority by call sites in `ArenaRoom` instead of checking method existence in lifecycle service.
  * Updated `apps/server/src/http/routes/session.routes.ts` to enforce canonical room key (`ArenaRoom.ROOM_KEY`) for join-token issuance.
  * Updated integration coverage in `apps/server/tests/integration/join-token.integration.test.ts` and `apps/server/tests/integration/http-auth.integration.test.ts`.
* Implemented medium-severity requirement fixes:
  * Added bootstrap and heartbeat per-subject throttling in `apps/server/src/http/routes/session.routes.ts`.
  * Added throttling integration coverage in `apps/server/tests/integration/session-bootstrap.integration.test.ts` and `apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts`.
  * Updated client auth state transition semantics to enter `acquiring-token-silently` before silent token acquisition in `apps/client/src/auth/external-id-session.ts`.
  * Updated client auth transition tests in `apps/client/tests/integration/auth-state-machine.test.ts`.
* Validation after fixes:
  * `npm run -w @game/server test` passed (9 files, 29 tests).
  * `npm run -w @game/server test` passed after RI-03 updates (9 files, 31 tests).
  * `npm run -w @game/client test` passed after RI-04 updates (3 files, 27 tests).

## Diff Mapping

| File | Type | New Lines | Old Lines | Notes |
|---|---|---|---|---|
| `.github/workflows/verify-release.yml` | Modified | 52-243 | 51-104 | Verification gate and p50 evidence checks |
| `apps/client/src/auth/external-id-session.ts` | Added | 1-113 | n/a | Client auth lifecycle state machine |
| `apps/server/src/http/routes/session.routes.ts` | Added | 1-96 | n/a | Bootstrap, join-token, heartbeat HTTP contracts |
| `apps/server/src/rooms/arena.room.ts` | Modified | 1-58 | 1-33 | Join-token verification and room lifecycle hooks |
| `apps/server/src/session/session-lifecycle.service.ts` | Added | 1-122 | n/a | Presence metadata and timeout cleanup |
| `docs/layer1-backlog.md` | Modified | 47-108 | 47-103 | Epic 1 story acceptance + security requirements |

## Instruction Files Reviewed

* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md`: applies to markdown artifacts in review tracking.
* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md`: applies to markdown artifacts and review handoff language.
* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/pull-request.instructions.md`: applies to `.copilot-tracking/pr/**`; used for artifact discipline and validation approach.

## Review Items

### 🔍 In Review

#### RI-01: Verify-release assertion always fails due self-contradictory lifecycle check

* File: `.github/workflows/verify-release.yml`
* Lines: 227 through 234
* Category: Reliability, CI/CD, Functional correctness
* Severity: High

**Description**

The workflow computes `LIFECYCLE_JOIN_COUNT` by grepping for `noteRoomJoin|noteRoomLeave` in `apps/server/src/session/session-lifecycle.service.ts`, then fails if the count is greater than zero. The service intentionally defines both methods, so this condition is always true. The verify pipeline is therefore configured to fail every run once this step executes.

**Evidence**

`apps/server/src/session/session-lifecycle.service.ts` contains both method definitions at lines 51 and 66.

**Suggested Resolution**

Replace this check with one that validates call-site ownership rather than method existence, for example ensuring room membership transitions are invoked from `ArenaRoom` hooks and not from HTTP/session lifecycle internals.

**Applicable Instructions**

* Epic #1 exit criteria and E1-S4 require successful verification gate behavior.

**User Decision**: Approved and implemented

**Follow-up Notes**: Fixed in workflow; verified to no longer self-fail on lifecycle service method definitions.

#### RI-02: Join-token room binding contract mismatch can reject validly issued tokens

* File: `apps/server/src/http/routes/session.routes.ts`
* Lines: 54 through 69
* Category: Functional correctness, Design
* Severity: High

**Description**

Join tokens are issued for caller-provided `roomId` values, but room admission verifies tokens against the constant `ArenaRoom.ROOM_KEY` (`"arena"`). If the caller requests any room identifier other than `arena`, the server issues a token that room auth then rejects as room mismatch.

**Evidence**

* Issuance: `issueJoinToken(..., roomId)` in `session.routes.ts`.
* Verification: `verifyJoinToken(options.joinToken ?? "", ArenaRoom.ROOM_KEY)` in `arena.room.ts`.

**Suggested Resolution**

Align issuance and verification semantics to the same identifier type (room key or room instance id), and enforce/validate that contract at issuance time.

**Applicable Instructions**

* Issue #10 acceptance requires valid join token to allow room join and bind identity to room presence.

**User Decision**: Approved and implemented

**Follow-up Notes**: Fixed by canonical room-key enforcement at issuance path and aligned integration tests.

#### RI-03: Required abuse controls are undocumented in code path and not implemented on bootstrap/heartbeat endpoints

* File: `apps/server/src/http/routes/session.routes.ts`
* Lines: 14 through 92
* Category: Security, Abuse resistance
* Severity: Medium

**Description**

No request throttling or rate-limiting is implemented for `/api/session/bootstrap` or `/api/session/heartbeat`, despite Epic 1 story requirements calling out bootstrap rate-limiting and heartbeat flood throttling.

**Evidence**

* Endpoint handlers perform auth + business logic only; no limiter middleware or token-bucket checks.
* Backlog requirements:
  * `docs/layer1-backlog.md:56` requires bootstrap IP/session rate-limit.
  * `docs/layer1-backlog.md:90` requires heartbeat flood throttling per session.

**Suggested Resolution**

Add bounded per-session and/or per-subject throttling middleware for these routes, with test coverage for reject/allow boundaries.

**Applicable Instructions**

* Epic 1 issue requirements #9 and #11 security sections.

**User Decision**: Approved and implemented

**Follow-up Notes**: Added bounded route-level throttling with dedicated integration coverage for bootstrap and heartbeat flood scenarios.

#### RI-04: Client auth state machine declares acquiring-token-silently but never transitions into it

* File: `apps/client/src/auth/external-id-session.ts`
* Lines: 12 and 49
* Category: Functional correctness, Maintainability
* Severity: Medium

**Description**

The state union includes `acquiring-token-silently`, but `acquireTokenReadyState()` transitions directly from `signed-out` to `bootstrap-in-flight` before silent token acquisition. This leaves one declared lifecycle state unused and weakens explicit state observability promised by story technical notes.

**Suggested Resolution**

Set state to `acquiring-token-silently` before `acquireTokenSilent()`, then transition to `bootstrap-in-flight` only when bootstrap network call begins, or remove/rename the unused state to match actual behavior.

**Applicable Instructions**

* E1-S1 technical notes in `docs/layer1-backlog.md:53` define explicit startup auth state machine stages.

**User Decision**: Approved and implemented

**Follow-up Notes**: Updated transition to explicitly pass through acquiring-token-silently and aligned integration test expectations.

### ✅ Approved for PR Comment

* RI-01 implemented in `.github/workflows/verify-release.yml`.
* RI-02 implemented in `apps/server/src/http/routes/session.routes.ts` and related tests.
* RI-03 implemented in `apps/server/src/http/routes/session.routes.ts` and related integration tests.
* RI-04 implemented in `apps/client/src/auth/external-id-session.ts` and related integration tests.

### ❌ Rejected / No Action

* None yet.

## Coverage Summary Against Epic 1 Issues

* #1 Epic gate coverage: Improved after RI-01 fix; verification assertion logic now checks room ownership by call sites.
* #9 E1-S1 bootstrap: Meets reviewed acceptance requirements including bounded bootstrap throttling and explicit silent-acquire lifecycle transition coverage.
* #10 E1-S2 join-token: Improved after RI-02 fix; issuance and room auth now share canonical room-key contract.
* #11 E1-S3 heartbeat: Meets reviewed acceptance requirements including authenticated heartbeat path, lifecycle cleanup, and bounded flood throttling.

## Next Steps

* [x] Confirm whether RI-01 should be fixed in this PR or tracked as immediate follow-up.
* [x] Resolve identifier contract for join-token issuance vs room admission (RI-02).
* [x] Implement or explicitly defer abuse controls with approved risk acceptance (RI-03).
* [x] Align or simplify client state machine lifecycle semantics (RI-04).
