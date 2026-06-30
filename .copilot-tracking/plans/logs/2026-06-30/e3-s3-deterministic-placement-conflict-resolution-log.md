<!-- markdownlint-disable-file -->
# Planning Log: E3-S3 Deterministic Placement Conflict Resolution

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-02: Replay window duration default and long-term purge cadence are not finalized by product/ops
  * Source: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 43-46)
  * Reason: Technical implementation can add configurable bounds, but canonical defaults require stakeholder decision
  * Impact: low

### Plan Deviations from Research

* DD-01: Research mentions temporary server-generated command IDs for legacy clients; plan enforces required commandId in primary path
  * Research recommends: Temporary compatibility mode may ease migration for old clients
  * Plan implements: Required commandId validation in placement route with no automatic server-generated fallback in first pass
  * Rationale: Keeps idempotency semantics explicit and avoids ambiguous replay identity behavior
* DD-02: Research suggests adding winner metadata in ledger response snapshot; plan limits winner metadata to deterministic fields needed for API/telemetry
  * Research recommends: Store optional detailed winner metadata
  * Plan implements: Minimal winner metadata sufficient for conflict code mapping and telemetry dimensions
  * Rationale: Reduces storage overhead and schema churn while satisfying story acceptance criteria
* DD-03: Repository layer introduced a legacy fallback command identity for non-route callers
  * Research recommends: Keep command identity explicit with required commandId in command contract
  * Plan implements: HTTP route enforces required commandId; repository adds deterministic `legacy-...` fallback for compatibility in direct invocation paths
  * Rationale: Prevents immediate breakage in existing test doubles/non-route usage while preserving strict API boundary validation
* DD-04: Validation command alias differs from implementation plan
  * Plan specifies: `npm run -w @game/server migrate`
  * Implementation differs: `npm run -w @game/server migrate:up` (equivalent available script)
  * Rationale: Workspace scripts currently define `migrate:up`/`migrate:down` only
* DD-05: Phase 3 targeted telemetry test command has no matching tests yet
  * Plan specifies: `npm run -w @game/server test -- telemetry`
  * Implementation differs: Initially failed due no matching test files; resolved in Phase 4 with dedicated telemetry-focused test coverage
  * Rationale: Validation gap closed by adding test files that align with workspace filter conventions

## Implementation Paths Considered

### Selected: Transactional Placement Command Ledger with Existing Unique Constraint Arbitration

* Approach: Keep coordinate uniqueness winner arbitration in database constraints and add a transactional placement command ledger keyed by (region_id, actor_id, command_id)
* Rationale: Meets deterministic winner, idempotent loser code, and retry-without-side-effects requirements with strongest correctness and lowest architecture churn
* Evidence: .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md (Lines 145-188)

### IP-01: Cache-First Dedupe with Database Fallback

* Approach: Check command replay in cache first, then fallback to database on miss
* Trade-offs: Potentially lower latency in warm path, but weak correctness under restarts/evictions and still requires durable fallback
* Rejection rationale: Does not provide sufficient deterministic guarantees without effectively reintroducing full ledger complexity

### IP-02: Advisory Lock-Based Conflict Arbitration

* Approach: Use DB advisory locks per coordinate or region during placement arbitration
* Trade-offs: Explicit lock control but increased deadlock/operational risk and higher implementation complexity
* Rejection rationale: Existing unique constraint already supplies deterministic winner arbitration with lower risk

## Suggested Follow-On Work

Items identified during planning that fall outside current scope.

* WI-01: Define replay-window SLO and operational purge cadence with product/ops stakeholders (Medium)
  * Source: DR-02
  * Dependency: Initial rollout telemetry and storage growth observation
* WI-02: Evaluate legacy-client transition strategy if commandId rollout reveals compatibility issues (Medium)
  * Source: DD-01
  * Dependency: Deployment telemetry from first release containing required commandId validation
* WI-03: Decide whether repository-level legacy command identity fallback should be retained or removed after test harness updates (Medium)
  * Source: DD-03
  * Dependency: Phase 4 test coverage stabilization and direct repository caller audit
* WI-04: Add telemetry-focused tests or adjust test filter conventions to make `-- telemetry` validation actionable (Medium)
  * Source: DD-05
  * Dependency: Completed in Phase 4 test suite additions
