---
title: E5-S2 Code Evidence Research
description: Evidence-backed implementation status and gaps for E5-S2 pan, zoom, and viewport culling in tile-fighter
ms.date: 2026-07-01
ms.topic: reference
---

## Scope

Research topic: E5-S2 pan, zoom, and viewport culling in this workspace.

Requested inspection targets:

* apps/client/src/**, apps/client/tests/**
* packages/shared-types/src/index.ts
* apps/server/src/http/routes/** and viewport/diff endpoints
* docs/layer1-backlog.md and docs/game-design-document.md
* .github/workflows/ci.yml and .github/workflows/verify-release.yml

Research goals:

* Identify what already exists for camera math, zoom bounds, viewport diff requests, and culling.
* Identify missing surfaces for E5-S2 implementation.
* Extract exact file references with line numbers.
* Propose candidate test additions for story #26 requirements.

## Evidence Log

### Story and product requirements baseline

* E5-S2 story explicitly requires camera controller + spatial culling and test coverage for unit camera math, integration viewport fetch, and perf FPS+memory budget: docs/layer1-backlog.md:326, docs/layer1-backlog.md:333, docs/layer1-backlog.md:334.
* E5-S2 telemetry requirements are viewport/zoom specific (`viewport_changed`, `zoom_level_changed`): docs/layer1-backlog.md:335.
* Security requirement for E5-S2 is bounded viewport request ranges: docs/layer1-backlog.md:336.
* Design doc sets UX and performance targets that align to E5-S2:
  * zoom/pan controls: docs/game-design-document.md:309
  * spatial partition culling: docs/game-design-document.md:332
  * legibility at zoomed-out scale: docs/game-design-document.md:274
  * 60 FPS target: docs/game-design-document.md:350

### Existing shared contract for viewport diff

* Shared types define viewport request/response contracts:
  * `RegionDiffViewport`: packages/shared-types/src/index.ts:155
  * `RegionDiffRequest` with `viewport`: packages/shared-types/src/index.ts:162, packages/shared-types/src/index.ts:165
  * `RegionDiffResponse` metadata includes viewport: packages/shared-types/src/index.ts:208, packages/shared-types/src/index.ts:218
* Shared policy metadata contains bounded defaults:
  * `DEFAULT_REGION_DIFF_POLICY`: packages/shared-types/src/index.ts:185
  * default bounds: `maxViewportArea` 10,000 and `maxTilesPerRequest` 1,000: packages/shared-types/src/index.ts:187, packages/shared-types/src/index.ts:188

### Existing server implementation for viewport diff and bounds

* `/api/regions/diff` route exists and is mounted:
  * route declaration: apps/server/src/http/routes/region-diff.routes.ts:138
  * route factory: apps/server/src/http/routes/region-diff.routes.ts:135
  * mounted in app: apps/server/src/http/app.ts:148
* Request parsing validates viewport bounds and area:
  * parser entry: apps/server/src/http/routes/region-diff.routes.ts:72
  * viewport area calculation and max check: apps/server/src/http/routes/region-diff.routes.ts:112, apps/server/src/http/routes/region-diff.routes.ts:113
  * invalid request returns 400: apps/server/src/http/routes/region-diff.routes.ts:147
* App-level defaults wire route limits from shared policy:
  * imports default policy: apps/server/src/http/app.ts:17
  * derives `regionDiffLimits`: apps/server/src/http/app.ts:85
  * uses `maxViewportArea` default from policy: apps/server/src/http/app.ts:88
* Region diff service applies viewport filtering and compacts latest deltas:
  * input includes viewport bounds: apps/server/src/domain/region-diff.service.ts:14
  * computes viewport area for telemetry context: apps/server/src/domain/region-diff.service.ts:50
  * repository query constrained by viewport min/max cell ranges: apps/server/src/persistence/region-diff.repository.ts:55, apps/server/src/persistence/region-diff.repository.ts:56, apps/server/src/persistence/region-diff.repository.ts:57, apps/server/src/persistence/region-diff.repository.ts:58
  * service compacts to latest per coordinate (network culling/reduction behavior at API layer): apps/server/src/domain/region-diff.service.ts:89

### Existing tests for viewport diff behavior

* Integration tests already validate viewport request constraints:
  * endpoint exercised: apps/server/tests/integration/region-diff.integration.test.ts:165
  * negative viewport coordinates rejected: apps/server/tests/integration/region-diff.integration.test.ts:221
  * viewport area cap rejection: apps/server/tests/integration/region-diff.integration.test.ts:349
  * max tiles cap rejection: apps/server/tests/integration/region-diff.integration.test.ts:374
* Load scenario exists for region-diff payload/latency mix (stale vs unchanged): apps/server/tests/load/region-diff-load.ts:126, apps/server/tests/load/region-diff-load.ts:168.

### Existing client surfaces and constraints

* Client package currently has no rendering engine dependencies that indicate camera/culling implementation (only MSAL runtime dep): apps/client/package.json:11.
* Client index exports creator/session/auth utilities and no camera/viewport module exports:
  * current exports include placement, telemetry, session handlers: apps/client/src/index.ts:31, apps/client/src/index.ts:57, apps/client/src/index.ts:80, apps/client/src/index.ts:88.
* Client telemetry currently tracks creator flow events, not viewport/zoom events:
  * event union includes `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`: apps/client/src/creator/creator-telemetry.ts:1, apps/client/src/creator/creator-telemetry.ts:5.
  * transition emitter handles creator actions only: apps/client/src/creator/creator-telemetry.ts:72, apps/client/src/creator/creator-telemetry.ts:74, apps/client/src/creator/creator-telemetry.ts:78, apps/client/src/creator/creator-telemetry.ts:84.
* Workspace search in `apps/client/src/**` found no matches for camera/zoom/pan/viewport fetch/culling terms tied to implementation.

### Existing CI/perf enforcement context

* CI runs lint/test/build globally but no E5-S2-specific perf assertion:
  * test and build steps: .github/workflows/ci.yml:84, .github/workflows/ci.yml:85, .github/workflows/ci.yml:87, .github/workflows/ci.yml:88.
* Verify-release enforces playable-shell p50 and E3-S4 server latency budgets:
  * playable-shell budget assertion: .github/workflows/verify-release.yml:199
  * E3-S4 latency budget load/assertion: .github/workflows/verify-release.yml:245, .github/workflows/verify-release.yml:256.
* No explicit FPS/memory budget assertion tied to client viewport rendering path was found in inspected workflows.

## Key Discoveries

1. Server-side viewport request contracts and bounded validation are already implemented and tested.

* Evidence: packages/shared-types/src/index.ts:155, apps/server/src/http/routes/region-diff.routes.ts:72, apps/server/tests/integration/region-diff.integration.test.ts:349.

2. API-layer spatial reduction exists for tile diffs (viewport-bounded query + latest-wins compaction), but this is not equivalent to client render culling.

* Evidence: apps/server/src/persistence/region-diff.repository.ts:55, apps/server/src/domain/region-diff.service.ts:89.

3. Client-side E5-S2 surfaces (camera math, pan/zoom controller, viewport diff caller, render culling hooks) are not present in inspected client source.

* Evidence:
  * no camera/zoom/pan/viewport fetch/culling implementation matches in apps/client/src/** during targeted search.
  * exports are creator/session/auth-only in apps/client/src/index.ts:31, apps/client/src/index.ts:57, apps/client/src/index.ts:80, apps/client/src/index.ts:88.

4. Required E5-S2 telemetry events are not represented in current client telemetry union.

* Evidence: apps/client/src/creator/creator-telemetry.ts:1, docs/layer1-backlog.md:335.

5. Existing perf budgets in workflows target network/session latency, not client FPS/memory for pan/zoom + culling.

* Evidence: .github/workflows/verify-release.yml:245, .github/workflows/verify-release.yml:256 versus E5-S2 test requirement docs/layer1-backlog.md:334.

## Missing Surfaces for E5-S2

The following implementation surfaces are not evidenced in current inspected files:

* Client camera math module (world/cell/screen transforms, pan integration, zoom level math, clamping bounds).
* Client zoom bounds policy surfaced in code (min/max zoom and legibility constraints).
* Client viewport diff request caller for `/api/regions/diff` and response apply path.
* Client render culling path (visible-tile filtering / draw-list culling) and associated performance instrumentation.
* Client telemetry events for `viewport_changed` and `zoom_level_changed`.
* CI or verify workflow checks for client FPS and memory budgets specific to E5-S2.

## Candidate Test Additions for Story #26

### Unit: camera math

Proposed new test target files:

* apps/client/tests/unit/camera-math.test.ts
* apps/client/tests/unit/viewport-bounds.test.ts

Candidate assertions:

* pan delta updates camera origin deterministically at fixed zoom.
* zoom in/out clamps to configured min/max.
* cell-to-screen and screen-to-cell transforms round-trip within tolerance.
* viewport rectangle computation from camera state + canvas size remains stable across zoom boundaries.

Rationale linkage:

* Fulfills unit requirement in docs/layer1-backlog.md:334.

### Integration: viewport fetch

Proposed new test target files:

* apps/client/tests/integration/e5-s2-viewport-fetch.test.ts

Candidate assertions:

* client viewport state change triggers bounded request body to `/api/regions/diff`.
* request includes expected `regionId`, `sinceVersion`, viewport min/max cell values.
* out-of-range viewport request is clamped client-side before send (or server 400 handled gracefully).
* returned tile set is applied only for visible viewport model.

Rationale linkage:

* Aligns with existing route contract and bounded requirements: apps/server/src/http/routes/region-diff.routes.ts:72, docs/layer1-backlog.md:336.

### Perf: FPS + memory budgets

Proposed new test target files:

* apps/client/tests/perf/e5-s2-pan-zoom-culling.perf.test.ts
* artifacts/e5-s2-viewport-budget.json (evidence artifact)

Candidate assertions:

* representative pan/zoom workload reports frame-time/FPS percentile target (story target source docs/game-design-document.md:350).
* memory growth under sustained pan/zoom remains within defined budget window.
* culling effectiveness metric (visible tiles vs total tiles) stays above threshold in sparse and dense scenes.

Workflow integration candidate:

* add verify step to `.github/workflows/verify-release.yml` analogous to existing evidence assertions at .github/workflows/verify-release.yml:256.

## Open Questions

1. Which client rendering stack is intended for E5-S2 implementation (Canvas2D, WebGL abstraction, or engine package)? Current `@game/client` dependencies do not indicate a renderer package.
2. What numeric zoom bounds and legibility thresholds should be treated as acceptance constants for unit/integration tests?
3. What exact FPS/memory thresholds should gate CI for E5-S2, and on which runner/harness to ensure repeatability?
4. Should viewport telemetry be emitted from the same `CreatorTelemetryAdapter` module or from a separate navigation telemetry adapter?
5. For viewport diff polling strategy, should fetch be event-driven (on camera movement debounce) or heartbeat/polling based?

## Research Status

Complete for requested evidence-gathering scope. Findings are evidence-backed to inspected files and line references above.