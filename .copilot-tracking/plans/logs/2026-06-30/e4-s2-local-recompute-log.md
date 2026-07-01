<!-- markdownlint-disable-file -->
# Planning Log: E4-S2 Local Bond Recompute Coordinator

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: The exact lag metric is still a design choice, so the plan defines queue-lag validation in terms of enqueue-to-drain timing rather than a broader placement-to-publish metric.
  * Source: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md (Open questions and risks)
  * Reason: The story only requires bounded lag; the narrower metric is easier to validate against the in-memory coordinator and the existing load harness.
  * Impact: medium

* DR-02: The plan does not expand the bond payload contract or realtime fanout shape in this story.
  * Source: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md (Open questions and risks)
  * Reason: E4-S2 is scoped to recompute queueing, dedupe, and telemetry; bond transport expansion is better handled when the client render contract is addressed.
  * Impact: medium

### Plan Deviations from Research

* DD-01: The queue key is resolved to region plus affected local cell instead of a broader neighborhood signature.
  * Research recommends: Keep the queue keyed to the smallest unit that still suppresses redundant work, with region+cell or neighborhood signature both viable.
  * Plan implements: A region-local-cell key with a separate last-emitted fingerprint cache.
  * Rationale: This preserves locality, keeps coalescing easy to reason about, and matches the current orthogonal neighborhood helper.

* DD-02: The plan introduces explicit recompute lifecycle telemetry instead of relying on `bonding_triggered` alone.
  * Research recommends: Track started/completed/skipped behavior around the bounded queue.
  * Plan implements: Dedicated `bond_recalc_started`, `bond_recalc_completed`, and `bond_recalc_skipped` telemetry methods.
  * Rationale: Queue lag and skip behavior are not observable enough through the existing bond event surface by itself.

* DD-03: The plan keeps the recompute coordinator in-memory for this story rather than persisting jobs.
  * Research recommends: Persistence is viable if crash resilience is required, but not necessary for the current scope.
  * Plan implements: An in-memory bounded coordinator with cleanup and backpressure controls.
  * Rationale: This is the least invasive path that still satisfies the story and keeps the implementation bounded.

* DD-04: The plan makes queue limits explicit in server bootstrap instead of leaving bounded-queue behavior implicit.
  * Research recommends: Drain with explicit limits for maximum pending items, maximum drain batch, and maximum wait time.
  * Plan implements: Env/config-driven queue limits threaded into the coordinator at startup.
  * Rationale: This keeps the worker bounded and configurable without changing call sites.

* DD-05: The plan introduces dedicated recompute lifecycle telemetry rather than relying on bond events alone.
  * Research recommends: Track started/completed/skipped behavior around the bounded queue.
  * Plan implements: Dedicated `bond_recalc_started`, `bond_recalc_completed`, and `bond_recalc_skipped` telemetry methods.
  * Rationale: Queue lag and skip behavior need direct observability.

* DD-06: The plan separates enqueue flood protection from placement throttling and scopes it to the recompute path.
  * Research recommends: Reuse account/IP throttling style at the HTTP edge while keeping the recompute queue separate from placement throttle logic.
  * Plan implements: A distinct queue-ingress flood-protection check before enqueueing recompute work.
  * Rationale: This satisfies the abuse-control requirement without coupling queue behavior to placement rate limits.

* DD-07: The plan turns queue-lag budget validation into testable invariants instead of leaving it as a loose performance note.
  * Research recommends: Use the load test to validate the lag budget with the same measurement definition the product expects.
  * Plan implements: Unit tests for coalescing and bounded drain plus load tests for lag and skip metrics.
  * Rationale: This makes the burst-lag requirement repeatable and enforceable.

* DD-08: The plan adds integration coverage for repeated placements and skip behavior rather than only unit-level queue tests.
  * Research recommends: Assert that repeated state does not re-emit redundant bond events.
  * Plan implements: An integration suite that replays the same adjacency and expects a skip.
  * Rationale: This verifies the end-to-end no-redundant-event contract.

* DD-09: The plan defines burst-load validation around enqueue-to-drain latency and skip rate.
  * Research recommends: Measure the queue-lag budget under sustained placement bursts.
  * Plan implements: A load harness that records queue lag, skip rate, and queue depth.
  * Rationale: This gives the bounded queue an operational metric that can be tracked over time.

## Implementation Paths Considered

### Selected: Dedicated in-memory server-side recompute coordinator

* Approach: Add a BondRecomputeCoordinator under apps/server/src/domain, enqueue work after successful placement, and expose telemetry for started/completed/skipped states.
* Rationale: Best balance of locality, determinism, and minimal coupling to the existing outbound fanout pipeline.
* Evidence: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md (Recommended implementation path)

### IP-01: Keep recompute synchronous inside apps/server/src/http/app.ts

* Approach: Continue computing bonds inline after placement commit.
* Trade-offs: Lowest code movement, but it does not create a bounded queue or protect the placement path from burst recompute cost.
* Rejection rationale: It does not meet the story requirement for queue lag under burst placement.

### IP-02: Reuse apps/server/src/domain/delta-fanout.service.ts for recompute

* Approach: Extend the outbound delta coordinator to manage bond recompute state.
* Trade-offs: Reuses an existing bounded structure, but couples unrelated delivery and recompute concerns.
* Rejection rationale: The research identifies outbound fanout as a poor semantic fit for recompute queueing and dedupe.

### IP-03: Persist recompute jobs in the database

* Approach: Store queue work in a table and drain it asynchronously.
* Trade-offs: Better crash resilience, but heavier schema and transaction complexity.
* Rejection rationale: The story does not require durable queue semantics, so the extra overhead is not justified for E4-S2.

## Suggested Follow-On Work

* WI-01: Confirm the final queue lag metric for operational reporting — Medium priority
  * Source: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md
  * Dependency: E4-S2 coordinator and load harness should exist before the metric is standardized.

* WI-02: Decide whether bond transport should become a separate follow-up event for client rendering — High priority for later E4 work
  * Source: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md
  * Dependency: E4-S2 queue behavior should land before the client-side contract is widened.

* WI-03: Evaluate whether crash-resilient persistence is needed for bond recompute jobs — Low priority
  * Source: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md
  * Dependency: Only worth pursuing if the in-memory coordinator proves insufficient under production failure modes.

* WI-04: Add a shared telemetry test-double factory for HTTP/load integration tests — Medium priority
  * Source: Phase 3 validation fixes (multiple tests required telemetry sink method updates after recompute lifecycle methods were introduced).
  * Dependency: None; can be implemented as test infrastructure hardening.
