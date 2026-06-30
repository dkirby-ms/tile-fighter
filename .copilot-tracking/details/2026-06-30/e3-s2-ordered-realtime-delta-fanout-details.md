<!-- markdownlint-disable-file -->
# Implementation Details: E3-S2 Ordered Realtime Delta Fanout

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md; GitHub issue #18; /memories/repo/ci-notes.md

## Implementation Phase 1: Realtime Delta Protocol and Server Fanout Core

<!-- parallelizable: false -->

### Step 1.1: Define ordered delta envelope and ack payload contracts

Define shared server-side message contracts for outbound realtime deltas and inbound acks. Contract includes sequenceId, regionId, coordinate payload, send timestamp, and retransmit attempt count for observability.

Files:
* apps/server/src/rooms/arena.room.ts - Add typed room message names and payload interfaces for delta fanout and acks
* apps/server/src/domain/delta-fanout.service.ts - New service-level contracts consumed by room and HTTP flow

Success criteria:
* Delta payload includes sequenceId and enough identity to dedupe/apply on client
* Ack payload is minimal and deterministic: session id context plus sequenceId

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 124-180) - Required fanout/ack semantics and envelope behavior

Dependencies:
* Existing room message handling conventions in apps/server/src/rooms/arena.room.ts

### Step 1.2: Implement in-memory ordered fanout coordinator with pending-ack tracking

Create a dedicated fanout coordinator service that tracks pending acks per subscriber and sequence, enforces one retransmit max, and cleans expired pending entries using TTL.

Files:
* apps/server/src/domain/delta-fanout.service.ts - New coordinator implementation for publish, ack, timeout retransmit, and cleanup
* apps/server/src/config/env.ts - Add DELTA_ACK_TIMEOUT_MS, DELTA_RETRANSMIT_MAX_ATTEMPTS, DELTA_ACK_PENDING_TTL_MS, DELTA_OUTBOUND_CAP_PER_CONNECTION

Discrepancy references:
* Supports selected path constraints documented in DR-01 and WI-01 from .copilot-tracking/plans/logs/2026-06-30/e3-s2-ordered-realtime-delta-fanout-log.md

Success criteria:
* Service tracks pending ack state per subscriber without unbounded growth
* Timeout path retransmits once and then marks terminal state for that sequence/subscriber
* Config defaults are explicit and validated at startup

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 101-123) - Proposed config and state-machine behavior

Dependencies:
* Step 1.1 completion

### Step 1.3: Validate phase changes

Run lint and build commands for server files modified in this phase.

Validation commands:
* npm run -w @game/server lint - Server lint scope
* npm run -w @game/server build - Server build scope

## Implementation Phase 2: Server Integration for Ordered Broadcast, Ack Handling, and Telemetry

<!-- parallelizable: true -->

### Step 2.1: Integrate fanout dispatch at committed tile mutation boundary

After successful tile mutation commit, dispatch fanout with canonical sequence from repository mutation result (region version), preserving commit order and avoiding pre-commit fanout.

Files:
* apps/server/src/http/app.ts - Trigger fanout service in placement pipeline after committed mutation response creation
* apps/server/src/persistence/tile.repository.ts - Ensure mutation return type exposes canonical sequence/version for fanout

Discrepancy references:
* Resolves DD-03 traceability by mapping dispatch sequencing work to implementation steps without claiming resolution of DR-02 product SLO decision

Success criteria:
* Fanout always uses committed sequence source from repository response
* No fanout occurs on failed or rolled-back placement attempts

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 145-180) - Sequence authority and dispatch pipeline

Dependencies:
* Implementation Phase 1 completion

### Step 2.2: Wire room subscriber registration, ack message handling, and outbound cap enforcement

Extend room lifecycle to register subscribers with coordinator, accept ack messages, and enforce per-connection outbound cap to protect against abuse.

Files:
* apps/server/src/rooms/arena.room.ts - Subscriber lifecycle registration, ack message handler, and cap checks before send/retransmit

Success criteria:
* Acked entries are removed idempotently even with duplicate ack messages
* Outbound cap guards against flooding and emits controlled reject/backpressure behavior

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 41-99) - Current room gap and required handling

Dependencies:
* Step 2.1 completion

### Step 2.3: Add required telemetry event helpers and emission points

Add typed telemetry methods and wire events for send, ack, and retransmit with consistent dimensions (room, session, sequence, attempt, timeout reason).

Files:
* apps/server/src/telemetry/telemetry-sink.ts - Add emitDeltaSent, emitDeltaAcked, emitDeltaRetransmitted helpers
* apps/server/src/domain/delta-fanout.service.ts - Emit telemetry at send, ack, retransmit transitions

Success criteria:
* All three required event names are emitted exactly at intended state transitions
* Event attributes support timeout-rate and retransmit-rate analysis in load tests

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 182-214) - Telemetry requirements
* GitHub issue #18 - Required telemetry events

Dependencies:
* Step 2.2 completion

### Step 2.4: Validate phase changes

Run server lint/tests scoped to fanout integration.

Validation commands:
* npm run -w @game/server lint - Server lint scope
* npm run -w @game/server test -- delta-fanout - Server targeted unit scope (or equivalent vitest pattern)

## Implementation Phase 3: Client Ordered Apply, Deduplication, and Ack Emission

<!-- parallelizable: true -->

### Step 3.1: Implement realtime delta handler with monotonic sequence dedupe

Create a client session handler that enforces ordered apply semantics and ignores duplicate sequence IDs without mutating world state twice.

Files:
* apps/client/src/session/realtime-delta-handler.ts - New ordered apply and dedupe handler
* apps/client/src/index.ts - Export and wire realtime handler entrypoint

Discrepancy references:
* Addresses DD-01 from .copilot-tracking/plans/logs/2026-06-30/e3-s2-ordered-realtime-delta-fanout-log.md

Success criteria:
* Duplicate sequence IDs are no-op for world mutation path
* In-order sequences apply deterministically to local state

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 79-100) - Missing client dedupe and ordering behavior

Dependencies:
* Implementation Phase 1 completion

### Step 3.2: Add client ack emission after successful apply and dedupe decisions

Emit ack messages for processed deltas so server can clear pending entries. For duplicate arrivals, follow one deterministic ack policy and document it (ack duplicates to collapse retries, or ack first-seen only with server-side idempotent clear).

Files:
* apps/client/src/session/realtime-delta-handler.ts - Ack callback integration and duplicate policy handling
* apps/client/src/session/heartbeat-caller.ts - Integrate outbound ack transport if existing session transport abstraction is reused

Success criteria:
* Client acks are emitted with sequence ID and expected room/session context
* Duplicate handling policy is deterministic and covered by unit tests

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 130-166) - Ack flow and dedupe contract

Dependencies:
* Step 3.1 completion

### Step 3.3: Validate phase changes

Run client lint/tests for dedupe and ordering behavior.

Validation commands:
* npm run -w @game/client lint - Client lint scope
* npm run -w @game/client test -- realtime-delta-handler - Client targeted unit scope (or equivalent vitest pattern)

## Implementation Phase 4: Unit, Integration, Load, and Abuse Coverage

<!-- parallelizable: false -->

### Step 4.1: Add server unit tests for fanout state machine and retransmit policy

Create unit tests for pending-ack transitions, timeout behavior, one-shot retransmit cap, and idempotent ack clear.

Files:
* apps/server/tests/unit/delta-fanout.service.test.ts - New server unit tests

Success criteria:
* Tests cover send, ack, timeout, retransmit, and terminal no-second-retransmit behavior
* Tests assert sequence-order preservation in emitted outbound envelopes

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 215-233) - Unit test requirements

Dependencies:
* Implementation Phases 2 and 3 completion

### Step 4.2: Add client unit tests for dedupe and ack behavior

Add client-side tests validating duplicate no-op behavior and expected ack emission policy.

Files:
* apps/client/tests/unit/realtime-delta-handler.test.ts - New client unit tests

Success criteria:
* Duplicate sequence does not reapply state
* Ack behavior is deterministic and matches documented policy

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 215-233) - Client test expectations

Dependencies:
* Implementation Phase 3 completion

### Step 4.3: Add integration test for cross-subscriber ordering convergence

Add integration coverage proving two placements are applied in identical order for multiple subscribers.

Files:
* apps/server/tests/integration/realtime-delta-fanout.integration.test.ts - New ordered fanout integration suite

Success criteria:
* Integration test asserts same sequence order observed by all subscribers
* Ack timeout path verifies single retransmit occurs for intentionally dropped ack subscriber

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 215-233) - Integration requirements
* GitHub issue #18 - Acceptance criteria and harness mapping

Dependencies:
* Steps 4.1 and 4.2 completion

### Step 4.4: Add load test for ack timeout rate and retransmit behavior

Create load profile simulating dropped ack ratio to measure retransmit frequency and timeout impact under churn.

Files:
* apps/server/tests/load/realtime-ack-timeout-load.ts - New load scenario for timeout and retransmit metrics

Success criteria:
* Load output includes timeout/retransmit counters from telemetry
* Outbound cap behavior is observable and does not crash room flow

Context references:
* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md (Lines 229-233) - Load test requirement

Dependencies:
* Step 4.3 completion

### Step 4.5: Validate phase changes

Run server and client test scopes for new coverage.

Validation commands:
* npm run -w @game/server test - Server unit/integration scope
* npm run -w @game/client test - Client unit scope
* npm run -w @game/server test:load - Server load scope

## Implementation Phase 5: Validation

<!-- parallelizable: false -->

### Step 5.1: Run full project validation

Execute all validation commands for the project:
* npm run lint
* npm run build
* npm run test

### Step 5.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures. Apply fixes directly when corrections are straightforward and isolated.

### Step 5.3: Report blocking issues

When validation failures require changes beyond minor fixes:
* Document the issues and affected files.
* Provide the user with next steps.
* Recommend additional research and planning rather than inline fixes.
* Avoid large-scale refactoring within this phase.

## Dependencies

* E3-S1 reconnect/session identity baseline must exist for stable subscriber identity mapping
* E2-S2 consistency assumptions for region update ordering must hold
* Colyseus room transport remains the realtime channel in Sprint 2 scope

## Success Criteria

* All E3-S2 acceptance criteria are mapped to concrete server/client behavior and automated tests
* Telemetry events delta_sent, delta_acked, and delta_retransmitted are emitted and test-observable
* Per-connection outbound cap is enforced and covered in validation
