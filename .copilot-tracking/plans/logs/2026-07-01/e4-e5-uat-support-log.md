<!-- markdownlint-disable-file -->
# Planning Log: E4-E5 Product Support for UAT Scenarios

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Manual row-6 contrast and reduced-motion visual verification is not executable in headless/unit validation.
  * Source: `.copilot-tracking/research/2026-07-01/e4-e5-uat-matrix-research.md` (Row 6)
  * Reason: Requires interactive browser checks and visual confirmation tooling outside automated unit/integration suite.
  * Impact: Medium

### Plan Deviations from Research

* DD-01: Arena state was extended rather than replaced.
  * Plan implied replacement-or-extension and research noted placeholder combat fields.
  * Implementation retained legacy deterministic simulation fields and layered tile/bond collections for compatibility.
  * Rationale: Minimize risk to existing room lifecycle while adding authoritative UAT-required state.
* DD-02: Client-side bond projection currently recomputes locally from tile deltas.
  * Plan intent emphasized authoritative bond projection readiness from server outputs.
  * Implementation computes client bond visuals deterministically on the browser from acknowledged tile deltas.
  * Rationale: Unblocks Phase 2 visuals quickly while keeping deterministic parity; authoritative bond projection remains a follow-on item.

## Implementation Paths Considered

### Selected: Incremental Product-First UAT Enablement

* Approach: Implement authoritative bond/domain work first, then the client creation/accessibility experience, then add regression coverage and product-facing observability support.
* Rationale: The manual matrix cannot run until the product surfaces exist, so the plan optimizes for dependency order around code changes only.
* Evidence: `.copilot-tracking/research/2026-07-01/e4-e5-uat-support-research.md`

### IP-01: Workflow-Gate-First Approach

* Approach: Implement workflow gating and evidence flow now, then defer E4/E5 product work.
* Trade-offs: Delivers operational governance quickly, but does not make the six scenarios executable.
* Rejection rationale: Out of scope after the user narrowed the request to product/code changes only.

### IP-02: Manual-UAT-Only Approach Without Added Automation

* Approach: Build the product surfaces and rely entirely on manual UAT without automated determinism or interaction coverage.
* Trade-offs: Lower short-term test cost, but weaker regression protection and harder future maintenance.
* Rejection rationale: Conflicts with the existing engineering pattern of backing release gates with automated checks where feasible.

## Suggested Follow-On Work

* WI-01: Telemetry Schema Reference — Publish a dedicated E4/E5 telemetry event reference for QA and ops consumers (Medium).
  * Source: Planning synthesis.
  * Dependency: Event payloads stabilized during implementation.
* WI-02: UAT Evidence Template — Create a reusable GitHub issue comment template or checklist for matrix row evidence capture (Medium).
  * Source: Subagent research recommendation.
  * Dependency: Future workflow/evidence planning outside this plan's scope.
* WI-03: Performance Budget for Bond Rendering — Add explicit render-budget targets for burst recompute and zoom/culling once the client visuals exist (High).
  * Source: Row 2 and Row 4 expectations currently rely on qualitative timing.
  * Dependency: Client rendering path implemented.
* WI-04: Authoritative bond projection contract — Include bond outcomes in room join/delta projection to avoid client-side bond recomputation drift (High).
  * Source: Phase 1 implementation completion report.
  * Dependency: Phase 2 state and realtime projection implementation.
* WI-05: Burst recompute integration coverage — Add multi-placement integration tests asserting bounded recompute event fanout and skip/completed counts (Medium).
  * Source: Phase 1 implementation completion report.
  * Dependency: Phase 4 automated regression expansion.
* WI-06: Authoritative bond payload delivery for client deltas — Include bond outcomes in room join/delta messages to remove client recompute responsibility (High).
  * Source: Phase 2 implementation validation.
  * Dependency: Phase 4 regression updates and any room payload contract changes.