<!-- markdownlint-disable-file -->
# Task Research: E4-E5 Product Support for UAT Scenarios

## Scope

Plan the product and code changes needed so the six manual UAT scenarios described for issue #90 can be executed consistently.

## Context Sources

* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Existing manual browser procedures for the six UAT rows.
* `.copilot-tracking/research/subagents/2026-07-01/uat-matrix-gate-research.md` - Additional release-gate findings that are intentionally out of scope for this product-only plan revision.
* `apps/client/src/browser/app.ts` - Current client loop is auth/bootstrap/join/place only.
* `apps/client/src/browser/render.ts` - Current client UI is a simple form and tile list, not a gameplay canvas.
* `apps/server/src/rooms/arena.room.ts` - Current room lifecycle and delta-ack path.
* `apps/server/src/rooms/arena.state.ts` - Current room state does not model tiles, bonds, viewport, or onboarding state.
* `apps/server/src/telemetry/telemetry-sink.ts` - Current telemetry sink lacks the E4/E5 event helpers called out by the UAT matrix.

## Verified Findings

### Product gaps blocking UAT execution

* The current client does not provide a palette, preview, canvas camera, onboarding flow, accessibility controls, or bond rendering. The browser entrypoint and renderer remain a minimal local loop.
* The current room state is combat-placeholder state (`tick`, `playerAHealth`, `playerBHealth`) rather than a tile-grid state that can support adjacency-based bond evaluation.
* Existing server paths support auth, bootstrap, join-token, placement, snapshots, region diff, and realtime deltas, but they do not currently expose bond-specific domain concepts, neighborhood recompute state, or E5 interaction telemetry.

### Telemetry gaps relative to the UAT matrix

* The telemetry sink already supports generic `emit(...)` plus placement, snapshot, diff, delta, and load-test helpers.
* The UAT matrix requires additional event names and payload contracts not yet present in server/client code: `bonding_triggered`, `bond_recalc_started`, `bond_recalc_completed`, `bond_recalc_skipped`, `bond_effect_rendered`, `reduced_motion_enabled`, `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`, `viewport_changed`, `zoom_level_changed`, `tutorial_started`, `tutorial_completed`, `first_tile_time_recorded`, `a11y_mode_enabled`, and `keyboard_placement_used`.
* Because the sink already supports a generic `emit(...)` contract, these events do not require a new telemetry subsystem. They do require a documented schema and consistent emission points across browser and server flows.

### Deferred release-process findings

* Separate research already covers GitHub environment approval gates and evidence-record storage.
* That workflow and governance work is intentionally excluded from this plan revision.
* The only retained implication is that product telemetry and interaction surfaces must exist before any later manual sign-off process can rely on them.

### Architectural direction implied by the scenarios

* Rows 1, 2, 3, and 6 need a deterministic bond model that can be recomputed from authoritative tile neighborhoods and rendered in the browser.
* Rows 3, 4, 5, and 6 need the browser client to evolve from a form-based shell into a tile-canvas experience with palette state, viewport state, onboarding state, and accessibility preferences.
* Row 4 needs viewport/culling logic that is most naturally centered in client rendering and region query/state projection paths, with server support only if region diff or snapshot scopes need viewport-aware fetches.
* Row 5 needs explicit time-to-first-tile instrumentation in the browser and likely a minimal analytics contract carried to the existing telemetry sink.

## Planning Implications

* Supporting the UAT scenarios is a multi-phase product implementation track, not a single change.
* The work centers on one stream: implement E4 and E5 capabilities plus their telemetry and regression support.
* The product stream should be phased so bond/domain work lands before UI flows that depend on it.

## Recommended Implementation Path

Select an incremental path that builds the missing capabilities in dependency order:

1. Establish authoritative bond/domain primitives and telemetry schema.
2. Extend realtime and client state contracts so bond outcomes can reach the browser deterministically.
3. Replace the minimal browser form with palette, preview, viewport, onboarding, and accessibility layers.
4. Add focused automated regression coverage for determinism and interaction telemetry.
5. Add focused implementation documentation and regression coverage once the product surfaces exist.

## Known Open Questions

* Whether viewport-aware server APIs need extension beyond the current region diff/snapshot model once pan/zoom is implemented.
* Whether seeded determinism in row 1 will use an explicit server seed concept or repeated manual placement in fresh regions.

## Readiness Assessment

There is enough verified context to create an implementation plan. The main remaining uncertainty is implementation shape, not scope coverage.