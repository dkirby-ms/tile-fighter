<!-- markdownlint-disable-file -->
# Task Research: Client Entra Auth Story Gap

Assess whether the current plan/backlog is missing an explicit client-side story for browser login to Entra, token acquisition, and bearer-token usage against server endpoints.

## Task Implementation Requests

* Review the plan and identify if there is a gap for client-side Entra login/token use.
* Recommend specific story coverage if a gap exists.

## Scope and Success Criteria

* Scope: Existing docs/backlog and code in this repository related to client auth bootstrap and server bearer-protected routes.
* Assumptions:
  * The repository is the source of truth for this planning check.
  * Layer 1 backlog and sprint handoff files represent current planned scope.
* Success Criteria:
  * Determine whether client-side Entra login/token story is explicitly and sufficiently tracked.
  * Provide concrete, evidence-backed story additions where needed.

## Outline

1. Existing planning coverage
2. Current implementation coverage
3. Gap analysis
4. Evaluated alternatives
5. Selected approach and story text

## Potential Next Research

* Verify live GitHub issue bodies for E1-S1/E1-S2
  * Reasoning: local planning artifacts may summarize, not fully mirror issue detail.
  * Reference: .copilot-tracking/github-issues/discovery/2026-06-28-backlog-review/issues-plan.md

## Research Executed

### File Analysis

* docs/layer1-backlog.md
  * Explicitly defines E1-S1 browser shell login + silent auth bootstrap and token-ready state transitions (lines 47-56).
  * Defines E1-S2 authenticated session bootstrap and join-token minting, but technical notes are centered on server auth service and room guard (lines 67-73).
* docs/cicd-harness.md
  * Harness verification covers protected route bearer checks and token-ready bootstrap behavior (lines 90-92).
* README.md
  * Setup includes browser shell registration and ENTRA_CLIENT_ID for client usage (lines 59-63).
* apps/client/src/auth/msal-config.ts
  * Client has Entra/MSAL config scaffold and login/request scopes (lines 11-18).
* apps/client/src/auth/external-id-session.ts
  * Client has token acquisition state machine (silent + interaction required fallback) (lines 34-53, 69-75).
* apps/client/src/session/bootstrap-store.ts
  * Client bearer token is attached for bootstrap POST flow in this path (lines 36-40, 50-54).
* apps/server/src/http/app.ts
  * Server enforces auth middleware on protected/session routes (lines 24-31).
* apps/server/src/http/auth-middleware.ts
  * Middleware validates bearer token and rejects unauthorized requests (lines 10-18).
* apps/server/src/http/routes/session.routes.ts
  * Authenticated session endpoints include join-token and heartbeat logic (lines 52-89).
* apps/server/tests/integration/http-auth.integration.test.ts
  * Integration tests verify bearer behavior for bootstrap and join-token protected routes (lines 117-125, 203-211).
* .copilot-tracking/github-issues/discovery/2026-06-28-backlog-review/issues-plan.md
  * Planning metadata includes E1-S1 and E1-S2 entries (line 30).
* .copilot-tracking/github-issues/sprint/layer1-mvp/handoff.md
  * Sprint handoff confirms story set creation including E1-S1/E1-S2 (line 35).

### Code Search Results

* "token-ready"
  * Found in planning and client auth state machine references tying bootstrap to auth state transitions.
* "Authorization"
  * Present in client bootstrap store for bearer header and in server middleware/tests.

### Project Conventions

* Standards referenced: Existing layer backlog story format and sprint handoff issue mapping files.
* Instructions followed: Task Researcher mode constraints; repository-only evidence.

## Key Discoveries

### Project Structure

Client auth primitives exist in apps/client but full end-to-end client caller coverage for all authenticated session operations is not explicitly represented as a dedicated backlog story.

### Implementation Patterns

The current pattern is:
1. Entra login/token acquisition in client auth utilities.
2. Bearer protection enforced server-side.
3. One client bootstrap store path that sends bearer token.

A reusable client-side authenticated API caller pattern across bootstrap/join-token/heartbeat is not explicitly called out as a planning deliverable.

### Complete Examples

```ts
// apps/client/src/session/bootstrap-store.ts (excerpted pattern)
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(request),
});
```

### API and Schema Documentation

Server route protection and authenticated session flow are implemented and tested, indicating client parity requirements are expected by design.

## Technical Scenarios

### Scenario A: Keep Current Stories As-Is

Assume E1-S1/E1-S2 implicitly cover all client behavior and rely on ad-hoc implementation details.

**Requirements:**

* No backlog changes.
* Teams infer client API-caller scope from existing text.

**Preferred Approach:**

* Rejected.

**Implementation Details:**

Risk: ambiguous ownership and acceptance criteria for client bearer handling beyond bootstrap, including retry/reacquire behavior on 401 for join-token/heartbeat calls.

#### Considered Alternatives

* Alternative rejected due to ambiguity and likely drift between server auth guarantees and client runtime behavior.

### Scenario B: Add Dedicated Client Authenticated Caller Story (Recommended)

Add a focused story that explicitly defines browser client authenticated API behavior for all required session endpoints, including error/retry transitions.

**Requirements:**

* Explicit bearer attachment expectations for bootstrap/join-token/heartbeat.
* Deterministic 401 handling (bounded silent reacquire and interaction-required fallback).
* Test coverage expectations in client-side tests.

**Preferred Approach:**

* Recommended because it closes planning ambiguity while aligning with existing server protections and current client primitive direction.

```text
Backlog additions:
- E1-S1a: client Entra sign-in bootstrap integration hardening
- E1-S1b: client authenticated session API caller
```

**Implementation Details:**

Proposed story candidate 1:
- Title: story(layer1): E1-S1a client Entra sign-in bootstrap integration
- Acceptance criteria:
  - Given cached account, startup attempts silent token acquisition before bootstrap.
  - Given interaction required, startup transitions to interaction-required and triggers interactive login.
  - Given bootstrap 401 once, client performs one bounded silent reacquire before requiring interaction.
  - Given bootstrap success, client emits session-start telemetry once and transitions to token-ready/session-active state.

Proposed story candidate 2:
- Title: story(layer1): E1-S1b client authenticated session API caller for server routes
- Acceptance criteria:
  - Client attaches Authorization bearer token for bootstrap, join-token, and heartbeat requests.
  - On 401, client retries once after silent reacquire.
  - If still unauthorized, client transitions to interaction-required.
  - Returns typed responses/contracts for bootstrap/join-token/heartbeat.
  - Tests validate bearer header attachment and bounded retry path.

#### Considered Alternatives

* Extend only E1-S2 text instead of adding a story.
  * Rejected: E1-S2 appears server-oriented in technical notes and risks keeping client behavior implicit.
* Add implementation-only tasks without acceptance criteria.
  * Rejected: does not provide verifiable planning guardrails.

## Selected Approach

Select Scenario B: add an explicit client-side authenticated API-caller story (and optionally split into S1a/S1b) so the backlog clearly captures browser Entra login/token lifecycle and bearer-token usage for all server session endpoints.

Rationale:

* Existing planning includes login/bootstrap intent but not a precise, testable client behavior contract for all authenticated calls.
* Server already enforces and tests bearer auth; planning should mirror required client responsibilities.
* This approach minimizes risk of partial client implementation and aligns acceptance criteria with observable runtime behavior.
