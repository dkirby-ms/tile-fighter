---
title: E1-S1 Shell Gap Subagent Research
description: Evidence-based verification of whether issue #9 (E1-S1 authenticated session bootstrap) was closed without an implemented client shell startup flow
ms.date: 2026-07-01
ms.topic: reference
---

## Research scope

Task: Verify whether issue #9 (E1-S1 authenticated session bootstrap) was closed without implementing an actual client shell startup flow.

Workspace: /home/saitcho/tile-fighter

Output focus:

1. Locate current client entrypoint and startup orchestration in apps/client.
2. Determine whether explicit shell startup/auth lifecycle state machine exists with states:
   - signed-out
   - acquiring-token-silently
   - interaction-required
   - token-ready
   - bootstrap-in-flight
   - bootstrap-failed
3. Map issue #9 acceptance criteria one by one to implementation status.
4. Check tests and determine if tests are ahead of implementation or aligned.
5. Identify minimal implementation needed to satisfy missing shell component.
6. Include concrete code snippets as evidence.
7. Conclude with prioritized next steps.

## Evidence sources used

Primary criteria source:

- docs/layer1-backlog.md:45-56

Issue closure evidence in workspace artifacts:

- .copilot-tracking/github-issues/triage/2026-06-29/handoff.md:25
- .copilot-tracking/github-issues/execution/2026-06-29-client-entra-auth/handoff.md:37-40

Client implementation evidence:

- apps/client/src/index.ts:1-138
- apps/client/src/auth/external-id-session.ts:10-113
- apps/client/src/session/bootstrap-store.ts:26-95
- apps/client/src/auth/msal-config.ts:11-27
- apps/client/src/auth/join-token-caller.ts:8-62
- apps/client/src/session/heartbeat-caller.ts:15-69
- apps/client/src/session/reconnect-caller.ts:50-111
- apps/client/package.json:6-10

Client test evidence:

- apps/client/tests/integration/auth-state-machine.test.ts:26-144
- apps/client/tests/unit/join-token-caller.test.ts:27-147
- apps/client/tests/unit/heartbeat-caller.test.ts:29-186
- apps/client/tests directory layout: unit + integration only (no smoke directory)

## Findings

### 1) Current client entrypoint and startup orchestration status

Entrypoint found:

- apps/client/src/index.ts is a barrel export file only. It exports auth/session/navigation/creator utilities and types.
- It does not instantiate MSAL, does not create ExternalIdSessionStateMachine, does not create SessionBootstrapStore, and does not orchestrate startup sequencing.

Direct evidence:

```ts
// apps/client/src/index.ts:1-8
export { ExternalIdSessionStateMachine } from "./auth/external-id-session.js";
export type { AuthState, AcquireTokenResult } from "./auth/external-id-session.js";
export { buildMsalConfiguration } from "./auth/msal-config.js";
export type { ExternalIdClientConfig } from "./auth/msal-config.js";
export { getJoinToken } from "./auth/join-token-caller.js";
export type { JoinTokenResponse } from "./auth/join-token-caller.js";
export { SessionBootstrapStore } from "./session/bootstrap-store.js";
```

Interpretation:

- apps/client currently behaves as a client library package, not an app shell runtime.
- No startup orchestration module was found in apps/client/src via symbol/path search.
- package scripts also show build/lint/test only (apps/client/package.json:6-10), with no run/dev/start shell command.

Conclusion for startup orchestration:

- Missing as an implemented runtime flow in apps/client.

### 2) Shell startup/auth lifecycle state machine existence

Declared lifecycle states exist:

- AuthState union defines all required states in apps/client/src/auth/external-id-session.ts:10-16.

```ts
export type AuthState =
  | "signed-out"
  | "acquiring-token-silently"
  | "interaction-required"
  | "token-ready"
  | "bootstrap-in-flight"
  | "bootstrap-failed";
```

Runtime transition behavior:

- signed-out initial state exists (line 28).
- acquiring-token-silently is set before acquireTokenSilent (line 49).
- token-ready set on silent success (line 58).
- interaction-required set on no account / interaction-required error (lines 42, 65).
- bootstrap-failed set on non-interaction silent failure (line 72).
- No runtime assignment to bootstrap-in-flight exists in this class.

Search corroboration:

- bootstrap-in-flight appears in type declarations and tests/docs context, but no assignment in production source.

Conclusion for required lifecycle state machine:

- Partial implementation.
- State vocabulary exists, but full explicit runtime lifecycle is incomplete because bootstrap-in-flight is not transitioned into.

### 3) Issue #9 acceptance criteria mapping

Acceptance criteria source:

- docs/layer1-backlog.md:49-53

#### AC1

Criterion:

- Given shell state token-ready after External ID OAuth acquisition, when bootstrap runs, then session bootstrap returns player context and shell init metadata.

Evidence:

- bootstrap flow performs token acquisition and bootstrap GET with Authorization bearer:
  - apps/client/src/session/bootstrap-store.ts:49-66
- typed payload includes player context-like fields and shellInit metadata:
  - apps/client/src/session/bootstrap-store.ts:3-16

Snippet:

```ts
// apps/client/src/session/bootstrap-store.ts:49-66
const tokenState = await this.authSession.acquireTokenReadyState();
...
const response = await fetch(this.bootstrapEndpoint, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${tokenState.accessToken}`
  }
});
```

Status: Implemented at helper level, missing shell-level orchestration.

Reason:

- SessionBootstrapStore.bootstrap() exists, but no shell startup module invokes it during app boot.

#### AC2

Criterion:

- Given invalid token, when bootstrap runs, then access is denied with a non-leaky error code.

Evidence:

- bootstrap-store throws generic status-based errors:
  - apps/client/src/session/bootstrap-store.ts:89-91
- No typed non-leaky client error contract/classification in bootstrap-store.

Snippet:

```ts
// apps/client/src/session/bootstrap-store.ts:89-91
if (!response.ok) {
  throw new Error(`Session bootstrap failed with status ${response.status}`);
}
```

Status: Partial.

Reason:

- HTTP denial path exists, but explicit non-leaky error mapping/contract is not implemented in client bootstrap helper.

#### AC3

Criterion:

- Given bootstrap receives 401, when client performs one silent reacquire attempt, then bootstrap retries exactly once.

Evidence:

- Single bounded retry constant:
  - apps/client/src/auth/external-id-session.ts:24
- Retry counter gate:
  - apps/client/src/auth/external-id-session.ts:93-102
- bootstrap-store retries once on 401 with reacquired token:
  - apps/client/src/session/bootstrap-store.ts:68-87

Snippet:

```ts
// apps/client/src/auth/external-id-session.ts:24, 93-102
const MAX_UNAUTHORIZED_RETRY = 1;
...
if (this.unauthorizedRetryCount >= MAX_UNAUTHORIZED_RETRY) {
  return { state: "interaction-required", reasonClass: "unauthorized" };
}
this.unauthorizedRetryCount += 1;
return await this.acquireTokenReadyState();
```

Status: Implemented at helper level.

#### AC4

Criterion:

- Given bounded retry still returns unauthorized, when retry completes, then client transitions to interaction-required and stops silent retry loops.

Evidence:

- Unauthorized retry cap returns interaction-required after one retry:
  - apps/client/src/auth/external-id-session.ts:94-98
- bootstrap-store triggers interactive auth and throws terminal error when retry token not token-ready:
  - apps/client/src/session/bootstrap-store.ts:69-73

Status: Implemented at helper level.

Caveat:

- This behavior exists in helper methods; no top-level shell controller state is present to represent end-user startup terminal state.

#### AC5

Criterion:

- Given bootstrap success, when telemetry initializes, then session_started is emitted once.

Evidence:

- No session_started emission in apps/client/src search results.
- No bootstrap telemetry adapter/module in client source.
- Existing telemetry module is creator-focused (CreatorTelemetryAdapter), not shell session startup telemetry.

Status: Missing.

Reason:

- Required E1-S1 telemetry events session_started/session_bootstrap_failed are not implemented in client shell startup path.

### 4) Test alignment assessment (unit/integration/smoke)

Observed test coverage:

- Unit and integration exist for helper behavior:
  - state machine transitions: apps/client/tests/integration/auth-state-machine.test.ts:26-144
  - caller retry/fallback patterns: apps/client/tests/unit/join-token-caller.test.ts:27-147 and apps/client/tests/unit/heartbeat-caller.test.ts:29-186

Missing coverage:

- No tests found for SessionBootstrapStore.bootstrap().
- No smoke test category in apps/client/tests (only unit and integration directories).
- docs/layer1-backlog.md explicitly calls for smoke open-shell path (line 55), but no corresponding client smoke test exists.

Test-vs-implementation status:

- Tests are mostly aligned with existing helper-level implementation.
- Overall E1-S1 acceptance test surface is behind required behavior because shell startup orchestration and smoke flow are missing.
- Tests are not ahead of implementation on missing shell startup; they do not exercise it.

### 5) Did issue #9 close without actual shell startup flow?

Workspace evidence indicates issue #9 is closed:

- .copilot-tracking/github-issues/triage/2026-06-29/handoff.md:25 marks #9 closed.

At the same time, client shell startup orchestration is absent:

- No startup module/wiring in apps/client/src.
- index.ts is a barrel, not runtime startup.
- no smoke open-shell path test.
- session_started telemetry not emitted.

Conclusion:

- Yes, based on repository evidence, issue #9 appears closed while the concrete client shell startup flow remains unimplemented (or at least not present in apps/client source).
- Implemented scope is largely helper-level auth/session primitives, not an integrated shell bootstrap runtime.

## Minimal implementation needed to close the shell gap

Goal: Add smallest runtime orchestration layer to connect existing helpers into an explicit shell startup lifecycle.

Suggested minimal files and responsibilities:

1. apps/client/src/shell/shell-startup.ts
- Create and own startup orchestration function/class.
- Instantiate PublicClientApplication with buildMsalConfiguration.
- Instantiate ExternalIdSessionStateMachine and SessionBootstrapStore.
- Drive startup states and expose observable startup status.

2. apps/client/src/shell/shell-startup-state.ts
- Define explicit runtime startup state union and transitions for:
  - signed-out
  - acquiring-token-silently
  - interaction-required
  - token-ready
  - bootstrap-in-flight
  - bootstrap-failed
- Ensure bootstrap-in-flight is actually entered before bootstrap HTTP begins.

3. apps/client/src/shell/shell-telemetry.ts
- Emit required E1-S1 events:
  - session_started exactly once on successful bootstrap
  - session_bootstrap_failed on terminal failures
- Keep event payload sanitized and deterministic.

4. apps/client/src/index.ts
- Export shell startup API surface for app host consumption.

5. Tests to add
- apps/client/tests/unit/shell-startup-state.test.ts
- apps/client/tests/integration/shell-startup-bootstrap.test.ts
- apps/client/tests/integration/shell-startup-telemetry.test.ts
- apps/client/tests/smoke/e1-s1-open-shell.test.ts

## Concrete snippets showing current helper-only pattern

Snippet A: state machine includes required state names but not bootstrap-in-flight assignment

```ts
// apps/client/src/auth/external-id-session.ts:10-16
export type AuthState =
  | "signed-out"
  | "acquiring-token-silently"
  | "interaction-required"
  | "token-ready"
  | "bootstrap-in-flight"
  | "bootstrap-failed";
```

```ts
// apps/client/src/auth/external-id-session.ts:49-59, 72-75
this._state = "acquiring-token-silently";
...
this._state = "token-ready";
...
this._state = "bootstrap-failed";
return {
  state: "bootstrap-failed",
  reasonClass: "transient-idp"
};
```

Snippet B: bootstrap helper has retry logic but no shell lifecycle manager around it

```ts
// apps/client/src/session/bootstrap-store.ts:68-73
if (response.status === 401) {
  const retryTokenState = await this.authSession.handleBootstrapUnauthorizedReacquire();
  if (retryTokenState.state !== "token-ready" || !retryTokenState.accessToken) {
    await this.authSession.beginInteractiveAuth();
    throw new Error("Interactive authentication required after bootstrap unauthorized");
  }
```

Snippet C: package shape indicates library utilities, not runnable shell startup

```json
// apps/client/package.json:6-10
"scripts": {
  "build": "tsc -b",
  "lint": "eslint src --ext .ts",
  "test": "vitest run --passWithNoTests"
}
```

## Prioritized next steps

1. Implement shell runtime startup orchestrator first
- Add shell-startup module that wires MSAL + ExternalIdSessionStateMachine + SessionBootstrapStore into one deterministic boot path.

2. Complete explicit lifecycle transitions
- Ensure bootstrap-in-flight is a real runtime transition, not a type-only state.

3. Add required telemetry events
- Emit session_started once on success and session_bootstrap_failed on failure.

4. Add missing bootstrap and smoke tests
- Integration tests for startup orchestration and retry/fallback.
- Smoke test for open-shell path from token-ready state.

5. Keep existing helper contracts
- Reuse current helpers (bootstrap-store, join-token-caller, heartbeat-caller) to minimize change scope.

## Research status

Complete for requested scope.

The requested verification was performed using workspace source/tests/docs artifacts only, with line-referenced evidence and no speculative assumptions beyond observed code and project tracking files.
