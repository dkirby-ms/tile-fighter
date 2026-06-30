<!-- markdownlint-disable-file -->
# Planning Log: E3-S1 Reliable Room Join and Rejoin

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: CI gate wiring for reconnect smoke/load remains identified as follow-on and is not represented as an in-scope implementation step
  * Source: .copilot-tracking/research/2026-06-29/e3-epic-research.md (Lines 49-83)
  * Reason: Package includes local smoke/load scenarios but no explicit CI pipeline integration step
  * Impact: low

### Plan Deviations from Research

* DD-01: Research proposes six implementation phases including explicit documentation cutover; plan compresses into five implementation phases and omits dedicated documentation cutover phase
  * Research recommends: Separate doc/runbook cutover phase after technical delivery
  * Plan implements: Technical delivery and validation phases only, with documentation moved to follow-on work
  * Rationale: Keeps plan tightly aligned to E3-S1 acceptance criteria and avoids scope creep into epic-wide operational docs
* DD-02: Research includes optional incremental per-delta checksum diagnostics; plan focuses on deterministic end-of-replay checksum as required behavior
  * Research recommends: Optional intermediate checksum diagnostics per replay delta
  * Plan implements: Mandatory final checksum validation, intermediate diagnostics optional and non-blocking
  * Rationale: Reduces complexity for first implementation while preserving determinism guarantees

## Implementation Paths Considered

### Selected: Dedicated Reconnect Checkpoint and Token Path

* Approach: Add a dedicated checkpoint persistence model, reconnect token service, and replay orchestration endpoint while preserving existing join-token flow for initial admission.
* Rationale: Cleanly separates first-join auth from reconnect restoration semantics and makes security/rate-limit policies explicit for reconnect abuse checks.
* Evidence: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md (Lines 915-1015)

### IP-01: Extend Join Token for Reconnect

* Approach: Reuse join-token service claims to represent reconnect context and avoid introducing a separate reconnect token service.
* Trade-offs: Fewer new files and potentially faster implementation, but weaker separation of concerns and higher risk of conflating first-join and reconnect threat models.
* Rejection rationale: Dedicated reconnect token path provides clearer status-code behavior, replay detection, and stale-session handling boundaries for E3-S1 security criteria.

### IP-02: Snapshot-Heavy Rejoin Recovery

* Approach: Use snapshot restore semantics for player rejoin instead of checkpoint plus delta replay.
* Trade-offs: Simpler replay logic but much higher storage and operational overhead, with greater risk to latency at scale.
* Rejection rationale: Conflicts with research guidance favoring lightweight checkpoints and deterministic delta replay; risks undermining E3-S4 latency goals.

## Suggested Follow-On Work

* WI-01: CI reconnect reliability gate — Add dedicated CI job wiring for E3-S1 smoke/load scenarios with threshold assertions (High)
  * Source: .copilot-tracking/research/2026-06-29/e3-epic-research.md
  * Dependency: E3-S1 implementation complete with stable tests
* WI-02: Replay diagnostics dashboard — Add telemetry aggregation and dashboard panels for reconnect outcomes/checksum mismatches (Medium)
  * Source: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
  * Dependency: Telemetry events emitted in production-like environment
* WI-03: Documentation cutover and operator runbook updates — Publish reconnect/retention operational runbook and incident response guidance (Medium)
  * Source: .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
  * Dependency: E3-S1 implementation and telemetry rollout complete
