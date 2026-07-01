<!-- markdownlint-disable-file -->
# Planning Log: E4-E5 Product Support for UAT Scenarios

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

None currently.

### Plan Deviations from Research

None currently.

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