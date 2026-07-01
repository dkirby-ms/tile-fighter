<!-- markdownlint-disable-file -->
# Task Research: E5-S2 Pan, Zoom, and Viewport Culling

Focused research for story #26 to define a low-risk implementation approach for smooth camera movement, zoom legibility, and off-screen tile culling in the client, while aligning with existing shared contracts, tests, and harness constraints.

## Task Implementation Requests

* Re-verify the codebase state relevant to E5-S2 camera math, viewport boundaries, and culling behavior.
* Evaluate implementation alternatives and select one recommended approach with evidence.

## Scope and Success Criteria

* Scope: Story #26 (E5-S2) in tile-fighter. Include apps/client, shared contracts, server viewport safeguards, tests, and CI/verification harness impact.
* Assumptions:
  * apps/client is still the primary implementation surface for creator behavior.
  * Existing shared contract types should be reused instead of introducing parallel client-local schemas.
  * E5-S2 should remain compatible with E2-S4 dependency assumptions.
* Success Criteria:
  * Identify exact files and seams that constrain pan/zoom and culling work.
  * Provide one selected approach and at least two alternatives with trade-off analysis.
  * Include actionable implementation and test guidance tied to evidence.

## Outline

1. Verify current implementation and missing surfaces for camera, zoom, and culling.
2. Map E5-S2 acceptance criteria and telemetry to existing contracts and tests.
3. Evaluate alternatives and recommend one approach.
4. Document concrete implementation shape and validation path.

## Potential Next Research

* Clarify app-shell ownership and where rendering lifecycle is orchestrated.
  * Reasoning: apps/client appears headless; rendering update cadence may live in a shell not visible in this scope.
  * Reference: apps/client/src/index.ts and downstream consumers.
* Define the production threshold for "without noticeable lag" in measurable terms.
  * Reasoning: story names fps+memory budgets but explicit numeric targets are not yet embedded in client tests.
  * Reference: issue #26 and existing load/perf artifacts.

## Research Executed

### File Analysis

* docs/layer1-backlog.md
  * Story #26 requirements, telemetry, abuse bounds, and test expectations are explicit for E5-S2.
* docs/game-design-document.md
  * Product expectations include pan/zoom controls, culling behavior, and 60 FPS target guidance.
* packages/shared-types/src/index.ts
  * Region diff request/viewport contracts and default bounds policy already exist.
* apps/server/src/http/routes/region-diff.routes.ts
  * Route-level viewport bounds validation is implemented and enforces abuse limits.
* apps/server/src/http/app.ts
  * Region diff route is mounted with defaults derived from shared policy.
* apps/server/src/domain/region-diff.service.ts
  * Service applies latest-wins compaction and telemetry-relevant viewport area handling.
* apps/server/src/persistence/region-diff.repository.ts
  * Viewport-constrained query ranges are already enforced at persistence query boundary.
* apps/server/tests/integration/region-diff.integration.test.ts
  * Abuse-oriented viewport bounds and policy constraints are already covered in integration tests.
* apps/client/src/index.ts
  * No camera/pan/zoom/culling exports currently exist.
* apps/client/src/creator/creator-telemetry.ts
  * Current telemetry surface does not include E5-S2 events.
* .github/workflows/ci.yml
  * Point-2 style build/type/lint/test gates are present and reusable for E5-S2.
* .github/workflows/verify-release.yml
  * Point-6 checks currently validate service/session readiness and E3 budgets, not E5-S2 UX behavior.

### Code Search Results

* Search terms: camera, pan, zoom, culling, viewport_changed, zoom_level_changed
  * No concrete E5-S2 client implementation modules were found in apps/client/src.
* Search terms: RegionDiffViewport, RegionDiffRequest, DEFAULT_REGION_DIFF_POLICY
  * Shared contracts and defaults are already defined and should be reused.
* Search terms: /api/regions/diff and maxViewportArea
  * Server route, validation, and bounds checks are present and covered by integration tests.

### External Research

* None

### Project Conventions

* Reuse shared contracts before introducing new local schemas.
* Prefer deterministic pure logic modules plus thin caller/adapters for side effects.
* Keep E5-S2 changes compatible with current TypeScript/Vitest workflow gates.
* Add measurable harness evidence when story asks for perf validation beyond unit/integration assertions.

## Key Discoveries

### Project Structure

The critical project reality is that E5-S2 server-side viewport contract and enforcement already exist, while client-side camera/navigation/culling implementation is not yet present.

Evidence:

* docs/layer1-backlog.md:326-337
* packages/shared-types/src/index.ts:155-193
* apps/server/src/http/routes/region-diff.routes.ts:58-147
* apps/client/src/index.ts:1-91

### Implementation Patterns

The lowest-risk pattern to follow is already established in the client: deterministic local state and pure derivation helpers, with network and telemetry abstracted through thin adapters.

Evidence:

* apps/client/src/creator/tool-state.ts:1-310
* apps/client/src/creator/placement-preview.ts:33-132
* apps/client/tests/integration/e5-s1-placement-flow.test.ts:1-126

### Complete Examples

```text
Current E5-S2 seam inventory

Already implemented
  packages/shared-types/src/index.ts
    RegionDiffViewport
    RegionDiffRequest
    DEFAULT_REGION_DIFF_POLICY

  apps/server/src/http/routes/region-diff.routes.ts
    parseRegionDiffRequest
    createRegionDiffRoutes

  apps/server/src/domain/region-diff.service.ts
    getRegionDiff

Missing in client for E5-S2
  apps/client/src/navigation/camera-state.ts
  apps/client/src/navigation/viewport-math.ts
  apps/client/src/navigation/viewport-caller.ts
  apps/client/src/navigation/viewport-culling.ts
  apps/client/src/navigation/navigation-telemetry.ts (or extension of creator-telemetry)
```

### API and Schema Documentation

Required existing contracts and constraints:

* Shared viewport input and response envelopes:
  * packages/shared-types/src/index.ts:155-218
* Shared bounds defaults:
  * packages/shared-types/src/index.ts:185-188
* Route parsing and abuse bounds:
  * apps/server/src/http/routes/region-diff.routes.ts:72-133
* Route mounting and limits wiring:
  * apps/server/src/http/app.ts:85-88
  * apps/server/src/http/app.ts:148
* Viewport-constrained data query and compaction:
  * apps/server/src/persistence/region-diff.repository.ts:55-58
  * apps/server/src/domain/region-diff.service.ts:89

### Configuration Examples

```text
Current harness-relevant checks

.github/workflows/ci.yml
  npm run lint
  npm run test
  npm run build

.github/workflows/verify-release.yml
  health/readiness assertions
  protected route auth check
  bootstrap and room-join validation
  playable-shell p50 check
  E3 latency budget artifact assertion

Gap for E5-S2
  No explicit post-deploy assertion for camera pan/zoom/culling behavior
  No explicit fps+memory budget assertion for E5-S2 flow
```

## Technical Scenarios

### Scenario 1: Client-only Camera and Culling over Existing Tile Cache

This approach introduces camera math and visible-set culling entirely client-side, while leaving viewport fetch strategy unchanged.

Requirements coverage:

* Smooth camera updates: partial
* Zoom legibility maintenance: partial
* Off-screen draw reduction: good
* Integration viewport fetch requirement: weak

Advantages:

* Fastest to implement and easiest unit-test path.
* Low coupling risk with server/API behavior.

Trade-offs:

* Does not directly satisfy the story's explicit viewport-fetch integration intent.
* Limited network-efficiency improvements when panning rapidly.

### Scenario 2: Camera-driven Viewport Fetch Orchestration Plus Local Culling

This approach adds deterministic camera state, derives bounded RegionDiffViewport requests, fetches viewport diffs with debounce/coalescing, then performs final visible-set culling for draw.

Requirements coverage:

* Smooth camera updates: strong
* Zoom legibility maintenance: strong
* Off-screen draw reduction: strong
* Integration viewport fetch requirement: strong

Advantages:

* Best direct fit to acceptance criteria and test requirements.
* Reuses existing shared contracts and tested server abuse bounds.
* Aligns with current client architecture patterns.

Trade-offs:

* Higher complexity than purely local culling.
* Requires careful debounce and in-flight request coalescing.

### Scenario 3: Predictive Prefetch Windows with Server-assisted Paging

This approach extends E5-S2 into multi-window prefetch logic and potentially expanded API behavior.

Requirements coverage:

* Smoothness potential: very strong
* Delivery risk in sprint scope: high

Advantages:

* Best long-run performance potential for very large maps.

Trade-offs:

* Highest complexity and contract risk.
* Over-scoped for immediate story scope and current harness shape.

#### Considered Alternatives

Rejected as primary for current sprint:

* Scenario 1 rejected because it under-delivers on explicit integration viewport-fetch intent.
* Scenario 3 rejected because it introduces high contract and complexity risk before baseline E5-S2 behavior exists.

## Selected Approach

Selected: Scenario 2, camera-driven viewport fetch orchestration plus local culling.

Rationale:

* Matches story acceptance criteria and explicit integration viewport-fetch requirement from docs/layer1-backlog.md.
* Uses existing authoritative shared contracts in packages/shared-types/src/index.ts.
* Leverages existing server bounds enforcement and abuse tests to reduce backend risk.
* Fits current deterministic client implementation style and test harness.

Recommended module shape:

* apps/client/src/navigation/camera-state.ts
  * deterministic pan/zoom reducer and clamps
* apps/client/src/navigation/viewport-math.ts
  * camera-to-RegionDiffViewport derivation and bound normalization
* apps/client/src/navigation/viewport-caller.ts
  * debounced, coalesced /api/regions/diff requests
* apps/client/src/navigation/viewport-culling.ts
  * visible set derivation from viewport
* apps/client/src/creator/creator-telemetry.ts (or split module)
  * add viewport_changed and zoom_level_changed events
* apps/client/src/index.ts
  * export new navigation APIs

## Actionable Next Steps for Planning

* Define camera-state and viewport-math invariants first, then lock unit tests before wiring network fetch behavior.
* Implement viewport-caller with debounce and in-flight request coalescing; enforce request bounds before send using shared policy defaults.
* Add integration test for camera movement triggering bounded region-diff requests and deterministic visible-set updates.
* Add telemetry event coverage for viewport_changed and zoom_level_changed with payload sanitization.
* Add an E5-S2 perf artifact path (fps+memory) and decide whether to extend .github/workflows/verify-release.yml with a creator UX proof step for harness point 6.

## Evidence Log

Core evidence references used in this research:

* docs/layer1-backlog.md:326-337
* docs/game-design-document.md:309-333
* docs/game-design-document.md:348-351
* packages/shared-types/src/index.ts:155-218
* apps/server/src/http/routes/region-diff.routes.ts:58-147
* apps/server/tests/integration/region-diff.integration.test.ts:221-390
* apps/client/src/index.ts:1-91
* apps/client/src/creator/creator-telemetry.ts:1-84
* apps/client/src/creator/tool-state.ts:1-310
* apps/client/src/creator/placement-preview.ts:33-132
* .github/workflows/ci.yml:84-88
* .github/workflows/verify-release.yml:199-256
