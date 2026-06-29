<!-- markdownlint-disable-file -->
# Planning Log: Story Layer1 E2-S3 Region Snapshot and Replay Recovery

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None.

### Plan Deviations from Research

* None.

### Implementation Deviations

* DD-01: Migration smoke run executed under local guard conditions with skipped checks
  * Plan specifies: Validate migration applies cleanly through startup smoke suite.
  * Implementation differs: Smoke suite passed with runtime skip guards due to unavailable DB preconditions.
  * Rationale: Existing test design intentionally skips assertions when integration DB prerequisites are absent.
* DD-02: Operator claim mapping uses role-first plus fallback scope parsing
  * Plan specifies: Extend principal role mapping for operator authorization checks.
  * Implementation differs: Mapping includes fallback to scope claim parsing where canonical role claim is undecided.
  * Rationale: Keeps authorization enforceable now while preserving future contract hardening.

## Implementation Paths Considered

### Selected: Full Snapshot Copy with Immutable Payload

* Approach: Persist region snapshot metadata and copied tile payload rows, then restore from latest snapshot with hash verification.
* Rationale: Most direct fit for predictable recovery and verification acceptance criteria.
* Evidence: .copilot-tracking/research/2026-06-29/story-layer1-e2-s3-region-snapshot-and-replay-recovery-research.md (Lines 173-237)

### IP-01: Metadata-Only Snapshot and Deterministic Replay

* Approach: Persist hash and metadata only; recompute restore from canonical tiles.
* Trade-offs: Lowest storage cost but cannot recover when canonical tile data is already drifted or corrupted.
* Rejection rationale: Does not satisfy reliability intent of replay recovery.

### IP-02: Event-Sourced Replay with Checkpointing

* Approach: Store deltas and checkpoints, rebuild region by replaying events.
* Trade-offs: Most flexible history model but significantly larger architectural change and higher implementation complexity.
* Rejection rationale: Exceeds bounded story scope and existing repository architecture.

## Suggested Follow-On Work

* WI-00: Add integration coverage for repository restore transaction on real test DB (P1)
  * Source: Phase 1, Step 1.3
  * Dependency: Existing Phase 4 integration matrix completion.

* WI-01: Finalize operator claim contract and remove fallback claim parsing (P1)
  * Source: Open question from primary research (operator claim authority)
  * Dependency: Identity platform decision and shared contract update.

* WI-02: Add snapshot retention and pruning policy with telemetry (P2)
  * Source: Open question from primary research (retention policy)
  * Dependency: Initial snapshot feature rollout and storage usage observation.

* WI-03: Introduce explicit write lock or maintenance gate for region restore window (P2)
  * Source: Open question from primary research (concurrent write policy)
  * Dependency: Load-test evidence and concurrency incident review.

* WI-04: Add explicit CI job profile for DB-required integration and smoke suites (P2)
  * Source: Phase 4, Step 4.3
  * Dependency: CI environment provisioning for test database lifecycle.

## User Decisions

* None recorded during implementation.

## Final Validation

* `npm run lint` - Passed
* `npm run build` - Passed after fixing a `TilesInsert` typing mismatch in snapshot restore row mapping
* `npm run test` - Passed

Blockers: None.
