<!-- markdownlint-disable-file -->
# Planning Log: E4 Deterministic Bonding Engine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None identified after aligning the plan to rule-specific local windows for maximum artistic freedom.

### Plan Deviations from Research

* None identified after the rule-geometry update and user preference confirmation.

## Implementation Paths Considered

### Selected: Shared evaluator in existing shared-types package

* Approach: Add bonding types and a pure evaluator to packages/shared-types, then consume it from the server placement flow.
* Rationale: Best balance of determinism, reuse, and minimal setup overhead for E4-S1.
* Evidence: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Recommended approach with rationale)

### IP-01: Server-only evaluator in apps/server/src/domain

* Approach: Implement the evaluator only in the server domain layer and emit telemetry from there.
* Trade-offs: Fastest local change, but it creates duplicate logic if the client or future stories need the same rule set.
* Rejection rationale: Too narrow for the long-term shared-module direction that the research favors.

### IP-02: New dedicated packages/shared-bonding package

* Approach: Split bonding types and evaluator into a new shared package.
* Trade-offs: Cleaner package boundary, but extra workspace configuration and CI overhead.
* Rejection rationale: Overhead is unnecessary for E4-S1 and would slow the current delivery path.

## Suggested Follow-On Work

* WI-01: Expand rule-window fixtures for later E4 story work - Medium priority
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Potential Next Research)
  * Dependency: E4-S1 evaluator and test corpus should land first so later refinement is measured against an implemented baseline.

* WI-02: Add client VFX and reduced-motion rendering for bond events - High priority for E4-S3, but out of scope for this task
  * Source: docs/layer1-backlog.md (E4-S3 acceptance criteria)
  * Dependency: Requires the E4-S2 local recompute path and the bond event contract surface.