<!-- markdownlint-disable-file -->
# Planning Log: E3-S3 Fix Validation Findings

## Discrepancy Log

Gaps and differences between validation findings and planned implementation.

### Unaddressed Research Items

* DR-01: Exact deprecation timeline for commandId fallback
  * Source: e3-s3-deterministic-placement-conflict-resolution-implementation-validation.md (Recommendation #4)
  * Reason: Requires product/architecture decision (not purely technical research)
  * Impact: Medium — Plan documents decision point but implementation awaits user guidance

* DR-02: Optimal concurrent load levels for DB-backed hotspot test
  * Source: e3-s3-deterministic-placement-conflict-resolution-implementation-validation.md (Recommendation #2)
  * Reason: Performance baselines may vary by infrastructure; test harness tuning is implementation-time discovery
  * Impact: Low — Plan includes test structure; load levels can be adjusted during implementation

### Plan Deviations from Research

* DD-01: Regression test scope for replay window
  * Research findings: "Wire runtime replay window from env config into repository creation and add regression test"
  * Plan implements: Specific test in placement-conflict-resolution.integration.test.ts testing replay window boundary behavior
  * Rationale: Concrete test case (near-boundary placement timing) provides stronger regression detection than generic replay window test

* DD-02: Test mocking removal approach
  * Research findings: "Add at least one non-mocked DB-backed contention scenario"
  * Plan implements: Separate new tests rather than replacing existing mocked tests
  * Rationale: Preserving existing mocked tests maintains fast test suite execution for developers; new DB-backed tests verify real transactional behavior. Trade-off: test suite size grows slightly.

## Implementation Paths Considered

### Selected: Phased Fix Implementation with DB-Backed Test Addition

* Approach: Fix config wiring in Phase 1 (sequential); add DB-backed tests in Phase 2 (parallel with Phase 1); add test coverage and deprecation docs in Phase 3 (parallel); final validation in Phase 4 (sequential)
* Rationale: Prioritizes highest-risk item (config wiring) first; parallelizes lower-risk test additions; keeps validation sequential for cleaner error reporting
* Evidence: Validation findings prioritized major > minor; config wiring is runtime behavior risk; test additions are lower-impact code changes

### IP-01: Aggressive Refactor with Mocked Test Removal

* Approach: Replace all mocked tests with real DB-backed versions; refactor repository interface for cleaner config passing
* Trade-offs:
  * Pro: Cleaner test suite; eliminates mocking complexity
  * Con: Larger test suite execution time; higher risk of test infrastructure issues; requires more extensive refactoring
* Rejection rationale: Validation findings do not recommend full replacement, only addition of DB-backed variants. Aggressive refactoring increases implementation complexity without corresponding risk reduction.

### IP-02: Config Wiring via Dependency Injection Container

* Approach: Introduce DI container (e.g., tsyringe, inversify) for config-to-repository wiring
* Trade-offs:
  * Pro: Cleaner separation of concerns; easier to test config injection
  * Con: Adds new dependency; requires refactoring across server initialization
* Rejection rationale: Existing codebase does not use DI patterns; change would be larger than necessary. Direct config passing in index.ts is simpler and maintains consistency.

## Suggested Follow-On Work

Items identified during planning that fall outside current scope.

* WI-01: Establish performance baseline for deterministic placement under load
  * Description: Define acceptable latency SLAs (p50, p95, p99) for placement commands under normal and hotspot contention scenarios. Provides metrics to prevent performance regressions in future changes.
  * Source: DB-backed hotspot test implementation will collect metrics; opportunity to formalize SLAs
  * Dependency: Phase 2 (hotspot test) completion
  * Priority: Medium

* WI-02: Implement commandId fallback removal (deprecation completion)
  * Description: Once deprecation timeline is decided, update repository to require commandId; add migration warnings; update all callers to provide explicit commandId
  * Source: Phase 3 (deprecation documentation) establishes timeline; this item executes the plan
  * Dependency: WI-02a (user decides on deprecation timeline); WI-02b (audit all commandId callers)
  * Priority: Medium (after deprecation timeline is communicated)

* WI-03: Improve test fixture setup for concurrent DB operations
  * Description: Current test database fixtures may have limitations for highly concurrent scenarios. Investigate test infrastructure gaps identified during Phase 2 implementation.
  * Source: Phase 2 (DB-backed contention tests) may reveal fixture limitations
  * Dependency: Phase 2 implementation feedback
  * Priority: Low (conditional on Phase 2 discoveries)

* WI-04: Document replay window tuning recommendations
  * Description: Create operational guide for operators on replay window configuration tuning based on expected load patterns, region size, and command volumes
  * Source: Phase 1 implementation makes replay window configurable; operators need guidance
  * Dependency: Phase 1 completion; production traffic data (post-launch)
  * Priority: Low (post-launch operational concern)
