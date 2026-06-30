---
title: E5 Client UX Surface Research
description: Research-only analysis of the current client implementation surface relevant to epic E5 creator UX navigation and accessibility.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
keywords:
  - epic-5
  - client
  - creator-ux
  - accessibility
  - onboarding
estimated_reading_time: 8
---

## Research Scope

Status: Complete

Topics investigated:

* Current client implementation surface in apps/client/src and apps/client/tests
* Package manifests and exported entrypoints that constrain E5 delivery
* Shared types that define tile placement and viewport contracts
* Existing behavior and missing pieces for tile creation UX, navigation, onboarding, and accessibility
* Likely implementation seams for E5-S1 through E5-S4

## Code Search Terms Used

* palette|shape|preview|pan|zoom|cull|onboard|accessib|keyboard|motion|tile
* creator|create|navigation|aria|focus|reduced-motion|prefers-reduced-motion|keydown|keyup|keyboard|pointer|wheel|zoom|pan|canvas|svg|preview|palette|shape|onboard|tutorial
* place|placement|TilePlaceCommand|viewport|regionId|roomId|keyboard|focus|aria|motion|zoom|pan

## Sources Reviewed

Primary client sources:

* apps/client/package.json:1-19
* apps/client/src/index.ts:1-38
* apps/client/src/auth/external-id-session.ts:8-95
* apps/client/src/auth/join-token-caller.ts:3-55
* apps/client/src/session/bootstrap-store.ts:3-94
* apps/client/src/session/realtime-delta-handler.ts:10-138
* apps/client/src/session/reconnect-caller.ts:3-156
* apps/client/src/session/replay-checksum.ts:4-190

Client tests:

* apps/client/tests/integration/auth-state-machine.test.ts:7-144
* apps/client/tests/unit/realtime-delta-handler.test.ts:7-300

Shared and planning contracts:

* packages/shared-types/src/index.ts:56-176
* docs/layer1-backlog.md:313-365

## Current Client Surface Summary

The current client package is a headless TypeScript helper package, not an interactive app shell. Its public exports are auth, token acquisition, bootstrap, heartbeat, reconnect, replay checksum, and realtime delta handling. There are no exported UI primitives, no rendering layer, no input map, no tile placement caller, and no viewport state surface.

Evidence:

* apps/client/package.json:6-18
* apps/client/src/index.ts:1-38

## Findings

### 1. No existing creator UI implementation exists in apps/client/src

The searched client source tree contains only nine source files, all focused on auth or session state plumbing. The package entrypoint exports those helpers directly and nothing related to palette state, shape selection, placement preview, camera movement, onboarding overlays, accessibility settings, or DOM interaction.

Evidence:

* apps/client/src/index.ts:1-38
* apps/client/package.json:6-18

Impact on E5:

* E5-S1 through E5-S4 are mostly greenfield in the client package as it exists today.

### 2. The only tile-related client behavior today is replay and realtime sync handling

The client knows tile data as payload fields on realtime deltas and replay checksum state. That includes regionId, cell coordinates, offsets, shape, color, stylePayload, and ownerId. This is useful for E5 because it defines the minimum shape of local tile state, but it is not yet tied to any editor or viewport model.

Evidence:

* apps/client/src/session/realtime-delta-handler.ts:10-23
* apps/client/src/session/replay-checksum.ts:4-31
* apps/client/src/session/replay-checksum.ts:47-103

Impact on E5:

* A preview model can likely reuse ReplayTileState-like fields and RealtimeDeltaPayload-like fields for local occupancy and optimistic display.

### 3. There is no client-side placement command or tile-submit adapter yet

The shared types define TilePlaceCommand and TilePlaceResult, including occupied, payload-mismatch, and throttled outcomes, but the client package has no corresponding caller or submit helper. Search results in apps/client only surfaced room join, heartbeat, reconnect, replay, and auth flows.

Evidence:

* packages/shared-types/src/index.ts:56-117
* apps/client/src/index.ts:1-38
* apps/client/src/auth/join-token-caller.ts:8-55

Impact on E5:

* E5-S1 needs a new client seam for place-command submission before palette, preview, and optimistic state can be wired end to end.

### 4. There is no viewport, camera, or culling implementation surface in the client package

The shared types define RegionDiffViewport and RegionDiffRequest, but there is no viewport state, camera math, wheel or pointer input handler, render culling adapter, or region diff fetcher in apps/client/src. The E5-S2 technical note calls for camera controller and spatial culling, which are absent from the current client surface.

Evidence:

* packages/shared-types/src/index.ts:155-176
* docs/layer1-backlog.md:328-336
* apps/client/src/index.ts:1-38

Impact on E5:

* E5-S2 requires new client architecture, not extension of an existing camera module.

### 5. Onboarding is currently blocked by auth and bootstrap flow, but no onboarding UI exists

The session bootstrap store waits for token-ready auth, performs an authenticated fetch, retries once on 401, and otherwise throws. That means a true time-to-first-tile metric must include auth and bootstrap latency. However, there is no onboarding shell, tutorial state, skip path, or first-tile metric capture in the client package.

Evidence:

* apps/client/src/session/bootstrap-store.ts:26-94
* apps/client/src/auth/external-id-session.ts:32-76
* apps/client/tests/integration/auth-state-machine.test.ts:26-144
* docs/layer1-backlog.md:343-351

Impact on E5:

* E5-S3 needs a new orchestration layer that sits above auth, bootstrap, and room join helpers.

### 6. Accessibility behavior is currently absent at code level

Searches across apps/client/src and apps/client/tests found no ARIA attributes, focus management helpers, reduced-motion detection, keyboard input handling, contrast toggles, or accessibility settings models. The backlog explicitly requires keyboard-only placement, high-contrast mode, and reduced motion, but none of those concepts appear in the current client package.

Evidence:

* docs/layer1-backlog.md:358-365
* apps/client/src/index.ts:1-38
* apps/client/package.json:11-18

Impact on E5:

* E5-S4 is greenfield and will need both state and UI layers, plus new tests.

### 7. Current client tests only cover infrastructure flows, not user interaction flows

The visible test surface covers auth state transitions and realtime delta deduplication and ack semantics. There are no tests for editor tool state, preview updates, onboarding progression, keyboard navigation, reduced-motion variants, or viewport math.

Evidence:

* apps/client/tests/integration/auth-state-machine.test.ts:26-144
* apps/client/tests/unit/realtime-delta-handler.test.ts:39-300
* apps/client/package.json:6-9

Impact on E5:

* The epic will need new test slices rather than simple extensions of the current suites.

### 8. RealtimeDeltaHandler is a viable seam for optimistic placement reconciliation, but not for tool state

RealtimeDeltaHandler already provides ordered application, duplicate suppression, and deterministic ack emission for successfully processed or duplicate deltas. That makes it a strong seam for post-submit confirmation and world-state reconciliation. It does not manage local editor intent, focus, preview, blocked-cell indication, or accessibility announcements.

Evidence:

* apps/client/src/session/realtime-delta-handler.ts:42-132
* apps/client/tests/unit/realtime-delta-handler.test.ts:131-230

Impact on E5:

* Use this handler beneath the creator shell, not as the creator shell itself.

### 9. Bootstrap and reconnect helpers imply a session orchestration seam, but there is no app-shell coordinator yet

SessionBootstrapStore keeps reconnect context and handles authenticated bootstrap. reconnectSession returns replay data and checksum state. Those pieces together suggest an eventual session-shell coordinator, but no such coordinator is exported or tested yet.

Evidence:

* apps/client/src/session/bootstrap-store.ts:18-47
* apps/client/src/session/bootstrap-store.ts:49-94
* apps/client/src/session/reconnect-caller.ts:16-31
* apps/client/src/session/reconnect-caller.ts:50-110
* apps/client/src/index.ts:7-38

Impact on E5:

* E5 implementation likely needs a new top-level composition module to connect auth, bootstrap, room join, replay, viewport state, and creator controls.

### 10. Shared contracts already define several boundaries E5 should build around

TilePlaceCommand establishes the placement payload shape. TilePlaceResult establishes user-visible failure cases. RegionDiffViewport and RegionDiffRequest establish the likely contract for viewport-driven fetching once pan and zoom exist.

Evidence:

* packages/shared-types/src/index.ts:56-117
* packages/shared-types/src/index.ts:155-176

Impact on E5:

* The lowest-risk client architecture is one that adds local reducers and adapters around these shared contracts instead of inventing client-only payload shapes.

## Existing Behavior Versus Missing Pieces

### Existing behavior

* Auth state machine for silent token acquisition and interactive recovery: apps/client/src/auth/external-id-session.ts:24-95
* Join-token acquisition for room entry: apps/client/src/auth/join-token-caller.ts:8-55
* Authenticated session bootstrap and reconnect-context storage: apps/client/src/session/bootstrap-store.ts:26-94
* Reconnect API caller with normalized failure classes: apps/client/src/session/reconnect-caller.ts:33-156
* Replay checksum and replay delta application to tile-state map: apps/client/src/session/replay-checksum.ts:42-190
* Ordered realtime delta application with dedupe and ack behavior: apps/client/src/session/realtime-delta-handler.ts:42-132

### Missing pieces

* Palette and shape state model
* Placement preview and occupied-cell blocked indicator
* Tile placement submit adapter using TilePlaceCommand
* Camera state, pan/zoom math, and culling logic
* Viewport-driven diff retrieval adapter
* Onboarding stepper, skip path, and first-tile timing capture
* Keyboard input map and focus model for tool usage
* Reduced-motion and high-contrast settings model
* Accessibility announcements and preference persistence
* Integration and smoke tests for creator flows

## Most Likely Implementation Seams

### 1. New client app-shell or creator-session coordinator

Rationale:

* Existing helpers are all low-level and stateless enough to compose cleanly
* E5 needs one place to coordinate auth readiness, bootstrap, room join, replay hydration, first-tile timing, and reconnect recovery

Candidate inputs and dependencies:

* apps/client/src/auth/external-id-session.ts:24-95
* apps/client/src/auth/join-token-caller.ts:8-55
* apps/client/src/session/bootstrap-store.ts:49-94
* apps/client/src/session/reconnect-caller.ts:50-110
* apps/client/src/session/realtime-delta-handler.ts:42-132

### 2. New creator tool reducer or local state store

Rationale:

* E5-S1 and E5-S4 both need deterministic state transitions for selected shape, selected color, preview cell, blocked state, keyboard mode, and accessibility toggles
* The backlog already hints at a tool reducer

Candidate contract anchors:

* docs/layer1-backlog.md:313-320
* packages/shared-types/src/index.ts:56-117

### 3. New placement adapter around TilePlaceCommand and TilePlaceResult

Rationale:

* Shared contracts exist, but no client submit seam does
* This adapter is the narrowest place to sanitize inputs, handle occupied or throttled results, and connect optimistic state to server truth

Candidate contract anchors:

* packages/shared-types/src/index.ts:56-117
* apps/client/src/session/realtime-delta-handler.ts:78-107

### 4. New viewport controller and visible-region adapter

Rationale:

* Pan/zoom and culling need a local camera model
* Shared viewport contracts already exist for a fetch boundary

Candidate contract anchors:

* packages/shared-types/src/index.ts:155-176
* docs/layer1-backlog.md:328-336

### 5. New onboarding metrics wrapper around bootstrap-to-first-placement flow

Rationale:

* The exit criterion is time based, and current code has no capture seam for it
* The wrapper should start timing before or at the start of authenticated shell entry and stop on successful first placement

Candidate contract anchors:

* docs/layer1-backlog.md:343-351
* apps/client/src/session/bootstrap-store.ts:49-94

## Open Questions

* Where will the actual interactive client UI live: this package, a future web app package, or another folder not yet created in the repo?
* Is there already an unpublished or ignored prototype for room join, tile placement, or viewport rendering outside apps/client/src?
* Should E5 placement preview be purely local, or should blocked-cell feedback depend on live occupancy derived from diff or replay state?
* Should accessibility preferences be per-session local state only, or persisted per authenticated account as implied by the backlog note on settings isolation?
* What is the intended metric start point for first_tile_time_recorded: page load, auth start, token-ready, bootstrap complete, or creator-shell ready?

## Recommended Next Research

* Inspect server-side tile placement route and room message contract to identify the narrowest client submit interface for E5-S1
* Inspect any existing or planned web host package for where DOM, rendering, and accessibility UI should live
* Research whether region diff retrieval work already defines a client fetch adapter or viewport cadence suitable for E5-S2
* Clarify telemetry sink expectations for first-tile timing, accessibility toggles, and keyboard placement usage