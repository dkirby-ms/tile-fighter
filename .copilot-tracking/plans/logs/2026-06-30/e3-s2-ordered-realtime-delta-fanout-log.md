<!-- markdownlint-disable-file -->
# Planning Log: E3-S2 Ordered Realtime Delta Fanout

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Multi-instance durability strategy for pending ack state is not included in E3-S2 implementation scope
  * Source: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 34-40)
  * Reason: Story scope and selected approach target single-node correctness for Sprint 2
  * Impact: medium
* DR-02: Final product-approved default for ack timeout SLO is not yet resolved in planning inputs
  * Source: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 230-235)
  * Reason: Requires product/network decision outside technical implementation planning
  * Impact: low
* DR-03: Supporting docs and environment example updates identified in research are not explicitly planned in implementation phases
  * Source: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 172-174)
  * Reason: Plan and details focus on runtime code and tests but do not include explicit tasks for apps/server/README.md and .env.example updates
  * Impact: low

### Plan Deviations from Research

* DD-01: Research suggested optional bounded seen-sequence window for client tolerance; plan uses strict monotonic dedupe baseline for initial implementation
  * Research recommends: Decide between strict monotonic dedupe and bounded seen window
  * Plan implements: Strict monotonic dedupe with deterministic duplicate ignore policy
  * Rationale: Lower complexity and stronger deterministic behavior for Sprint 2 acceptance criteria

## Implementation Paths Considered

### Selected: In-Memory Room-Scoped Fanout Coordinator

* Approach: Introduce a room-scoped in-memory fanout coordinator with sequence-aware pending ack registry, one-shot retransmit, and per-connection outbound cap.
* Rationale: Meets all E3-S2 acceptance criteria with lowest implementation risk and minimal infra changes in Sprint 2.
* Evidence: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 124-180)

### IP-01: Redis Streams or Pub/Sub Fanout in Sprint 2

* Approach: Offload ordered fanout and ack state to Redis-backed shared runtime.
* Trade-offs: Better multi-instance resilience, but introduces infra and deployment complexity not currently wired in runtime code paths.
* Rejection rationale: Exceeds Sprint 2 scope and increases delivery risk for current story.

### IP-02: Database Outbox and Dispatcher

* Approach: Persist deltas to outbox table and dispatch with worker-based ack tracking.
* Trade-offs: Strong durability but highest implementation and operational complexity; larger blast radius for latency and delivery timing.
* Rejection rationale: Not required for issue #18 acceptance criteria and too heavy for targeted story point budget.

## Suggested Follow-On Work

* WI-01: Multi-instance fanout hardening — Add Redis- or outbox-backed pending ack durability for horizontal scaling (High)
  * Source: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md
  * Dependency: E3-S2 baseline production validation complete
* WI-02: Ack timeout tuning and adaptive policy — Replace fixed timeout default with network-profile tuning and percentile-driven thresholds (Medium)
  * Source: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md
  * Dependency: Telemetry baselines from load and production-like environments
* WI-03: Fanout observability dashboard — Build dashboard/alerts for timeout rate, retransmit ratio, and outbound cap rejects (Medium)
  * Source: GitHub issue #18 telemetry requirements
  * Dependency: Telemetry events emitted in stable environments
