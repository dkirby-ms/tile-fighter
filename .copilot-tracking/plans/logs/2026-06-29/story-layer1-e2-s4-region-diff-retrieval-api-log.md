<!-- markdownlint-disable-file -->
# Planning Log: Story Layer1 E2-S4 Region Diff Retrieval API

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Delete semantics are unresolved for diff payloads (tombstones mandatory now versus deferred)
  * Source: .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 36-39)
  * Reason: Product direction is not finalized in issue #16 discussion.
  * Impact: medium

* DR-02: Concrete viewport and payload hard limits are not specified
  * Source: .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 40-42)
  * Reason: Limits need explicit product and operations alignment.
  * Impact: medium

* DR-03: Authorization scope beyond authentication (room/region membership requirement) is not finalized
  * Source: .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 43-45)
  * Reason: Existing middleware currently authenticates but does not enforce membership.
  * Impact: medium

### Plan Deviations from Research

* DD-01: Temporary default decisions may be implemented before product decisions are finalized
  * Research recommends: Confirm delete semantics, concrete hard limits, and authorization scope before finalizing endpoint behavior.
  * Plan implements: Allows implementation with explicit temporary defaults and follow-on work to unblock delivery.
  * Rationale: Preserves delivery progress while surfacing decision debt for explicit follow-on closure.

* DD-02: Load validation depth is intentionally staged
  * Research recommends: Include load coverage to assess stale-read amplification behavior.
  * Plan implements: Starts with a lightweight load harness and defers a reproducible benchmark profile to follow-on work.
  * Rationale: Provides immediate signal for correctness and basic performance while reserving environment-dependent benchmarking for a dedicated phase.

* DD-03: Validation workspace identifier differs from plan command examples.
  * Plan specifies: `npm run --workspace @tile-fighter/server ...`
  * Implementation differs: Executed equivalent commands with `--workspace @game/server`.
  * Rationale: Repository workspace package name is `@game/server`; `@tile-fighter/server` is not present.

* DD-04: Phase-local validation test targets were not yet present when commands were executed.
  * Plan specifies: run focused `region-diff` unit and integration tests in Phase 2 and Phase 3.
  * Implementation differs: Commands returned no matching test files because those files are created in Phase 4.
  * Rationale: Plan sequencing intentionally stages new tests in Phase 4, so focused commands become valid only after test authoring.

* DD-05: Tile repository unit-test compatibility required post-implementation guardrails.
  * Plan specifies: add transactionally atomic region version + delta persistence hooks to tile mutation paths.
  * Implementation differs: Added compatibility guards for DB doubles lacking full Kysely `transaction`/`selectFrom` support.
  * Rationale: Preserve existing unit-test contract while keeping production transactional behavior intact.

## Implementation Paths Considered

### Selected: POST /api/regions/diff with region watermark and append-only delta log

* Approach: Add region_versions and tile_deltas persistence, maintain version increments on tile writes, and serve compacted deltas through POST diff route.
* Rationale: Meets unchanged/stale acceptance behavior and aligns with current server route conventions.
* Evidence: .copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md (Lines 165-236)

### IP-01: GET /api/regions/:regionId/diff with query parameters

* Approach: Use GET with sinceVersion and viewport query serialization.
* Trade-offs: More cache-friendly semantics but increased query-shape complexity and less alignment with existing route conventions.
* Rejection rationale: Current codebase standard favors JSON POST for complex payload validation.

### IP-02: Hash-gated full viewport reads without delta log

* Approach: Re-read full viewport state and compare hash or version client-side.
* Trade-offs: Minimal schema changes but high read amplification and no true incremental stale-update behavior.
* Rejection rationale: Does not satisfy issue acceptance requirement for incremental updates.

## Suggested Follow-On Work

* WI-01: Finalize tombstone/delete diff semantics and update shared contracts (P1)
  * Source: DR-01
  * Dependency: Product decision on delete visibility in client sync protocol.

* WI-02: Define and enforce hard viewport/maxTiles limits with rate-limit alignment (P1)
  * Source: DR-02
  * Dependency: Operations and reliability review for acceptable payload/throughput envelope.

* WI-03: Add region/room membership authorization checks for diff reads (P1)
  * Source: DR-03
  * Dependency: Membership model availability in auth/session domain.

* WI-04: Add retention and pruning strategy for tile_deltas compaction (P2)
  * Source: Selected architecture implications
  * Dependency: Stability data from post-launch read/write telemetry.

* WI-05: Expand load scenario into reproducible benchmark profile for CI/non-CI environments (P2)
  * Source: DD-02
  * Dependency: Baseline performance targets and environment provisioning.

* WI-06: Add focused persistence unit/integration tests for region version bump and tile delta append invariants (P2)
  * Source: Implementation Phase 1 completion report
  * Dependency: Region diff service and route stabilization to avoid test churn.

* WI-07: Externalize region diff route defaults (viewport cap and maxTiles defaults/caps) into config for operations tuning (P2)
  * Source: Implementation Phase 3 completion report
  * Dependency: Product/operations agreement on request-bound envelopes.

* WI-08: Add targeted tile repository tests for region version and tile delta persistence behavior under real transaction-capable DB integration fixtures (P2)
  * Source: DD-05
  * Dependency: Test fixture support for region_versions/tile_deltas verification assertions.
