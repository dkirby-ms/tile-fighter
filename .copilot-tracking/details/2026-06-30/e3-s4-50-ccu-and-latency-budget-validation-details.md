<!-- markdownlint-disable-file -->
# Implementation Details: E3-S4 50 CCU and Latency Budget Validation

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md, apps/server/tests/load/join-rejoin-load.ts, apps/server/tests/load/room-join-load.ts, apps/server/src/telemetry/telemetry-sink.ts, .github/workflows/nonprod-load.yml, .github/workflows/verify-release.yml, docs/cicd-harness.md

## Implementation Phase 1: Build Sustained 50 CCU Evidence Harness

<!-- parallelizable: false -->

### Step 1.1: Add a dedicated E3-S4 sustained load runner with environment-driven CCU, duration, and artifact output parameters

Create a new load scenario under apps/server/tests/load dedicated to story E3-S4 rather than extending the smoke-style join or reconnect scenarios. The runner should accept `LOAD_CCU`, `LOAD_DURATION_MINUTES`, `LOAD_EVIDENCE_PATH`, `LOAD_ROOM_KEY`, and any existing endpoint or bearer-token inputs already used by load tests. Keep setup logic close to the existing load suite so `npm run -w @game/server test:load` remains the primary entrypoint.

Files:
* apps/server/tests/load/e3-s4-latency-budget.load.ts - New sustained load scenario and evidence writer
* apps/server/package.json - Existing `test:load` entrypoint should continue to discover the new file without a new script unless naming or filtering changes are required

Discrepancy references:
* Addresses DR-01 by turning the research-only recommended harness into a concrete implementation surface

Success criteria:
* The load suite includes a dedicated E3-S4 scenario file
* The scenario reads environment variables for CCU, duration, and artifact location with defaults matching the story target
* The scenario can be executed by the existing server `test:load` script without workflow-specific branching

Context references:
* apps/server/tests/load/join-rejoin-load.ts - Existing reconnect p95 measurement pattern and percentile helper
* apps/server/tests/load/room-join-load.ts - Existing load test organization and HTTP request patterns
* apps/server/package.json - Current load test entrypoint

Dependencies:
* Existing load harness utilities and auth setup patterns remain available
* The scenario must preserve current `test:load` workspace behavior

### Step 1.2: Measure placement ack median and reconnect p95 inside the load runner and serialize percentile evidence for workflow consumption

Add percentile collection inside the sustained runner for both required budget dimensions. Placement acknowledgement timing should start immediately before the placement or join/placement-ack request that represents acknowledgement completion and end on the response boundary used by the product contract. Reconnect timing should follow the current `join-rejoin-load.ts` pattern but aggregate over sustained churn instead of a short burst. At the end of the run, write a JSON artifact that includes sample counts, percentile values, configured thresholds, and any useful metadata such as CCU, duration, environment, and timestamp.

Files:
* apps/server/tests/load/e3-s4-latency-budget.load.ts - Measurement boundaries, percentile aggregation, and artifact serialization

Success criteria:
* The evidence artifact contains numeric placement acknowledgement median and reconnect p95 fields
* The artifact includes enough metadata for workflow assertions and post-run debugging
* The measurement path is local to the harness and does not depend on placeholder server telemetry durations

Context references:
* apps/server/tests/load/join-rejoin-load.ts - Existing reconnect timing around the reconnect API
* .github/workflows/verify-release.yml - Existing evidence-reader pattern for JSON gating
* .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md - Selected artifact shape guidance

Dependencies:
* Step 1.1 completion
* Writable artifact directory for local and workflow execution

### Step 1.3: Add focused harness validation for the new load scenario

After the new scenario exists, add or adjust supporting assertions so it fails clearly when required environment inputs are absent or the evidence artifact cannot be written. Keep this validation local to the load scenario or adjacent tests instead of immediately expanding into workflow integration.

Files:
* apps/server/tests/load/e3-s4-latency-budget.load.ts - Input validation and artifact-write assertions

Success criteria:
* Missing required load inputs fail fast with actionable errors
* Artifact output failures surface during local test execution
* The harness remains deterministic enough for CI use with explicit environment overrides

Context references:
* .github/workflows/nonprod-load.yml - Existing secret validation expectations
* .github/workflows/verify-release.yml - Existing artifact-consumption expectations

Dependencies:
* Steps 1.1 and 1.2 completion

## Implementation Phase 2: Add Load Telemetry and Synthetic Credential Guardrails

<!-- parallelizable: true -->

### Step 2.1: Extend telemetry helpers to emit load-run started, load-run completed, and latency-budget violation events

Add reusable helper methods, or a similarly structured typed emission path, to the shared telemetry sink for load-run lifecycle events. These events should record at minimum the scenario name, configured CCU, configured duration, placement acknowledgement median, reconnect p95, evidence path or artifact key, and whether a threshold violation occurred. Prefer helper methods over scattered raw `emit(...)` calls so future load scenarios reuse the same event contract.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - New helper methods for load-run lifecycle and violation events
* apps/server/tests/load/e3-s4-latency-budget.load.ts - Call sites for the new helper methods

Discrepancy references:
* Addresses DR-02 by formalizing the load telemetry event family missing from current code

Success criteria:
* Telemetry sink exposes load-run lifecycle helpers or an equivalent typed contract
* The E3-S4 harness emits a start event and a completion event for each run
* Budget violations emit a distinct event with measured percentile values and thresholds

Context references:
* apps/server/src/telemetry/telemetry-sink.ts - Current generic event emission and existing helper style
* apps/server/src/session/session-checkpoint.service.ts - Existing reconnect telemetry producer using placeholder duration values

Dependencies:
* Step 1.2 completion
* Telemetry sink configuration remains optional or required per existing runtime settings

### Step 2.2: Ensure the load harness tags synthetic credential provenance and avoids mixing release verification credentials with scheduled nonprod load secrets

Use explicit environment naming and artifact metadata so scheduled non-production runs and release verification runs cannot be confused in telemetry or post-run evidence. The plan should preserve the existing secret split between `NONPROD_LOAD_BEARER_TOKEN` and `VERIFY_BEARER_TOKEN`, and the harness should annotate which secret class or provenance label was used without logging the secret itself. If additional metadata is required, add a non-secret environment variable such as synthetic credential provenance or run class.

Files:
* apps/server/tests/load/e3-s4-latency-budget.load.ts - Artifact metadata and telemetry attributes for synthetic credential provenance
* .github/workflows/nonprod-load.yml - Optional non-secret provenance input or explicit scenario env settings
* .github/workflows/verify-release.yml - Optional non-secret provenance input or explicit scenario env settings

Success criteria:
* Evidence and telemetry distinguish scheduled nonprod load from release verification load
* No workflow reuses the wrong bearer-token secret name for the wrong run class
* No secret values are written to artifacts, logs, or telemetry payloads

Context references:
* .github/workflows/nonprod-load.yml - Existing `NONPROD_LOAD_BEARER_TOKEN` contract
* .github/workflows/verify-release.yml - Existing `VERIFY_BEARER_TOKEN` and provenance contract
* docs/cicd-harness.md - Existing verification token provenance documentation

Dependencies:
* Step 2.1 completion for telemetry attributes
* Workflow updates in Phase 3 should preserve the same secret split

### Step 2.3: Validate telemetry and guardrail changes without widening to full workflow execution

Run targeted server lint and load tests with telemetry sink disabled or pointed at a non-blocking endpoint so the new event helpers and provenance tagging can be verified without needing GitHub-hosted workflow infrastructure.

Validation commands:
* `npm run -w @game/server lint`
* `npm run -w @game/server test:load`

Success criteria:
* Telemetry helper changes compile and lint cleanly
* Local load runs can complete with provenance metadata present in the artifact
* No secret-handling regressions are introduced in the workflow env contracts

## Implementation Phase 3: Gate Nonprod and Release Verification on Budget Evidence

<!-- parallelizable: true -->

### Step 3.1: Update scheduled nonprod load workflow to run the sustained E3-S4 scenario with explicit 50 CCU evidence settings

Extend the non-production load workflow so it sets the E3-S4 scenario inputs explicitly. Keep the run bounded by environment variables such as `LOAD_CCU=50`, `LOAD_DURATION_MINUTES=30`, and a dedicated evidence artifact path. If the broader `test:load` entrypoint becomes too wide for the scheduled job, narrow invocation carefully while keeping local discoverability intact.

Files:
* .github/workflows/nonprod-load.yml - Scheduled load workflow inputs and artifact behavior

Success criteria:
* Scheduled nonprod load uses the sustained E3-S4 scenario settings
* The workflow produces a durable evidence artifact or at minimum a file ready for artifact upload
* Synthetic nonprod load secrets remain isolated from release verification secrets

Context references:
* .github/workflows/nonprod-load.yml - Current scheduled load shape
* .copilot-tracking/research/2026-06-30/e3-s4-50-ccu-and-latency-budget-validation-research.md - Recommended `LOAD_CCU` and `LOAD_DURATION_MINUTES` settings

Dependencies:
* Phase 1 completion
* Phase 2 provenance handling available if metadata fields are added

### Step 3.2: Extend verify-release workflow to read the new E3-S4 evidence artifact and fail when placement ack median or reconnect p95 exceed budget

Follow the existing JSON artifact gating pattern in the release verification workflow. After the load step produces the E3-S4 evidence artifact, add an assertion step that validates numeric fields and throws when placement acknowledgement median exceeds 200 ms or reconnect p95 exceeds 3000 ms. Preserve the existing playable-shell smoke gate unless the E3-S4 scenario supersedes part of it explicitly.

Files:
* .github/workflows/verify-release.yml - E3-S4 load invocation inputs and artifact assertion step

Success criteria:
* Release verification reads the E3-S4 evidence JSON reliably
* Verification fails with clear threshold messages for both budget dimensions
* Existing smoke verification remains intact unless intentionally replaced

Context references:
* .github/workflows/verify-release.yml - Existing `verify-room-join-metrics.json` gating step
* docs/cicd-harness.md - Existing documented playable-shell p50 blocking contract

Dependencies:
* Phase 1 evidence artifact shape must be stable
* Phase 2 telemetry work is optional for the gate itself but should already be in place

### Step 3.3: Update CI/CD harness documentation for the new evidence artifact, thresholds, and secret expectations

Revise the harness documentation so operators understand the new latency-budget artifact, the placement and reconnect thresholds, and the distinction between verification and scheduled nonprod synthetic credentials. Update troubleshooting guidance if E3-S4 failures should trigger new incident or rollback handling.

Files:
* docs/cicd-harness.md - Verification contract, artifact, thresholds, and synthetic credential notes

Success criteria:
* Documentation describes the E3-S4 evidence artifact and blocking thresholds
* Documentation preserves the separation between nonprod and verification secret contracts
* Operational triage guidance reflects the new failure mode

Context references:
* docs/cicd-harness.md - Existing verification and nonprod load sections
* .github/workflows/nonprod-load.yml - Nonprod load secret contract
* .github/workflows/verify-release.yml - Verification secret and artifact contract

Dependencies:
* Steps 3.1 and 3.2 completion so the docs match implemented behavior

## Implementation Phase 4: Final Validation

<!-- parallelizable: false -->

### Step 4.1: Run full E3-S4 validation

Execute the narrowest commands that validate the modified implementation slice first, then run any artifact assertion helper used by the workflows.

Validation commands:
* `npm run -w @game/server lint`
* `npm run -w @game/server test:load`
* `node` assertion against the generated E3-S4 evidence artifact mirroring workflow budget checks

### Step 4.2: Fix minor validation issues

Iterate on lint errors, evidence schema mismatches, and targeted load-test failures when the fixes remain inside the harness, telemetry, workflow, or documentation slice planned above.

### Step 4.3: Report blocking issues

If validation exposes sustained-run flakiness, missing credentials, or environment constraints that cannot be addressed as minor fixes, capture them as implementation blockers and propose the next planning or infrastructure step.

## Dependencies

* GitHub Actions environment secrets for nonprod and verification workflows
* Telemetry sink endpoint configuration when telemetry is required
* Server load-test runtime and artifact-write permissions

## Success Criteria

* The implementation can produce and validate E3-S4 evidence locally and in workflows
* Workflow gating enforces the story budget without relying on manual log inspection