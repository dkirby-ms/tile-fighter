---
applyTo: '.copilot-tracking/changes/2026-06-29/client-entra-auth-coverage-update-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Client Entra Auth Coverage Update

## Overview

Update Layer 1 planning artifacts so client-side Entra login, token lifecycle, and authenticated session API calling are explicit, testable, and traceable across bootstrap, join-token, and heartbeat flows.

## Objectives

### User Requirements

* Update the plan to account for the findings in the client auth gap research. — Source: user request on 2026-06-29.
* Ensure the web client can login to Entra, obtain tokens, and use them with the server. — Source: user request on 2026-06-29.

### Derived Objectives

* Remove ambiguity between E1-S1 and E1-S2 ownership by adding explicit client-authenticated caller story coverage. — Derived from: .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md.
* Define deterministic 401 retry and interactive fallback behavior for client calls to bootstrap, join-token, and heartbeat endpoints. — Derived from: selected approach in research.
* Align story acceptance criteria to existing server auth enforcement and integration test boundaries. — Derived from: evidence in apps/server auth and tests.

## Context Summary

### Project Files

* docs/layer1-backlog.md - Primary story and acceptance criteria source that needs client-auth clarity updates.
* docs/cicd-harness.md - Verification contract that should include client token lifecycle expectations.
* apps/client/src/auth/external-id-session.ts - Existing client token lifecycle state machine reference.
* apps/client/src/session/bootstrap-store.ts - Existing authenticated bootstrap caller reference.
* apps/server/src/http/routes/session.routes.ts - Authenticated bootstrap/join-token/heartbeat server contract reference.

### References

* .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md - Primary research and selected story update approach.
* .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md - Prior plan baseline to extend without regressions.
* .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md - Prior discrepancy/path history relevant to this update.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md — Markdown formatting standards for planning artifacts.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md — Writing standards for planning artifacts.

## Implementation Checklist

### [ ] Implementation Phase 1: Add Client Auth Story Coverage

<!-- parallelizable: false -->

* [ ] Step 1.1: Add explicit story text for client Entra sign-in bootstrap integration behavior (silent acquire, interaction fallback, bounded retry).
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 10-31)
* [ ] Step 1.2: Add explicit story text for authenticated client API caller behavior across bootstrap, join-token, and heartbeat.
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 33-56)
* [ ] Step 1.3: Map acceptance criteria to concrete client and server evidence locations to keep scope testable.
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 58-78)
* [ ] Step 1.4: Promote client test expectations to explicit acceptance criteria coverage for bootstrap, join-token, and heartbeat caller behavior.
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 80-95)

### [ ] Implementation Phase 2: Align Epic Plan and Discrepancy Tracking

<!-- parallelizable: false -->

* [ ] Step 2.1: Update plan language in epic artifacts so client-side bearer behavior is explicit and not implied.
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 84-104)
* [ ] Step 2.2: Record path decisions and remaining risk in planning log entries (DR/DD/WI updates).
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 106-126)

### [ ] Implementation Phase 3: Validation

<!-- parallelizable: false -->

* [ ] Step 3.1: Run full planning validation with Plan Validator and resolve critical/major findings.
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 132-148)
* [ ] Step 3.2: Confirm no unresolved major gap remains for client Entra login/token-to-server usage in planning artifacts.
  * Details: .copilot-tracking/details/2026-06-29/client-entra-auth-coverage-update-details.md (Lines 150-160)

## Planning Log

See .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Existing Layer 1 backlog conventions in docs/layer1-backlog.md.
* Existing E1 epic planning set in .copilot-tracking/plans/2026-06-28/.
* Research findings in .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md.

## Success Criteria

* Planning artifacts explicitly include client-side Entra sign-in and token lifecycle behavior for server calls.
* Planning artifacts define bearer-token requirements for bootstrap, join-token, and heartbeat client requests.
* Planning artifacts define bounded retry and interaction-required fallback behavior.
* Planning artifacts explicitly require client-side test coverage for bearer attachment, bounded 401 retry, and interaction-required terminal state.
* Planning validation returns no critical or major findings for this gap area.
