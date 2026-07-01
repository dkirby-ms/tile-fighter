<!-- markdownlint-disable-file -->
# Planning Log: E4 Deterministic Bonding Engine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None identified after aligning the plan to rule-specific local windows for maximum artistic freedom.

### Plan Deviations from Research

* DD-01: Bond type is included in the server realtime fanout payload before a shared delta payload contract update.
  * Plan specifies: Bonding behavior and telemetry implementation for E4-S1.
  * Implementation differs: Server payload now carries `bondType` in preparation for downstream consumption.
  * Rationale: Keep post-commit authoritative bonding output available immediately while deferring broader transport contract formalization to follow-on work.
* DD-02: Unsuccessful-placement integration coverage uses a deterministic repository stub for conflict outcomes.
  * Plan specifies: Integration proof for placement-triggered bonding and telemetry branch behavior.
  * Implementation differs: Conflict verification path uses a focused stub instead of a full DB-backed conflict orchestration.
  * Rationale: Keep deterministic test execution stable while proving the intended telemetry non-emission behavior.
* DD-03: Neighborhood retrieval was tightened to orthogonal-coordinate lookups during validation.
  * Plan specifies: Bounded local neighborhood retrieval for bond evaluation.
  * Implementation differs: Query narrowed from local range to exact orthogonal cells.
  * Rationale: Preserve E4-S1 rule behavior while restoring E3-S4 latency budget compliance under load.

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

* WI-03: Align realtime delta payload typing with optional `bondType` - Medium priority
  * Source: Phase 1 implementation output
  * Dependency: Confirm contract scope with E4-S2 and E4-S4 before broadening public shared types.

* WI-04: Add integration scenarios for `blend-gradient` and `pulse-rhythm` telemetry emission - Medium priority
  * Source: Phase 2 implementation output
  * Dependency: Extend scenario fixtures while preserving deterministic placement sequencing in integration harness.

* WI-05: Decide whether to persist refreshed load-budget artifact in feature commits - Low priority
  * Source: Phase 3 validation execution
  * Dependency: Team preference for artifact versioning policy in `apps/server/artifacts`.