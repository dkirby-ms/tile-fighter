<!-- markdownlint-disable-file -->
# Planning Log: Epic 1 Gap Fill

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Client join-token caller implementation missing
  * Source: .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md (Complete Examples section)
  * Reason: Included in Phase 1 as primary requirement
  * Impact: high — Blocks Issue #10 client-side completion

* DR-02: Client heartbeat caller implementation missing
  * Source: .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md (Complete Examples section)
  * Reason: Included in Phase 1 as primary requirement
  * Impact: high — Blocks Issue #11 client-side completion

* DR-03: Client state machine not fully implemented
  * Source: .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md (API and Schema Documentation section)
  * Reason: Included in Phase 3 for completion
  * Impact: medium — Affects state observability but doesn't block core functionality

* DR-04: Bootstrap-failed state not used; recovery flow missing
  * Source: .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md (API and Schema Documentation section)
  * Reason: Included in Phase 3 Step 3.2 for implementation
  * Impact: medium — Affects error recovery clarity

* DR-05: No client-side test coverage for join-token caller
  * Source: .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md (Complete Examples section)
  * Reason: Included in Phase 4 Step 4.1
  * Impact: high — Blocks test completeness requirement

* DR-06: No client-side test coverage for heartbeat caller
  * Source: .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md (Complete Examples section)
  * Reason: Included in Phase 4 Step 4.2
  * Impact: high — Blocks test completeness requirement

* DR-07: No client integration test coverage for full auth state machine
  * Source: .copilot-tracking/research/2026-06-29/epic-1-issue-gap-analysis-research.md (Complete Examples section)
  * Reason: Included in Phase 4 Step 4.3
  * Impact: medium — Affects integration test coverage

### Plan Deviations from Research

* DD-01: Heartbeat telemetry event names mismatch
  * Research recommends: `session_heartbeat`, `session_ended`, `presence_cleared` (per Issue #11)
  * Plan implements: Rename server events in Phase 2 to match specification
  * Rationale: Research identified mismatch between issue spec and current code. Plan corrects current code to match spec.

* DD-02: Join-token telemetry event names mismatch
  * Research recommends: `room_join_token_issued`, `room_join_token_rejected` (per Issue #10)
  * Plan implements: Rename server events in Phase 2 to match specification
  * Rationale: Research identified mismatch between issue spec and current code. Plan corrects current code to match spec.

* DD-03: Client-side caller pattern not specified in existing docs
  * Research gap: No explicit reference implementation for client-side callers in docs
  * Plan approach: Use bootstrap-store.ts as reference pattern (bearer extraction + 401 retry)
  * Rationale: bootstrap-store.ts demonstrates the exact pattern needed (bearer attachment, silent retry on 401), making it a valid reference for consistency.

## Implementation Paths Considered

### Selected: Linear phases with parallel client-side work

* Approach: 
  - Phase 1 (parallelizable): Create join-token and heartbeat callers in parallel
  - Phase 2 (sequential): Update telemetry events (requires Phase 1 client work + Phase 2 coordination)
  - Phase 3 (parallelizable): Complete auth state machine independently
  - Phase 4 (parallelizable): Create client tests in parallel
  - Phase 5 (sequential): Final validation and fix iteration
* Rationale: 
  - Phases 1, 3, 4 are independent and can run in parallel (different files, no shared state)
  - Phase 2 depends on Phase 1 completion to ensure consistent telemetry patterns
  - Phase 5 must run last after all implementation phases
* Evidence: Monorepo architecture allows independent package builds; client and auth are separate concerns with no interdependencies

### IP-01: Alternative - Implement server telemetry first, then client

* Approach: Reorder to Phase 2 before Phase 1 (server events first, then client callers)
* Trade-offs:
  * **Benefit**: Server-side events can be tested in isolation before client integration
  * **Drawback**: Client callers would have telemetry mismatches until Phase 1 completes
  * **Drawback**: Requires two-phase test updates (server tests, then integration tests)
* Rejection rationale: Selected approach minimizes telemetry drift during implementation. Client callers are created with correct event names from the start, avoiding rework.

### IP-02: Alternative - Skip client state machine completion, focus on callers only

* Approach: Remove Phase 3, focus only on client callers (Phase 1) and telemetry (Phase 2)
* Trade-offs:
  * **Benefit**: Faster initial completion (3 phases instead of 5)
  * **Drawback**: Leaves defined but unused state machine transitions (bootstrap-in-flight, bootstrap-failed)
  * **Drawback**: Incomplete implementation of external-id-session.ts contract
  * **Drawback**: May require rework if future consumer code expects those state transitions
* Rejection rationale: Issue #9 analysis identifies state machine completion as part of auth coverage. Including Phase 3 ensures complete implementation and prevents technical debt.

### IP-03: Alternative - Server telemetry and client tests only (no client callers)

* Approach: Implement telemetry (Phase 2) and tests (Phase 4) but defer client caller implementation (Phase 1)
* Trade-offs:
  * **Benefit**: Demonstrates test infrastructure and telemetry alignment
  * **Drawback**: Does not actually implement the required functionality (client callers)
  * **Drawback**: Tests would be mocking server behavior without client implementation
* Rejection rationale: Core requirement is to implement client callers (Issues #10, #11). Tests without implementation do not close the gaps.

## Suggested Follow-On Work

Items identified during planning that fall outside current scope.

* WI-01: Add client telemetry event logging for join-token and heartbeat attempts
  * Description: Client-side callers should emit telemetry for diagnostics (success, retry, fallback). Currently plan covers server-side events only. Client-side telemetry pattern needs definition.
  * Priority: medium
  * Source: Derived from client caller implementation requirements
  * Dependency: Phase 1 completion (client callers exist)
  * Effort estimate: 1-2 days (pattern definition + implementation)

* WI-02: E2E test coverage for client auth → join-token → heartbeat flow
  * Description: Plan covers unit and integration tests for individual components. Full end-to-end test from auth through join-token request through heartbeat cycle not included.
  * Priority: medium
  * Source: Test coverage analysis
  * Dependency: Phase 1-4 completion
  * Effort estimate: 2-3 days (E2E test suite setup + scenarios)

* WI-03: Document client retry/fallback strategy in architectural decision record
  * Description: Plan implements silent retry on 401 pattern consistently across join-token and heartbeat. This pattern should be documented as an ADR for future reference.
  * Priority: low
  * Source: Implementation best practices
  * Dependency: Phase 1 implementation patterns established
  * Effort estimate: 1 day (ADR authoring)

* WI-04: Performance testing for client-side caller latency and retry impact
  * Description: Load testing already exists for room-join (apps/server/tests/load/room-join-load.ts). Client-side caller performance and retry timing impact should be profiled.
  * Priority: low
  * Source: Performance validation gap
  * Dependency: Phase 1 implementation complete
  * Effort estimate: 1-2 days (performance profile setup + analysis)

* WI-05: Update client package exports to include new callers (bootstrap and extraction utilities)
  * Description: If other packages consume join-token and heartbeat callers, public API surface must be clearly defined. Current step exports callers; follow-on work is defining versioning and stability guarantees.
  * Priority: low
  * Source: API surface management
  * Dependency: Phase 1 Step 1.3 complete
  * Effort estimate: 0.5 day (API review and documentation)

## Implementation Decisions

### PD-01: Client Caller Error Handling - Fallback to Interactive Auth

When client join-token or heartbeat callers fail on repeated 401 (after one silent retry), should they:

| Option | Behavior | Trade-off |
|--------|----------|-----------|
| A | Throw error, let consumer decide whether to retry | Consumer responsible for fallback logic |
| B | Automatically trigger interactive auth fallback | Caller handles fallback, but reduces consumer control |
| C | Return error result struct, let consumer decide | Explicit error handling, more verbose |

**Selected**: Option A (throw error, let consumer decide)

**Rationale**: Follows bootstrap-store.ts pattern where error is caught by consumer (bootstrap-store) and consumer decides fallback. Maintains separation of concerns: caller handles silent retry, consumer handles interactive auth trigger.

**Evidence**: apps/client/src/session/bootstrap-store.ts lines 70-90 demonstrate this pattern.

### PD-02: Telemetry Event Naming - Server-Emitted Only vs Client+Server

Should telemetry events be emitted from:

| Option | Behavior | Trade-off |
|--------|----------|-----------|
| A | Server-only (current plan) | Clear event ownership, fewer duplicate events, but loses client-side diagnostics |
| B | Both client and server | Client-side diagnostics available, but risk of duplicate/conflicting events |
| C | Client-only | Simplifies server-side, but loses server diagnostic visibility |

**Selected**: Option A (server-only, current plan)

**Rationale**: Server is authoritative for session events (join, heartbeat, leave). Client-side should emit separate diagnostic telemetry (WI-01) if needed, but session events are server-owned.

**Evidence**: Centralized telemetry sink at apps/server/src/telemetry/telemetry-sink.ts handles all session-level events.

**Deferred for follow-on**: WI-01 defines client-side diagnostics telemetry separately.

### PD-03: Test Framework and Patterns

Should client tests use:

| Option | Framework | Trade-off |
|--------|-----------|-----------|
| A | Vitest (current project standard) | Consistent with server tests, established patterns |
| B | Jest | Broader ecosystem, but adds new test framework |
| C | Playwright | Better for integration, but overkill for unit tests |

**Selected**: Option A (Vitest)

**Rationale**: Project already uses Vitest for server tests (apps/server/vitest.config.ts). Client tests should follow same standard for consistency.

**Evidence**: apps/server/vitest.config.ts and apps/server/tests/ directory structure.

## Validation Notes

* Plan validated by: Plan Validator subagent (2026-06-29)
* Validation date: 2026-06-29
* Overall status: ✅ READY FOR IMPLEMENTATION
* Critical findings: None
* Major findings: None
* Minor findings: 
  1. Phase 3 parallelization clarified: Both steps 3.1 and 3.2 modify `external-id-session.ts`. Marked as sequential (false) with coordination note in plan.
  2. Test infrastructure verification added as Phase 4 Step 4.1 to verify directories and vitest configuration before test creation.
  3. All step numbering updated to reflect new test infrastructure step.

All research gaps (DR-01 through DR-07) verified as addressed in implementation plan. Success criteria confirmed traceable to user requirements and research findings. Plan is actionable and ready for immediate implementation.
