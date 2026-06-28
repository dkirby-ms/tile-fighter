<!-- markdownlint-disable-file -->
# Planning Log: Epic Layer1 E1 Core Platform and Auth Session Spine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None currently.

### Plan Deviations from Research

* None currently.

## Implementation Paths Considered

### Selected: Incremental Vertical Slices on Existing Spine

* Approach: Implement E1-S1 through E1-S4 as additive slices over existing startup/auth/room infrastructure.
* Rationale: Lowest regression risk, clear contract boundaries, and direct alignment with issue scope and acceptance criteria.
* Evidence: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 156-175, 178-201)

### IP-01: Full auth/session subsystem rewrite first

* Approach: Replace major portions of auth/session stack before adding story-level features.
* Trade-offs: Potentially cleaner long-term architecture, but large migration risk and delayed usable increments.
* Rejection rationale: Existing platform spine is already functioning and supports additive evolution with lower risk.

### IP-02: Minimal verification-only patch

* Approach: Implement smoke/verification updates only and defer join-token and heartbeat lifecycle work.
* Trade-offs: Fastest near-term gate improvements, but misses core issue scope and cannot close epic acceptance.
* Rejection rationale: Contradicts explicit in-scope epic requirements for join-token issuance and heartbeat lifecycle.

## Suggested Follow-On Work

* WI-01: Canonical E1 story issue reconciliation — Close duplicate story set ambiguity (#9-#12 vs #49-#52) and align epic tracking references. (high)
  * Source: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 36-38, 150-151)
  * Dependency: Initial E1 implementation PRs prepared.
* WI-02: Join-token secret rotation and key-versioning strategy — Define rotation cadence, versioned signing keys, and operational runbook. (medium)
  * Source: Join-token service design requirements identified in E1-S2 planning.
  * Dependency: E1-S2 token issuance implementation complete.
* WI-03: Presence metadata persistence model hardening — Evaluate durable storage for auxiliary presence metadata beyond in-memory tracking for multi-instance reliability. (medium)
  * Source: Research notes that persistence currently does not model lifecycle-related metadata.
  * Dependency: E1-S3 baseline lifecycle adapter complete.
* WI-04: Verification artifact retention policy — Standardize storage duration and naming for p50 evidence and smoke logs in CI artifacts. (low)
  * Source: E1 exit criteria requires measurable proof for closure.
  * Dependency: E1-S4 verification workflow updates complete.
