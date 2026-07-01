<!-- markdownlint-disable-file -->
# Planning Log: Minimal Browser App Scaffold with First Playable Loop

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None.

### Plan Deviations from Research

* None currently identified.

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
