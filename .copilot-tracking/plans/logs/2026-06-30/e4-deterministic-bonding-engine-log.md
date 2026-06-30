<!-- markdownlint-disable-file -->
# Planning Log: E4 Deterministic Bonding Engine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-02: Bond neighborhood geometry for `pulse-rhythm` is still a live interpretation choice.
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Potential Next Research)
  * Reason: The backlog uses adjacency wording, but research does not fully settle whether `alternating pair pattern` should use orthogonal neighbors only or a slightly broader bounded neighborhood.
  * Impact: Medium

### Plan Deviations from Research

* DD-01: The implementation plan recommends strict orthogonal adjacency as the default E4-S1 interpretation unless PD-01 is changed.
  * Research recommends: Confirm the adjacency model before implementation.
  * Plan implements: Default to 4-neighbor orthogonal adjacency, keep the decision explicit in PD-01, and preserve wider windows as a follow-on option.
  * Rationale: This keeps E4-S1 implementable without expanding beyond the backlog's clearest wording.

### Resolved Discrepancies

* DR-01: Tile attribute bounds validation lacked an implementation owner.
  * Source: docs/layer1-backlog.md (E4-S1 security and abuse checks); apps/server/src/http/routes/tile.routes.ts (current validation surface)
  * Resolution: Added Implementation Phase 1 Step 1.2 to the plan and details, targeting apps/server/src/http/routes/tile.routes.ts and shared bounds constants when needed.

* DD-02: The earlier plan revision treated rule-specific local windows as settled even though the research kept adjacency semantics open.
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Potential Next Research); docs/layer1-backlog.md (adjacency wording)
  * Resolution: Replaced the implicit assumption with PD-01, documented the default recommendation, and left the geometry discrepancy visible in the log.

## Implementation Paths Considered

### Selected: Shared evaluator in existing shared-types package with strict adjacency semantics

* Approach: Add bonding types, bounds constants, and a pure adjacency-first evaluator to packages/shared-types, then consume it from the route and server placement flow.
* Rationale: Best balance of determinism, backlog alignment, reuse, and minimal setup overhead for E4-S1.
* Evidence: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Recommended approach with rationale)

### IP-01: Server-only evaluator in apps/server/src/domain

* Approach: Implement the evaluator only in the server domain layer and emit telemetry from there.
* Trade-offs: Fastest local change, but it creates duplicate logic if the client or future stories need the same rule set.
* Rejection rationale: Too narrow for the long-term shared-module direction that the research favors.

### IP-02: New dedicated packages/shared-bonding package

* Approach: Split bonding types and evaluator into a new shared package.
* Trade-offs: Cleaner package boundary, but extra workspace configuration and CI overhead.
* Rejection rationale: Overhead is unnecessary for E4-S1 and would slow the current delivery path.

### IP-03: Broader rule-specific local windows inside E4-S1

* Approach: Let each bond rule inspect a wider custom local window immediately, even when the backlog wording only guarantees adjacency.
* Trade-offs: More expressive rule grammar, but higher ambiguity risk and more room for deterministic contract drift before downstream stories land.
* Rejection rationale: E4-S1 should stay aligned to explicit adjacency wording first and leave broader geometry to a later, separately validated expansion.

## Suggested Follow-On Work

* WI-01: Explore broader geometry fixtures after E4-S1 adjacency rules land - Medium priority
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Potential Next Research)
  * Dependency: E4-S1 evaluator and deterministic adjacency corpus should land first so later rule expansion is measured against a stable baseline.

* WI-02: Add client VFX and reduced-motion rendering for bond events - High priority for E4-S3, but out of scope for this task
  * Source: docs/layer1-backlog.md (E4-S3 acceptance criteria)
  * Dependency: Requires the E4-S2 local recompute path and the bond event contract surface.

* WI-03: Optimize neighborhood retrieval if the first adjacency helper is broader than needed - Medium priority
  * Source: .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md (Constraints, risks, and gaps)
  * Dependency: Needs the initial server-authoritative evaluator path to exist before query-shape tuning is meaningful.

* WI-04: Revisit `pulse-rhythm` geometry if PD-01 changes after design review - Medium priority
  * Source: Planning decision PD-01 in the implementation plan
  * Dependency: Requires confirmation that adjacency-only semantics are insufficient for the intended pattern grammar.