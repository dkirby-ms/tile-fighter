<!-- markdownlint-disable-file -->
# Planning Log: Epic 2 Follow-Up Missing Elements Remediation

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

None.

### Plan Deviations from Research

* DD-03: Local integration suites continue to use skip semantics when DB prerequisites are unavailable
  * Plan specifies: focused and full integration validations for Phase 2 through Phase 5.
  * Implementation differs: local environment executed DB-guarded skips for DB-backed suites where TEST_DATABASE_URL was unavailable.
  * Rationale: this is aligned with planned local/CI semantics after CI fail-fast precondition guardrails were implemented.

## Decision Register

* PD-01: Placement throttle window and limit
  * Status: Open
  * Owner: Product + Server Lead
  * Due date: 2026-07-02
  * Next action: Confirm production-safe request rate and burst model for initial rollout.
  * Default if unresolved: account-plus-region key with conservative 60-second window and explicit 429 rejection contract.

* PD-02: Canonical JWT operator claim source
  * Status: Open
  * Owner: Identity + Server Lead
  * Due date: 2026-07-02
  * Next action: Select canonical claim source and define fallback removal criteria.
  * Default if unresolved: retain documented transition contract (role-first with bounded scope fallback) and emit migration telemetry.

* PD-03: Tombstone requirement for delete semantics
  * Status: Open
  * Owner: Product + Client Lead
  * Due date: 2026-07-02
  * Next action: Confirm client replay requirements for stale viewport recovery.
  * Default if unresolved: implement explicit delete operation support in diff contract with tests for stale-client correctness.

* PD-04: Region diff hard limits
  * Status: Open
  * Owner: Product + Operations
  * Due date: 2026-07-02
  * Next action: Approve max viewport area and max tiles values for production baseline.
  * Default if unresolved: keep conservative configurable defaults and caps in env with boundary-test enforcement.

* PD-05: Region membership authorization model
  * Status: Open
  * Owner: Product + Security + Server Lead
  * Due date: 2026-07-02
  * Next action: Finalize whether membership is room-scoped, region-scoped, or both.
  * Default if unresolved: require authenticated active membership for requested region before diff retrieval.

* PD-06: CI integration DB precondition policy
  * Status: Open
  * Owner: DevOps + Server Lead
  * Due date: 2026-07-02
  * Next action: Decide if CI allows explicit integration-skip mode or always requires provisioned DB.
  * Default if unresolved: enforce strict CI precondition check for required DB-backed suites while preserving local skip behavior.

## Implementation Paths Considered

### Selected: Integrated Policy-First Remediation

* Approach: Lock contract language first, then execute three parallel implementation lanes (placement/quality, diff correctness/limits, auth/authorization), followed by final validation.
* Rationale: Resolves ambiguity before coding divergence and allows independent progress across file-disjoint lanes.
* Evidence: .copilot-tracking/research/2026-06-29/epic2-follow-up-missing-elements-remediation-research.md

### IP-01: Technical-First Remediation Without Backlog/Contract Updates

* Approach: Implement code controls immediately and document policy later.
* Trade-offs: faster initial coding but high risk of rework and acceptance ambiguity.
* Rejection rationale: Contradicts audit finding that ambiguity itself is a key blocker.

### IP-02: Split into Separate Independent Plans Per Unresolved Item

* Approach: Create one plan per audit item and execute serially by story.
* Trade-offs: cleaner issue isolation but slower coordinated closure and duplicated overhead.
* Rejection rationale: Items are coupled through shared auth, route, and test surfaces.

## Suggested Follow-On Work

* WI-01: Performance calibration pass for finalized diff limits using reproducible load profiles (P1)
  * Source: DR-04
  * Dependency: Hard-limit decision and config rollout complete.

* WI-02: Deprecation cleanup for transitional JWT fallback behavior after token issuer migration (P1)
  * Source: DR-02
  * Dependency: Canonical claim contract in production and issuer rollout complete.

* WI-03: Delta retention and compaction lifecycle strategy for tile_deltas growth (P2)
  * Source: DR-03
  * Dependency: Final tombstone semantics implemented and observed in production telemetry.

* WI-04: Security review of region membership authorization boundaries and potential caching strategy (P2)
  * Source: DR-05
  * Dependency: Membership model implementation stabilized in integration tests.

* WI-05: Add CI quality gate reporting for skipped integration tests visibility dashboarding (P3)
  * Source: DR-04
  * Dependency: CI guardrails merged.

* WI-06: Execute DB-backed rerun of tile-persistence integration throttle scenarios in a DB-provisioned environment (P1)
  * Source: DD-03
  * Dependency: TEST_DATABASE_URL availability in validation environment.

* WI-07: Execute DB-backed rerun of region-diff integration scenarios in a DB-provisioned environment (P1)
  * Source: DD-04
  * Dependency: TEST_DATABASE_URL availability in validation environment.

* WI-08: Execute DB-backed rerun of region-diff membership authorization integration scenarios in a DB-provisioned environment (P1)
  * Source: DD-05
  * Dependency: TEST_DATABASE_URL availability in validation environment.

* WI-09: Remove transitional JWT scope fallback after issuer contract hardening is complete (P1)
  * Source: PD-02 default path
  * Dependency: identity provider cutover and token contract enforcement complete.
