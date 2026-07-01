<!-- markdownlint-disable-file -->
# Task Research: E1-S1 Client Shell Gap

Determine whether E1-S1 was closed without implementing the required client shell startup flow, identify exact gaps against acceptance criteria, and recommend concrete implementation steps.

## Task Implementation Requests

* Verify implementation status of E1-S1 acceptance criteria in the existing codebase.
* Identify whether a real client shell/startup state machine exists or only lower-level callers/tests.
* Provide actionable remediation plan to add missing shell path.

## Scope and Success Criteria

* Scope: apps/client startup/auth/bootstrap flow, related tests, and telemetry integration.
* Assumptions: GitHub issue #9 represents intended E1-S1 behavior; current branch main is canonical.
* Success Criteria:
  * Evidence-backed mapping of each acceptance criterion to implemented or missing code.
  * Single recommended approach to fill the client shell gap with concrete file-level impact.

## Outline

1. Verify closure evidence versus source implementation.
2. Map issue #9 acceptance criteria to code-level behavior.
3. Evaluate viable remediation approaches.
4. Select recommended implementation path with file-level plan.

## Potential Next Research

* Verify server bootstrap route denial error contract (non-leaky codes) for strict client-side mapping.
  * Reasoning: AC2 requests a non-leaky code; server contract should drive client normalization.
  * Reference: apps/server/src/http and apps/server/src/auth modules.

* Confirm authoritative acceptance source (issue body vs backlog mirror) for sign-off criteria.
  * Reasoning: existing tracking artifacts may have drift from issue text.
  * Reference: issue #9 metadata and docs/layer1-backlog.md.

## Research Executed

### File Analysis

* .copilot-tracking/github-issues/triage/2026-06-29/handoff.md
  * Issue #9 is marked closed in triage handoff.
* apps/client/src/index.ts
  * Client package entrypoint is export-only; no startup runtime orchestration.
* apps/client/src/auth/external-id-session.ts
  * Contains state vocabulary including bootstrap-in-flight but does not transition into bootstrap-in-flight at runtime.
* apps/client/src/session/bootstrap-store.ts
  * Implements bootstrap fetch and bounded unauthorized retry behavior; lacks explicit non-leaky error classification and shell telemetry emission.
* apps/client/package.json
  * Exposes build/lint/test scripts only; no shell runtime command.
* apps/client/tests/integration/auth-state-machine.test.ts
  * Verifies helper-level auth state transitions.
* apps/client/tests/unit/join-token-caller.test.ts
  * Verifies bounded retry logic in helper caller patterns.
* apps/client/tests/unit/heartbeat-caller.test.ts
  * Verifies retry/fallback caller behavior.

### Code Search Results

* session_started
  * No client startup telemetry emission found in apps/client/src.
* bootstrap-in-flight
  * Found in AuthState type but no runtime assignment found in app startup orchestration because no shell orchestrator exists.
* shell startup / open-shell smoke
  * No startup orchestration file in apps/client/src and no smoke folder under apps/client/tests.

### External Research

* N/A.

### Project Conventions

* Standards referenced: TypeScript modular separation already present across auth/session/navigation caller modules.
* Instructions followed: task-researcher mode constraints and research artifact path requirements.

## Key Discoveries

### Project Structure

The closed-work-item evidence and implementation state diverge.

* Closure evidence exists in .copilot-tracking/github-issues/triage/2026-06-29/handoff.md.
* apps/client currently provides reusable startup primitives but no executable shell orchestrator.
* Entry file apps/client/src/index.ts exports modules only; it does not run startup logic.

### Acceptance Criteria Mapping (Issue #9)

* AC1 token-ready bootstrap returns context/metadata: partial-to-implemented at helper level in apps/client/src/session/bootstrap-store.ts.
  * Gap: no shell startup controller invokes this as an end-to-end startup path.
* AC2 invalid token denied with non-leaky code: partial.
  * Current behavior throws generic status-based error text in bootstrap-store without explicit non-leaky client error taxonomy.
* AC3 one silent reacquire and single bootstrap retry: implemented at helper level.
  * Evidence in external-id-session and bootstrap-store retry gate logic.
* AC4 bounded retry falls to interaction-required and no silent loops: implemented at helper level.
  * Evidence in handleBootstrapUnauthorizedReacquire plus terminal error path in bootstrap-store.
* AC5 bootstrap success emits session_started once: missing.
  * No client startup telemetry adapter/event emission found for session_started or session_bootstrap_failed in startup path.

### Test Coverage Status

* Helper-level auth and caller behaviors are tested (unit/integration).
* Missing tests for bootstrap-store behavior itself.
* Missing smoke open-shell startup test requested by backlog/issue framing.
* Result: tests are aligned to helper implementation but do not validate the missing shell orchestration.

### Complete Example (Current Gap)

```ts
// apps/client/src/index.ts (current pattern)
export { ExternalIdSessionStateMachine } from "./auth/external-id-session.js";
export { SessionBootstrapStore } from "./session/bootstrap-store.js";

// No startup orchestration entry that wires auth -> bootstrap -> telemetry.
```

### Configuration Example (Current Package Shape)

```json
{
  "scripts": {
    "build": "tsc -b",
    "lint": "eslint src --ext .ts",
    "test": "vitest run --passWithNoTests"
  }
}
```

## Technical Scenarios

### Scenario A: Keep Helper-Only Architecture (No Shell Orchestrator)

Retain current modules and consider issue closed based on helper tests alone.

**Requirements:**

* Minimal code churn.
* Preserve existing modular helper APIs.

**Preferred Approach:**

* Rejected.

```text
No new files
```

**Implementation Details:**

This option does not satisfy E1-S1 acceptance criteria requiring a shell startup lifecycle and startup telemetry.

#### Considered Alternatives

Rejected due to unresolved AC1 orchestration gap, AC5 telemetry gap, and missing smoke startup path.

### Scenario B: Add Thin Shell Startup Orchestrator in apps/client (Selected)

Introduce a small startup runtime layer that composes existing helpers and exposes deterministic startup states/events.

**Requirements:**

* Explicit runtime lifecycle with required states.
* Bounded 401 retry behavior reuse.
* session_started emitted once on success; session_bootstrap_failed emitted on terminal failure.
* Integration and smoke coverage for open-shell startup.

**Preferred Approach:**

* Selected because it fills the acceptance gaps with minimal disruption and maximal reuse of already-tested helper modules.

```text
apps/client/src/shell/shell-startup-state.ts
apps/client/src/shell/shell-telemetry.ts
apps/client/src/shell/shell-startup.ts
apps/client/src/index.ts (export shell startup API)
apps/client/tests/unit/shell-startup-state.test.ts
apps/client/tests/integration/shell-startup-bootstrap.test.ts
apps/client/tests/integration/shell-startup-telemetry.test.ts
apps/client/tests/smoke/e1-s1-open-shell.test.ts
```

**Implementation Details:**

1. Add a startup controller that orchestrates:
   * acquireTokenReadyState()
   * transition to bootstrap-in-flight
   * SessionBootstrapStore.bootstrap()
   * telemetry emission and terminal state handling.
2. Add explicit startup state transition model that includes bootstrap-in-flight as an actual runtime state.
3. Emit telemetry once using idempotent guard in shell telemetry adapter.
4. Add tests for state transitions, 401 retry ceiling, interaction-required fallback, and startup telemetry cardinality.

#### Considered Alternatives

Alternative C below was considered but not selected due to extra package and operational overhead.

### Scenario C: Create Separate Executable Shell Host Package

Build a new app package that consumes apps/client library and hosts startup runtime there.

**Requirements:**

* Runtime shell artifact separated from helper library.

**Preferred Approach:**

* Rejected for immediate E1-S1 remediation.

```text
apps/shell-host/** (new package)
apps/client/** (library-only)
```

**Implementation Details:**

Provides cleaner long-term architecture but adds coordination overhead, package setup, and additional CI/runtime wiring beyond immediate story closure correction.

#### Considered Alternatives

Retain as a follow-on refactor after E1-S1 compliance is restored with Scenario B.

## Selected Approach Summary

Selected: Scenario B (thin shell startup orchestrator in apps/client).

Rationale:

* Resolves the core acceptance gap without rewriting existing helper modules.
* Preserves current modular boundaries.
* Enables direct tests for startup flow and telemetry cardinality.
* Minimizes implementation risk while making issue closure criteria objectively testable.
