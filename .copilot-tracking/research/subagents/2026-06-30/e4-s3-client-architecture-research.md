---
title: E4-S3 Client Architecture Research
status: Complete
date: 2026-06-30
story: "#23"
scope: "Codebase-only investigation for client bond visual rendering with reduced motion"
---

## Research Questions

1. What is the current client event/session architecture and where should bond render events be handled?
2. Are there existing visual effect/render abstractions, quality tiers, or motion controls in apps/client?
3. What shared types/contracts exist for bond events and payload validation?
4. What exact files and line numbers are most relevant for implementing event->render and reduced-motion branching?

## Executive Findings

- apps/client currently provides auth/session transport and deterministic realtime delta application, but no rendering pipeline or UI/motion layer.
- The strongest client integration point for event->render is the apply callback passed to RealtimeDeltaHandler in apps/client/src/session/realtime-delta-handler.ts (ApplyDeltaCallback at line 36 and invocation at line 93).
- Server currently emits tile placement deltas over realtime message "delta" and expects "delta_ack". Bond computation exists server-side, but bond events are emitted to telemetry (bonding_triggered) rather than websocket clients.
- Shared bond contracts exist for bond type semantics in packages/shared-types/src/bonding.ts, but no shared websocket bond-event payload contract currently exists.
- No existing reduced-motion toggle, media query handling, quality tiers, or animation abstraction was found in apps/client/src.

## Evidence Log

### Q1) Current client event/session architecture and where bond render events should be handled

1. Client realtime ingress point:
   - apps/client/src/session/realtime-delta-handler.ts:10 defines RealtimeDeltaPayload.
   - apps/client/src/session/realtime-delta-handler.ts:42 defines RealtimeDeltaHandler.
   - apps/client/src/session/realtime-delta-handler.ts:55-57 subscribes to room "delta" events.
   - apps/client/src/session/realtime-delta-handler.ts:85-108 performs sequence dedupe and deterministic ack.
   - apps/client/src/session/realtime-delta-handler.ts:93 invokes applyDeltaCallback(delta), which is the principal hook for world-state apply and downstream rendering.

2. Realtime transport semantics are validated by tests:
   - apps/client/tests/unit/realtime-delta-handler.test.ts verifies ordered application, dedupe, and ack behavior (e.g., "delta_ack" assertions around lines 141-173 and 195-211).

3. Server fanout path for tile placement:
   - apps/server/src/http/app.ts:261-283 builds deltaPayload and publishes via coordinator after successful tile placement.
   - apps/server/src/rooms/arena.room.ts:32-34 defines REALTIME_MESSAGES with DELTA and DELTA_ACK.
   - apps/server/src/rooms/arena.room.ts:72 sends DELTA to client, and line 83 handles DELTA_ACK.

4. Bond computation and emission path today:
   - apps/server/src/index.ts:91 initializes BondRecomputeCoordinator.
   - apps/server/src/index.ts:105 evaluates bond type using evaluateBondType.
   - apps/server/src/index.ts:120 emits telemetry via telemetrySink.emitBondingTriggered.
   - apps/server/src/domain/bond-recompute-coordinator.ts:194 calls emitBondingTriggered callback.

Conclusion for Q1:
- Bond visual rendering should be handled on the client in the consumer of ApplyDeltaCallback (apps/client/src/session/realtime-delta-handler.ts:36,93), because this is the only deterministic event-to-local-state hook currently exposed in apps/client.
- If server-driven bond events are required (instead of client-local bond inference), a new websocket message type and payload contract must be added; current server bond emission is telemetry-only.

### Q2) Existing visual effect/render abstractions, quality tiers, motion controls in apps/client

Findings:
- No render engine dependency is declared in apps/client/package.json (only @azure/msal-browser).
- apps/client/src contains auth and session modules only:
  - apps/client/src/auth/*
  - apps/client/src/session/*
  - apps/client/src/index.ts exports only auth/session/checksum/realtime handlers.
- No code matches found for prefers-reduced-motion, reduced motion, animation framework usage, quality tier config, canvas/webgl renderer abstraction, or effect system in apps/client/src.

Evidence:
- apps/client/package.json: dependencies include only @azure/msal-browser.
- apps/client/src/index.ts: exports session/auth contracts and handlers, no render/motion API export.
- Grep scans over apps/client/src for render/motion/quality/effect terms returned only realtime delta/session-related matches.

Conclusion for Q2:
- There is no existing visual rendering abstraction or reduced-motion control in apps/client at this time.

### Q3) Shared types/contracts for bond events and payload validation

Existing shared bond domain contracts:
- packages/shared-types/src/bonding.ts:1 defines BondType ("glow-chain" | "blend-gradient" | "pulse-rhythm").
- packages/shared-types/src/bonding.ts:3 defines BondEvaluationTile.
- packages/shared-types/src/bonding.ts:77-108 defines evaluateBondType behavior.
- packages/shared-types/src/index.ts:225-226 re-exports evaluateBondType, BondEvaluationTile, BondType.

Related session/delta contracts:
- packages/shared-types/src/index.ts:195 defines RegionDiffTileDelta with stylePayload at line 204.
- apps/client/src/session/realtime-delta-handler.ts defines RealtimeDeltaPayload and DeltaAckPayload locally.
- apps/server/src/domain/delta-fanout.service.ts defines matching server-side RealtimeDeltaPayload and DeltaAckPayload.

Validation posture:
- In apps/client, runtime payload validation is minimal and mostly type-level.
- replay-checksum has a concrete type guard for upsert replay deltas:
  - apps/client/src/session/replay-checksum.ts:150 defines isUpsertDelta.
- No shared schema (e.g., zod/io-ts) was found for realtime "delta" payload, and no shared bond-event payload contract exists.

Conclusion for Q3:
- Shared bond semantics exist (BondType + evaluator), but there is no shared wire contract for bond events and no explicit payload validator for bond-event messages.

### Q4) Exact files and line numbers relevant for event->render and reduced-motion branching

Primary implementation files:
- apps/client/src/session/realtime-delta-handler.ts
  - line 10: RealtimeDeltaPayload (incoming event shape)
  - line 36: ApplyDeltaCallback (render integration seam)
  - line 55-57: room "delta" subscription
  - line 85-108: ordered dedupe + ack flow
  - line 93: callback invocation point
  - line 127-130: delta_ack emission

- apps/client/src/index.ts
  - line 31-37: exports RealtimeDeltaHandler and payload/callback types
  - relevant for introducing new client-facing render/motion API exports

- packages/shared-types/src/bonding.ts
  - line 1: BondType
  - line 3: BondEvaluationTile
  - line 77: evaluateBondType
  - candidate for client-side bond inference logic if using local evaluation from tile neighborhood

- packages/shared-types/src/index.ts
  - lines 225-226: public shared-types exports for bonding primitives

- apps/server/src/http/app.ts
  - lines 261-283: authoritative tile delta fanout publish path
  - location to add optional bond event websocket publish if server-authoritative bond FX is desired

- apps/server/src/rooms/arena.room.ts
  - lines 32-34: realtime message names
  - line 72: send DELTA
  - line 83: receive DELTA_ACK
  - candidate file for adding new room message constant/handler for bond events

- apps/server/src/index.ts
  - lines 91-120: bond recompute and telemetry emission wiring
  - currently emits telemetry, not client-visible room event

- apps/client/tests/unit/realtime-delta-handler.test.ts
  - line 8 onward: harness and assertions for ordered apply and deterministic ack
  - useful template for tests covering event->render dispatch sequencing and reduced-motion branch behavior

## Recommended Integration Points

1. Client-side event->render integration (minimum-scope path)
- Integrate bond rendering decisions in the ApplyDeltaCallback implementation consumed by RealtimeDeltaHandler.
- Rationale: preserves existing ordering and dedupe semantics already guaranteed by handler.

2. Reduced-motion branching point
- Add a motion preference resolver in apps/client (new module), then branch inside the same callback flow that currently applies delta to local world state.
- This keeps motion policy deterministic with event apply order.

3. Contract evolution path if server-authored bond events are required
- Add shared bond-event payload types to packages/shared-types.
- Add server websocket message publish near apps/server/src/http/app.ts:261-283 and room message constants in apps/server/src/rooms/arena.room.ts.
- Add client handler analogous to existing "delta" pipeline.

## Risks and Gaps

1. Missing current UI/render layer in apps/client
- Risk: Story implementation may require creating new rendering infrastructure, not just extending existing code.

2. No shared runtime validator for realtime payloads
- Risk: introducing new bond event payloads without validation may increase client-side runtime failure surface.

3. Potential contract drift between server and client RealtimeDeltaPayload definitions
- Risk: payload interfaces are duplicated in separate files (client and server), increasing drift risk.

4. Server bond signal not currently sent to clients
- Risk: if acceptance criteria requires server-authoritative bond event rendering, additional transport work is required.

## Explicit Non-Existence / Missing References

- Referenced file apps/server/src/http/routes/place-tile.ts does not exist.
- Actual route file for tile operations is apps/server/src/http/routes/tile.routes.ts, with orchestration integrated in apps/server/src/http/app.ts via createTileRoutes.
- No reduced-motion or quality-tier modules found under apps/client/src.

## Discovered Files

- apps/client/src/session/realtime-delta-handler.ts
- apps/client/src/session/reconnect-caller.ts
- apps/client/src/session/replay-checksum.ts
- apps/client/src/session/bootstrap-store.ts
- apps/client/src/index.ts
- apps/client/package.json
- apps/client/tests/unit/realtime-delta-handler.test.ts
- apps/server/src/http/app.ts
- apps/server/src/rooms/arena.room.ts
- apps/server/src/domain/delta-fanout.service.ts
- apps/server/src/domain/bond-recompute-coordinator.ts
- apps/server/src/index.ts
- packages/shared-types/src/bonding.ts
- packages/shared-types/src/index.ts
