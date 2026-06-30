---
title: E5-S1 Planning Research
description: Focused implementation research for E5-S1 creator placement UX, optimistic feedback, input sanitization, and telemetry.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
keywords:
  - e5-s1
  - creator-ux
  - placement-preview
  - telemetry
  - input-sanitization
estimated_reading_time: 9
---

## Research Status

Complete

## Research Scope

Questions investigated:

* Where are the concrete implementation seams for E5-S1 in this repo.
* Which files in apps/client should be modified or added for:
  * palette plus shape picker state
  * placement preview before commit
  * blocked indicator for occupied cell
  * optimistic indicator until ack
  * input sanitization
  * telemetry events (`palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`)
* Whether shared types need updates.
* Which tests to add and which commands should validate the slice.
* At least one viable alternative implementation path and trade-offs.

## Key Evidence From Repo

Current client seams are headless session/auth primitives, not UI composition:

* apps/client/src/index.ts:7 exports SessionBootstrapStore
* apps/client/src/session/bootstrap-store.ts:49 owns bootstrap fetch flow
* apps/client/src/session/realtime-delta-handler.ts:56 subscribes to delta events
* apps/client/src/session/realtime-delta-handler.ts:130 emits `delta_ack`

Placement contract and server-side validation already exist:

* packages/shared-types/src/index.ts:56 defines TilePlaceCommand
* packages/shared-types/src/index.ts:84 defines TilePlaceResult
* packages/shared-types/src/index.ts:52-54 defines commandId constraints
* apps/server/src/http/routes/tile.routes.ts:97 validates tile placement command shape
* apps/server/src/http/routes/tile.routes.ts:116 validates commandId syntax and bounds
* apps/server/src/http/routes/tile.routes.ts:143 exposes POST `/api/tiles/place`

E5-S1 acceptance and telemetry expectations:

* docs/layer1-backlog.md:316 requires blocked indicator on occupied hover
* docs/layer1-backlog.md:317 requires optimistic indicator until ack
* docs/layer1-backlog.md:320 requires `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`

Client testing and dependency baseline:

* apps/client/package.json:9 currently allows `--passWithNoTests`
* apps/client/package.json:11-12 includes only `@azure/msal-browser` as runtime dependency
* apps/client/tests/unit/realtime-delta-handler.test.ts:45 has robust delta/ack tests to mirror style
* apps/client/tests/unit/join-token-caller.test.ts:27 and apps/client/tests/unit/reconnect-caller.test.ts:33 show fetch-caller test pattern

## Recommended Implementation Path

Use a dedicated creator composition slice in apps/client that keeps E5-S1 logic deterministic and transport-agnostic.

### Files to add in apps/client

* apps/client/src/creator/tool-state.ts
  * Reducer/state for selected shape/color, hover cell, preview status, pending placement status, and blocked reason.
  * Emit transition hooks for telemetry at reducer boundaries.
* apps/client/src/creator/placement-preview.ts
  * Pure function: tool selection plus occupancy map -> preview model (`ready`, `blocked`, `invalid_input`).
  * Occupancy key should align with server coordinate identity (`regionId`, `cellX`, `cellY`, offsets where needed).
* apps/client/src/creator/placement-caller.ts
  * HTTP adapter for POST `/api/tiles/place` with TilePlaceCommand and TilePlaceResult.
  * Follow fetch/retry style established in join/reconnect callers.
* apps/client/src/creator/placement-input.ts
  * Input sanitization guards for regionId, integer cell coords, finite numeric offsets, shape/color allowlist, and safe stylePayload size/type.
* apps/client/src/creator/creator-telemetry.ts
  * Small event emitter interface and default adapter for E5-S1 events.
  * Keep payload PII-safe and bounded.

### Existing files to modify

* apps/client/src/index.ts
  * Export new creator E5-S1 modules.
* apps/client/src/session/realtime-delta-handler.ts
  * Optional minimal extension: expose callback hook for acked sequence to allow optimistic marker resolution.
  * Keep current monotonic/always-ack behavior unchanged.

### Shared type impacts

Minimum-change recommendation:

* No required breaking change to packages/shared-types/src/index.ts for E5-S1.
* Reuse TilePlaceCommand and TilePlaceResult as-is (packages/shared-types/src/index.ts:56, 84).

Optional follow-up improvement (non-blocking):

* Add exported shape/color union types in packages/shared-types/src/index.ts to reduce client/server drift for sanitization rules.
* Trade-off: better compile-time safety versus coordination overhead if art catalog changes frequently.

## Test Plan Seams

Add these tests under apps/client/tests:

* apps/client/tests/unit/tool-state.test.ts
  * shape/color selection transitions
  * palette-open transition
  * optimistic pending state start/resolve
* apps/client/tests/unit/placement-preview.test.ts
  * preview visible on valid empty cell
  * blocked indicator when occupied
  * invalid preview when sanitization fails
* apps/client/tests/unit/placement-input.test.ts
  * accepts valid command payloads
  * rejects malformed region/cell/offset/shape/color/stylePayload cases
* apps/client/tests/unit/placement-caller.test.ts
  * maps success/occupied/throttled/command_payload_mismatch responses
  * preserves server conflict metadata for UI state
* apps/client/tests/integration/e5-s1-placement-flow.test.ts
  * end-to-end reducer plus preview plus caller behavior
  * optimistic indicator displayed until ack/result, then resolved
  * telemetry events fired once per transition boundary

Potential extension tests:

* apps/client/tests/unit/realtime-delta-handler.test.ts
  * add case to verify optimistic reconciliation hook does not alter existing ack semantics.

## Validation Commands

Primary E5-S1 validation commands:

* npm run -w @game/client lint
* npm run -w @game/client test
* npm run -w @game/client build

Cross-workspace confidence checks:

* npm run lint
* npm run test

## Dependencies And Blockers

Dependencies:

* Existing placement HTTP contract in apps/server/src/http/routes/tile.routes.ts:143
* Existing placement response semantics in packages/shared-types/src/index.ts:84
* Existing realtime ack path in apps/client/src/session/realtime-delta-handler.ts:130

Blockers or decision gates:

* No browser app shell currently owns this flow; apps/client is still a primitives package (apps/client/src/index.ts:1-38).
* No client telemetry module exists for E5 events; must define a local interface/adaptor.
* No explicit occupancy store exists yet. Preview occupancy must be sourced from replay bootstrap plus realtime deltas.
* Sanitization policy source-of-truth is split today:
  * commandId constraints are explicit in shared types (packages/shared-types/src/index.ts:52-54)
  * shape/color are currently unconstrained strings, so E5-S1 must choose local allowlist policy or add shared unions.

## Alternative Path Considered

Alternative: implement E5-S1 as a single imperative creator-session class with inline state and side effects, no reducer/pure preview layer.

Pros:

* Fewer files and faster initial coding.
* Lower short-term abstraction overhead.

Cons:

* Harder to unit test deterministic transitions and sanitization edge cases.
* Telemetry hooks become UI-callback-coupled and brittle.
* Harder to evolve into E5-S2 and E5-S4 without regressions.

Trade-off decision:

* Prefer reducer plus pure preview plus thin transport adapters.
* It adds files now, but reduces risk for optimistic state correctness, telemetry determinism, and future keyboard/a11y work.

## Selected Recommendation

Implement E5-S1 with a deterministic creator state slice (tool-state plus preview plus sanitize plus caller plus telemetry adapter), reuse existing shared placement contracts unchanged, and add focused unit plus integration tests in apps/client.

This path best fits current repo seams and minimizes coupling to a not-yet-defined browser shell.

## Open Questions

* Should shape/color constraints be enforced only client-side for now, or promoted to shared union types in packages/shared-types/src/index.ts?
* What exact event payload schema is required for E5-S1 telemetry events, beyond event names listed in docs/layer1-backlog.md:320?
* Should optimistic indicator clear on HTTP placement response, realtime ack, or both (with precedence rules) when responses race?
* Is commandId generation owned by E5-S1 creator code, and if so should generation strategy be standardized in shared utilities?
