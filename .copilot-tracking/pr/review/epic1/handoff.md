<!-- markdownlint-disable-file -->
# PR Review Handoff: epic1

## PR Overview

Epic 1 implementation now satisfies the reviewed requirements for #1, #9, #10, and #11 after resolving RI-01 through RI-04 and validating with server/client test suites.

* Branch: epic1
* Base Branch: main
* Total Files Changed: 70
* Total Review Comments: 4 (implemented)

## PR Comments Ready for Submission

### File: .github/workflows/verify-release.yml

#### Comment 1 (Lines 227 through 234)

* Category: Reliability
* Severity: High

Implemented. Verify assertion now checks room-lifecycle ownership by call sites in `ArenaRoom` and guards against room-membership transitions from HTTP session routes.

Suggested direction: validate ownership via call sites or structural conditions instead of method-name existence in the service definition file.

### File: apps/server/src/http/routes/session.routes.ts

#### Comment 2 (Lines 54 through 69)

* Category: Functional correctness
* Severity: High

Implemented. Join-token endpoint now enforces canonical room key support and issues tokens with the same key used by room-auth verification.

Suggested direction: align issuance and verification to the same room identifier contract and enforce it consistently.

### File: apps/server/src/http/routes/session.routes.ts

#### Comment 3 (Lines 14 through 92)

* Category: Security
* Severity: Medium

Implemented. Added bounded per-subject/IP bootstrap throttling and per-subject heartbeat flood throttling in session routes, with dedicated integration coverage.

Suggested direction: add per-session/per-subject throttling and tests for allow/deny boundaries.

### File: apps/client/src/auth/external-id-session.ts

#### Comment 4 (Lines 12 through 49)

* Category: Functional correctness
* Severity: Medium

Implemented. State machine now transitions into `acquiring-token-silently` before `acquireTokenSilent`, and transition tests were updated accordingly.

Suggested direction: set `acquiring-token-silently` before `acquireTokenSilent()`, then move to `bootstrap-in-flight` only when bootstrap HTTP begins, or simplify the declared state set.

## Review Summary by Category

* Security Issues: 0 open (1 resolved)
* Code Quality: 0 open (1 resolved)
* Convention Violations: 0
* Documentation: 0
* Reliability/CI: 0 open (1 resolved)
* Functional Correctness: 0 open (2 resolved)

## Instruction Compliance

* ✅ markdown.instructions.md: Tracking artifacts include markdownlint-disable marker and consistent markdown structure.
* ✅ writing-style.instructions.md: Findings and rationale are clear, direct, and actionable.
* ✅ pull-request.instructions.md: Review artifacts generated under `.copilot-tracking/pr/review/epic1` with reproducible diff evidence.

## Residual Risks

* No unresolved high- or medium-severity findings remain from this review pass.
* Follow-on optimization opportunity: tune throttle thresholds from production telemetry once real traffic baselines are available.
