<!-- markdownlint-disable-file -->
# Planning Log: E5 Creator UX Navigation and Accessibility

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Final browser-shell ownership remains undefined at the repository level.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 41-45)
  * Reason: The updated plan defines a creator-session flow owner inside apps/client, but the repo still has no verified browser shell or downstream consumer that would host and deploy that surface.
  * Impact: High
* DR-02: The exact `first_tile_time_recorded` boundary is not specified in current docs or code.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 87-90)
  * Reason: Step 3.2 correctly blocks on an explicit timing-contract decision, but the artifacts still do not define whether timing starts at page load, token-ready, bootstrap completion, room join, or first creator interaction.
  * Impact: High
* DR-03: Harness point 6 still does not define deployable proof for creator UX completion.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 114-125)
  * Reason: Step 5.3 explicitly expands verification only if a deployable creator shell exists and otherwise reports the gap, so current planning still lacks a concrete deployed proof path for preview, first placement, onboarding, and accessibility flows.
  * Impact: High
* DR-04: Viewport fetch may require follow-on contract work once camera behavior is implemented.
  * Source: .copilot-tracking/research/2026-06-30/e5-creator-ux-navigation-and-accessibility-research.md (Lines 234-235, 252-254)
  * Reason: Step 2.2 correctly makes viewport-driven refresh contingent, but the artifacts still leave the exact transport decision open until camera behavior proves whether local culling is sufficient.
  * Impact: Medium
* DR-05: Broader accessibility scope is still not explicitly resolved for Epic 5.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-creator-planning-gaps-research.md (Lines 85-91, 149-156)
  * Reason: Phase 4 plans reduced-motion, high-contrast, announcer, and keyboard work, but the artifacts still do not state whether colorblind-safe palettes, pattern overlays, and readable text scaling remain in Epic 5 scope or move to formal follow-on work.
  * Impact: Medium

### Plan Deviations from Research

* None currently. The updated plan follows the research recommendations and leaves the remaining telemetry, hosting, and verification gaps explicit.

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
  * Source: docs/game-design-document.md (Lines 311-317)
  * Dependency: Product scope confirmation
