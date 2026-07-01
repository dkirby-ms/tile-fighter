<!-- markdownlint-disable-file -->
# Implementation Details: E4-E5 Product Support for UAT Scenarios

## Context Reference

Sources: `.copilot-tracking/research/2026-07-01/e4-e5-uat-support-research.md`, `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md`, and verified repository files in the current workspace.

## Implementation Phase 1: Bond Domain and Authoritative State Foundation

<!-- parallelizable: false -->

### Step 1.1: Replace or extend arena state to model tiles, adjacency inputs, and bond outcomes

Move the room away from the current combat placeholder state and toward authoritative tile/bond state that can drive both realtime fanout and manual UAT observation.

Files:
* `apps/server/src/rooms/arena.state.ts` - Add authoritative room state for tiles, regions, bond metadata, and any viewport-independent client projection needed at join time.
* `apps/server/src/rooms/arena.room.ts` - Publish the expanded state and keep room lifecycle authority in Colyseus.
* `packages/shared-types/src/index.ts` - Add shared types for bond identifiers, bond payloads, and any client-facing projection contracts.

Success criteria:
* Room state can represent placed tiles and current bond outcomes deterministically.
* Shared types define the contract needed by both server and browser code.

Context references:
* `apps/server/src/rooms/arena.state.ts` (Lines 1-11) - Current placeholder state is insufficient.
* `apps/server/src/rooms/arena.room.ts` (Lines 1-178) - Current room already owns lifecycle and fanout.

Dependencies:
* None.

### Step 1.2: Implement deterministic bond evaluation and neighborhood recompute pipeline on the server

Add the E4-S1 and E4-S2 domain logic in server-side code that already owns authoritative placement and region change processing.

Files:
* `apps/server/src/domain/` - Add or extend services for bond-rule evaluation, neighborhood index maintenance, and bounded recompute queue behavior.
* `apps/server/src/http/app.ts` - Invoke bond evaluation and recompute work from successful placement flow or a dedicated domain service entrypoint.
* `apps/server/src/persistence/tile.repository.ts` - Carry any extra persistence or replay fields only if needed to rebuild deterministic bond state.
* `apps/server/src/domain/region-diff.service.ts` and `apps/server/src/domain/region-snapshot.service.ts` - Extend if bond state must be included in diff/snapshot outputs.

Success criteria:
* Same placement pattern yields the same bond type repeatedly.
* Burst placement recomputes are bounded to touched neighborhoods.
* Server-side bond state is derivable from authoritative placement state.

Context references:
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Rows 1 and 2 acceptance expectations.
* `apps/server/src/http/app.ts` (Lines 141-239) - Existing placement success path is the natural hook.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Emit bond and recompute telemetry from authoritative execution points

Add explicit helper methods and schemas for the E4 server-side event family.

Files:
* `apps/server/src/telemetry/telemetry-sink.ts` - Add helper methods or at minimum documented event-schema wrappers for bond and recompute events.
* `apps/server/src/domain/` services implementing bond logic - Emit `bonding_triggered`, `bond_recalc_started`, `bond_recalc_completed`, and `bond_recalc_skipped` at authoritative execution points.
* `apps/server/tests/` - Add tests for event emission payloads and suppression rules.

Success criteria:
* E4 telemetry events exist with stable payload names and fields.
* Events are emitted from domain-authoritative code rather than UI-only heuristics.

Context references:
* `apps/server/src/telemetry/telemetry-sink.ts` (Lines 1-260) - Existing generic sink can be extended without new infrastructure.
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-support-research.md` - Expected event families and product-side observability gaps.

Dependencies:
* Step 1.2 completion.

### Step 1.4: Validate server-side deterministic behavior and recompute coverage

Run focused validation against the authoritative domain slice before moving on to browser-heavy work.

Validation commands:
* `npm run -w @game/server test -- bonding`
* `npm run -w @game/server test -- recompute`
* `npm run -w @game/server build`

## Implementation Phase 2: Client Bond Rendering and Interactive Creation UX

<!-- parallelizable: false -->

### Step 2.1: Extend browser state and realtime projection to carry bond and viewport-ready tile data

Prepare the client-side model so the browser can render bond outcomes and camera state from authoritative data.

Files:
* `apps/client/src/browser/state.ts` - Add bond, preview, viewport, onboarding, and accessibility state slices.
* `apps/client/src/browser/app.ts` - Consume enriched bootstrap, placement, and realtime payloads.
* `apps/client/src/browser/room.ts` - Extend delta/join handling if new bond payloads travel over realtime messages.
* `apps/client/src/session/realtime-delta-handler.ts` - Extend payload handling for bond-aware updates if the existing abstraction remains the projection boundary.
* `packages/shared-types/src/index.ts` - Share browser-consumable payload types.

Success criteria:
* Client state can represent active bonds, previews, zoom state, onboarding progress, and a11y preferences.
* Realtime payload application remains deterministic.

Context references:
* `apps/client/src/browser/state.ts` (Lines 1-79) - Current state covers only basic tiles and selection.
* `apps/client/src/browser/app.ts` (Lines 1-239) - Current orchestration path already owns UI updates around placement and room delta flow.

Dependencies:
* Phase 1 complete.

### Step 2.2: Replace the minimal form renderer with palette, placement preview, optimistic placement, and bond visuals

Implement the E5-S1 and E4-S3 interaction surfaces in the browser.

Files:
* `apps/client/src/browser/render.ts` - Replace form-only DOM with canvas or structured rendering surface that supports palette, preview, and bond visuals.
* `apps/client/src/browser/app.ts` - Add handlers for palette open/select, hover preview, optimistic placement, and ack resolution.
* `apps/client/src/main.ts` and client style assets if introduced - Wire runtime startup and any required rendering assets.

Success criteria:
* User can choose shape and color, see placement preview, place optimistically, and observe bond visuals after ack.
* Occupied-cell feedback is distinct from valid preview state.

Context references:
* `apps/client/src/browser/render.ts` (Lines 1-81) - Current UI is a coordinate form and list.
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Row 3 expectations.

Dependencies:
* Step 2.1 completion.

### Step 2.3: Add pan/zoom, culling, and readability behavior for bonded tile clusters

Support E5-S2 without polluting unrelated server concerns unless viewport-aware data loading becomes necessary.

Files:
* `apps/client/src/browser/render.ts` - Implement camera transforms and culling-aware drawing.
* `apps/client/src/browser/state.ts` - Store zoom level, pan offset, and visibility state.
* `apps/client/src/browser/app.ts` - Handle input events for pan/zoom.
* `apps/client/src/browser/api.ts` or server diff endpoints - Extend only if viewport-scoped fetches become necessary to keep payloads bounded.

Success criteria:
* Camera pan/zoom is responsive.
* Bond visuals remain legible across target zoom levels.
* Off-screen tiles do not render artifacts.

Context references:
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Row 4 expectations.

Dependencies:
* Step 2.2 completion.

### Step 2.4: Emit client interaction telemetry for palette, preview, viewport, and render outcomes

Add the client-side event family required by rows 3 and 4.

Files:
* `apps/client/src/browser/app.ts` - Emit interaction telemetry when users open palette, choose shape/color, and navigate viewport.
* `apps/client/src/browser/render.ts` - Emit render-side events such as `bond_effect_rendered` if that is best observed at draw completion.
* Shared telemetry utility within `apps/client/src/browser/` if a reusable wrapper is needed.

Success criteria:
* `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`, `viewport_changed`, `zoom_level_changed`, and `bond_effect_rendered` are observable during manual UAT.

Context references:
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-support-research.md` - Expected client event families.

Dependencies:
* Steps 2.2 and 2.3 completion.

## Implementation Phase 3: Onboarding, Accessibility, and Time-to-First-Tile Instrumentation

<!-- parallelizable: false -->

### Step 3.1: Add onboarding stepper and first-tile timing instrumentation

Implement the row 5 flow and make the p50 gate observable through telemetry.

Files:
* `apps/client/src/browser/app.ts` - Track onboarding lifecycle and first successful placement timing.
* `apps/client/src/browser/state.ts` - Store onboarding progress and timing state.
* `apps/client/src/browser/render.ts` - Render tutorial/skip UI and placement confirmation state.

Success criteria:
* Tutorial start, completion/skip, and first tile timing are measurable and emitted.
* The UI can support repeated fresh-session manual timing runs.

Context references:
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Row 5 expectations.

Dependencies:
* Phase 2 state and render foundations complete.

### Step 3.2: Add keyboard navigation, focus treatment, high-contrast mode, and reduced-motion bond variants

Implement the row 6 accessibility surface directly in the browser rendering and interaction layer.

Files:
* `apps/client/src/browser/render.ts` - Visible focus treatment, high-contrast styles, and low-motion bond variants.
* `apps/client/src/browser/app.ts` - Keyboard navigation, accessibility toggles, and telemetry emission.
* Client style assets or theme modules if introduced.

Success criteria:
* Placement flow is keyboard-complete.
* High-contrast and reduced-motion modes affect both controls and bond visuals.
* `a11y_mode_enabled`, `keyboard_placement_used`, and `reduced_motion_enabled` are emitted.

Context references:
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Row 6 expectations and WCAG targets.

Dependencies:
* Phase 2 render/interaction foundations complete.

### Step 3.3: Validate onboarding and accessibility behavior with targeted client tests and manual checks

Validation commands:
* `npm run -w @game/client test -- onboarding`
* `npm run -w @game/client test -- accessibility`
* Manual browser checks for keyboard-only navigation and reduced-motion rendering
* Manual browser checks confirming visible focus indicators across palette controls, canvas navigation targets, and placement controls
* Manual or DevTools-assisted contrast checks confirming palette controls and tile-edge boundaries meet the row 6 `>=3:1` expectation in high-contrast mode

## Implementation Phase 4: Regression Coverage and UAT Support Instrumentation

<!-- parallelizable: true -->

### Step 4.1: Add automated regression coverage for bond determinism and client interaction telemetry

Manual UAT remains the observation surface, but rows 1 through 6 need automated guardrails underneath them.

Files:
* `apps/server/tests/unit/` and `apps/server/tests/integration/` - Add bond determinism and recompute queue coverage.
* `apps/client/tests/unit/` and browser-targeted tests - Add preview, onboarding, and a11y telemetry coverage where practical.
* `apps/client/vitest.config.ts` and `apps/server/vitest.config.ts` - Extend test setup only if the new client rendering path needs browser-like fixtures.

Success criteria:
* Bond determinism has automated regression coverage.
* At least the highest-value UX telemetry paths are covered by tests.

Context references:
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - Row-level behavior that should be protected by automated regression coverage.

Dependencies:
* Phases 1 through 3 implemented enough to exercise the target behaviors.

### Step 4.2: Document developer-facing UAT support contracts and observability expectations

Document the event and behavior contracts that future implementation and manual UAT will rely on, without adding workflow approval mechanics.

Files:
* `docs/game-design-document.md` or another existing product doc surface if the team wants product-facing documentation updates.
* `apps/client/README.md` or `apps/server/README.md` only if implementation changes require local usage notes for manual UAT preparation.

Success criteria:
* The expected E4/E5 telemetry and UX behavior contracts are discoverable for future implementers and testers.
* Any documentation remains limited to product behavior and local observability setup.

Context references:
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-support-research.md` - Product and telemetry gaps.
* `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` - The six user-visible UAT procedures.

Dependencies:
* Step 4.1 completion.

## Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all validation commands relevant to the completed work:
* `npm run lint`
* `npm run build`
* `npm run test`

### Step 5.2: Fix minor validation issues

Iterate only on lint, build, test, and workflow issues introduced by this implementation.

### Step 5.3: Report blocking issues

If remaining failures require broader architectural changes, document them and create follow-on planning rather than widening scope inside the validation phase.

## Dependencies

* Product phases depend on the existing auth/bootstrap/join flow remaining stable.
## Success Criteria

* All six UAT rows are implementable against the shipped product surface.
* Manual UAT is backed by stable telemetry and testable product behavior.