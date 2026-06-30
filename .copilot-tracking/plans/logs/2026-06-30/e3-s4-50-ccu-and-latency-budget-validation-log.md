<!-- markdownlint-disable-file -->
# Planning Log: E3-S4 50 CCU and Latency Budget Validation

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None currently. The updated plan covers the placement acknowledgement timing-boundary confirmation work inside the dedicated harness measurement step.

### Plan Deviations from Research

* None currently. The plan follows the research recommendation to measure budgets in the harness, preserve secret separation, and gate release verification with artifact-backed thresholds.

## Implementation Paths Considered

### Selected: Dedicated Sustained Harness with Artifact-Based Workflow Gate

* Approach: add a new sustained load test for E3-S4, emit evidence JSON and load telemetry, and extend the existing nonprod and verify-release workflows to consume that evidence
* Rationale: It covers both required budget dimensions and matches the repo's existing artifact-based promotion gate pattern
* Evidence: .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md

### IP-01: Extend join-rejoin-load.ts and room-join-load.ts in place

* Approach: fold 50 CCU duration logic into the existing reconnect and join smoke scenarios
* Trade-offs: lower file count, but mixes sustained validation with narrow smoke coverage and makes environment-driven orchestration harder to reason about
* Rejection rationale: the current files are short, scenario-specific tests and not a good long-duration harness boundary

### IP-02: Gate release on stdout parsing only

* Approach: keep load tests printing percentile summaries and parse stdout in workflows rather than writing JSON evidence
* Trade-offs: fastest implementation, but fragile parsing and inconsistent with the repo's existing evidence-file gate
* Rejection rationale: artifact-based gating is already established in verify-release and is more reliable for promotion blocking

## Suggested Follow-On Work

* WI-01: Repair server-side reconnect duration telemetry
  * Source: apps/server/src/session/session-checkpoint.service.ts placeholder duration fields identified in research
  * Dependency: E3-S4 harness gate completion
  * Description: Replace zero-value reconnect and replay telemetry placeholders with measured durations so runtime telemetry can corroborate harness evidence

* WI-02: Add workflow artifact upload and retention policy for E3-S4 evidence
  * Source: planned workflow gating relies on a local artifact file but upload/retention behavior is not yet guaranteed by the selected implementation path
  * Dependency: Phase 3 implementation
  * Description: Persist E3-S4 evidence as a GitHub Actions artifact for audit and rollback review

* WI-03: Add fast smoke preflight for sustained load configuration
  * Source: research notes a small smoke sanity run may help before the full 30 minute execution
  * Dependency: sustained harness completion and timing baseline confidence
  * Description: Add a short preflight scenario to catch broken credentials or endpoints before the full budget run starts