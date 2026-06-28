---
applyTo: '.copilot-tracking/changes/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Epic Layer1 E1 Core Platform and Auth Session Spine

## Overview

Implement E1 as sequential vertical slices on the existing server platform and Colyseus room lifecycle so authenticated bootstrap, join-token room admission, presence hygiene, and verification gates satisfy Issue #1 acceptance criteria without introducing a parallel multiplayer session authority.

## Objectives

### User Requirements

* Build a plan to implement the researched E1 task. — Source: user request on 2026-06-28.
* Deliver Issue #1 scope: session bootstrap, join-token issuance, heartbeat lifecycle, verification harness, and playable-shell p50 evidence. — Source: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 88-92, 136-143, 156-201).

### Derived Objectives

* Preserve existing startup/auth middleware/room baseline and implement additive capabilities instead of rewriting core platform components. — Derived from: selected approach and risk assessment in research.
* Map each E1 story (S1-S4) to concrete files, tests, and validation commands to enable implementation handoff without additional discovery. — Derived from: requirement for actionable planning and closure readiness.
* Resolve measurable acceptance ambiguity for "playable shell <5s p50" with an explicit metric contract and CI evidence output. — Derived from: identified research gap and epic exit criteria.
* Keep Colyseus room lifecycle hooks and admission semantics as the authoritative multiplayer session model while limiting custom services to auth credentialing and auxiliary presence metadata. — Derived from: user constraint to avoid rolling custom multiplayer session logic.

## Context Summary

### Project Files

* apps/server/src/index.ts - Current startup wiring and room registration integration points for auth/session services.
* apps/server/src/http/routes/protected.routes.ts - Existing protected profile baseline showing absence of bootstrap contract.
* apps/server/src/rooms/arena.room.ts - Current direct access-token room auth path to replace with join-token contract.
* docs/layer1-backlog.md - E1 story definitions, acceptance criteria, and telemetry expectations.
* docs/cicd-harness.md - Existing verification harness and deployment checks to extend for E1-S4.
* apps/server/tests/integration/http-auth.integration.test.ts - Existing auth integration test baseline to extend with bootstrap/join/heartbeat suites.
* apps/server/tests/load/room-join-load.ts - Existing load harness to extend for verification and p50 evidence.

### References

* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md - Primary task research and selected implementation path.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown formatting standards for planning artifacts.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Markdown writing style standards for planning artifacts.

## Implementation Checklist

### [ ] Implementation Phase 1: Session Bootstrap Vertical Slice (E1-S1)

<!-- parallelizable: false -->

* [ ] Step 1.1: Add protected bootstrap endpoint and shell-init payload contract.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 12-34)
* [ ] Step 1.2: Add bootstrap integration tests and telemetry assertions.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 36-57)
* [ ] Step 1.3: Add telemetry sink runtime and CI secret wiring for session telemetry.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 59-80)
* [ ] Step 1.4: Validate phase changes.
  * Run bootstrap-focused tests and server build checks.

### [ ] Implementation Phase 2: Join Token Issuance and Room Admission (E1-S2)

<!-- parallelizable: false -->

* [ ] Step 2.1: Implement short-lived room join token service and config contract for Colyseus-compatible room admission.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 94-117)
* [ ] Step 2.2: Add join-token issuance endpoint and switch room `onAuth` to join-token verification without adding parallel room-membership state.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 119-142)
* [ ] Step 2.3: Add unit and integration coverage for join-token flow and replay/mismatch cases.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 144-162)
* [ ] Step 2.4: Validate phase changes.
  * Run join-token tests and server build checks.

### [ ] Implementation Phase 3: Colyseus Lifecycle and Presence Hygiene (E1-S3)

<!-- parallelizable: false -->

* [ ] Step 3.1: Implement a non-authoritative lifecycle adapter that derives multiplayer liveness from Colyseus room lifecycle hooks.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 175-198)
* [ ] Step 3.2: Integrate heartbeat endpoint/channel updates as auxiliary presence metadata and stale-metadata cleanup behavior.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 200-219)
* [ ] Step 3.3: Add lifecycle unit/integration suites that verify Colyseus remains the only room-membership authority.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 221-238)
* [ ] Step 3.4: Validate phase changes.
  * Run lifecycle tests and server build checks.

### [ ] Implementation Phase 4: Verification Gate and p50 Evidence (E1-S4)

<!-- parallelizable: false -->

* [ ] Step 4.1: Expand verification harness to include health/readiness, protected-profile smoke, authenticated bootstrap, and room-join token flow.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 251-274)
* [ ] Step 4.2: Define playable-shell p50 metric contract and capture CI evidence artifacts.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 276-296)
* [ ] Step 4.3: Validate phase changes.
  * Run workflow/docs formatting checks and non-prod load validation.

### [ ] Implementation Phase 5: Full Validation

<!-- parallelizable: false -->

* [ ] Step 5.1: Run full project validation.
  * Execute lint, test, build, and load validation commands for modified components.
* [ ] Step 5.2: Fix minor validation issues.
  * Iterate on straightforward lint/build/test findings.
* [ ] Step 5.3: Report blocking issues.
  * Document blockers and closure-evidence gaps requiring follow-on planning.

## Planning Log

See .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Node.js/npm workspace tooling and existing monorepo scripts.
* Existing CI workflows and deployment verification environment secrets.
* Join-token signing secret and lifecycle configuration values in runtime environment.
* Colyseus room lifecycle/auth hooks (`onAuth`, `onJoin`, `onLeave`, reconnection flow) used as multiplayer state authority.

## Success Criteria

* E1-S1 through E1-S4 are represented as implementation-ready steps with concrete files, tests, and validation commands.
* Plan aligns with selected research approach (incremental vertical slices) with documented alternatives and rationale.
* Epic closure evidence includes authenticated verification checks and a reproducible playable-shell p50 measurement method.
* Plan explicitly prevents a custom multiplayer session authority by keeping room-membership lifecycle authoritative in Colyseus.
