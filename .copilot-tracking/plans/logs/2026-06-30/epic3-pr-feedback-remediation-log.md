<!-- markdownlint-disable-file -->
# Planning Log: Epic3 PR Feedback Remediation

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Environment-backed latency budget validation path for nonprod/release CI remains outside this remediation scope.
  * Source: `.copilot-tracking/pr/review/epic3/handoff.md` (Backlog Follow-Up section)
  * Reason: Current user request is to plan PR feedback implementation for direct review findings in server fanout/config wiring.
  * Impact: Medium

### Plan Deviations from Research

* DD-01: Outbound cap reset-window uses `deltaAckPendingTtlMs` as the reset interval source.
  * Plan specifies: Implement reset-window semantics with existing `windowResetAt` state and bounded scope.
  * Implementation differs: Reuses `deltaAckPendingTtlMs` for reset timing rather than introducing a separate outbound window config.
  * Rationale: Keeps remediation minimal-risk and avoids expanding runtime configuration surface in this PR.

## Implementation Paths Considered

### Selected: Incremental targeted remediation on current architecture

* Approach: Fix wiring and cap behavior in existing `app.ts`, `arena.room.ts`, `delta-fanout.service.ts`, and `index.ts`, then add/adjust tests.
* Rationale: Fastest path to resolve critical PR review comments with minimal architectural churn.
* Evidence: `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` (Verified Findings and Planning Decisions sections)

### IP-01: Coordinator contract redesign around in-flight cap and explicit dispatch abstraction

* Approach: Introduce new dispatch abstraction, migrate cap semantics to in-flight ack bounded model, and refactor room/app integration.
* Trade-offs: Potentially cleaner long-term model, but higher regression risk and larger change surface for current PR.
* Rejection rationale: Exceeds intended remediation scope for feedback closure and would delay PR readiness.

## Suggested Follow-On Work

* WI-01: Add environment-backed latency-budget gate in CI workflows — Implement external environment-backed load scenario and promotion gate in `.github/workflows/nonprod-load.yml` and `.github/workflows/verify-release.yml`. (High)
  * Source: `.copilot-tracking/pr/review/epic3/handoff.md` Backlog Follow-Up
  * Dependency: Completion of current fanout correctness remediation so load validation reflects intended runtime behavior.
* WI-02: Evaluate in-flight pending-ack cap model as post-PR hardening — Compare operational behavior versus reset-window approach under long-lived load patterns. (Medium)
  * Source: `.copilot-tracking/research/subagents/2026-06-30/epic3-pr-feedback-scope-research.md` Open Questions
  * Dependency: Current PR merged and baseline telemetry captured.
* WI-03: Add a shared key-contract regression test for room and HTTP fanout registry lookup. (Medium)
  * Source: Phase 2 implementation feedback
  * Dependency: Current remediation merged so contract is stable.
* WI-04: Add negative-path integration coverage for placement fanout when no registry entry exists for region. (Low)
  * Source: Phase 2 implementation feedback
  * Dependency: Current remediation merged so baseline behavior remains unchanged.
