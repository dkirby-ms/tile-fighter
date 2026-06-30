---
applyTo: '.copilot-tracking/changes/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E3-S4 50 CCU and Latency Budget Validation

## Overview

Add a dedicated sustained load-validation path that measures 50 CCU placement acknowledgement and reconnect latency budgets, emits load-run evidence, and blocks release verification when the recorded budget regresses.

## Objectives

### User Requirements

* Validate 50 CCU load with placement ack median under 200 ms and reconnect p95 under 3 seconds — Source: .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md
* Emit load-run telemetry and fail release-candidate verification when the latency budget regresses — Source: .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md
* Keep synthetic load credentials isolated from normal player traffic — Source: .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md

### Derived Objectives

* Build a dedicated load harness instead of extending the existing smoke scenarios so 50 CCU and 30 minute duration can be parameterized cleanly — Derived from: existing load tests are narrow, fixed-scope scenarios in apps/server/tests/load
* Write an artifact with percentile evidence instead of relying on stdout so the workflow can gate promotion deterministically — Derived from: .github/workflows/verify-release.yml already blocks on JSON evidence
* Add explicit load-run lifecycle and budget-violation telemetry events through the shared telemetry sink so operators can audit scheduled and release validation runs — Derived from: apps/server/src/telemetry/telemetry-sink.ts supports generic event emission but lacks load-run helpers

## Context Summary

### Project Files

* apps/server/tests/load/room-join-load.ts - Current join smoke scenario and evidence-writing pattern anchor for load-oriented assertions
* apps/server/tests/load/join-rejoin-load.ts - Current reconnect p95 measurement pattern using local timing around reconnect calls
* apps/server/src/session/session-checkpoint.service.ts - Current reconnect/replay telemetry producer with zero-value latency placeholders that need verified duration wiring or explicit bypass from harness metrics
* apps/server/src/telemetry/telemetry-sink.ts - Generic telemetry emitter and best insertion point for reusable load-run event helpers
* .github/workflows/nonprod-load.yml - Existing scheduled non-production load workflow and secret contract for synthetic bearer tokens
* .github/workflows/verify-release.yml - Existing artifact-based release verification gate pattern to extend with E3-S4 latency budget enforcement
* docs/cicd-harness.md - CI/CD documentation that must reflect the new evidence artifact, secrets, and blocking thresholds

### References

* .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md - Primary research for implementation path, risks, and alternatives
* /memories/repo/ci-notes.md - Repo memory covering workspace commands, plan traceability, and validation cautions

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Tracking markdown requirements
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Tracking markdown writing conventions

## Implementation Checklist

### [ ] Implementation Phase 1: Build Sustained 50 CCU Evidence Harness

<!-- parallelizable: false -->

* [ ] Step 1.1: Add a dedicated E3-S4 sustained load runner with environment-driven CCU, duration, and artifact output parameters
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 8-40)
* [ ] Step 1.2: Measure placement ack median and reconnect p95 inside the load runner and serialize percentile evidence for workflow consumption
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 42-71)
* [ ] Step 1.3: Add focused harness validation for the new load scenario
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 73-84)

### [ ] Implementation Phase 2: Add Load Telemetry and Synthetic Credential Guardrails

<!-- parallelizable: false -->

* [ ] Step 2.1: Extend telemetry helpers to emit load-run started, load-run completed, and latency-budget violation events
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 88-118)
* [ ] Step 2.2: Ensure the load harness tags synthetic credential provenance and avoids mixing release verification credentials with scheduled nonprod load secrets
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 120-148)
* [ ] Step 2.3: Validate telemetry and guardrail changes without widening to full workflow execution
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 150-161)

### [ ] Implementation Phase 3: Gate Nonprod and Release Verification on Budget Evidence

<!-- parallelizable: true -->

* [ ] Step 3.1: Update scheduled nonprod load workflow to run the sustained E3-S4 scenario with explicit 50 CCU evidence settings
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 165-194)
* [ ] Step 3.2: Extend verify-release workflow to read the new E3-S4 evidence artifact and fail when placement ack median or reconnect p95 exceed budget
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 196-225)
* [ ] Step 3.3: Update CI/CD harness documentation for the new evidence artifact, thresholds, and secret expectations
  * Details: .copilot-tracking/details/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-details.md (Lines 227-243)

### [ ] Implementation Phase 4: Final Validation

<!-- parallelizable: false -->

* [ ] Step 4.1: Run server lint, targeted load tests, and workflow-adjacent artifact validation commands
  * Execute `npm run -w @game/server lint`
  * Execute `npm run -w @game/server test:load`
  * Execute a local artifact assertion command against the generated E3-S4 evidence JSON
* [ ] Step 4.2: Fix minor validation issues discovered in the harness, telemetry, or workflow scripts
  * Iterate on lint, test, and artifact assertion failures when the fixes stay within the planned E3-S4 slice
* [ ] Step 4.3: Report blocking issues that require further research or infrastructure support
  * Document sustained-run blockers such as unavailable synthetic credentials, flaky timing boundaries, or missing telemetry sink endpoints

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Node.js 22 and workspace npm install
* Vitest load test execution in `@game/server`
* Synthetic bearer tokens and websocket endpoints exposed through GitHub environment secrets
* Writable artifact directory for evidence JSON during local and workflow runs

## Success Criteria

* A dedicated sustained load scenario can run with configurable `LOAD_CCU`, `LOAD_DURATION_MINUTES`, and `LOAD_EVIDENCE_PATH` inputs — Traces to: 50 CCU / 30 minute validation requirement
* The load scenario records placement acknowledgement median and reconnect p95 in a JSON artifact — Traces to: latency budget reporting requirement
* Load-run lifecycle and budget violation telemetry are emitted with synthetic-run context — Traces to: telemetry requirement
* Scheduled nonprod load and verify-release workflows both consume the E3-S4 evidence artifact — Traces to: load-run telemetry and gating requirement
* Release verification fails when placement ack median exceeds 200 ms or reconnect p95 exceeds 3000 ms — Traces to: release-candidate blocking requirement
* Documentation reflects the new thresholds, artifacts, and synthetic secret contract — Traces to: operational handoff requirement