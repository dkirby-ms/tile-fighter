<!-- markdownlint-disable-file -->
# Planning Log: Issue #14 Authoritative Placement and 10-Minute Self-Edit Window

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-03: Confirm the exact throttle policy for per-account placement limits.
  * Source: .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Open Questions and Risks)
  * Reason: The research notes that the issue does not specify the exact window and limit.
  * Impact: high

### Plan Notes

* The plan is intentionally route-based and keeps the 10-minute edit window anchored to created_at.
* The plan preserves existing persistence telemetry while adding story-level tile events.

## Implementation Paths Considered

### Selected: HTTP authoritative commands with repository-enforced policy

* Approach: Add tile HTTP routes, share tile DTOs, enforce owner/window policy in the repository/service layer, and emit telemetry for place/reject/edit outcomes.
* Rationale: This is the smallest cohesive path that fits the current authenticated HTTP command architecture and the existing repository-union style.
* Evidence: apps/server/src/http/app.ts:1-26, apps/server/src/http/routes/session.routes.ts:1-132, apps/server/src/persistence/tile.repository.ts:1-123, .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md

### IP-01: Room-message authoritative commands

* Approach: Move placement and edit into Colyseus room messages and synchronize state from the room layer.
* Trade-offs: Better alignment with real-time multiplayer state, but larger architectural surface and more coupling to room state.
* Rejection rationale: The current room model is combat-oriented and does not yet have a tile mutation command surface.

### IP-02: Client-enforced edit window with server best-effort validation

* Approach: Keep edit permission logic mostly client-side and trust the UI timer, with only minimal server checks.
* Trade-offs: Easier short-term UI work, but unsafe and not authoritative.
* Rejection rationale: It conflicts with the issue requirement for server authority and trusted time.

### IP-03: Event-sourced tile mutation history

* Approach: Store all tile place/edit actions in an event log and derive current state from replay.
* Trade-offs: Strong auditability and replay, but substantially more implementation and query complexity.
* Rejection rationale: The issue does not require event sourcing, and the current repository is already direct-state oriented.

## Suggested Follow-On Work

Items identified during planning that fall outside current scope.

* WI-01: Clarify the exact per-account throttle policy with product or gameplay owners - high priority
  * Source: .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Open Questions and Risks)
  * Dependency: None
  * Effort estimate: small

* WI-02: Decide whether tile commands should eventually move from HTTP routes into room-message handling - medium priority
  * Source: .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Scenario B and Implementation Impact)
  * Dependency: Authoritative HTTP implementation complete
  * Effort estimate: medium

* WI-03: Confirm whether additive audit columns are worth the schema cost - low priority
  * Source: .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Persistence)
  * Dependency: Repository implementation complete
  * Effort estimate: small

* WI-04: Add a broader tile contention benchmark once the issue-specific load test is stable - low priority
  * Source: .copilot-tracking/research/2026-06-29/issue-14-authoritative-placement-self-edit-window-research.md (Implementation Impact)
  * Dependency: Issue-specific load coverage complete
  * Effort estimate: medium
