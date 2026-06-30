<!-- markdownlint-disable-file -->
# Planning Log: E5-S1 Creator Placement Preview

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None currently.
## Resolved During Planning

* RD-01: Optimistic indicator clear policy selected as ack-preferred with immediate clear on terminal HTTP failure.
  * Rationale: Aligns with backlog requirement that optimistic indicator persists until ack while still handling terminal error outcomes deterministically.
  * Applied in: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Step 2.3)
* RD-02: Deterministic reducer unit-test artifact added explicitly to implementation details.
  * Rationale: Closes validator-identified gap for explicit deterministic test coverage planning.
  * Applied in: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Step 1.1)
* RD-03: Prior DR-01 reclassified as a scoped deviation rather than an unaddressed item.
  * Rationale: Shared-type shape/color hardening is intentionally deferred in-scope and captured under DD-01 with follow-on work.
  * Applied in: .copilot-tracking/plans/2026-06-30/e5-s1-creator-placement-preview-plan.instructions.md (Objectives, Phase 2.1)
* RD-04: Prior DR-02 resolved by explicit telemetry adapter and deterministic emission/test steps.
  * Rationale: Plan/details now define a telemetry module boundary, deterministic emission points, bounded payload guidance, and integration coverage.
  * Applied in: .copilot-tracking/details/2026-06-30/e5-s1-creator-placement-preview-details.md (Step 2.2)

### Plan Deviations from Research

* DD-01: Defer shared-type shape and color unions to follow-on work.
  * Research recommends: Consider promoting shape and color constraints to shared-types for stronger compile-time contract enforcement.
  * Plan implements: Client-local sanitization in E5-S1 with optional follow-on for shared-type hardening.
  * Rationale: Keeps E5-S1 bounded to required acceptance and avoids multi-package contract expansion.

## Implementation Paths Considered

### Selected: Deterministic reducer plus pure preview and thin transport adapters

* Approach: Add focused creator modules for state, preview, sanitization, submit caller, and telemetry in apps/client.
* Rationale: Maximizes deterministic testability and keeps E5-S1 independent from future UI shell decisions.
* Evidence: .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md (Lines 49-75)

### IP-01: Imperative creator-session module with inline state and side effects

* Approach: Implement E5-S1 in one module with direct state mutation, submit logic, and telemetry callbacks.
* Trade-offs: Faster initial coding but weaker deterministic tests, more coupling, and higher regression risk for E5-S2 and E5-S4 layering.
* Rejection rationale: Conflicts with deterministic behavior goals and increases maintenance cost.

## Suggested Follow-On Work

* WI-01: Shared-type shape/color hardening - Add optional shape and color unions to shared-types to reduce client/server drift. (Medium)
  * Source: DR-01
  * Dependency: E5-S1 completion
* WI-02: Telemetry schema contract - Define required payload fields and sampling policy for E5-S1 events. (Medium)
  * Source: DR-02
  * Dependency: Analytics owner alignment
* WI-03: Realtime ack matching contract hardening - If implementation reveals race ambiguity, formalize ack correlation contract for placement commandIds. (Medium)
  * Source: RD-01
  * Dependency: E5-S1 implementation telemetry and integration test outcomes
