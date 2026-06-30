---
title: E3-S4 50 CCU and Latency Budget Validation Subagent Research
description: Verified evidence for story #20 load harness, latency measurement points, telemetry sinks, release blocking, and implementation options.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
keywords:
	- 50 CCU
	- latency budget
	- load testing
	- reconnect
	- telemetry
estimated_reading_time: 10
---

## Research Questions

1. Where is the 50 CCU load harness defined, and how is CCU / duration parameterized?
2. Where are placement ack latency and reconnect latency currently measured, aggregated, or logged?
3. What telemetry events or metrics sinks already exist for load_run_started, load_run_completed, latency_budget_violation, or close equivalents?
4. How could a budget regression block a release candidate in the current repo conventions?
5. What are the exact files/paths and any relevant line references for the best implementation path?
6. What alternatives exist, and which one is recommended?

## Verified Findings

### 1) Current 50 CCU load harness state

There is no dedicated sustained 50 CCU / 30 minute harness in the repo today.

The closest existing load entrypoints are:

* apps/server/tests/load/room-join-load.ts:26-138
	* 12 concurrent placement attempts against one coordinate
	* 40 concurrent heartbeat requests
	* Uses fixed local constants `attempts = 12` and `burst = 40`
	* Reports only via `process.stdout.write` and in-memory assertions

* apps/server/tests/load/join-rejoin-load.ts:18-134
	* 100 reconnect attempts via `totalReconnects = 100`
	* Measures reconnect latency with `const reconnectStart = Date.now()` and `latencyMs: Date.now() - reconnectStart`
	* Prints a p95 summary to stdout

* apps/server/tests/load/region-diff-load.ts:18-141
	* 60 concurrent requests via `totalRequests = 60`
	* Uses `staleRatio = 0.65`
	* Measures request latency with `Date.now()` around the HTTP call and prints p95 summaries

The server workspace exposes the load script entrypoint at apps/server/package.json:12-14:

* `test:load`: `vitest run tests/load`

Current workflows parameterize load runs only through environment variables, not a generic CCU/duration contract:

* .github/workflows/verify-release.yml:190-219 sets `LOAD_JOIN_COUNT=5`, `LOAD_ROOM_KEY=arena`, and `LOAD_EVIDENCE_PATH=artifacts/verify-room-join-metrics.json`
* .github/workflows/nonprod-load.yml:47-52 sets `LOAD_JOIN_COUNT=25`

There is no repo evidence for `CCU`, `LOAD_CCU`, `LOAD_DURATION_MINUTES`, or a similar sustained-run parameter today.

### 2) Placement ack and reconnect latency measurement

Placement ack latency is currently measured only ad hoc inside load tests, not in a server telemetry event or persisted metrics stream.

* apps/server/tests/load/region-diff-load.ts:101-123 measures HTTP round-trip latency for region diff requests with `const start = Date.now()` and `const latencyMs = Date.now() - start`
* apps/server/tests/load/join-rejoin-load.ts:97-110 measures reconnect latency with `const reconnectStart = Date.now()` and `latencyMs: Date.now() - reconnectStart`
* apps/server/tests/load/join-rejoin-smoke.test.ts:64-86 measures reconnect latency in a smoke test and enforces a 500 ms SLA

Reconnect latency is also present in server telemetry shape, but the current implementation writes zero-valued placeholders rather than measured durations:

* apps/server/src/session/session-checkpoint.service.ts:322-337 emits `reconnect_delta_replay_completed` with `durationMs: 0` and `room_rejoined` with `reconnectLatencyMs: 0`

Placement-related server telemetry exists, but it records placement outcome, not elapsed latency:

* apps/server/src/http/app.ts:152-183 emits `tile_place_rejected` and `tile_placed`
* apps/server/src/http/app.ts:235-251 emits `tile_place_throttled`

### 3) Existing telemetry events and sinks

The telemetry sink is generic and already supports arbitrary event names through `TelemetrySink.emit(...)`:

* apps/server/src/telemetry/telemetry-sink.ts:9-45

Existing event families that are relevant to this story include:

* Session lifecycle events: `room_joined`, `session_heartbeat`, `session_ended`, `presence_cleared`
	* apps/server/src/session/session-lifecycle.service.ts:58-116 and 135-151

* Reconnect / replay events: `reconnect_delta_replay_started`, `reconnect_delta_replay_completed`, `room_rejoined`, `room_rejoin_failed`
	* apps/server/src/session/session-checkpoint.service.ts:287-337

* Delta fanout events: `delta_sent`, `delta_acked`, `delta_retransmitted`
	* apps/server/src/telemetry/telemetry-sink.ts:338-405
	* apps/server/src/rooms/arena.room.ts:128-149

* Tile / placement events: `tile_persisted`, `tile_persist_conflict`, `tile_placed`, `tile_place_rejected`, `tile_place_throttled`, `tile_edited`
	* apps/server/src/telemetry/telemetry-sink.ts:51-228
	* apps/server/src/http/app.ts:152-251

There is no verified existing event named `load_run_started`, `load_run_completed`, or `latency_budget_violation` anywhere in the server source.

Closest equivalents for load-run framing are the existing generic `TelemetrySink.emit(...)` API plus the event families above.

### 4) How a budget regression can block a release candidate today

The repo already has a release-verification gate that fails the workflow when a metric artifact violates threshold.

* .github/workflows/verify-release.yml:190-219 runs `npm run -w @game/server test:load`, reads `artifacts/verify-room-join-metrics.json`, and throws if `p50Ms > 5000`
* docs/cicd-harness.md:198-202 documents the same rule: the workflow writes the artifact and promotion is blocked when `p50Ms` exceeds `5000`

That is the clearest current convention for blocking a release candidate in this repo: make the load job produce an artifact, then have a workflow step fail the job if the budget is exceeded.

CI also already blocks on independent gate failures such as dependency audit and test/build failures:

* .github/workflows/ci.yml:32-47 fails on `npm audit --audit-level=high`, lint, test, or build failure

### 5) Best implementation path

Best path for story #20 is to add a dedicated sustained load test and wire it into the existing verification pattern, rather than overloading the current smoke-style load tests.

Recommended implementation surface:

* New or extended load test under apps/server/tests/load/
* Existing load script entrypoint: apps/server/package.json:12-14
* Existing release gate pattern: .github/workflows/verify-release.yml:190-219

Recommended shape:

* Add a dedicated 50 CCU load file that accepts environment parameters for CCU and duration
* Measure placement ack latency and reconnect latency inside the load test using request start/end timestamps
* Emit a JSON evidence artifact with sample count, percentile values, and pass/fail state
* Fail the test or workflow when latency budget thresholds are violated

### 6) Alternatives

Alternative A: extend apps/server/tests/load/room-join-load.ts

* Pros: closest placement path, already exercises placement contention and heartbeat throttling
* Cons: it is currently a scenario test with fixed small constants, not a sustained CCU runner

Alternative B: extend apps/server/tests/load/join-rejoin-load.ts

* Pros: already computes reconnect p95 from measured latencies
* Cons: it does not cover placement ack latency, so it would still leave half of story #20 uncovered

Alternative C: rely only on workflow parsing of stdout

* Pros: minimal code change
* Cons: weaker than artifact-based gating, harder to review, and less consistent with the existing verify-release evidence artifact pattern

Recommended option: dedicated load test + artifact-based workflow gate, using the verify-release convention as the blocking mechanism.

## Exact Evidence Paths

* apps/server/tests/load/room-join-load.ts:26-138
* apps/server/tests/load/join-rejoin-load.ts:18-134
* apps/server/tests/load/region-diff-load.ts:18-141
* apps/server/tests/load/join-rejoin-smoke.test.ts:64-86
* apps/server/src/http/app.ts:152-251
* apps/server/src/session/session-checkpoint.service.ts:287-337
* apps/server/src/session/session-lifecycle.service.ts:58-116, 135-151
* apps/server/src/telemetry/telemetry-sink.ts:9-45, 51-228, 338-405
* apps/server/package.json:12-14
* .github/workflows/nonprod-load.yml:47-52
* .github/workflows/verify-release.yml:190-219
* docs/cicd-harness.md:198-202
* docs/layer1-backlog.md:34-35, 205-215

## Remaining Gaps

* No sustained 50 CCU / 30 minute harness exists yet.
* No generic load-run telemetry events exist yet.
* No measured reconnect latency is stored in server telemetry; current reconnect telemetry uses zero placeholders.
* No existing metric sink or dashboard is documented for latency budget reporting beyond the generic telemetry sink HTTP endpoint.

## Conclusion

The repo already has the right blocking pattern, but not the right sustained load harness.

The most defensible path is to add a dedicated 50 CCU load scenario under apps/server/tests/load/, parameterize it with environment variables for CCU and duration, emit an artifact with percentile evidence, and gate promotion the same way verify-release currently blocks on `p50Ms`.
