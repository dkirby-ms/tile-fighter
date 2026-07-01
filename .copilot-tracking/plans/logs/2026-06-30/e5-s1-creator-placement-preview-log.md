<!-- markdownlint-disable-file -->
# Planning Log: E5-S1 Creator Placement Preview

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Shared-type shape and color hardening is deferred out of E5-S1.
  * Source: .copilot-tracking/research/2026-06-30/e5-s1-creator-placement-preview-research.md
  * Reason: Research recommends optional shape and color unions in shared-types to reduce drift, but the plan keeps sanitization client-local and does not add a contract-hardening step.
  * Impact: Client/server drift risk remains until follow-on work lands, which can weaken compile-time safety for allowed creator inputs.
* DR-02: Telemetry payload schema is still undefined for E5-S1 events.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md
  * Reason: Research calls out the need to clarify event payload schema beyond the required names, while the plan only commits to a bounded local adapter with minimal payloads.
  * Impact: Analytics integration and payload stability may require a later contract decision.
* DR-03: The plan does not identify the occupancy data seam needed for blocked previews.
  * Source: .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md
  * Reason: Research states preview occupancy must come from replay bootstrap plus realtime deltas, but the plan only names the evaluator and does not assign the source of occupancy input.
  * Impact: Blocked indicator behavior is under-specified until the occupancy source and wiring seam are named.

### Plan Deviations from Research

* DD-01: Defer shared-type shape and color unions to follow-on work.
  * Research recommends: Consider promoting shape and color constraints to shared-types for stronger compile-time contract enforcement.
  * Plan implements: Client-local sanitization in E5-S1 with optional follow-on for shared-type hardening.
  * Rationale: Keeps E5-S1 bounded to required acceptance and avoids multi-package contract expansion.
* DD-02: Use a local creator telemetry adapter rather than introducing a shared telemetry schema in E5-S1.
  * Research recommends: Add telemetry events for palette opening, selection changes, and preview visibility, with payload shape left open.
  * Plan implements: A bounded apps/client telemetry adapter that emits the required event names with minimal payloads.
  * Rationale: Keeps telemetry deterministic and scoped to the client slice while leaving contract hardening for a later story.
* DD-03: Use an ack-preferred optimistic clear policy.
  * Research recommends: Resolve the clear boundary through implementation or follow-up decision.
  * Plan implements: Keep optimistic state visible after a successful submit until realtime ack, then clear immediately on terminal HTTP failure.
  * Rationale: Matches the acceptance wording that the optimistic indicator persists until ack while still avoiding stale pending state on hard failures.

## Implementation Paths Considered

### Selected: Deterministic reducer plus pure preview and thin transport adapters

* Approach: Add focused creator modules for state, preview, sanitization, submit caller, and telemetry in apps/client.
* Rationale: Maximizes deterministic testability and keeps E5-S1 independent from future UI shell decisions.
* Evidence: .copilot-tracking/research/subagents/2026-06-30/e5-s1-planning-research.md (Lines 49-75)

### IP-01: Imperative creator-session module with inline state and side effects

* Approach: Implement E5-S1 in one module with direct state mutation, submit logic, and telemetry callbacks.
* Trade-offs: Faster initial coding but weaker deterministic tests, more coupling, and higher regression risk for E5-S2 and E5-S4 layering.
* Rejection rationale: Conflicts with deterministic behavior goals and increases maintenance cost.

## Suggested Follow-On Work

* WI-01: Shared-type shape/color hardening - Add optional shape and color unions to shared-types to reduce client/server drift. (Medium)
  * Source: DR-01
  * Dependency: E5-S1 completion
* WI-02: Telemetry schema contract - Define required payload fields and sampling policy for E5-S1 events. (Medium)
  * Source: DR-02
  * Dependency: Analytics owner alignment
* WI-03: Realtime ack matching contract hardening - If implementation reveals race ambiguity, formalize ack correlation contract for placement commandIds. (Medium)
  * Source: RD-01
  * Dependency: E5-S1 implementation telemetry and integration test outcomes
