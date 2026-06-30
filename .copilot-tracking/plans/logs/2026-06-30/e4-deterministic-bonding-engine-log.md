<!-- markdownlint-disable-file -->
# Planning Log: E4 Deterministic Bonding Engine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Exact adjacency semantics are not fully specified in the local backlog artifact, so the plan uses a bounded neighborhood plus canonical ordering and leaves any final adjacency refinement to later validation if needed.
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Potential Next Research and Technical Scenarios)
  * Reason: The story text names rule outcomes but does not fully spell out the neighborhood topology in the repository artifacts.
  * Impact: medium

* DR-02: The research mentions optional payload metadata and future client reuse, but the plan keeps E4-S1 server-side and telemetry-only beyond the shared evaluator export.
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Recommended Approach and Technical Scenarios)
  * Reason: E4-S1 acceptance does not require client rendering or realtime bond payload delivery.
  * Impact: low

* DR-03: A dedicated property-based testing package is not introduced, so the property-style determinism requirement is satisfied inside the new server unit suite.
  * Source: docs/layer1-backlog.md (E4-S1 test requirements)
  * Reason: The existing test harness already supports deterministic corpus-style assertions without new dependencies.
  * Impact: low

### Plan Deviations from Research

* DD-01: The research recommendation keeps open the possibility of a dedicated bonding package, but the plan implements the evaluator in packages/shared-types first.
  * Research recommends: A dedicated package only if the domain grows enough to justify setup overhead.
  * Plan implements: Shared evaluator module inside the existing shared-types package.
  * Rationale: Lower setup cost, faster delivery, and good alignment with the existing shared contract surface.

* DD-02: The research discusses optional realtime bond metadata, but the plan does not widen the client contract in E4-S1.
  * Research recommends: Keeping future client reuse in mind.
  * Plan implements: Server telemetry plus shared evaluator only.
  * Rationale: Client VFX and realtime payload work belong to later E4 stories and should not widen the scope here.

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

* WI-01: Define the exact neighborhood topology for later E4 story work - Medium priority
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Potential Next Research)
  * Dependency: E4-S1 evaluator and test corpus should land first so later refinement is measured against an implemented baseline.

* WI-02: Add client VFX and reduced-motion rendering for bond events - High priority for E4-S3, but out of scope for this task
  * Source: docs/layer1-backlog.md (E4-S3 acceptance criteria)
  * Dependency: Requires the E4-S2 local recompute path and the bond event contract surface.