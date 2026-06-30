<!-- markdownlint-disable-file -->
# Task Research: E5 Creator UX Navigation and Accessibility

Epic #5 covers the first interactive creator experience for Layer 1. The repo already defines the product intent, story breakdown, and acceptance criteria, but the current client package does not yet expose a UI, camera, onboarding, or accessibility layer. This research identifies the concrete seams already present in the codebase, the missing implementation surfaces, and the lowest-risk delivery approach for E5-S1 through E5-S4.

## Task Implementation Requests

* Research the current codebase state relevant to palette, shape, preview, pan/zoom, culling, onboarding, and accessibility controls.
* Evaluate viable implementation directions for this epic and recommend one approach grounded in the repo.

## Scope and Success Criteria

* Scope: Assess current implementation surfaces, documented product intent, prior related work, harness expectations, and likely story decomposition for E5-S1 through E5-S4. Excludes direct code changes.
* Assumptions:
  * The GitHub epic issue is the primary scope brief.
  * apps/client is the intended client implementation surface, even though it is currently a headless library.
  * Existing shared and server contracts constrain first-tile flow, placement, replay, reconnect, and viewport behavior.
* Success Criteria:
  * Identify the relevant files, tests, and docs that define or constrain creator UX work.
  * Recommend a practical implementation approach for the epic with alternatives and trade-offs.

## Outline

1. Gather repo and docs evidence for the current client and UX surface.
2. Map epic scope to existing architecture, shared contracts, tests, and harness requirements.
3. Evaluate viable implementation approaches for creator flow, onboarding, navigation, and accessibility.
4. Select a recommended delivery shape with concrete implementation implications.

## Potential Next Research

* Trace the final room-join and app-shell startup path that sits above the existing client helpers.
  * Reasoning: The current repo shows auth, bootstrap, reconnect, and replay helpers, but not the top-level coordinator that would own the true first-tile critical path.
  * Reference: apps/client/src and any downstream consumer of the package exports.
* Define the exact `first_tile_time_recorded` timing contract.
  * Reasoning: The backlog names the event, but the repo does not yet expose the start or stop boundary for the p50 budget.
  * Reference: docs/layer1-backlog.md
* Decide whether E5 harness point 6 needs browser-driven verification.
  * Reasoning: current post-deploy verification proves bootstrap and room join health, not actual creator UX completion.
  * Reference: .github/workflows/verify-release.yml

## Research Executed

### File Analysis

* apps/client/package.json
  * Client workspace is testable and buildable, but currently allows `--passWithNoTests`, which means E5 coverage must be added explicitly.
* apps/client/src/index.ts
  * Public client surface exports auth, bootstrap, heartbeat, reconnect, replay, and realtime delta utilities only.
* apps/client/src/auth/external-id-session.ts
  * Auth readiness is a hard dependency for bootstrap and therefore for first-tile timing.
* apps/client/src/auth/join-token-caller.ts
  * Join-token acquisition is the current room-entry gate for interactive client flow.
* apps/client/src/session/bootstrap-store.ts
  * Bootstrap payload is intentionally minimal and carries no onboarding, accessibility, palette, or viewport metadata.
* apps/client/src/session/realtime-delta-handler.ts
  * Deterministic delta application and ack behavior already exist and should remain the world-state confirmation seam.
* apps/client/src/session/reconnect-caller.ts
  * Reconnect failure classes are normalized and suitable for resilient UX messaging.
* apps/client/src/session/replay-checksum.ts
  * Tile replay state and deterministic checksum behavior already define a reusable local world-state primitive.
* packages/shared-types/src/index.ts
  * Shared contracts already define placement payloads, placement outcomes, viewport constraints, and diff policy.
* docs/layer1-backlog.md
  * E5 stories, acceptance criteria, telemetry expectations, and harness mapping are already detailed.
* docs/game-design-document.md
  * Product intent promises keyboard navigation, reduced motion, high contrast, colorblind-safe palettes, pattern overlays, and 30-second creation.
* .github/workflows/ci.yml
  * Harness point 2 maps cleanly to existing deterministic build, type safety, lint, and test gates.
* .github/workflows/verify-release.yml
  * Harness point 6 currently validates auth/bootstrap/room-join behavior and latency evidence, but not creator UX completion.

### Code Search Results

* `palette|shape|preview|pan|zoom|cull|onboard|accessib|keyboard|motion|tile`
  * Functional hits appear in docs and backlog, not in apps/client implementation files.
* `reduced-motion|prefers-reduced-motion|aria|focus|keydown|keyup`
  * No current client accessibility implementation surface was found.
* `TilePlaceCommand|TilePlaceResult|RegionDiffViewport|RegionDiffRequest`
  * Shared type boundaries exist in packages/shared-types/src/index.ts and should be reused directly.
* `first_tile_time_recorded|keyboard_placement_used|a11y_mode_enabled`
  * Telemetry is promised by backlog artifacts, but no client-side measurement surface is present yet.

### External Research

* None

### Project Conventions

* Standards referenced: repo memory notes, Task Researcher operating constraints, markdown guidance for repository research artifacts.
* Instructions followed: research documents under .copilot-tracking/research/, evidence-first consolidation, plain-text file references inside research artifacts.

## Key Discoveries

### Project Structure

The decisive structural fact is that apps/client is not yet an application shell. It is a headless session library that exposes authentication, session bootstrap, reconnect, heartbeat, replay checksum, and realtime delta helpers. There is no current creator UI module, no input abstraction, no accessibility state, no viewport model, and no tile placement caller.

Relevant evidence:

* apps/client/package.json:6-18
* apps/client/src/index.ts:1-38
* apps/client/tests/integration/auth-state-machine.test.ts:26-144
* apps/client/tests/unit/realtime-delta-handler.test.ts:39-300

### Implementation Patterns

Several low-level patterns already exist and should be preserved instead of replaced:

* Realtime confirmation pattern: ordered delta application, duplicate suppression, and ack behavior belong in apps/client/src/session/realtime-delta-handler.ts and are a good seam for post-placement confirmation.
* Replay integrity pattern: apps/client/src/session/replay-checksum.ts already models canonical tile replay state and checksum generation for reconnect consistency.
* Auth and bootstrap orchestration pattern: apps/client/src/auth/external-id-session.ts and apps/client/src/session/bootstrap-store.ts are already the startup gates for any first-run creator flow.
* Shared contract pattern: placement and viewport payloads already exist in packages/shared-types/src/index.ts and should anchor new client reducers and adapters.

### Complete Examples

```text
Current client seam inventory

apps/client/src/
  auth/
    external-id-session.ts
    join-token-caller.ts
    msal-config.ts
  session/
    bootstrap-store.ts
    heartbeat-caller.ts
    realtime-delta-handler.ts
    reconnect-caller.ts
    replay-checksum.ts

Missing for E5

apps/client/src/
  creator/
    tool-state.ts
    placement-caller.ts
    placement-preview.ts
    onboarding-state.ts
    accessibility-settings.ts
    camera-state.ts
    spatial-culling.ts
    viewport-diff-caller.ts
```

### API and Schema Documentation

The most important contracts already exist:

* Placement command and results: packages/shared-types/src/index.ts:56-117
* Viewport and region diff request boundaries: packages/shared-types/src/index.ts:155-208
* Join-token, heartbeat, bootstrap, and reconnect server endpoints: apps/server/src/http/routes/session.routes.ts
* Placement throttle and route behavior: apps/server/src/http/app.ts

The most important missing contracts are also clear:

* No client placement-submit helper exists.
* No bootstrap metadata exists for onboarding or accessibility defaults.
* No telemetry contract is visible for first-tile timing or accessibility-mode capture.

### Configuration Examples

```text
Current harness surfaces relevant to E5

package.json
  lint
  test
  build

.github/workflows/ci.yml
  npm ci --workspaces --include-workspace-root
  npm run audit
  npm run lint
  npm run test
  npm run build

.github/workflows/verify-release.yml
  health and readiness checks
  protected route auth check
  bootstrap token-ready check
  authenticated room-join smoke check
  playable-shell p50 threshold
  load artifact validation
```

## Technical Scenarios

### Scenario 1: Deliver E5 as a Client-Side Composition Layer on Top of Existing Contracts

This approach introduces a new creator-facing state and adapter layer in apps/client, but keeps shared placement, reconnect, replay, and session contracts intact. It assumes E5 should compose the current headless client helpers rather than replace them.

**Requirements:**

* First tile in <30s p50
* Keyboard + reduced-motion flows are usable
* Scope covers palette/shape/preview, pan/zoom and culling, onboarding, and accessibility controls
* Must align with harness points 2 and 6 already used by the repo

**Preferred Approach:**

* Add a new creator composition surface in apps/client, backed by deterministic local reducers and thin request adapters, while preserving existing auth, replay, reconnect, and shared type boundaries.

```text
Recommended file-shape direction

apps/client/src/
  creator/
    tool-state.ts
    placement-caller.ts
    placement-preview.ts
    camera-state.ts
    spatial-culling.ts
    onboarding-state.ts
    accessibility-settings.ts
    accessibility-announcer.ts
    creator-session.ts

apps/client/tests/
  unit/
    tool-state.test.ts
    camera-state.test.ts
    spatial-culling.test.ts
    accessibility-settings.test.ts
  integration/
    creator-placement-flow.test.ts
    onboarding-flow.test.ts
    keyboard-placement-flow.test.ts
```

**Implementation Details:**

The recommended implementation path is to treat E5 as a composition problem with four story slices:

* E5-S1 should add deterministic local tool state and placement preview on top of shared placement contracts. The new code should map directly onto TilePlaceCommand and TilePlaceResult from packages/shared-types/src/index.ts:56-117 and use realtime-delta-handler only for committed world-state reconciliation.
* E5-S2 should add local camera state, zoom bounds, and spatial culling based on RegionDiffViewport and RegionDiffRequest from packages/shared-types/src/index.ts:155-208. If viewport-driven fetch is required, that likely becomes a thin adapter rather than a new domain model.
* E5-S3 should add a skippable onboarding flow above auth and bootstrap helpers, because docs/game-design-document.md and docs/layer1-backlog.md both support a place-first experience, but they also conflict on whether tutorial flow is mandatory. The safest interpretation is assistive rather than blocking onboarding.
* E5-S4 should add local accessibility settings and keyboard control state first, then expand only if needed to shared persistence. Reduced motion, keyboard-only placement, and high contrast can start as client-local behavior without waiting for server support.

This approach best matches the repo because:

* The current client package already contains reusable low-level primitives for startup, reconnect, replay, and realtime consistency.
* Shared contracts already constrain placement and viewport payloads, which lowers risk when reducers and adapters align directly with them.
* Most of the user-facing epic scope can be delivered client-side first without touching server session or diff contracts.
* Unit and integration coverage can plug directly into the existing Vitest and TypeScript harness used by apps/client.

Primary risks in this approach:

* The true first-tile timer boundary is still unspecified.
* Viewport fetch behavior may still need server or shared work if pan/zoom exceeds purely local culling.
* Harness point 6 remains under-specified unless deployed verification grows to include creator UX behavior.

### Scenario 2: Expand Bootstrap and Server Contracts Up Front Before Building E5 UI

This approach would first extend server and shared contracts for onboarding metadata, viewport defaults, accessibility preference persistence, and possibly tutorial or multi-room entry behavior before implementing the creator shell.

**Requirements:**

* Support richer onboarding defaults or saved accessibility state across sessions
* Potentially support tutorial rooms, pre-join browsing, or server-aware first-tile telemetry

**Preferred Approach:**

* Not selected as the first delivery step

**Implementation Details:**

This path is defensible if product decisions require persisted accessibility preferences, richer bootstrap defaults, or server-observable first-tile metrics. It is not the best starting point because the current epic scope can largely be advanced without changing core session contracts, and front-loading server work would slow delivery without solving the immediate absence of the client interaction layer.

### Scenario 3: Build a Separate Frontend App Shell Outside apps/client and Treat apps/client as a Shared SDK

This approach would leave apps/client as a headless package and introduce the creator UI in a separate app layer that consumes it.

**Requirements:**

* Clear evidence that the actual DOM/rendering shell already lives elsewhere
* A repo-level decision that apps/client should remain infrastructure-only

**Preferred Approach:**

* Not selected until a separate frontend shell is confirmed

**Implementation Details:**

This remains a plausible architectural alternative because the current apps/client package looks like a browser/session SDK rather than a full app. It is not selected because the visible repo does not yet identify a separate interactive frontend surface. Planning E5 against an unverified shell would add unnecessary ambiguity.

#### Considered Alternatives

* Contract-first server expansion was rejected as the default path because it delays the most obvious missing work, which is the absence of any creator interaction layer in the client.
* Separate frontend shell delivery was rejected as the default path because the repository evidence in scope does not yet show where that shell lives.

## Selected Approach

The recommended implementation strategy is to deliver E5 as a new creator composition layer in apps/client, built on deterministic local reducers and thin adapters that reuse the current auth, bootstrap, replay, reconnect, realtime, and shared-type contracts.

Why this is the strongest fit:

* The epic is mostly greenfield in the client, so the cleanest move is to add explicit creator modules rather than stretch session helpers into UI responsibilities.
* The existing shared contracts already define safe boundaries for placement and viewport behavior.
* Most of the requested epic scope is client-local and does not require immediate server changes.
* The repo's harness for TypeScript, lint, unit tests, integration tests, and verification artifacts can support this incrementally.

Implementation impact by story:

* E5-S1 can be delivered almost entirely client-side, except for the missing placement-submit adapter.
* E5-S2 is client-heavy, but may need a thin viewport fetch adapter once camera state exists.
* E5-S3 is primarily a coordination layer over existing auth and bootstrap gates.
* E5-S4 is primarily client-local unless product requires persisted accessibility preferences.

## Actionable Next Steps for Planning

* Plan E5-S1 around a new `creator/tool-state` reducer, `creator/placement-preview` adapter, and `creator/placement-caller` seam tied directly to shared placement contracts.
* Plan E5-S2 around `camera-state` and `spatial-culling` as deterministic units with testable math before deciding whether viewport fetch expansion is necessary.
* Treat E5-S3 onboarding as skippable guidance rather than a mandatory blocking tutorial unless product explicitly resolves the current doc tension.
* Scope E5-S4 in two tiers: required keyboard and reduced-motion support first, then contrast and broader accessibility polish against the larger GDD promise set.
* Add a concrete decision record for harness point 6 that states whether deployed browser verification is required for first-tile, keyboard-only, and reduced-motion flows.
