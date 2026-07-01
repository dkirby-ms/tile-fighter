<!-- markdownlint-disable-file -->
# Planning Log: Minimal Browser App Scaffold with First Playable Loop

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None.

### Plan Deviations from Research

* DD-01: Root `dev:full` implementation introduced `concurrently` in root devDependencies.
  * Plan intent: Add root aliases for server/client workflows.
  * Implementation detail: Added `concurrently` dependency to satisfy command orchestration.
  * Rationale: Enables explicit `dev:full` without changing existing `dev` command behavior.
* DD-02: Phase 1 scaffold intentionally uses stubbed API and room connectors.
  * Plan intent: Create browser runtime scaffold and validate startup.
  * Implementation detail: `probeApi` and `connectRoom` currently return placeholder state.
  * Rationale: Defers gameplay/auth orchestration to Phase 2 per plan boundaries.
* DD-03: Phase 2 added an explicit browser dependency on `@colyseus/sdk` in `@game/client`.
  * Plan intent: Integrate room join and realtime delta handling.
  * Implementation detail: Added client runtime dependency instead of indirect import strategy.
  * Rationale: Required for direct browser room connection in the first playable loop.
* DD-04: Step 2.4 validated command startup but not full authenticated browser interaction loop.
  * Plan intent: Validate bootstrap -> join-token -> room join -> place -> render update manually.
  * Implementation detail: Command-level bring-up verified; interactive loop remains pending.
  * Rationale: External identity sign-in and local auth environment prerequisites were not fully exercised in automation.
* DD-05: Phase 3 required two scoped fixes discovered during root validation.
  * Plan intent: Final validation should pass or surface blockers.
  * Implementation detail: Updated browser render typing/lint compliance and optional scope guarding in app startup logic.
  * Rationale: Root lint/build exposed issues introduced by newly added browser loop paths.

## Implementation Paths Considered

### Selected: In-place `apps/client` Vite Browser Shell

* Approach: Add a Vite runtime shell under `apps/client` and reuse existing session/auth/realtime helpers.
* Rationale: Lowest repository churn, fastest path to first playable loop, and strongest reuse of validated helpers.
* Evidence: `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 146-182)

### IP-01: New top-level `web/` app package

* Approach: Create a separate workspace for browser runtime and keep `apps/client` SDK-only.
* Trade-offs: Better long-term separation, but adds immediate workspace/config complexity and delays playable loop.
* Rejection rationale: Not optimal for minimal first-loop delivery scope.

### IP-02: Static no-bundler browser page

* Approach: Serve static compiled JS/HTML without Vite.
* Trade-offs: Minimal tooling changes, but poor realtime debugging ergonomics and weaker developer workflow.
* Rejection rationale: Does not meet desired local development velocity.

### IP-03: HTTP-only prototype without realtime room join

* Approach: Build bootstrap + placement only, defer room events.
* Trade-offs: Lower initial complexity, but misses required connect/join/realtime render loop.
* Rejection rationale: Fails user-stated playable loop requirement.

## Suggested Follow-On Work

* WI-01: Local Auth Developer Experience Hardening — Add a documented local auth bootstrap/dev profile for browser bring-up (High).
  * Source: Research risk assessment and implementation complexity.
  * Dependency: Initial browser scaffold merged.
* WI-02: Renderer Evolution Plan — Define transition from DOM baseline to canvas or engine-backed renderer (Medium).
  * Source: Technical scenario notes.
  * Dependency: First playable loop validated.
* WI-03: Browser-Safe Shared Utility Layer — Formalize platform-aware checksum/crypto adapters in `apps/client` (Medium).
  * Source: Compatibility risk and future hardening needs.
  * Dependency: Initial checksum isolation shipped and validated.
