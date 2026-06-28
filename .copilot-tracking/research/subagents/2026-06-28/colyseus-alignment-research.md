---
title: Colyseus Alignment Audit for E1 Planning Artifacts
description: Audit of E1 plan/details/log/research for Colyseus-native multiplayer and session alignment, with findings and edit-ready text
ms.date: 2026-06-28
ms.topic: reference
---

## Research Topics and Questions

* Audit current E1 planning artifacts for alignment with Colyseus-native room/session patterns.
* Identify wording that implies custom multiplayer session orchestration instead of Colyseus primitives.
* Produce actionable edits and paste-ready replacement text.

## Scope and Evidence Reviewed

* .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md
* .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md
* .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md
* apps/server/src/rooms/arena.room.ts
* apps/server/src/http/routes/protected.routes.ts
* apps/server/src/index.ts

## Key Discoveries

* Current server baseline is Colyseus-native room registration plus room-level auth:
  * apps/server/src/index.ts line 55 defines room with injected options.
  * apps/server/src/rooms/arena.room.ts lines 26-28 perform auth inside `onAuth`.
* Planning artifacts include language that can drift toward custom session management outside Colyseus lifecycle:
  * Plan phase 3 and details phase 3 describe a separate session lifecycle service, scheduler, stale session cleanup, and heartbeat endpoint as primary mechanics.
* Planning artifacts also assume explicit join-token issuance and replay cache mechanics. This can be valid for external auth, but the wording currently omits Colyseus reservation mechanisms (`seat reservation`, `onJoin`, `onLeave`, reconnection semantics) and therefore implies custom admission flow as the core multiplayer mechanism.

## Findings

### [HIGH] F-01: Session lifecycle is framed as an external custom service instead of room lifecycle first

Evidence:

* .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md lines 73-84
* .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md lines 173-204
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md lines 195-199

Why this conflicts with Colyseus conventions:

* Colyseus session/player liveness should be anchored to room lifecycle hooks and transport presence (`onJoin`, `onLeave`, reconnection handling), with app-specific heartbeat only as a thin extension. Current wording makes external lifecycle service the primary source of truth.

Risk:

* Parallel state machines for room membership and custom session records can diverge and produce stale presence bugs.

### [HIGH] F-02: Join admission is described as custom token issuance flow without explicit Colyseus seat reservation alignment

Evidence:

* .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md lines 94-133
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md lines 190-193
* apps/server/src/rooms/arena.room.ts lines 26-28

Why this conflicts with Colyseus conventions:

* Colyseus-native admission typically uses `matchMaker` flow and seat reservation semantics. Plans should explicitly state that join credentials integrate with reservation and room `onAuth`, not replace Colyseus routing/admission.

Risk:

* Team may implement a custom side-channel admission protocol that bypasses native seat lifecycle guarantees.

### [MEDIUM] F-03: Heartbeat endpoint is treated as required primary mechanism without prioritizing WebSocket/room events

Evidence:

* .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md lines 197-209
* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md lines 148, 166, 196

Why this conflicts with Colyseus conventions:

* In Colyseus, connection and leave events already provide liveness boundaries. A heartbeat HTTP endpoint can exist for shell metrics, but should not be the canonical multiplayer session source.

Risk:

* Duplicated liveness tracking and additional failure modes under network partition conditions.

### [LOW] F-04: Planning log says no deviations while Colyseus-specific constraints are missing

Evidence:

* .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md lines 10-14

Why this matters:

* There is no documented discrepancy asserting Colyseus-native constraints, so reviewers can misread current plan as fully aligned.

## Recommended Wording and Checklist Changes

### Global wording guardrails

* Replace phrases like session lifecycle manager as primary with room lifecycle extensions anchored to Colyseus hooks.
* State explicitly that join-token service augments Colyseus seat reservation and room `onAuth`; it does not introduce a separate multiplayer session protocol.
* State heartbeat endpoint as optional telemetry/input channel, not canonical room membership authority.

### Checklist additions

* Add acceptance check: room membership state derives from Colyseus lifecycle (`onAuth`, `onJoin`, `onLeave`, reconnection path) with no parallel authoritative session table.
* Add acceptance check: join admission path documents and tests seat-reservation compatibility.
* Add acceptance check: stale cleanup only applies to auxiliary metadata, never to override active room membership tracked by Colyseus.

## Specific Sections to Edit

### Plan file edits

Target file:

* .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md

Sections:

* lines 73-84 (Phase 3 heading and steps)
* line 116 (dependency statement mentioning lifecycle configuration)
* line 120 (success criteria)

### Details file edits

Target file:

* .copilot-tracking/details/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-details.md

Sections:

* lines 173-189 (Step 3.1)
* lines 197-209 (Step 3.2)
* lines 225-227 (Step 3.3 success criteria)
* lines 259-261 (Step 4.1 success criteria)

### Log file edits

Target file:

* .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md

Sections:

* lines 10-14 (replace none currently statements)
* add one discrepancy entry under Plan Deviations from Research

### Research file edits

Target file:

* .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md

Sections:

* lines 146-150 (requirements list)
* lines 191-199 (S2 and S3 details)
* lines 206-209 (dependency assumptions)

## Paste-Ready Snippets

### Snippet A: Plan Phase 3 title and step wording

Use this to replace Phase 3 heading and bullets:

"Implementation Phase 3: Colyseus Room Lifecycle and Presence Hygiene (E1-S3)

* Step 3.1: Extend room lifecycle instrumentation using Colyseus `onJoin`/`onLeave` and reconnection flow as the authoritative session source.
* Step 3.2: Add optional heartbeat ingestion for shell telemetry only, and map it to non-authoritative metadata.
* Step 3.3: Add lifecycle tests that verify room membership authority remains in Colyseus state transitions.
* Step 3.4: Validate phase changes with integration tests covering join, disconnect, reconnect, and stale metadata cleanup." 

### Snippet B: Details Step 3.1 replacement paragraph

"Add a lightweight presence adapter that derives session state from Colyseus room lifecycle hooks (`onAuth`, `onJoin`, `onLeave`, reconnection path). Any lifecycle service introduced in this phase must be non-authoritative and must not maintain a separate source of truth for active room membership." 

### Snippet C: Details Step 3.2 success criteria replacement

"* Room membership authority is derived from Colyseus lifecycle transitions.
* Heartbeat input, if implemented, updates auxiliary metadata only.
* Cleanup routines never evict or mutate active room membership outside Colyseus lifecycle events." 

### Snippet D: Join-token wording hardening

"Join tokens are scoped credentials for Colyseus admission and must be validated within Colyseus-compatible seat reservation and room `onAuth` flow. This design augments Colyseus admission semantics and must not introduce a parallel custom multiplayer session protocol." 

### Snippet E: Planning log discrepancy entry

"* COL-01: Colyseus lifecycle authority was implicit but not explicit in Phase 3 wording.
  * Impact: Risk of implementing a parallel custom session authority.
  * Resolution: Update plan/details/research language to make Colyseus room lifecycle authoritative and heartbeat service auxiliary." 

## Clarifying Questions That Require Product Input

* Is join-token issuance required to integrate with explicit seat reservation now, or is room `onAuth`-only gating acceptable for this milestone?
* Should reconnection behavior be part of E1 acceptance for session spine, or deferred to a follow-on story?

## Status

* Complete: Original research questions were answered with evidence and edit-ready recommendations.
* Residual risk: Final alignment depends on whether issue #1 acceptance language mandates seat reservation in this milestone.