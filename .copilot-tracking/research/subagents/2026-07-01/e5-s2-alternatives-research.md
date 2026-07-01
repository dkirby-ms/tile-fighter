---
title: E5-S2 Implementation Alternatives Research
description: Evidence-backed alternatives for story #26 pan/zoom and viewport culling implementation
author: GitHub Copilot
ms.date: 2026-07-01
ms.topic: reference
---

## Research scope

Evaluate viable implementation approaches for E5-S2 (story #26): pan/zoom and viewport culling, using current repo constraints.

## Questions investigated

1. Which implementation approaches are viable in the current client/server shape?
2. Which approach best satisfies E5-S2 acceptance criteria with lowest delivery risk?
3. How does each approach fit shared contracts and harness points 2 and 6?

## Repo evidence summary

1. E5-S2 requires smooth pan, zoom legibility, and off-screen culling with tests and telemetry (`viewport_changed`, `zoom_level_changed`): docs/layer1-backlog.md:326-337.
2. E5 stories map to harness points 2 and 6, and sprint checkpoint text ties these points to type/integration validation and perf/abuse checks: docs/layer1-backlog.md:36, docs/layer1-backlog.md:559-566.
3. Shared viewport contract already exists and is authoritative (`RegionDiffViewport`, `RegionDiffRequest`, max policy defaults): packages/shared-types/src/index.ts:155-193.
4. Server route enforces bounded viewport requests (integer coordinates, non-negative mins, min<=max, bounded viewport area, bounded maxTiles): apps/server/src/http/routes/region-diff.routes.ts:58-133.
5. Integration tests already verify viewport abuse boundaries and policy behavior (negative coordinates, oversized area, maxTiles cap): apps/server/tests/integration/region-diff.integration.test.ts:221-390.
6. Existing client architecture favors deterministic reducers/selectors plus adapter/caller seams and Vitest-based unit/integration tests: apps/client/src/creator/tool-state.ts:1-310, apps/client/src/creator/placement-preview.ts:33-132, apps/client/tests/integration/e5-s1-placement-flow.test.ts:1-126.
7. Client currently exports no camera/viewport/culling modules, so E5-S2 requires new surface area: apps/client/src/index.ts:1-91.
8. GDD explicitly expects zoom/pan controls and spatial partition culling, plus 60 FPS target at typical zoom: docs/game-design-document.md:309-333, docs/game-design-document.md:348-351.
9. Post-deploy verification gate currently validates health/readiness/protected/bootstrap/room-join and E3-S4 load budgets, not creator pan/zoom behavior directly: docs/cicd-harness.md:158-170.
10. Point-2 compatibility path is currently grounded in repo build/type/test gates (`tsc -b`, workspace tests/lint, client vitest): package.json:10-17, apps/client/package.json:6-10, apps/client/vitest.config.ts:6-11.

## Alternatives evaluated

### Approach A: Client-only camera and culling over existing in-memory tiles

Architecture/flow:

1. Add pure camera math module that maps input deltas to world viewport bounds.
2. Add pure culling module that filters visible tiles from local tile cache by computed bounds.
3. Emit `viewport_changed` and `zoom_level_changed` through creator telemetry adapter.
4. Keep region-diff fetching behavior unchanged for this story.

Benefits:

1. Lowest coupling to server APIs and auth/session flows.
2. Fastest path to unit coverage (camera math and culling are deterministic pure functions).
3. Minimal risk to E2-S4 route contract and existing diff tests.

Trade-offs/risks:

1. Does not reduce network payload when users pan quickly across sparse regions because fetch policy is unchanged.
2. Can meet visual culling acceptance, but “integration viewport fetch” requirement remains underpowered unless tests assert at least request-shape correctness.
3. Harness point 6 evidence gap persists because current verification does not exercise this path.

Complexity estimate:

1. Delivery complexity: Medium (3/5).
2. Test complexity: Low-Medium (2/5).
3. Operational complexity: Low (2/5).

Compatibility with shared contracts and harness points 2 and 6:

1. Shared contracts: Compatible if it reuses `RegionDiffViewport` bounds for internal viewport representation before fetch.
2. Harness point 2: Strongly compatible (pure TS modules + unit/integration tests fit current build/test gates).
3. Harness point 6: Partially compatible; needs added evidence artifact or verification extension because current gate does not cover creator navigation.

### Approach B: Camera-driven viewport fetch orchestration + local culling (recommended)

Architecture/flow:

1. Add camera state module (pan origin, zoom level, viewport dimensions, clamped world bounds).
2. Convert camera state to shared `RegionDiffViewport` request bounds.
3. Add viewport diff caller that debounces camera movement and fetches `/api/regions/diff` with bounded viewport + maxTiles.
4. Apply returned deltas into local tile store; perform render culling on final camera bounds for draw list.
5. Emit `viewport_changed` and `zoom_level_changed` telemetry events.

Benefits:

1. Directly satisfies E5-S2 integration requirement (“integration (viewport fetch)”) while also satisfying culling behavior.
2. Aligns with existing server safeguards for bounded viewport abuse handling.
3. Reuses established deterministic client pattern (pure reducers/selectors + side-effect caller adapter).
4. Positions future perf work to tune both request volume and draw volume.

Trade-offs/risks:

1. Higher implementation surface than Approach A (camera math + fetch orchestration + culling).
2. Requires careful debounce/backpressure policy to avoid request burst under drag/zoom.
3. Diff delete semantics are upsert-only and implicit delete by absence, so client merge/cull logic must avoid stale ghosts.

Complexity estimate:

1. Delivery complexity: Medium-High (4/5).
2. Test complexity: Medium-High (4/5).
3. Operational complexity: Medium (3/5).

Compatibility with shared contracts and harness points 2 and 6:

1. Shared contracts: Strongly compatible by using `RegionDiffRequest.viewport` and policy-aware bounds.
2. Harness point 2: Strongly compatible via deterministic math modules and integration tests in existing Vitest setup.
3. Harness point 6: Better compatibility than A/C if we add a lightweight verification artifact (for example a synthetic viewport fetch + telemetry proof), because current post-deploy gate is service-centric.

### Approach C: Server-assisted viewport paging and predictive prefetch windows

Architecture/flow:

1. Add client camera module with predictive “ahead-of-pan” windows.
2. Introduce multi-window fetch strategy (current viewport + prefetch ring).
3. Optionally evolve server diff API behavior for window tokens or prioritized tiles.
4. Culling runs client-side against active viewport while prefetch cache warms neighboring cells.

Benefits:

1. Best potential for smoothness at high pan velocity and zoom transitions.
2. Can reduce visible “pop-in” by keeping nearby windows warm.
3. Future-ready for very large maps and occupancy growth.

Trade-offs/risks:

1. Highest complexity and largest regression surface across E2-S4/E3 diff behavior.
2. Requires additional contract and load validation work before safe adoption.
3. Hardest to prove quickly under current harness point 6 verification model.

Complexity estimate:

1. Delivery complexity: High (5/5).
2. Test complexity: High (5/5).
3. Operational complexity: High (4/5).

Compatibility with shared contracts and harness points 2 and 6:

1. Shared contracts: Partial without contract changes; stronger only after extending diff semantics.
2. Harness point 2: Achievable but heavy, with significantly larger required test matrix.
3. Harness point 6: Weak in current cycle due missing dedicated creator-flow post-deploy verification path.

## Recommendation

Select Approach B: camera-driven viewport fetch orchestration plus local culling.

Justification with evidence:

1. E5-S2 explicitly asks for camera control and culling plus integration viewport fetch tests: docs/layer1-backlog.md:330-335.
2. The server and shared types already provide strict viewport request contracts and abuse bounds, so client can integrate with low API ambiguity: packages/shared-types/src/index.ts:155-193, apps/server/src/http/routes/region-diff.routes.ts:58-133.
3. Existing integration tests already validate viewport security behavior, reducing backend risk for this approach: apps/server/tests/integration/region-diff.integration.test.ts:221-390.
4. Client codebase patterns favor pure reducers/selectors + adapter callers, which maps cleanly to camera state and fetch orchestration modules: apps/client/src/creator/tool-state.ts:1-310, apps/client/src/creator/placement-preview.ts:33-132.
5. GDD direction includes zoom/pan controls and spatial partition culling; Approach B delivers both while creating measurable fetch behavior for perf evolution: docs/game-design-document.md:309-333, docs/game-design-document.md:348-351.

## Selected approach implementation shape

Proposed module/function additions (apps/client):

1. apps/client/src/navigation/camera-state.ts
   - `createInitialCameraState()`
   - `reduceCameraState(state, action)`
   - Handles pan delta, zoom delta, clamp to world bounds.
2. apps/client/src/navigation/viewport-math.ts
   - `deriveViewportFromCamera(cameraState, gridConfig): RegionDiffViewport`
   - `clampViewportToBounds(viewport, bounds)`
3. apps/client/src/navigation/viewport-caller.ts
   - `fetchViewportDiff(input: { regionId; sinceVersion; viewport; maxTiles })`
   - Wraps authenticated fetch, bounded retries, and typed response validation.
4. apps/client/src/navigation/viewport-culling.ts
   - `deriveVisibleTiles(tiles, viewport)`
   - `deriveCullingStats(tiles, visibleTiles)`
5. apps/client/src/creator/creator-telemetry.ts (extend)
   - Add event names `viewport_changed`, `zoom_level_changed`.
   - Add emit helpers with sanitized payload conventions.
6. apps/client/src/index.ts
   - Export new navigation modules/types.

Proposed tests:

1. apps/client/tests/unit/camera-state.test.ts
   - Pan accumulation and clamp behavior.
   - Zoom step constraints and legibility floor/ceiling.
2. apps/client/tests/unit/viewport-math.test.ts
   - Deterministic camera-to-viewport mapping.
   - Non-negative bounds and max area shaping before request.
3. apps/client/tests/unit/viewport-culling.test.ts
   - Off-screen tiles excluded, visible tiles preserved.
   - Edge inclusion semantics at viewport boundary.
4. apps/client/tests/unit/creator-telemetry-viewport.test.ts
   - `viewport_changed` and `zoom_level_changed` payload sanitization and emission.
5. apps/client/tests/integration/e5-s2-viewport-fetch.test.ts
   - Camera movement triggers bounded `RegionDiffRequest.viewport` fetches.
   - Debounce/backpressure prevents request storms.
   - Integration with local culling produces deterministic visible set.

Suggested harness alignment add-on for point 6 evidence:

1. Add lightweight verification artifact (for example, viewport fetch/culling summary JSON from client integration run) consumed by existing verification workflow artifacts, similar in spirit to current latency budget evidence shape: docs/cicd-harness.md:191-232, apps/server/artifacts/e3-s4-latency-budget.json:1-25.

## Top risks and mitigations for recommended approach

1. Risk: Request burst during aggressive pan/zoom causing avoidable load.
   - Mitigation: Debounce camera change fetches, coalesce in-flight requests, and cap maxTiles per request using existing route limits.
2. Risk: Client viewport math generates invalid or out-of-policy bounds.
   - Mitigation: Reuse shared viewport type, clamp to non-negative min bounds, and unit-test area/max invariants against route validation rules.
3. Risk: Harness point 6 remains under-proven for creator UX if only local tests are added.
   - Mitigation: Add a post-deploy creator verification artifact/check that asserts viewport fetch success plus telemetry emission for pan/zoom events.

## Follow-on questions discovered

1. Where is the runtime browser render loop/shell that consumes `@game/client` APIs? The repo currently exposes client library modules but no concrete UI runtime file in apps/client/src for camera hookup.

## Research status

Complete for requested scope.
