<!-- markdownlint-disable-file -->
# Planning Log: E5 Creator UX Navigation and Accessibility

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Creator shell ownership remains undefined at the repository level.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 41-45)
  * Reason: The repo currently has no browser app shell or downstream consumer, so the plan introduces a creator-session composition seam inside apps/client without committing to a final renderer host.
  * Impact: High
* DR-02: The exact `first_tile_time_recorded` boundary is not specified in current docs or code.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 87-90)
  * Reason: The backlog requires the metric, but it does not define whether timing starts at page load, token-ready, bootstrap completion, room join, or first creator interaction.
  * Impact: High
* DR-03: Harness point 6 does not yet define proof for creator UX completion.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 114-125)
  * Reason: Current post-deploy verification stops at auth, bootstrap, room join, and latency evidence rather than preview, first placement, onboarding, or accessibility flows.
  * Impact: High
* DR-06: The plan does not allocate work for the E5-S1 and E5-S2 telemetry events already defined by the backlog.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 57-64)
  * Reason: The implementation plan and details cover onboarding and first-tile telemetry, but they do not define steps, files, or success criteria for `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`, `viewport_changed`, or `zoom_level_changed`.
  * Impact: High
* DR-04: Viewport fetch may require follow-on contract work once camera behavior is implemented.
  * Source: .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 234-235, 252-254)
  * Reason: E5-S2 is mostly client-local, but viewport-driven refresh may still need a thin transport or additional contract clarification.
  * Impact: Medium
* DR-05: Tutorial scope remains slightly ambiguous between backlog wording and the place-first product intent.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 81-85, 138-140)
  * Reason: The backlog references a tutorial overlay, while the game design document emphasizes no mandatory tutorials and minimal reading.
  * Impact: Medium

### Plan Deviations from Research

* DD-01: Accessibility implementation is staged to deliver required keyboard, reduced-motion, and high-contrast behavior first, while deferring broader GDD accessibility promises if they exceed Epic 5 scope.
  * Research recommends: The game design document promises colorblind-safe palettes, pattern overlays, and readable text scaling in addition to the epic exit criteria.
  * Plan implements: E5-S4-required accessibility controls first, with broader palette and pattern work captured as follow-on items unless explicitly pulled into scope.
  * Rationale: The backlog makes keyboard placement, contrast, and reduced motion explicit acceptance criteria, while the broader GDD promise set is larger than the documented E5 story boundaries.
* DD-02: E5-S4 is sequenced as a parallelizable client phase without carrying forward the researched E4-S3 prerequisite.
  * Research recommends: E5-S4 depends on E5-S1 and E4-S3, and the backlog sequencing places it after the earlier creator workflow slices.
  * Plan implements: Phase 4 is marked `parallelizable: true`, and its step dependencies name only Phase 1 and Step 4.1.
  * Rationale: The plan preserves the client-local delivery shape, but it weakens implementation-order clarity by omitting a verified prerequisite that should stay explicit in the execution path.

## Implementation Paths Considered

### Selected: Client composition layer inside apps/client

* Approach: Add a creator-session composition surface plus deterministic creator modules inside apps/client, reusing existing auth, bootstrap, replay, reconnect, realtime, and shared-type contracts.
* Rationale: This is the narrowest path that adds the missing creator flow owner without forcing immediate server or repo-level shell changes.
* Evidence: .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 188-237)

### IP-01: Contract-first server and bootstrap expansion

* Approach: Extend shared and server contracts first for onboarding metadata, persisted accessibility settings, and telemetry before building the creator interaction layer.
* Trade-offs: Better long-term contract clarity, but it delays the obvious missing client interaction surfaces and increases cross-package scope early.
* Rejection rationale: Research shows most E5 value can be delivered client-side first, while server-first expansion would front-load work that is not yet required.

### IP-02: Separate frontend shell outside apps/client

* Approach: Keep apps/client as a headless SDK and introduce a separate browser application shell elsewhere in the repo.
* Trade-offs: Cleaner separation if a dedicated frontend app is desired, but the current repo does not show such a shell or consumer.
* Rejection rationale: Planning against an unverified application surface adds ambiguity and blocks immediate creator-flow work.

## Suggested Follow-On Work

* WI-01: Define first-tile telemetry contract - Specify the start and stop triggers, payload dimensions, and reporting expectations for `first_tile_time_recorded`. (High)
  * Source: DR-02
  * Dependency: Creator-session ownership decision
* WI-02: Add creator-flow release verification - Introduce browser-driven or equivalent post-deploy proof for first placement, onboarding timing, and keyboard/reduced-motion flows. (High)
  * Source: DR-03
  * Dependency: Deployable creator shell or equivalent verification surface
* WI-03: Resolve broader accessibility scope - Decide whether colorblind-safe palettes, pattern overlays, and text scaling stay in Epic 5 or move to a follow-on epic. (Medium)
  * Source: DD-01
  * Dependency: Product scope confirmation
