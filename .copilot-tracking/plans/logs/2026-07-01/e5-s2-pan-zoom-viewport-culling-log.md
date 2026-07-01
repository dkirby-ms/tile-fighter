<!-- markdownlint-disable-file -->
# Planning Log: E5-S2 Pan Zoom and Viewport Culling

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Application shell ownership for render lifecycle orchestration remains unconfirmed.
  * Source: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Potential Next Research)
  * Reason: Current plan proceeds with deterministic navigation modules and test doubles in apps/client without resolving full app-shell ownership.
  * Impact: Integration wiring may require light adaptation when concrete shell ownership is finalized.
* DR-02: Numeric threshold definition for "without noticeable lag" is not yet codified in shared acceptance artifacts.
  * Source: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Potential Next Research)
  * Reason: Research identifies fps/memory evidence need, but target thresholds are not yet standardized in client-side acceptance tests.
  * Impact: Perf artifact can be produced now, but pass/fail enforcement may remain policy-soft until thresholds are formalized.

### Plan Deviations from Research

* None currently. Existing plan approach aligns with the selected research recommendation (Scenario 2) and does not introduce contradictory implementation direction.

## Implementation Paths Considered

### Selected: Camera-driven viewport fetch orchestration plus local culling

* Approach: Implement deterministic camera state and viewport math, call `/api/regions/diff` with debounced/coalesced bounded requests, and derive visible tile sets locally.
* Rationale: Strongest fit to E5-S2 acceptance and explicit viewport integration intent with moderate implementation risk.
* Evidence: .copilot-tracking/research/2026-07-01/e5-s2-pan-zoom-viewport-culling-research.md (Scenario 2 and Selected Approach sections)

### IP-01: Client-only camera and local culling with unchanged fetch strategy

* Approach: Implement pan/zoom and culling but avoid viewport-driven region-diff orchestration changes.
* Trade-offs: Lower complexity and quick delivery, but weak alignment to explicit viewport-fetch integration requirement and weaker network efficiency gains.
* Rejection rationale: Under-delivers on E5-S2 integration intent.

### IP-02: Predictive prefetch windows and server-assisted paging

* Approach: Extend E5-S2 with predictive multi-window prefetch and expanded API behavior.
* Trade-offs: Potentially strongest future smoothness, but highest scope/contract risk and poor sprint fit.
* Rejection rationale: Over-scoped for immediate E5-S2 baseline delivery.

## Suggested Follow-On Work

* WI-01: Confirm app-shell rendering lifecycle ownership - Identify final orchestrator and align camera update cadence wiring. (Medium)
  * Source: DR-01
  * Dependency: E5-S2 baseline module implementation
* WI-02: Formalize E5-S2 perf thresholds - Define numeric fps/memory pass/fail targets and codify in backlog acceptance language. (Medium)
  * Source: DR-02
  * Dependency: Initial E5-S2 perf artifact data
* WI-03: Add verify-release E5-S2 gate - Extend post-deploy checks to assert E5-S2 perf artifact compliance. (Medium)
  * Source: Research harness gap and Step 3.3 planning
  * Dependency: WI-02 threshold definition
