<!-- markdownlint-disable-file -->
# Implementation Details: E4-S2 Local Bond Recompute Coordinator

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md; .copilot-tracking/research/2026-06-30/e4-deterministic-bonding-and-task1-research.md; docs/layer1-backlog.md; apps/server/src/http/app.ts; apps/server/src/persistence/tile.repository.ts; apps/server/src/domain/delta-fanout.service.ts; apps/server/tests/load/placement-conflict-hotspot.load.ts

## Implementation Phase 1: Queue Coordinator and Server Wiring

<!-- parallelizable: false -->

### Step 1.1: Add a server-side BondRecomputeCoordinator with coalescing and last-emitted fingerprint suppression

Create a dedicated in-memory coordinator in the server domain that accepts placement-complete events, coalesces pending work by region plus affected local cell, drains work on a bounded loop, and suppresses duplicate bond publications when the fingerprint for a key has not changed. Keep the coordinator focused on queue state, dedupe, and telemetry callbacks so the pure bond evaluator remains unchanged in packages/shared-types.

Files:
* apps/server/src/domain/bond-recompute-coordinator.ts - New coordinator, queue state, dedupe fingerprint cache, and bounded drain loop
* apps/server/src/domain/index.ts - Export the coordinator if a central domain barrel is present or introduced during the change

Discrepancy references:
* Addresses DD-01 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by selecting a server-side queue coordinator instead of reusing the outbound fanout service
* Addresses DD-02 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by choosing a coalescing region-local-cell key rather than a raw FIFO of placements

Success criteria:
* The coordinator accepts enqueue requests and can drain them deterministically in unit tests
* Repeated enqueue calls for the same key are coalesced instead of creating duplicate pending entries
* The coordinator records skip behavior when the last-emitted fingerprint matches the current recompute result

Context references:
* apps/server/src/domain/delta-fanout.service.ts (Lines 62-181, 214-259) - Closest bounded queue and cleanup analogue
* .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md (Recommended implementation path) - Queue shape, dedupe, and telemetry guidance
* docs/layer1-backlog.md (Lines 264-271) - Story-level recompute and no-redundant-event requirements

Dependencies:
* The pure evaluator exported from packages/shared-types/src/bonding.ts remains available
* The server can pass the region id, cell coordinates, and request identity into the coordinator

### Step 1.2: Thread recompute enqueue calls through the authoritative placement success path and wire queue limits from server bootstrap

Refactor the current placement success branch so it enqueues a recompute job after the tile commit succeeds instead of performing the recompute inline. Pass the placement metadata required to resolve the local neighborhood, and wire queue limits from environment/config into the coordinator during server initialization so the queue can enforce a maximum pending depth, drain batch size, and maximum wait time.

Files:
* apps/server/src/http/app.ts - Replace the inline bond recompute call with enqueue logic against the coordinator
* apps/server/src/index.ts - Instantiate the coordinator and pass the queue limits during bootstrap
* apps/server/src/config/env.ts - Add environment schema entries for the recompute queue limits and flood-protection settings

Discrepancy references:
* Addresses DD-03 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by moving recompute off the request-critical path while keeping placement authoritative
* Addresses DD-04 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by wiring explicit queue limits rather than relying on implicit in-memory behavior

Success criteria:
* Successful placements enqueue recompute work only after commit success
* The coordinator is created once at server startup and re-used for all placements
* Queue limits are configurable without changing the coordinator call sites

Context references:
* apps/server/src/http/app.ts (Lines 196-245) - Current placement success path
* apps/server/src/persistence/tile.repository.ts (Lines 920-956) - Local orthogonal neighborhood helper used by the worker
* apps/server/src/index.ts (Lines 103-139) - Bootstrap wiring location

Dependencies:
* Step 1.1 completion
* The server bootstrap already exposes telemetrySink, db, and tileRepository to the HTTP app

### Step 1.3: Validate phase changes

Run targeted lint and build checks for the new coordinator, HTTP wiring, and environment/bootstrap changes before expanding to the test suites.

Validation commands:
* npm run -w @game/server lint - Server lint for the coordinator and wiring changes
* npm run -w @game/server build - Server TypeScript build for the new coordinator path

## Implementation Phase 2: Telemetry, Tests, and Load Validation

<!-- parallelizable: true -->

### Step 2.1: Add recompute telemetry and flood-protection hooks at the server edge

Extend the telemetry sink with bond recompute lifecycle events for started, completed, and skipped outcomes. Use those events to report queue depth, lag timing, and skip reasons from the coordinator. Add the server-edge flood-protection check so the enqueue path respects the story requirement for account/IP abuse control while leaving the existing placement throttle behavior intact.

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add emitBondRecalcStarted, emitBondRecalcCompleted, and emitBondRecalcSkipped helpers
* apps/server/src/http/app.ts - Apply queue-ingress flood protection before enqueueing recompute work

Discrepancy references:
* Addresses DD-05 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by adding explicit recompute telemetry instead of reusing bonding_triggered alone
* Addresses DD-06 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by distinguishing queue flood protection from the placement throttle window

Success criteria:
* Each recompute lifecycle event is emitted with stable field ordering
* Flood-protection rejections are observable without enqueueing work
* The new telemetry does not alter the existing placement success response shape

Context references:
* apps/server/src/telemetry/telemetry-sink.ts (Lines 117-172) - Existing bond and throttle telemetry surface
* apps/server/src/http/app.ts (Lines 264-306) - Existing throttle-map pattern in the HTTP edge
* docs/layer1-backlog.md (Lines 264-271) - Recompute telemetry and abuse constraints

Dependencies:
* Step 1.2 completion

### Step 2.2: Add unit coverage for queue coalescing, skip behavior, and lag-bound invariants

Create unit tests for the coordinator that prove coalescing, bounded draining, and duplicate suppression. Include cases for repeated enqueue of the same region-local cell key, unchanged fingerprint skips, full-queue behavior, and stable queue depth accounting under repeated calls.

Files:
* apps/server/tests/unit/bond-recompute-coordinator.test.ts - New unit suite for queue behavior and skip invariants

Discrepancy references:
* Addresses DD-07 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by turning the queue-lag requirement into testable invariants

Success criteria:
* Same-key enqueues collapse to one pending unit of work
* Unchanged fingerprints produce a skipped recompute outcome
* Queue accounting remains deterministic across repeated runs

Context references:
* apps/server/tests/unit/delta-fanout.service.test.ts (Lines 186-259) - Bounded timing and cleanup pattern to mirror
* apps/server/tests/unit/tile.repository.telemetry.test.ts (Lines 6-146) - Deterministic telemetry assertion style

Dependencies:
* Step 1.1 completion

### Step 2.3: Add integration coverage for repeated placements and no-redundant-event behavior

Add an integration suite that places tiles through the authoritative server path, waits for the recompute worker to drain, and asserts that identical adjacency state does not emit repeated bond events. Cover both a successful initial recompute and a repeated placement or replay that should collapse into a skip.

Files:
* apps/server/tests/integration/tile-bonding-recompute.integration.test.ts - New placement-triggered recompute integration suite

Discrepancy references:
* Addresses DD-08 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by proving no redundant bond publication under repeated state

Success criteria:
* A placement triggers exactly one recompute result for the affected local cell set
* Reprocessing the same state produces a skip rather than a second bond emission
* The integration test remains deterministic across repeated runs

Context references:
* apps/server/src/http/app.ts (Lines 196-245) - Placement success branch under test
* .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md (Likely test additions) - Integration coverage recommendation

Dependencies:
* Steps 1.1 and 1.2 completion

### Step 2.4: Add burst-load coverage for queue lag and skip rate

Adapt the existing burst-contention load pattern into a recompute-focused load harness that measures enqueue-to-drain latency, skip rate, and queue depth under sustained placement bursts. Use the same deterministic load style already used for placement and reconnect pressure tests.

Files:
* apps/server/tests/load/tile-bond-recompute.load.ts - New load scenario for burst recompute lag and skip-rate measurement

Discrepancy references:
* Addresses DD-09 in .copilot-tracking/plans/logs/2026-06-30/e4-s2-local-recompute-log.md by defining a measurable lag budget for the story

Success criteria:
* Burst load collects a queue-lag metric and a skip-rate metric
* Sustained placement bursts do not cause unbounded queue growth
* The harness is safe to run alongside the existing load suite

Context references:
* apps/server/tests/load/placement-conflict-hotspot.load.ts (Lines 17-217) - Burst-contention shape to adapt
* .copilot-tracking/research/2026-06-30/e4-s2-local-recompute-research.md (Likely test additions) - Load validation recommendation

Dependencies:
* Steps 1.1 and 1.2 completion

### Step 2.5: Validate phase changes

Run the focused unit, integration, and load checks for the recompute path before the final validation sweep.

Validation commands:
* npm run -w @game/server test -- bond-recompute-coordinator - Unit coverage for queue coalescing and skip behavior
* npm run -w @game/server test -- tile-bonding-recompute.integration - Integration coverage for no-redundant-event behavior
* npm run -w @game/server test -- tile-bond-recompute.load - Load coverage for burst-lag measurement

## Implementation Phase 3: Final Validation

<!-- parallelizable: false -->

### Step 3.1: Run full project validation

Execute the repository lint, build, and relevant test suites so the recompute coordinator is validated end to end.

Validation commands:
* npm run lint - Repository-wide lint sweep
* npm run build - Repository-wide build sweep if present
* npm run test - Full workspace test sweep

### Step 3.2: Fix minor validation issues

Resolve small lint, type, or test failures directly when they are local to the recompute coordinator, telemetry sink, HTTP wiring, or new tests. Keep broader follow-on work in the planning log instead of widening scope here.

### Step 3.3: Report blocking issues

Document any unresolved queue-shape, lag-metric, or flood-protection questions that require additional research or product input before the next iteration.

## Dependencies

* apps/server/src/http/app.ts
* apps/server/src/config/env.ts
* apps/server/src/index.ts
* apps/server/src/telemetry/telemetry-sink.ts
* apps/server/src/domain/delta-fanout.service.ts
* apps/server/src/persistence/tile.repository.ts
* apps/server/tests/unit
* apps/server/tests/integration
* apps/server/tests/load

## Success Criteria

* The coordinator coalesces repeated recompute work and suppresses duplicate bond publication when the adjacency fingerprint is unchanged
* Queue telemetry records started, completed, and skipped states with a measurable lag definition
* Unit, integration, and load suites demonstrate bounded queue behavior under burst placement without introducing nondeterministic failures