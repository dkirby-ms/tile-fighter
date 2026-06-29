<!-- markdownlint-disable-file -->
# Epic Follow-Up Audit: Epic 1 & Epic 2

**Research Date**: 2026-06-29  
**Scope**: Review follow-up items logged after Epic 1 (merged) and Epic 2 (open PR #82) completion, audit against current backlog.

## Epic 1 Follow-Up Items (Phase 1: Tile Persistence Schema Completion)

**Source**: `/memories/repo/phase1-tile-persistence-complete.md`

### Documented Next Steps (from Phase 1 notes)

- Phase 2: Repository implementation (tile.repository.ts) ✅ **COMPLETE** - Implemented in Epic 2
- Phase 3: Telemetry integration ✅ **COMPLETE** - Implemented in Epic 2

**Audit Status**: Epic 1 follow-up items were all addressed within Epic 2.

---

## Epic 2 Follow-Up Items (PR #82: Tile Placement and Server Authority)

**Source**: GitHub PR #82 Epic2 tile placement and server authority (active PR)

### Extracted Unaddressed Research Items from Planning Logs

#### From Issue #14 Planning Log (Authoritative Placement and 10-Minute Self-Edit Window)

**Unaddressed Research Items:**

1. **DR-03**: Confirm exact throttle policy for per-account placement limits
   - Status: OPEN
   - Impact: High
   - Details: The issue does not specify the exact window and limit for per-account placement throttling
   - Backlog Match: None explicitly found yet
   - Evidence: `.copilot-tracking/details/2026-06-29/planning-log-issue-14-authoritative-placement-self-edit-window.md` (Unaddressed Research Items section)

2. **DR-04**: Integration scenarios run with skip semantics when `TEST_DATABASE_URL` is unavailable
   - Status: OPEN
   - Impact: Medium
   - Details: Integration and migration smoke suites depend on live test database connectivity; assumes skip behavior rather than hard failure
   - Backlog Match: None explicitly found yet
   - Evidence: Same planning log file

**Implementation Deviations:**

1. **DD-06**: Tile route mount is conditional on persistence dependencies
   - Type: Architecture Decision
   - Details: Route mount occurs after auth middleware only when db and tileRepository are provided
   - Rationale: Keeps existing app composition compatible for contexts that may instantiate HTTP app without persistence wiring
   - Backlog Impact: May require future testing/validation of conditional mount path

2. **DD-07**: Audit metadata migration intentionally skipped
   - Type: Schema Decision
   - Details: No new migration added; existing `created_at` and `owner_id` fields fully support 10-minute self-edit policy
   - Rationale: Additional audit columns deferred to follow-on work
   - Backlog Impact: Potential future Epic for audit trail enhancements

---

#### From Issue #15 Planning Log (Region Snapshot and Replay Recovery - E2-S3)

**Unaddressed Research Items**: None documented

**Plan Deviations:**

1. **DD-01**: Migration smoke run executed under local guard conditions
   - Type: Test Execution
   - Details: Smoke suite passed with runtime skip guards due to unavailable DB preconditions
   - Rationale: Existing test design intentionally skips assertions when integration DB prerequisites absent

2. **DD-02**: Operator claim mapping uses role-first plus fallback scope parsing
   - Type: Authorization Decision
   - Details: Mapping includes fallback to scope claim parsing where canonical role claim is undecided
   - Rationale: Keeps authorization enforceable now while preserving future contract hardening
   - Backlog Impact: Future work to formalize JWT claim contract

---

#### From Issue #16 Planning Log (Region Diff Retrieval API - E2-S4)

**Unaddressed Research Items:**

1. **DR-01**: Delete semantics are unresolved for diff payloads (tombstones)
   - Status: OPEN
   - Impact: Medium
   - Details: Tombstones mandatory now versus deferred is not finalized
   - Backlog Match: None explicitly found yet
   - Evidence: `.copilot-tracking/research/2026-06-29/story-layer1-e2-s4-region-diff-retrieval-api-research.md` (Lines 36-39)

2. **DR-02**: Concrete viewport and payload hard limits not specified
   - Status: OPEN
   - Impact: Medium
   - Details: Limits need explicit product and operations alignment
   - Backlog Match: None explicitly found yet
   - Evidence: Same research file (Lines 40-42)

3. **DR-03**: Authorization scope beyond authentication not finalized
   - Status: OPEN
   - Impact: Medium
   - Details: Room/region membership requirement not finalized; middleware currently authenticates only
   - Backlog Match: None explicitly found yet
   - Evidence: Same research file (Lines 43-45)

**Plan Deviations:**

1. **DD-01**: Temporary default decisions implemented before product decisions finalized
   - Type: Product Dependency
   - Details: Implementation with explicit temporary defaults and follow-on work to unblock delivery
   - Rationale: Preserves delivery progress while surfacing decision debt

2. **DD-02**: Load validation depth staged intentionally
   - Type: Test Scope
   - Details: Lightweight load harness now; reproducible benchmark profile deferred
   - Backlog Impact: Future performance validation work

---

## Cross-Epic Summary of Unaddressed Items

| Issue | Item ID | Category | Status | Impact | Backlog? |
|-------|---------|----------|--------|--------|----------|
| #14 | DR-03 | Placement throttle policy | OPEN | High | ❌ Not found |
| #14 | DR-04 | Test DB availability handling | OPEN | Medium | ❌ Not found |
| #15 | DD-02 | JWT claim contract formalization | OPEN | Low | ❌ Not found |
| #16 | DR-01 | Delete semantics / tombstones | OPEN | Medium | ❌ Not found |
| #16 | DR-02 | Viewport/payload hard limits | OPEN | Medium | ❌ Not found |
| #16 | DR-03 | Authorization scope (membership) | OPEN | Medium | ❌ Not found |

---

## Backlog Verification

**Backlog Source**: `docs/layer1-backlog.md`

Checked for stories/tasks addressing the identified follow-up items:

- E2-S2 (Issue #14): Covers placement and self-edit but does not explicitly define throttle policy limits
  - Line reference: `docs/layer1-backlog.md:132-144`
  - Status: Ambiguity remains on exact throttle values

- E2-S3 (Issue #15): Snapshot and replay recovery complete
  - Line reference: `docs/layer1-backlog.md:147-159`
  - Status: No explicit follow-up items documented

- E2-S4 (Issue #16): Region diff retrieval API
  - Line reference: `docs/layer1-backlog.md:163-176`
  - Status: Ambiguities noted in plan logs (delete semantics, limits, authz scope) not addressed in backlog

---

## Recommendations

1. **High Priority** (Blocks shipping): 
   - Formalize placement throttle policy (DR-03 #14) and add to backlog as a refined story
   - Define viewport/payload limits and add to backlog (DR-02 #16)

2. **Medium Priority** (Quality/Completeness):
   - Document delete semantics for region diffs (DR-01 #16)
   - Clarify authorization scope and membership checks (DR-03 #16)
   - Formalize JWT claim contract for operator role (DD-02 #15)

3. **Lower Priority** (Polish):
   - Test database availability handling strategy (DR-04 #14)
   - Benchmark performance baseline for load scenarios (DD-02 #16)

---

## Evidence Links

- **Epic 1 completion**: `/memories/repo/phase1-tile-persistence-complete.md`
- **Epic 2 PR**: GitHub PR #82 (dkirby-ms/tile-fighter)
- **Backlog**: `docs/layer1-backlog.md`
- **CI notes**: `/memories/repo/ci-notes.md`
