---
applyTo: '.copilot-tracking/changes/2026-06-30/epic3-pr-feedback-remediation-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Epic3 PR Feedback Remediation

## Overview

Implement targeted server-side fixes and tests to close critical/high/medium PR feedback findings for fanout correctness, cap recovery behavior, and runtime configuration wiring.

## Objectives

### User Requirements

* Plan out implementation work for PR feedback from epic3 handoff. — Source: User request in chat (2026-06-30)
* Address the four direct feedback comments with actionable implementation sequencing. — Source: `.copilot-tracking/pr/review/epic3/handoff.md`

### Derived Objectives

* Add explicit phase-level validation for server workspace and workspace-wide checks. — Derived from: repository scripts and prior CI reliability notes in `/memories/repo/ci-notes.md`
* Record scope-bounded decisions and deferred items in discrepancy tracking. — Derived from: Task Planner quality requirements and handoff backlog follow-up

## Context Summary

### Project Files

* `apps/server/src/http/app.ts` - Placement mutation path and delta publish dispatch wiring.
* `apps/server/src/rooms/arena.room.ts` - Room lifecycle and fanout coordinator/registry behavior.
* `apps/server/src/domain/delta-fanout.service.ts` - Delta send eligibility and outbound cap handling.
* `apps/server/src/index.ts` - Bootstrap dependency composition and runtime config pass-through.
* `apps/server/tests/unit/delta-fanout.service.test.ts` - Unit coverage for fanout cap behavior.
* `apps/server/tests/integration/realtime-delta-fanout.integration.test.ts` - Integration fanout delivery coverage.

### References

* `.copilot-tracking/pr/review/epic3/handoff.md` - PR review findings and severity.
* `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` - Consolidated planning research.
* `.copilot-tracking/research/subagents/2026-06-30/epic3-pr-feedback-scope-research.md` - File-level discovery and test command verification.

### Standards References

* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md` — Tracking markdown conventions for `.copilot-tracking` artifacts.
* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md` — Technical writing clarity and consistency.

## Implementation Checklist

### [x] Implementation Phase 1: Wire replay-window runtime config

<!-- parallelizable: true -->

* [x] Step 1.1: Wire replay-window runtime config in server bootstrap
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 16-40)
* [x] Step 1.2: Add targeted replay-window wiring test
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 42-61)
* [x] Step 1.3: Validate phase changes
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 63-70)

### [x] Implementation Phase 2: Restore fanout registry and dispatch wiring

<!-- parallelizable: false -->

* [x] Step 2.1: Wire room lifecycle registry registration and cleanup
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 76-101)
* [x] Step 2.2: Fix HTTP placement publish inputs and sender callback
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 103-129)
* [x] Step 2.3: Add and update targeted tests for fanout wiring
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 131-152)
* [x] Step 2.4: Validate phase changes
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 154-162)

### [x] Implementation Phase 3: Implement outbound cap reset and tests

<!-- parallelizable: false -->

* [x] Step 3.1: Implement outbound cap reset-window recovery semantics
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 168-193)
* [x] Step 3.2: Update cap tests and integration verification
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 195-215)
* [x] Step 3.3: Validate phase changes
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 217-226)

### [x] Implementation Phase 4: Validation

<!-- parallelizable: false -->

* [x] Step 4.1: Run full project validation
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 232-240)
* [x] Step 4.2: Fix minor validation issues
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 242-244)
* [x] Step 4.3: Report blocking issues
  * Details: `.copilot-tracking/details/2026-06-30/epic3-pr-feedback-remediation-details.md` (Lines 246-252)

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-30/epic3-pr-feedback-remediation-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* `@game/server` workspace scripts for lint/build/test execution.
* Existing room/fanout integration contract between HTTP path and room lifecycle.
* Runtime environment configuration parsing in server bootstrap.

## Success Criteria

* All four direct PR findings in handoff are covered by planned code/test changes. — Traces to: `.copilot-tracking/pr/review/epic3/handoff.md`
* Fanout registry and publish wiring path is verifiably functional through automated tests. — Traces to: `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md`
* Outbound cap behavior includes recovery semantics aligned with selected implementation path. — Traces to: `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` (Planning Decisions for Implementation)
* Runtime replay-window override is passed through bootstrap composition and validated. — Traces to: index.ts finding in handoff and research
* Deferred environment-backed latency gate is tracked as follow-on work outside current scope. — Traces to: DR-01 in planning log
