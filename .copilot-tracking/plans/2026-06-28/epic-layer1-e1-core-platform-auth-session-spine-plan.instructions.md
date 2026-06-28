---
applyTo: '.copilot-tracking/changes/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Epic Layer1 E1 Core Platform and Auth Session Spine

## Overview

Implement E1 as sequential vertical slices on the existing server platform and Colyseus room lifecycle so OAuth-backed player sign-in through a Microsoft Entra External ID tenant, authenticated bootstrap, join-token room admission, presence hygiene, and verification gates satisfy Issue #1 acceptance criteria without introducing a parallel multiplayer session authority.

## Objectives

### User Requirements

* Build a plan to implement the researched E1 task. — Source: user request on 2026-06-28.
* Deliver Issue #1 scope: session bootstrap, join-token issuance, heartbeat lifecycle, verification harness, and playable-shell p50 evidence. — Source: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 88-92, 136-143, 156-201).
* Ensure player authentication uses OAuth backed by a Microsoft Entra External ID tenant. — Source: user request on 2026-06-28.

### Derived Objectives

* Preserve existing startup/auth middleware/room baseline and implement additive capabilities instead of rewriting core platform components. — Derived from: selected approach and risk assessment in research.
* Map each E1 story (S1-S4) to concrete files, tests, and validation commands to enable implementation handoff without additional discovery. — Derived from: requirement for actionable planning and closure readiness.
* Define the shell-to-API auth boundary explicitly: the shell acquires a game-API access token from the External ID tenant before bootstrap, and the server remains the trust boundary for token validation. — Derived from: External ID auth requirement and research addendum.
* Resolve measurable acceptance ambiguity for "playable shell <5s p50" with an explicit metric contract and CI evidence output anchored to token-ready state for returning players. — Derived from: identified research gap and epic exit criteria.
* Keep Colyseus room lifecycle hooks and admission semantics as the authoritative multiplayer session model while limiting custom services to auth credentialing and auxiliary presence metadata. — Derived from: user constraint to avoid rolling custom multiplayer session logic.
* Keep External ID API bearer tokens and server-issued room join credentials as separate trust layers. — Derived from: External ID OAuth requirement and selected join-token design.

## Context Summary

### Project Files

* apps/server/src/index.ts - Current startup wiring and room registration integration points for auth/session services.
* apps/server/src/auth/auth-service.ts - Current generic Entra JWT validation surface to retain as the API trust boundary while planning External ID-specific acceptance rules.
* apps/server/src/config/env.ts - Current authority/audience/JWKS configuration surface to extend with explicit External ID contract and related secrets.
* packages/shared-auth/src/index.ts - Shared JWT validation surface to harden for External ID token version, issuer, and tenant-scoped subject rules.
* apps/server/src/http/routes/protected.routes.ts - Existing protected profile baseline showing absence of bootstrap contract.
* apps/server/src/rooms/arena.room.ts - Current direct access-token room auth path to replace with join-token contract.
* apps/client/ - Planned shell workspace surface to add OAuth token acquisition, token-ready bootstrap gating, and retry behavior for External ID-backed player sign-in.
* docs/layer1-backlog.md - E1 story definitions, acceptance criteria, and telemetry expectations.
* docs/cicd-harness.md - Existing verification harness and deployment checks to extend for E1-S4.
* apps/server/tests/integration/http-auth.integration.test.ts - Existing auth integration test baseline to extend with bootstrap/join/heartbeat suites.
* apps/server/tests/load/room-join-load.ts - Existing load harness to extend for verification and p50 evidence.

### References

* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md - Primary task research and selected implementation path.
* .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md - External ID-specific planning guidance for OAuth, CI, and token validation boundaries.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown formatting standards for planning artifacts.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Markdown writing style standards for planning artifacts.

## Implementation Checklist

### [x] Implementation Phase 1: External ID OAuth Bootstrap Vertical Slice (E1-S1)

<!-- parallelizable: false -->

* [x] Step 1.1: Define the External ID app-registration and authority contract for the shell client and game API.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 10-34)
* [x] Step 1.2: Define the shell-to-API OAuth contract for External ID-backed bootstrap, including token acquisition states, silent renewal, and bounded interactive fallback.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 36-57)
* [x] Step 1.3: Create the shell auth implementation surface for External ID OAuth, including MSAL configuration, token-ready bootstrap gating, and bounded retry behavior.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 59-82)
* [x] Step 1.4: Harden External ID token validation in shared auth and server config before bootstrap depends on it.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 84-109)
* [x] Step 1.5: Add protected bootstrap endpoint and shell-init payload contract aligned to token-ready auth state.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 111-132)
* [x] Step 1.6: Add bootstrap integration tests, auth-retry expectations, and telemetry assertions.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 134-158)
* [x] Step 1.7: Add telemetry sink runtime and CI secret wiring for session telemetry and External ID verification provenance.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 160-184)
* [x] Step 1.8: Validate phase changes.
  * Run bootstrap-focused tests and server build checks.

### [x] Implementation Phase 2: Join Token Issuance and Room Admission (E1-S2)

<!-- parallelizable: false -->

* [x] Step 2.1: Implement short-lived room join token service and config contract for Colyseus-compatible room admission.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 198-223)
* [x] Step 2.2: Add join-token issuance endpoint and switch room `onAuth` to join-token verification without adding parallel room-membership state or reusing the External ID access token as a room credential.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 225-249)
* [x] Step 2.3: Add unit and integration coverage for join-token flow and replay/mismatch cases.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 251-268)
* [x] Step 2.4: Validate phase changes.
  * Run join-token tests and server build checks.

### [x] Implementation Phase 3: Colyseus Lifecycle and Presence Hygiene (E1-S3)

<!-- parallelizable: false -->

* [x] Step 3.1: Implement a non-authoritative lifecycle adapter that derives multiplayer liveness from Colyseus room lifecycle hooks.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 281-305)
* [x] Step 3.2: Integrate heartbeat endpoint/channel updates as auxiliary presence metadata and stale-metadata cleanup behavior, with telemetry that distinguishes auth churn from transport churn.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 307-328)
* [x] Step 3.3: Add lifecycle unit/integration suites that verify Colyseus remains the only room-membership authority.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 330-347)
* [x] Step 3.4: Validate phase changes.
  * Run lifecycle tests and server build checks.

### [x] Implementation Phase 4: Verification Gate and p50 Evidence (E1-S4)

<!-- parallelizable: false -->

* [x] Step 4.1: Expand verification harness to include health/readiness, protected-profile smoke, authenticated bootstrap, and room-join token flow with documented External ID token provenance and expected-claim validation.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 360-386)
* [x] Step 4.2: Define playable-shell p50 metric contract from token-ready state and capture CI evidence artifacts.
  * Details: .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md (Lines 388-409)
* [x] Step 4.3: Validate phase changes.
  * Run workflow/docs formatting checks and non-prod load validation.

### [ ] Implementation Phase 5: Full Validation

<!-- parallelizable: false -->

* [x] Step 5.1: Run full project validation.
  * Execute lint, test, build, and load validation commands for modified components.
* [x] Step 5.2: Fix minor validation issues.
  * Iterate on straightforward lint/build/test findings.
* [x] Step 5.3: Report blocking issues.
  * Document blockers and closure-evidence gaps requiring follow-on planning.

## Planning Log

See .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Node.js/npm workspace tooling and existing monorepo scripts.
* Existing CI workflows and deployment verification environment secrets.
* External ID tenant authority, API audience, JWKS/metadata endpoints, and client-registration contract for the game shell.
* Join-token signing secret and lifecycle configuration values in runtime environment.
* Colyseus room lifecycle/auth hooks (`onAuth`, `onJoin`, `onLeave`, reconnection flow) used as multiplayer state authority.
* A decision to keep E1 verification on pre-minted External ID tokens plus explicit provenance and expected-claim validation, deferring full automated token minting.

## Success Criteria

* E1-S1 through E1-S4 are represented as implementation-ready steps with concrete files, tests, and validation commands.
* Plan aligns with selected research approach (incremental vertical slices) with documented alternatives and rationale.
* Epic closure evidence includes authenticated verification checks, documented External ID token provenance, and a reproducible playable-shell p50 measurement method anchored to token-ready bootstrap timing.
* Plan explicitly prevents a custom multiplayer session authority by keeping room-membership lifecycle authoritative in Colyseus.
* Plan explicitly targets OAuth-backed player auth through a Microsoft Entra External ID tenant instead of a generic bearer-token assumption.
