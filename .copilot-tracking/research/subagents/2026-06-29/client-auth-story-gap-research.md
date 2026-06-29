---
title: Client Auth Story Gap Research
description: Planning and implementation coverage analysis for client-side Entra login, token acquisition, and bearer token usage in server calls.
author: GitHub Copilot
ms.date: 2026-06-29
ms.topic: reference
keywords:
  - entra external id
  - client auth
  - backlog coverage
  - bearer token
  - gap analysis
estimated_reading_time: 8
---

## Research scope

- Inspect planning and backlog artifacts for explicit story coverage of:
  - Browser login via Entra External ID.
  - Token acquisition in the web client.
  - Attaching bearer tokens to server requests.
- Inspect implementation in apps/client and apps/server auth-related files.
- Determine whether gaps are planning gaps, implementation gaps, or both.

## Status

- Complete

## Evidence from planning and backlog artifacts

- docs/layer1-backlog.md:47 defines E1-S1 as authenticated session bootstrap from the game shell.
- docs/layer1-backlog.md:49 explicitly requires token-ready state after External ID OAuth acquisition before bootstrap.
- docs/layer1-backlog.md:53 explicitly calls out External ID OAuth authorization code plus PKCE and a client auth state machine.
- docs/layer1-backlog.md:67-72 defines E1-S2 join-token acquisition from an authenticated session, with server minting and room admission guard.
- README.md:59-63 requires Entra OIDC runtime values and names ENTRA_CLIENT_ID as the browser shell app registration client ID used by MSAL.
- docs/cicd-harness.md:90-92 requires valid bearer token for protected route verification and token-ready bootstrap verification.
- .copilot-tracking/github-issues/discovery/2026-06-28-backlog-review/issues-plan.md:30 lists story E1-S1 authenticated session bootstrap in issue planning metadata.
- .copilot-tracking/github-issues/sprint/layer1-mvp/handoff.md:35 records story issues E1-S1 through E8-S4 as created.

### Planning interpretation

- Browser login and token acquisition are explicitly covered in backlog planning.
- Bearer attachment is explicitly covered for bootstrap and protected-route verification.
- A dedicated client story for reusable bearer attachment across all session endpoints (bootstrap plus join-token plus heartbeat) is not explicitly separated in backlog text.

## Evidence from current implementation

### Client-side

- apps/client/src/auth/msal-config.ts:11-18 builds MSAL auth config with authority, clientId, redirectUri, knownAuthorities.
- apps/client/src/auth/msal-config.ts:25-26 builds API scopes for token acquisition.
- apps/client/src/auth/external-id-session.ts:34-53 performs silent token acquisition and returns token-ready with accessToken.
- apps/client/src/auth/external-id-session.ts:69-75 supports interactive redirect auth fallback.
- apps/client/src/auth/external-id-session.ts:77-87 supports one bounded unauthorized re-acquisition attempt.
- apps/client/src/session/bootstrap-store.ts:24-40 acquires token then calls bootstrap endpoint with Authorization Bearer header.
- apps/client/src/session/bootstrap-store.ts:43-55 retries bootstrap on 401 with a reacquired token and Authorization Bearer header.
- apps/client/package.json:6-10 shows only build, lint, and test scripts, with no runtime app script wiring.
- apps/client/src currently contains only auth and session folders (no app entrypoint component in this workspace path).

### Server-side

- apps/server/src/http/app.ts:24-31 applies auth middleware before protected and session routes.
- apps/server/src/http/auth-middleware.ts:10-18 extracts Bearer token, validates through AuthService, and returns 401 on failure.
- apps/server/src/http/routes/session.routes.ts:15-39 implements authenticated bootstrap response.
- apps/server/src/http/routes/session.routes.ts:52-70 implements authenticated join-token issuance.
- apps/server/src/http/routes/session.routes.ts:82-89 implements authenticated heartbeat endpoint input validation path.
- apps/server/tests/integration/http-auth.integration.test.ts:117-125 verifies bootstrap works with Authorization Bearer token.
- apps/server/tests/integration/http-auth.integration.test.ts:203-211 verifies join-token issuance works with Authorization Bearer token.

### Implementation interpretation

- Server-side auth enforcement for bearer tokens is implemented and integration-tested.
- Client-side token acquisition and bearer attachment exist for bootstrap.
- Client-side implementation does not yet show a reusable authenticated API caller that consistently attaches bearer tokens for all session endpoints beyond bootstrap in this code path.

## Gap determination

- Planning gap: Partial
- Implementation gap: Yes

Rationale:

- Planning does include core login and token acquisition coverage, so there is no complete planning omission.
- Planning text is less explicit about a dedicated client-side story that standardizes bearer attachment behavior for non-bootstrap session calls.
- Implementation currently demonstrates bootstrap bearer usage, but not broader client wiring for join-token and heartbeat calls in apps/client.

## Story candidates to close the gap

### Candidate 1

- Title: story(layer1): E1-S1a client Entra sign-in bootstrap integration
- Problem addressed: Ensure MSAL token acquisition state machine is actually wired into the browser startup path.
- Acceptance criteria:
  - Given a returning player with a cached account, when the shell starts, then silent token acquisition is attempted before bootstrap.
  - Given silent acquisition returns interaction required, when shell transitions state, then interactive redirect auth is triggered.
  - Given bootstrap returns 401 once, when retry logic executes, then one silent reacquire attempt occurs before interaction required.
  - Given bootstrap success, when shell state is updated, then token-ready and bootstrap-in-flight states transition deterministically and telemetry is emitted once.

### Candidate 2

- Title: story(layer1): E1-S1b client authenticated session API caller for server routes
- Problem addressed: Add explicit client implementation and tests for bearer attachment to all session endpoints that require auth.
- Acceptance criteria:
  - Given token-ready state, when client calls bootstrap, join-token, or heartbeat endpoints, then Authorization Bearer header is attached to each request.
  - Given a 401 from any authenticated session endpoint, when retry policy applies, then bounded silent reacquire runs and request is retried once.
  - Given repeated unauthorized responses after retry, when auth flow continues, then client enters interaction-required state.
  - Given join-token and heartbeat calls succeed, when invoked through the shared API caller, then typed response contracts are returned.
  - Given unit and integration tests run, then tests verify header attachment and bounded retry behavior for bootstrap plus join-token paths.

## Open questions

- Should join-token and heartbeat be part of E1-S1 scope extension, or tracked as separate E1-S2 implementation subtasks?
- Is there an existing external client shell repository where runtime wiring already exists and this workspace intentionally contains only client auth primitives?
- Should the reusable authenticated API caller live in apps/client/src/session or a shared client package for future game modules?
