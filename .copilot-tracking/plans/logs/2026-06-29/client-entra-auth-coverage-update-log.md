<!-- markdownlint-disable-file -->
# Planning Log: Client Entra Auth Coverage Update

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

None currently. Re-validation found all research-derived and user-specified client auth planning requirements are explicitly covered in the current plan and details artifacts.

### Plan Deviations from Research

None currently. Re-validation found no material contradictions between research recommendations and the updated plan approach.

## Implementation Paths Considered

### Selected: Integrated Story Coverage Update in Existing E1 Planning

* Approach: Update backlog and epic planning language to explicitly include client Entra login/token lifecycle and authenticated caller behavior for bootstrap/join-token/heartbeat.
* Rationale: Lowest disruption to current plan while closing the identified ambiguity immediately.
* Evidence: .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 145-177)

### IP-01: Create two brand-new stories only (S1a/S1b) without touching existing epic plan text

* Approach: Add only new stories and leave existing epic plan wording intact.
* Trade-offs: Cleaner story isolation, but leaves legacy planning ambiguity in the epic artifact.
* Rejection rationale: User request is to update the plan; limiting updates to new stories would not fully satisfy plan clarity.

### IP-02: Keep current stories and rely on implementation notes

* Approach: No plan updates; rely on engineering interpretation and code-level conventions.
* Trade-offs: Zero planning churn, but high risk of inconsistent implementation boundaries.
* Rejection rationale: Conflicts with research finding that gap is real and actionable.

## Suggested Follow-On Work

* WI-01: Confirm GitHub issue body wording for E1-S1 and E1-S2 matches updated coverage language. (high)
  * Source: .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Potential Next Research)
  * Dependency: Coverage update accepted in planning docs.
* WI-02: Add explicit client-side tests for bounded 401 retry and interaction-required terminal state across bootstrap and join-token caller paths. (medium)
  * Source: .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Lines 162-166)
  * Dependency: Story acceptance criteria updates merged.
* WI-03: Evaluate whether heartbeat caller should be represented in dedicated client service abstraction in apps/client/session for reuse and observability. (medium)
  * Source: .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md (Open Questions)
  * Dependency: Baseline story clarification complete.
