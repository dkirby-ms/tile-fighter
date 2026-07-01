<!-- markdownlint-disable-file -->
# Task Research: E4-E5 Manual UAT Procedures (Issue #90)

What to actually do in the browser to validate Epics 4 (Deterministic Bonding Engine) and 5 (Creator UX,
Navigation, Accessibility). Six rows, each with preconditions, step-by-step actions, and observable pass criteria.

## Task Implementation Requests

* Define what a tester does in the browser for each of the six UAT matrix rows
* Specify observable pass/fail criteria for each row (no scripts, no automation)

## Scope and Success Criteria

* Scope: E4 stories (S1–S4) and E5 stories (S1–S4); six matrix rows from issue #90 only
* Assumptions: all E4 and E5 stories are built and accessible in a running dev instance; tester uses a desktop browser
* Success Criteria:
  * Each row has step-by-step browser actions a solo tester can follow unambiguously
  * Pass criteria are visually or telemetrically observable without tooling beyond browser DevTools

## Implementation Status

All E4 and E5 stories are unbuilt as of 2026-07-01. The current client UI is a plain HTML form (X/Y inputs + Place Tile button) with no canvas, palette, or bond visuals. UAT execution cannot begin until stories are implemented.

E4 prerequisites before rows 1, 2, 3, 6 can run:
* E4-S1: bonding evaluator emitting `glow_chain`, `blend_gradient`, `pulse_rhythm` bond types
* E4-S2: local neighborhood recompute queue
* E4-S3: client bond visual rendering and `prefers-reduced-motion` variant

E5 prerequisites before rows 3, 4, 5, 6 can run:
* E5-S1: palette picker and placement preview
* E5-S2: pan/zoom camera with spatial culling
* E5-S3: onboarding stepper with `first_tile_time_recorded` telemetry
* E5-S4: keyboard input map, high-contrast toggle, reduced-motion toggle

## Telemetry Observation Setup

The server posts telemetry events as JSON to `TELEMETRY_SINK_URL`. The minimum-overhead way to observe events during manual UAT is browser DevTools Network tab, filtered to the sink URL. Each POST body contains `eventName` and `attributes`. Keep the Network tab open for the duration of each row.

---

## Row 1 — Bond Determinism Under Repeated Seeded Runs

*Stories:* E4-S1

**Preconditions:**
* Fresh canvas region with no existing tiles
* DevTools Network tab open, filtered to the telemetry sink URL

**Steps:**
1. Place three tiles in an L-shape: (0,0) red square, (1,0) red square, (0,1) red square
2. Observe which bond effects appear on screen; screenshot the canvas
3. In the Network tab, note the `bond_type` value from each `bonding_triggered` POST body
4. Reload the page; navigate to an adjacent empty region
5. Place the identical L-shape with identical colors
6. Observe bond effects; compare to the screenshot from step 2
7. Note the `bond_type` values from telemetry
8. Repeat steps 4–7 one more time (three total runs across three regions)

**Pass:**
* Identical `bond_type` values across all three runs for the same adjacency pattern
* `bonding_triggered` fires for each adjacency pair in each run
* Visual bond effect (glow/blend/pulse) matches across all three runs

**Fail:** any run produces a different `bond_type` for the same pattern, or no bond event fires where one is expected

---

## Row 2 — Local Neighborhood Recompute Under Burst Placement

*Stories:* E4-S1, E4-S2

**Preconditions:**
* Empty region; DevTools Network tab open

**Steps:**
1. Rapidly place 6–8 tiles of matching colors in a contiguous cluster, placing each within 1–2 seconds of the previous
2. Stop placing; wait 3 seconds
3. Confirm all bond effects appear on screen for the full cluster
4. In the Network tab, count `bond_recalc_started` and `bond_recalc_completed` events; verify counts are reasonable relative to the number of adjacencies created
5. Check that `bond_recalc_skipped` (not `bond_recalc_completed`) fires for unchanged neighbors
6. Place one tile 10+ cells away from the cluster; confirm no `bond_recalc_started` fires for it unless it has a matching-hue neighbor nearby

**Pass:**
* All cluster bonds are visible within ~3 seconds of the last placement
* `bond_recalc_skipped` fires for cells with no adjacency change; `bond_recalc_completed` fires for cells that gained a new bond
* No recalc events appear for non-adjacent cells

**Fail:** bonds missing after 5+ seconds, recalc events fire for cells that were not touched, or the same cell triggers repeated recalc events

---

## Row 3 — Palette Preview → Place → Bond Confirmation Flow

*Stories:* E5-S1, E4-S1, E4-S3

**Preconditions:**
* At least one tile of a known color already on the canvas
* DevTools Network tab open

**Steps:**
1. Open the palette picker; confirm `palette_opened` appears in the Network tab
2. Select a shape (e.g. square); confirm `shape_selected` fires
3. Select a color matching the existing tile; confirm `color_selected` fires
4. Hover over a cell adjacent to the existing tile; confirm a preview of the tile appears at that cell with the correct shape and color
5. Hover over an occupied cell; confirm a "blocked" or "occupied" visual indicator appears instead of a placement preview
6. Click a valid adjacent cell with a matching color; confirm an optimistic placement indicator appears immediately (before server ack)
7. Wait for the ack; confirm `placement_preview_shown` then `tile_placed` appear in the Network tab in that order
8. Observe a bond effect between the newly placed tile and the matching-color neighbor
9. Confirm `bonding_triggered` fires with a `bond_type` value in the Network tab

**Pass:**
* Preview renders on hover with the correct shape and color
* Occupied cells show a blocked indicator, not a placement preview
* Optimistic indicator appears before the server ack arrives
* Bond effect is visible on screen after ack
* Telemetry sequence in order: `palette_opened` → `shape_selected` → `color_selected` → `placement_preview_shown` → `tile_placed` → `bonding_triggered`

**Fail:** preview absent on hover, no blocked indicator on occupied cells, bond effect not rendered, or any event in the telemetry sequence is missing

---

## Row 4 — Pan/Zoom and Culling with Bond Readability at Multiple Zoom Levels

*Stories:* E5-S2, E4-S3

**Preconditions:**
* Canvas with at least 6 tiles in a bonded cluster with active bond effects visible

**Steps:**
1. Pan the camera to center on the cluster; confirm the camera moves without perceptible input lag
2. At 100% zoom: confirm tile edges are crisp and bond effect overlays are legible; screenshot
3. Zoom in to the maximum level (200% or app max); confirm tile detail and bond effects are legible; screenshot
4. Zoom out to 50%; confirm tile shapes are still distinguishable from the bond overlays; screenshot
5. Zoom out to the minimum level; confirm tiles are still visible as colored cells (not invisible)
6. Pan while at minimum zoom; confirm no rendering garbage appears for off-screen tiles
7. In the Network tab, confirm `viewport_changed` fires on each pan and `zoom_level_changed` fires on each zoom step

**Pass:**
* Pan is responsive with no perceptible lag
* Bond effects are legible at 50%, 100%, and 200% zoom
* Tiles remain visible at minimum zoom
* No rendering artifacts appear for off-screen tiles
* `viewport_changed` and `zoom_level_changed` telemetry both fire

**Fail:** camera is sluggish or unresponsive, bond overlays are invisible at any tested zoom level, off-screen garbage is visible, or telemetry events do not fire

---

## Row 5 — Onboarding to First Tile ≤30 Seconds p50 with Bond Confirmation

*Stories:* E5-S3, E4-S1

**Preconditions:**
* 5 separate incognito browser windows ready (each simulates a first-time session)
* Stopwatch (phone or browser)
* DevTools Network tab open in each window

**Steps (repeat 5 times, once per incognito window):**
1. Open the app URL; start the stopwatch when the page finishes loading
2. Follow the onboarding stepper steps as a new user would
3. Place the first tile on the canvas; stop the stopwatch when the placement ack confirmation appears
4. Record the elapsed time
5. Confirm `tutorial_started` fires; confirm `tutorial_completed` fires (or a skip event if skipped)
6. Confirm `first_tile_time_recorded` fires and its payload shows an elapsed value ≤30s for passing runs

Separately, repeat steps 1–4 using the skip action at step 2 to validate the skip path.

Calculate the median (p50) of the 5 recorded times.

If any existing tile is adjacent to the first placement: confirm a bond confirmation callout or indicator appears.

**Pass:**
* Median of the 5 run times ≤ 30 seconds
* Both the complete-onboarding path and the skip path reach first tile placement successfully
* `first_tile_time_recorded` payload value matches the observed median
* Bond confirmation indicator appears when first tile lands adjacent to a matching-color tile

**Fail:** median > 30 seconds, either onboarding path fails to reach placement, or `first_tile_time_recorded` is absent

---

## Row 6 — Keyboard-Only + High-Contrast + Reduced-Motion Placement-and-Bond Flow

*Stories:* E5-S4, E4-S3
*Standards:* WCAG 2.1 SC 2.1.1 Keyboard (Level A), WCAG 2.1 SC 1.4.11 Non-text Contrast 3:1 (Level AA)

This row has three sub-tests; all three must pass.

### Sub-test A: Keyboard-only placement

**Preconditions:** do not use the mouse during this sub-test.

**Steps:**
1. Load the app; use Tab to move focus through the UI
2. Tab to the palette picker; open it with Enter or Space
3. Tab to a shape option; select it with Enter or Space
4. Tab to a color option; select it with Enter or Space
5. Tab to the canvas cell navigation area; use arrow keys to move to a target cell
6. Confirm a visible focus indicator is present on the focused cell
7. Press Enter or Space to place the tile; wait for the ack
8. In the Network tab, confirm `keyboard_placement_used` fires

**Pass:**
* Every step completable without touching the pointer
* Visible focus indicator present on every interactive element encountered
* `keyboard_placement_used` fires after placement

**Fail:** any step requires a click or hover, focus indicator missing on any element, placement not achievable by keyboard alone

### Sub-test B: High-contrast mode

**Steps:**
1. Enable high-contrast mode in the app's accessibility settings
2. Confirm `a11y_mode_enabled` fires in the Network tab
3. Check palette button contrast: use the browser DevTools accessibility panel or the color picker tool to sample a palette button foreground against its background; record the ratio
4. Check placed tile edge contrast: sample a tile edge color against the canvas background; record the ratio
5. Check that bond effect overlays remain distinguishable (not invisible or the same color as the canvas background)

**Pass:**
* Palette buttons ≥3:1 contrast ratio against their panel background
* Tile edges ≥3:1 contrast ratio against the canvas background
* Bond effect overlays are visually distinct in high-contrast mode

**Fail:** any sampled element is below 3:1, or bond overlays become invisible

### Sub-test C: Reduced-motion

**Setup:** enable reduced motion via OS (macOS: Accessibility > Display > Reduce Motion; Windows: Settings > Ease of Access > Display > Show animations off) or via DevTools > Rendering > Emulate CSS media feature > `prefers-reduced-motion: reduce`.

**Steps:**
1. With reduced motion active, load the app
2. Confirm `reduced_motion_enabled` fires in the Network tab (or `a11y_mode_enabled` with a motion attribute)
3. Place a tile adjacent to a matching-color tile; confirm a bond forms
4. Observe the bond animation: it must be a static glow, fade-in, or other low-motion variant — not a sweeping pulse or chain-propagation animation
5. Confirm `bond_effect_rendered` fires in the Network tab

**Pass:**
* Bond effect renders but uses the low-motion variant (no sweep or pulse animation visible)
* `reduced_motion_enabled` fired before `bond_effect_rendered`

**Fail:** full sweep/pulse animation plays with reduced motion active, or `bond_effect_rendered` does not fire

---

## WCAG Reference

| Criterion | Level | What it covers in this matrix |
|-----------|-------|-------------------------------|
| SC 2.1.1 Keyboard | A | All palette, navigation, and placement actions operable by keyboard |
| SC 1.4.11 Non-text Contrast | AA | Palette buttons, tile edges, bond effect outlines ≥3:1 |
| `prefers-reduced-motion` | CSS media feature | Bond animations suppressed to static/fade variant |
