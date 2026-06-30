<!-- markdownlint-disable-file -->
# Task Research: E3-S4 50 CCU and Latency Budget Validation

Research for story #20: validate 50 CCU and placement ack latency under 200 ms median, with p95 reconnect under 3 seconds, load-run telemetry, and release-candidate blocking on budget regression.

## Task Implementation Requests

* Determine the current load harness and metrics export pipeline for 50 CCU validation
* Identify where placement ack latency and reconnect p95 can be measured and reported
* Determine how budget regression should block release candidates in the current repo
* Assess security/abuse handling for isolated synthetic credentials during load runs
* Recommend one implementation path for story #20 and note viable alternatives

## Scope and Success Criteria

* Scope: server load harness, integration metrics ingestion, smoke load sanity, telemetry events, and gating/blocking logic for latency budgets
* Assumptions:
  * Story #20 builds on E3-S2 and E3-S3 server-side work
  * Existing test/load infrastructure is the primary implementation surface
  * Synthetic credentials and telemetry sinks already exist in some form
* Success Criteria:
  * 50 CCU load path and metrics collection are mapped to concrete files and tests
  * Placement ack latency and reconnect p95 measurement points are identified
  * A clear blocking mechanism for budget regression is described
  * Recommendations are grounded in codebase evidence, not speculation

## Outline

1. Story requirements and acceptance criteria
2. Current load harness and metrics pipeline analysis
3. Telemetry and gating options
4. Recommended approach and implementation sequence
5. Risks, gaps, and follow-up questions

## Potential Next Research

* Confirm where 50 CCU load orchestration is defined and how it is parameterized
  * Reasoning: acceptance criteria mention a 50 CCU / 30 min run, which likely maps to an existing load harness entrypoint
  * Reference: apps/server/tests/load/

* Find the current reconnect latency metric source and aggregation path
  * Reasoning: p95 reconnect under 3s must be measurable in code or test outputs
  * Reference: apps/server/src/session/, apps/server/tests/load/

* Verify whether any release-candidate blocking or budget-regression gating already exists
  * Reasoning: the story explicitly requires blocking the RC on regression
  * Reference: docs/, apps/server/src/telemetry/

## Research Executed

### File Analysis

* [apps/server/package.json](apps/server/package.json)
  * Defines `test:load` as `vitest run tests/load`, which is the current entrypoint for server load scenarios.

* [apps/server/tests/load/room-join-load.ts](apps/server/tests/load/room-join-load.ts)
  * Exercises placement contention and heartbeat throttling with fixed local constants (`attempts = 12`, `burst = 40`) rather than a sustained CCU parameter.
  * Uses `process.stdout.write` and in-memory assertions only; no artifact output or workflow gate is present here.

* [apps/server/tests/load/join-rejoin-load.ts](apps/server/tests/load/join-rejoin-load.ts)
  * Measures reconnect latency with `Date.now()` around the reconnect call and prints a p95 summary to stdout.
  * This is the closest existing reconnect p95 measurement path.

* [apps/server/tests/load/region-diff-load.ts](apps/server/tests/load/region-diff-load.ts)
  * Measures request latency with `Date.now()` around the HTTP call and prints p95 summaries.
  * Useful as a template for percentile reporting but not a 50 CCU harness.

* [apps/server/src/session/session-checkpoint.service.ts](apps/server/src/session/session-checkpoint.service.ts)
  * Emits reconnect/replay telemetry, but the currently verified durations are placeholders (`durationMs: 0`, `reconnectLatencyMs: 0`).

* [apps/server/src/telemetry/telemetry-sink.ts](apps/server/src/telemetry/telemetry-sink.ts)
  * Supports arbitrary telemetry events through `emit(...)` and already defines placement / reconnect / delta event families.
  * No verified `load_run_started`, `load_run_completed`, or `latency_budget_violation` helper exists.

* [.github/workflows/nonprod-load.yml](.github/workflows/nonprod-load.yml)
  * Runs `npm run -w @game/server test:load` with `LOAD_JOIN_COUNT=25` for non-production validation.
  * Shows the current load harness is workflow-driven, not a generic CCU-duration runner.

* [.github/workflows/verify-release.yml](.github/workflows/verify-release.yml)
  * Runs the load test, reads `artifacts/verify-room-join-metrics.json`, and fails promotion when `p50Ms > 5000`.
  * This is the repo’s clearest release-candidate blocking pattern.

* [docs/cicd-harness.md](docs/cicd-harness.md)
  * Documents the same artifact-based p50 gate for release verification.

* [.github/workflows/ci.yml](.github/workflows/ci.yml)
  * Confirms workflow-level gating conventions already exist for lint, test, build, and audit failures.

### Code Search Results

* `LOAD_JOIN_COUNT`
  * Appears in [.github/workflows/nonprod-load.yml](.github/workflows/nonprod-load.yml) and [.github/workflows/verify-release.yml](.github/workflows/verify-release.yml) as a fixed workflow knob.

* `p50Ms`
  * Appears in [.github/workflows/verify-release.yml](.github/workflows/verify-release.yml) and [docs/cicd-harness.md](docs/cicd-harness.md) as the verification artifact threshold.

* `reconnectLatencyMs` / `durationMs`
  * Present in [apps/server/src/session/session-checkpoint.service.ts](apps/server/src/session/session-checkpoint.service.ts), but currently emitted as zero-valued placeholders.

### External Research

* Not required. Repository evidence was sufficient to determine the best implementation path.

### Project Conventions

* Standards referenced: TypeScript monorepo server patterns, workflow artifact gates, load tests under `apps/server/tests/load`, generic telemetry sink event emission.
* Instructions followed: Task Researcher mode constraints, markdownlint-disable-file for tracking artifacts

## Key Discoveries

### Project Structure

* The current server test/load entrypoint already exists, so E3-S4 can be implemented without adding a new test framework.
* Existing load scenarios are narrow and scenario-specific; there is no sustained CCU runner yet.
* Release blocking is already done via workflow artifact checks, so the new budget gate should reuse that convention.

### Implementation Patterns

* Load tests currently time requests locally with `Date.now()` and print summaries to stdout.
* Telemetry is available as a generic sink, but load-specific events are not modeled yet.
* The reconnect service currently emits latency-shaped telemetry with placeholder durations, so producer-level budget reporting should be added rather than inferred from those events.

### Complete Examples

```ts
// Current release gate pattern in verify-release.yml
const evidence = JSON.parse(fs.readFileSync("artifacts/verify-room-join-metrics.json", "utf8"));
if (evidence.p50Ms > 5000) {
  throw new Error(`Playable-shell p50 regression: expected <= 5000ms, got ${evidence.p50Ms}ms`);
}
```

### API and Schema Documentation

* No new API schema is required for the research conclusion itself.
* The selected implementation path depends on load-test artifact generation and workflow gating, not on new product endpoints.

### Configuration Examples

```yaml
LOAD_CCU: 50
LOAD_DURATION_MINUTES: 30
LOAD_EVIDENCE_PATH: artifacts/e3-s4-latency-budget.json
```

## Technical Scenarios

### 50 CCU Load Run and Latency Budget Validation

Story #20 needs a load harness that can run 50 synthetic clients long enough to collect median placement ack latency and p95 reconnect latency, then surface a budget failure strongly enough to block a release candidate.

**Requirements:**

* Run 50 CCU for 30 minutes
* Measure placement ack median under 200 ms
* Measure reconnect p95 under 3 seconds
* Emit load-run start/completion and budget-violation telemetry
* Ensure load traffic uses isolated synthetic credentials

**Preferred Approach:**

* Add a dedicated sustained load test under `apps/server/tests/load/` that accepts environment-driven CCU and duration values, measures placement ack and reconnect latencies with local timing, and writes a percentile evidence artifact.
* Reuse the existing verify-release workflow pattern to fail promotion when the evidence artifact violates the latency budget.

```text
apps/server/tests/load/
  e3-s4-latency-budget.load.ts
.github/workflows/verify-release.yml
docs/cicd-harness.md
```

**Implementation Details:**

1. Keep measurement close to the load harness instead of moving timing into the server telemetry path first.
2. Parameterize the sustained run with `LOAD_CCU` and `LOAD_DURATION_MINUTES` environment variables.
3. Emit `load_run_started` and `load_run_completed` events or equivalent telemetry fields from the load job.
4. Write an evidence artifact with sample counts and percentiles, then gate release verification the same way `p50Ms` is already gated.
5. If the server-side telemetry path needs richer durations later, add it after the load gate is stable.

```ts
// Recommended shape for the sustained load runner
const ccu = Number(process.env.LOAD_CCU ?? "50");
const durationMinutes = Number(process.env.LOAD_DURATION_MINUTES ?? "30");
const evidencePath = process.env.LOAD_EVIDENCE_PATH ?? "artifacts/e3-s4-latency-budget.json";
```

#### Considered Alternatives

* Extend `apps/server/tests/load/room-join-load.ts`
  * Good for placement contention, but it is still a small fixed-scenario test rather than a sustained CCU runner.

* Extend `apps/server/tests/load/join-rejoin-load.ts`
  * Good for reconnect p95, but it does not cover placement ack latency.

* Parse stdout only
  * Lowest effort, but weaker than artifact-based gating and inconsistent with the repo’s existing release verification pattern.

## Remaining Gaps

* No dedicated sustained 50 CCU / 30 minute harness exists yet.
* No verified `load_run_started`, `load_run_completed`, or `latency_budget_violation` telemetry helper exists yet.
* No measured reconnect duration is persisted in server telemetry; current reconnect telemetry uses zero placeholders.
* No documented dashboard or metrics sink beyond the generic telemetry endpoint is present in the repo evidence.

## Selected Approach and Rationale

The best fit is a dedicated sustained load harness under `apps/server/tests/load/` plus a workflow gate that fails on artifact evidence, reusing the existing verify-release convention.

Why this is the right choice:

* It covers both required budget dimensions: placement ack latency and reconnect p95.
* It fits the current repo shape: load tests already live under `apps/server/tests/load/`, and release verification already blocks on an artifact threshold.
* It avoids overloading existing smoke tests with a new operational role they are not designed to carry.
* It keeps the release-candidate blocking rule reviewable and consistent with current CI practice.

### Suggested Implementation Sequence

1. Add the sustained runner and environment parameters.
2. Measure and aggregate placement ack and reconnect latencies locally in the load job.
3. Emit telemetry or artifact records for load start/completion and budget violations.
4. Hook the new artifact into the verification workflow with a hard fail threshold.
5. Add a small smoke sanity run only if the sustained runner needs a fast preflight.
