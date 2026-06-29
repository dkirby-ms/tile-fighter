---
applyTo: '.copilot-tracking/changes/2026-06-29/epic2-follow-up-missing-elements-remediation-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Epic 2 Follow-Up Missing Elements Remediation

## Overview

Resolve the missing policy, authorization, and contract elements identified in the Epic follow-up audit by formalizing backlog decisions, hardening server enforcement, and validating behavior with targeted and full-suite checks.

## Objectives

### User Requirements

* Plan work to fix missing elements identified in research — Source: user request in this conversation.
* Address unresolved follow-up items from Epic 2 audit across issues #14, #15, and #16 — Source: .copilot-tracking/research/2026-06-29/epic-follow-up-audit.md.

### Derived Objectives

* Convert ambiguous policy items into explicit implementation contracts before coding changes are executed — Derived from: .copilot-tracking/research/subagents/2026-06-29/epic2-follow-up-missing-elements-research.md.
* Sequence security-sensitive work so JWT and membership authorization decisions are locked before final auth test assertions — Derived from: subagent sequencing constraints.
* Preserve local test skip ergonomics while enforcing CI strictness for integration database prerequisites — Derived from: audit DR-04 and /memories/repo/ci-notes.md.
* Structure remediation into parallelizable lanes where files and validation scopes permit independent execution — Derived from: subagent parallelization analysis.

## Context Summary

### Project Files

* docs/layer1-backlog.md - Story acceptance and policy language baseline for E2-S2/E2-S4.
* apps/server/src/config/env.ts - Runtime configuration source for throttle and diff limits.
* apps/server/src/http/routes/tile.routes.ts - Placement command and rejection path enforcement surface.
* apps/server/src/http/routes/region-diff.routes.ts - Diff request validation, authz checks, and payload limits.
* apps/server/src/http/auth-middleware.ts - JWT claim mapping and operator contract enforcement.
* apps/server/src/session/session-lifecycle.service.ts - Candidate membership verification dependency for region authorization.
* apps/server/src/persistence/tile.repository.ts - Delta generation and delete/tombstone write behavior.
* packages/shared-types/src/index.ts - Shared claim and diff contract definitions.
* apps/server/tests/integration/region-diff.integration.test.ts - Diff behavior and authorization integration coverage.
* apps/server/tests/integration/tile-persistence.integration.test.ts - Placement and throttle integration coverage.
* apps/server/tests/unit/auth-middleware.test.ts - Claim contract unit coverage.
* .github/workflows/ci.yml - CI enforcement for DB preconditions and integration test truthfulness.

### References

* .copilot-tracking/research/2026-06-29/epic-follow-up-audit.md - Primary gap inventory and priorities.
* .copilot-tracking/research/subagents/2026-06-29/epic2-follow-up-missing-elements-research.md - Deep technical recommendations and phase split.
* .copilot-tracking/research/2026-06-29/epic2-follow-up-missing-elements-remediation-research.md - Consolidated planning-ready research.
* /memories/repo/ci-notes.md - Verified workspace and CI command semantics.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md — Markdown artifact expectations.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md — Planning writing conventions.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/shared/hve-core-location.instructions.md — Artifact resolution guidance.

## Implementation Checklist

### [x] Implementation Phase 1: Policy and Contract Baseline

<!-- parallelizable: false -->

* [x] Step 1.0: Capture unresolved policy decisions with owners, due dates, and defaults
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 12-31)
* [x] Step 1.1: Refine backlog and docs for explicit unresolved policy decisions
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 32-54)
* [x] Step 1.2: Define shared contract updates for JWT claims and region diff delete/limit semantics
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 55-75)
* [x] Step 1.3: Validate policy and contract baseline
  * Run lint/build checks for changed shared and docs surfaces
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 76-83)

### [x] Implementation Phase 2: Placement and Quality Controls Lane

<!-- parallelizable: false -->

* [x] Step 2.1: Implement configurable placement throttle policy and telemetry rejections
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 88-112)
* [x] Step 2.2: Implement test DB skip strategy standardization with CI guardrails
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 113-136)
* [x] Step 2.3: Validate placement and CI policy lane
  * Run focused tile and CI config checks
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 137-143)

### [x] Implementation Phase 3: Region Diff Correctness and Limits Lane

<!-- parallelizable: false -->

* [x] Step 3.1: Externalize and enforce region diff viewport and payload limits from config
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 149-170)
* [x] Step 3.2: Implement finalized delete/tombstone semantics in persistence and diff assembly
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 172-194)
* [x] Step 3.3: Validate diff correctness and limit controls
  * Run focused diff integration/unit/load tests
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 196-203)

### [x] Implementation Phase 4: Auth Contract and Membership Authorization Lane

<!-- parallelizable: false -->

* [x] Step 4.1: Formalize JWT operator claim contract and transition behavior
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 209-230)
* [x] Step 4.2: Add region membership authorization checks for region diff API
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 232-253)
* [x] Step 4.3: Validate auth and membership lane
  * Run focused auth middleware and region diff authorization tests
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 255-262)

### [x] Implementation Phase 5: Final Validation

<!-- parallelizable: false -->

* [x] Step 5.1: Run full project validation
  * Execute all lint commands, full build, and all tests
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 268-275)
* [x] Step 5.2: Fix minor validation issues
  * Iterate on straightforward lint, type, and test issues only
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 277-279)
* [x] Step 5.3: Report blocking issues and additional planning needs
  * Document blockers that exceed minor corrections
  * Details: .copilot-tracking/details/2026-06-29/epic2-follow-up-missing-elements-remediation-details.md (Lines 281-283)

## Planning Log

See .copilot-tracking/plans/logs/2026-06-29/epic2-follow-up-missing-elements-remediation-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Product/ops alignment inputs for throttle numbers, diff hard limits, and tombstone requirements.
* Existing server workspace commands under @game/server.
* Existing integration DB provisioning path for CI.
* Current route and middleware architecture in apps/server/src/http.

## Success Criteria

* All six unresolved items from the follow-up audit have explicit contract definitions and mapped implementation steps — Traces to: .copilot-tracking/research/2026-06-29/epic-follow-up-audit.md.
* Placement throttling and diff hard limits are configurable, enforced, and covered by tests — Traces to: DR-03 #14 and DR-02 #16.
* JWT claim contract and region diff membership authorization are formalized and validated in unit/integration suites — Traces to: DD-02 #15 and DR-03 #16.
* Delete/tombstone semantics are explicitly implemented or documented as consciously deferred with follow-on backlog items — Traces to: DR-01 #16.
* CI/local test DB skip behavior is documented and enforced so integration skips cannot silently pass as full CI success — Traces to: DR-04 #14.
* Decision-capture gate records owners, due dates, and default implementation behavior for unresolved policy items before enforcement phases begin — Traces to: DR-01 through DR-05 in planning log.
