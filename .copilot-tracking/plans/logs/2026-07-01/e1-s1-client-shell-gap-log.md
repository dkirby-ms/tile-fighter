<!-- markdownlint-disable-file -->
# Planning Log: E1-S1 Client Shell Gap

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Server bootstrap denial contract and non-leaky code taxonomy are not yet confirmed via a dedicated contract-validation step; plan coverage currently treats this as an implementation assumption while adding deterministic client-side normalization.
  * Source: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Potential Next Research)
  * Reason: Plan now includes explicit startup-path denial normalization work, but does not include an explicit cross-service contract confirmation task.
  * Impact: Low
* DR-02: Authoritative acceptance source alignment (issue body versus backlog mirror) remains a documentation-sign-off check rather than an implementation blocker.
  * Source: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Potential Next Research)
  * Reason: Plan implementation steps satisfy startup-shell closure intent but do not add a specific metadata-reconciliation task for sign-off wording.
  * Impact: Low

### Plan Deviations from Research

* DD-01: Phase 2 implementation execution used direct Task Implementor edits after subagent invocation failed with a 401 token-expired error.
  * Plan specifies: Execute each phase through phase-implementor subagent.
  * Implementation differs: Continued in-session with equivalent scoped edits, validation, and artifact updates.
  * Rationale: Prevent implementation stall from transient orchestration auth failure while preserving plan scope and validation requirements.

## Implementation Paths Considered

### Selected: Thin shell startup orchestrator inside apps/client

* Approach: Add a small shell startup runtime layer in apps/client that composes auth readiness and bootstrap helpers, emits startup telemetry, and returns deterministic outcomes.
* Rationale: Fastest path to close AC gaps while reusing existing helper logic and minimizing architecture churn.
* Evidence: .copilot-tracking/research/2026-07-01/e1-s1-client-shell-gap-research.md (Scenario B and Selected Approach Summary)

### IP-01: Keep helper-only architecture

* Approach: Maintain current helper modules and assert closure through existing helper tests.
* Trade-offs: Minimal code churn but fails acceptance criteria requiring startup lifecycle and telemetry from shell path.
* Rejection rationale: Does not close AC1 and AC5 gaps identified by research.

### IP-02: Split runtime into separate shell-host package

* Approach: Build a new executable shell host package outside apps/client.
* Trade-offs: Cleaner long-term architecture but higher setup and coordination overhead for immediate E1-S1 remediation.
* Rejection rationale: Over-scoped for immediate gap closure and delays acceptance-criteria restoration.

## Suggested Follow-On Work

* WI-01: Verify and codify bootstrap denial error contract from server for strict client mapping. (Medium)
  * Source: DR-01
  * Dependency: E1-S1 shell orchestrator baseline merged
* WI-02: Reconcile issue #9 acceptance wording against docs/layer1-backlog.md and update tracking artifacts. (Low)
  * Source: DR-02
  * Dependency: None
* WI-03: Evaluate future extraction to dedicated shell-host package once startup flow stabilizes. (Low)
  * Source: IP-02 rejection rationale
  * Dependency: E1-S1 and adjacent shell stories completed
