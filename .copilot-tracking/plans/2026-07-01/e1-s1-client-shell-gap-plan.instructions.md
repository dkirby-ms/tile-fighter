---
applyTo: '.copilot-tracking/changes/2026-07-01/e1-s1-client-shell-gap-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E1-S1 Client Shell Gap

## Overview

Implement a thin client shell startup orchestrator in apps/client that composes existing auth and bootstrap helpers into a deterministic runtime startup lifecycle with required telemetry and coverage.

## Objectives

### User Requirements

* Verify and close E1-S1 acceptance gaps with a real startup flow rather than helper-only modules. - Source: user request and .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md
* Ensure startup includes bounded retry behavior, explicit terminal failure handling, and no silent retry loops. - Source: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (AC3/AC4 mapping)
* Emit startup telemetry with `session_started` exactly once on success and `session_bootstrap_failed` on terminal failure. - Source: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (AC5 mapping)
* Add integration and smoke coverage for the shell startup path. - Source: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Test coverage status)

### Derived Objectives

* Reuse existing `ExternalIdSessionStateMachine` and `SessionBootstrapStore` behavior rather than duplicating retry logic in a new startup module. - Derived from: selected Scenario B in research
* Introduce explicit startup-state modeling in a dedicated shell module to make `bootstrap-in-flight` a real runtime transition, not just vocabulary. - Derived from: research gap findings in apps/client/src/auth/external-id-session.ts
* Normalize bootstrap denial failures to non-leaky client error categories that can map cleanly to server denial contracts. - Derived from: research potential next research on denial contract alignment
* Keep runtime orchestration separate from transport/helper modules to preserve current modular client architecture. - Derived from: apps/client module boundaries and selected Scenario B

## Context Summary

### Project Files

* apps/client/src/index.ts - Client package export seam where shell startup API must be exposed.
* apps/client/src/auth/external-id-session.ts - Existing auth state machine and bounded reacquire behavior to compose.
* apps/client/src/session/bootstrap-store.ts - Existing bootstrap fetch/retry helper to orchestrate from shell startup.
* apps/client/src/creator/creator-telemetry.ts - Existing telemetry conventions to align startup event payloads.
* apps/client/tests/integration/auth-state-machine.test.ts - Existing helper-level coverage baseline.
* apps/client/tests/unit/join-token-caller.test.ts - Existing bounded retry caller pattern.
* apps/client/tests/unit/heartbeat-caller.test.ts - Existing caller fallback pattern.

### References

* .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md - Primary E1-S1 gap analysis and selected implementation scenario.
* .copilot-tracking/github-issues/triage/2026-06-29/handoff.md - Closed issue evidence referenced by research.
* docs/layer1-backlog.md - Acceptance framing alignment source referenced by research.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown authoring constraints for planning artifacts.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Required writing style guidance for planning artifacts.

## Implementation Checklist

### [x] Implementation Phase 1: Shell startup runtime design and state modeling

<!-- parallelizable: false -->

* [x] Step 1.1: Add startup state model including explicit `bootstrap-in-flight` runtime transition semantics
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 11-31)
* [x] Step 1.2: Add shell startup orchestrator that sequences auth readiness, bootstrap call, and terminal startup outcomes
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 33-55)
* [x] Step 1.3: Export startup orchestrator and state model from client package entrypoint
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 57-72)
* [x] Step 1.4: Validate phase changes
  * Run lint, targeted unit tests, and build for @game/client

### [x] Implementation Phase 2: Telemetry and error normalization

<!-- parallelizable: false -->

* [x] Step 2.1: Add shell telemetry adapter with idempotent `session_started` emission and terminal failure event mapping
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 87-108)
* [x] Step 2.2: Add non-leaky bootstrap denial error taxonomy and mapping in startup orchestration path
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 110-129)
* [x] Step 2.3: Validate phase changes
  * Run lint, unit tests, and build for @game/client

### [x] Implementation Phase 3: Integration, smoke, and regression coverage

<!-- parallelizable: false -->

* [x] Step 3.1: Add unit tests for startup state transitions and retry/terminal behavior boundaries
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 144-163)
* [x] Step 3.2: Add integration tests for startup bootstrap and telemetry cardinality across success and failure paths
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 165-184)
* [x] Step 3.3: Add open-shell smoke test covering end-to-end startup orchestration path
  * Details: .copilot-tracking/details/2026-07-01/e1-s1-client-shell-gap-details.md (Lines 186-204)
* [x] Step 3.4: Validate phase changes
  * Run lint, unit/integration/smoke tests, and build for @game/client

### [x] Implementation Phase 4: Validation

<!-- parallelizable: false -->

* [x] Step 4.1: Run full project validation
  * Execute lint, test, and build commands at client workspace and root workspace scope
* [x] Step 4.2: Fix minor validation issues
  * Iterate on localized lint, type, and test issues in shell startup surfaces
* [x] Step 4.3: Report blocking issues
  * Document issues requiring additional research and add follow-on work rather than widening E1-S1 scope

## Planning Log

See .copilot-tracking/plans/logs/2026-07-01/e1-s1-client-shell-gap-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing auth and bootstrap helper modules in apps/client
* Existing client telemetry conventions
* Existing Vitest unit/integration harness in @game/client
* Existing workspace lint/test/build scripts in package.json files

## Success Criteria

* E1-S1 startup lifecycle is implemented through a concrete shell orchestrator path rather than helper-only exports. - Traces to: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md
* Startup telemetry and failure mapping are deterministic, bounded, and acceptance-criteria aligned. - Traces to: AC2 and AC5 mapping in research
* Unit, integration, and smoke coverage explicitly validate E1-S1 startup flow closure. - Traces to: research test coverage gap findings
* Plan includes discrepancy tracking and implementation-path rationale for transparent delivery. - Traces to: planning log and selected Scenario B
