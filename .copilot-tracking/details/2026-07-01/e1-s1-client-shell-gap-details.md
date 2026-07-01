<!-- markdownlint-disable-file -->
# Implementation Details: E1-S1 Client Shell Gap

## Context Reference

Sources: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md; docs/layer1-backlog.md; .copilot-tracking/github-issues/triage/2026-06-29/handoff.md

## Implementation Phase 1: Shell startup runtime design and state modeling

<!-- parallelizable: false -->

### Step 1.1: Add shell startup state model

Create a startup-state model that defines deterministic transitions for shell startup, including a concrete runtime `bootstrap-in-flight` state and terminal success/failure states.

Files:
* apps/client/src/shell/shell-startup-state.ts - Startup state definitions, transition helpers, and startup result typing.

Discrepancy references:
* None

Success criteria:
* Runtime startup path can represent each acceptance-relevant transition explicitly.
* `bootstrap-in-flight` is represented as an executable runtime state transition, not only type vocabulary.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Acceptance Criteria Mapping section) - Missing runtime transition evidence.
* apps/client/src/auth/external-id-session.ts - Existing state vocabulary and retry support to align against.

Dependencies:
* None

### Step 1.2: Add shell startup orchestrator

Implement a thin orchestrator that executes the startup lifecycle in order: acquire token-ready auth state, transition to bootstrap-in-flight, invoke bootstrap store, and return deterministic terminal outcome.

Files:
* apps/client/src/shell/shell-startup.ts - Startup controller orchestration, helper composition, and terminal outcome model.
* apps/client/src/session/bootstrap-store.ts - Optional narrow seam additions for consistent error classification inputs.
* apps/client/src/auth/external-id-session.ts - Optional seam exposure for startup orchestration integration.

Discrepancy references:
* None

Success criteria:
* Startup controller composes existing helper logic without duplicating bounded retry loops.
* Startup flow performs at most one silent reacquire and one bootstrap retry through existing helper behavior.
* Startup controller exposes a deterministic outcome contract consumed by app shell or host.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Scenario B implementation details) - Selected orchestration sequence.
* apps/client/src/session/bootstrap-store.ts - Existing retry behavior to preserve.

Dependencies:
* Step 1.1 completion

### Step 1.3: Export shell startup API

Expose new shell startup modules from the client package entrypoint so consumers can run startup orchestration directly.

Files:
* apps/client/src/index.ts - Export shell startup state and orchestrator surfaces.

Success criteria:
* Startup API is importable from @game/client package root exports.
* Existing exports remain backward compatible.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Current gap code snippet) - Entry file currently export-only without orchestration.

Dependencies:
* Step 1.2 completion

### Step 1.4: Validate phase changes

Run targeted validation commands for startup-state and orchestrator additions.

Validation commands:
* npm run -w @game/client lint - Validate shell startup source changes.
* npm run -w @game/client test -- shell-startup-state - Validate focused startup state tests if present.
* npm run -w @game/client build - Confirm client package compiles with new exports.

## Implementation Phase 2: Telemetry and non-leaky error normalization

<!-- parallelizable: false -->

### Step 2.1: Add shell telemetry adapter

Add shell-focused telemetry helpers that emit startup lifecycle events with idempotent `session_started` behavior and explicit failure telemetry for terminal outcomes.

Files:
* apps/client/src/shell/shell-telemetry.ts - Startup telemetry emitters and idempotency guard.
* apps/client/src/creator/creator-telemetry.ts - Optional shared telemetry utility reuse or normalization helper extraction.
* apps/client/src/shell/shell-startup.ts - Orchestrator integration points for event emission boundaries.

Discrepancy references:
* None

Success criteria:
* `session_started` is emitted at most once per startup attempt and only on success.
* `session_bootstrap_failed` is emitted on terminal startup failure outcomes.
* Telemetry does not emit duplicate success events for equivalent no-op transitions.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (AC5 mapping) - Missing startup telemetry path.

Dependencies:
* Implementation Phase 1 completion

### Step 2.2: Add non-leaky denial classification mapping

Add explicit startup denial classification in shell path so invalid/denied bootstrap outcomes map to non-leaky client-side categories rather than raw status text.

Files:
* apps/client/src/shell/shell-startup.ts - Error normalization and terminal classification mapping.
* apps/client/src/session/bootstrap-store.ts - Optional structured error data propagation for mapping.

Discrepancy references:
* DR-01

Success criteria:
* Startup failure categories avoid leaking raw server internals while preserving actionable client behavior.
* Classification mapping supports deterministic telemetry and test assertions.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (AC2 mapping and Potential Next Research) - Denial contract alignment gap.

Dependencies:
* Step 2.1 completion

### Step 2.3: Validate phase changes

Run targeted validation commands for telemetry and error normalization changes.

Validation commands:
* npm run -w @game/client lint - Validate telemetry and shell orchestration updates.
* npm run -w @game/client test -- shell-startup-telemetry - Validate focused telemetry behavior if present.
* npm run -w @game/client build - Confirm compile with telemetry and error mapping updates.

## Implementation Phase 3: Unit, integration, and smoke coverage

<!-- parallelizable: false -->

### Step 3.1: Add startup unit coverage

Add unit tests for startup state transitions and bounded retry/terminal behavior boundaries.

Files:
* apps/client/tests/unit/shell-startup-state.test.ts - Startup state transitions and invariants.
* apps/client/tests/unit/shell-startup.test.ts - Orchestrator-level unit tests for retry ceiling and terminal outcomes.

Discrepancy references:
* None

Success criteria:
* Tests validate startup transitions including bootstrap-in-flight and terminal states.
* Tests verify bounded retry semantics and no silent-loop behavior.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (AC3/AC4 mapping) - Existing helper behavior to preserve.

Dependencies:
* Implementation Phase 2 completion

### Step 3.2: Add startup integration coverage

Add integration tests that execute shell startup end-to-end through helper composition and verify bootstrap success/failure telemetry behavior.

Files:
* apps/client/tests/integration/shell-startup-bootstrap.test.ts - Startup bootstrap integration flow and terminal outcomes.
* apps/client/tests/integration/shell-startup-telemetry.test.ts - Telemetry cardinality and failure-event assertions.

Discrepancy references:
* None

Success criteria:
* Integration flow validates auth readiness to bootstrap orchestration path.
* Telemetry assertions validate `session_started` once-on-success behavior and failure event emission.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Scenario B selected file list) - Required integration coverage files.

Dependencies:
* Step 3.1 completion

### Step 3.3: Add open-shell smoke test

Add a dedicated smoke test for open-shell startup path to verify E1-S1 closure criteria at end-to-end startup level.

Files:
* apps/client/tests/smoke/e1-s1-open-shell.test.ts - Startup smoke scenario and success/failure assertions.

Discrepancy references:
* DR-02

Success criteria:
* Smoke test validates startup can run from shell entrypoint and produce deterministic result.
* Smoke scenario is runnable in CI-compatible client test workflows.

Context references:
* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Test Coverage Status) - Missing smoke path evidence.

Dependencies:
* Step 3.2 completion

### Step 3.4: Validate phase changes

Run phase validation for E1-S1 coverage additions.

Validation commands:
* npm run -w @game/client lint
* npm run -w @game/client test
* npm run -w @game/client build

## Implementation Phase 4: Full validation and closeout

<!-- parallelizable: false -->

### Step 4.1: Run full project validation

Execute all validation commands for modified scope and workspace:
* npm run -w @game/client lint
* npm run -w @game/client test
* npm run -w @game/client build
* npm run lint
* npm run test
* npm run build

### Step 4.2: Fix minor validation issues

Iterate on lint, test, and type issues in touched startup-shell surfaces. Apply only localized corrections within E1-S1 scope.

### Step 4.3: Report blocking issues

When failures require wider contract or architecture changes:
* Document blockers and impacted files.
* Record follow-on items in planning log.
* Recommend additional focused research rather than expanding this implementation batch.

## Dependencies

* Existing auth and bootstrap helper APIs in apps/client
* Existing client telemetry conventions
* Existing Vitest unit/integration harness and workspace scripts

## Success Criteria

* Details provide implementation-ready steps with deterministic file targets for shell startup closure.
* Step-level validation commands and criteria are explicit and executable.
* Discrepancy-linked items are tracked where research gaps remain unresolved.
