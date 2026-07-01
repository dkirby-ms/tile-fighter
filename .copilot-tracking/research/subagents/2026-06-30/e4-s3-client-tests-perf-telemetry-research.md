---
title: E4-S3 Client Tests Perf Telemetry Research
description: Research findings for issue #23 on client test conventions, perf budget coverage, telemetry patterns, and malformed payload validation in tile-fighter.
author: GitHub Copilot (Researcher Subagent)
ms.date: 2026-06-30
ms.topic: reference
keywords:
  - issue-23
  - client-tests
  - telemetry
  - performance
  - payload-validation
estimated_reading_time: 9
---

## Research Scope

This report answers issue #23 research questions:

1. What test patterns exist in apps/client/tests for unit/integration and how should new tests be structured?
2. Are there existing perf budget checks (fps/frame pacing) in client or docs/cicd-harness mapping relevant to Harness mapping 2,6?
3. How are telemetry events currently emitted and tested in client/server?
4. What malformed payload validation patterns exist for realtime/session handlers?

## Findings Summary

- Client test style is consistent and strongly patternized around `describe`/`it`, local factory helpers, global `fetch` stubbing, explicit retry-path assertions, and state-machine transition checks.
- No client FPS or frame-pacing budgets currently exist. Existing perf budgets are server-side latency budgets in the harness (`placementAckMedianMs`, `reconnectP95Ms`) and load tests.
- Telemetry emission is centralized on server in `TelemetrySink` with event-specific wrappers and broad route/service usage. Client has no dedicated telemetry emitter today.
- Malformed payload protection is strongest on server route boundaries (shape/field validation + status mapping), with additional client validation for replay-upsert integrity.

## Evidence

### 1) Client test patterns and structure conventions

#### Unit-test conventions in apps/client/tests/unit

- Shared auth mock factory pattern appears in request-caller tests:
  - `makeMockAuth` in `apps/client/tests/unit/heartbeat-caller.test.ts` at line 12.
  - `makeMockAuth` in `apps/client/tests/unit/join-token-caller.test.ts` at line 9.
  - `makeMockAuth` in `apps/client/tests/unit/reconnect-caller.test.ts` at line 13.
- `fetch` is stubbed at boundary and asserted for headers/flows:
  - `vi.stubGlobal("fetch", ...)` used in `apps/client/tests/unit/heartbeat-caller.test.ts` at lines 34, 48, 58, 84, 109, 131, 141, 154, 170.
  - Similar usage in `apps/client/tests/unit/join-token-caller.test.ts` at lines 31, 45, 56, 81, 92, 103, 113, 126, 142.
- Retry and auth-state branches are explicitly asserted:
  - 401 retry + refreshed bearer in `apps/client/tests/unit/heartbeat-caller.test.ts` lines 81-97.
  - Retry failure/forbidden cases in same file lines 117-143.
  - `failureClass` assertions for reconnect in `apps/client/tests/unit/reconnect-caller.test.ts` lines 68-76, 131-149.
- Deterministic sequencing and dedupe behavior tested directly for realtime handler:
  - Core ordering/dedupe tests in `apps/client/tests/unit/realtime-delta-handler.test.ts` lines 46-137.
  - Deterministic ack policy tests in lines 140-213.

#### Integration-test conventions in apps/client/tests/integration

- Current integration scope is state-machine behavior (not HTTP/WS integration):
  - `ExternalIdSessionStateMachine` transition suite in `apps/client/tests/integration/auth-state-machine.test.ts` line 26.
  - Transitional state assertions (signed-out -> acquiring-token-silently -> token-ready) at lines 33-51.
  - Interaction-required and bootstrap-failed transitions at lines 54-94.

#### Structural expectations for new tests

From existing files and Vitest config:

- Tests live under `apps/client/tests` via `vitest.config.ts` with `test.dir` set to `tests` (`apps/client/vitest.config.ts` lines 7-9).
- Node environment is standard for client tests (`apps/client/vitest.config.ts` line 10).
- Naming convention uses suffix `.test.ts` and behavior-driven spec names (`apps/client/tests/unit/*.test.ts`, `apps/client/tests/integration/auth-state-machine.test.ts`).

### 2) Perf budget checks relevant to harness mapping 2,6

#### Client-side fps/frame-pacing checks

- No client fps/frame pacing budget code or tests were found under `apps/client/src` or `apps/client/tests`.
- Existing client tests focus on auth/session/replay/realtime correctness, not render-loop metrics.

#### Existing harness perf budgets

`docs/cicd-harness.md` contains explicit E3-S4 budget gate coverage:

- Verification workflow references and gating context:
  - `verify-release.yml` mention at line 160.
  - E3-S4 validation requirement at line 170.
- Budget gate section:
  - `## E3-S4 Latency Budget Gate` at line 191.
  - Threshold table at lines 199-200 (`metrics.placementAckMedianMs`, `metrics.reconnectP95Ms`).
- Budget artifact fields and pass/fail indicators:
  - Evidence JSON shape lines 208-228.
  - `budgetStatus` troubleshooting guidance at line 268.
- Run-context split likely relevant to harness mapping 2/6:
  - Scheduled nonprod vs release verification token mapping at lines 250-251.
  - Nonprod load workflow mention at line 335.

Related executable load evidence exists server-side:

- Budget test constants in `apps/server/tests/load/e3-s4-latency-budget.load.ts`:
  - `PLACEMENT_ACK_MEDIAN_BUDGET_MS = 200` at line 13.
  - `RECONNECT_P95_BUDGET_MS = 3000` at line 14.
- Evidence artifact writing and budget assertion logic in same file lines 25-71 and 240 onward.

Conclusion for Q2:

- Mapping is latency-budget oriented (placement ack + reconnect), not fps/frame pacing.
- For issue #23, any fps/frame pacing requirement appears to be net-new and currently uncovered.

### 3) Telemetry emission and testing in client/server

#### Server telemetry emission pattern

Centralized sink pattern:

- `TelemetrySink.emit(eventName, attributes)` in `apps/server/src/telemetry/telemetry-sink.ts` lines 15-47.
- Mode/URL behavior in same file:
  - `off` short-circuit at line 25.
  - required URL enforcement at lines 29-31.
  - request failure hard-fail in required mode at lines 45-46.

Event wrapper methods include domain and load telemetry:

- Placement/rejection/conflict events in `apps/server/src/telemetry/telemetry-sink.ts` lines 107, 211, 233, 257, 285.
- Realtime delivery telemetry (`delta_sent`, `delta_acked`, `delta_retransmitted`) at lines 429, 453, 477.
- Load telemetry (`load_run_started`, `load_run_completed`, `load_budget_violation`) at lines 499, 520, 552.

Route/service call sites:

- Session bootstrap/join-token/rejoin fail emissions in `apps/server/src/http/routes/session.routes.ts` lines 73, 126, 133, 206.
- Presence/session lifecycle emissions in `apps/server/src/session/session-lifecycle.service.ts` lines 69, 78, 95, 112, 146.

#### Telemetry testing coverage

- Concrete telemetry assertion exists for tile conflict path:
  - Mocks `emitPlacementConflictDetected` and `emitPlacementConflictResolved` in `apps/server/tests/unit/tile.repository.telemetry.test.ts` lines 8-10.
  - Verifies exactly-once calls at lines 145-146.
- Lifecycle tests also assert `presence_cleared` emission:
  - `apps/server/tests/unit/session-lifecycle.service.test.ts` lines 25-29.

#### Client telemetry status

- No dedicated client telemetry sink/emitter was found in `apps/client/src`.
- Client realtime handler logs failures via `console.error` only (`apps/client/src/session/realtime-delta-handler.ts` line 99).

### 4) Malformed payload validation patterns for realtime/session handlers

#### Client-side validation/guard behavior

- Replay integrity guard:
  - Unsupported checksum scope throws `ReplayChecksumError` in `apps/client/src/session/replay-checksum.ts` line 44.
  - Upsert payload validation via `isUpsertDelta` and type checks at lines 74-76 and 150-164.
- Realtime handler assumes typed payload and applies sequence compare via `parseInt`:
  - `compareSequenceIds` in `apps/client/src/session/realtime-delta-handler.ts` lines 116-118.
  - No explicit payload schema guard before handling at line 56.

#### Server route-boundary validation (stronger)

Session handlers (`session.routes.ts`):

- Required fields enforced with 400 responses:
  - Heartbeat `roomId` required at lines 149 and 111.
  - Reconnect requires both `roomId` and `reconnectToken` at line 183.
- Reconnect failure reasons normalized and mapped to status codes with telemetry:
  - `room_rejoin_failed` emit at line 206.

Region diff handlers (`region-diff.routes.ts`):

- `parseRegionDiffRequest` enforces full payload constraints (regionId, sinceVersion integer >= 0, viewport integer bounds, area cap, maxTiles cap) at lines 72-136.
- Invalid payload mapped to 400 at line 147.

Tile handlers (`tile.routes.ts`):

- Command shape guards:
  - `isTilePlaceCommand` at lines 87-115.
  - `isTileEditCommand` at lines 125-139.
- malformed command identity rejection:
  - `isValidTilePlaceCommandId` at lines 117-123.
  - 400 + `conflictCode: malformed_command_identity` at lines 157-160.
- Domain mismatch payload protection:
  - `command_payload_mismatch` mapped to 409 with explicit conflict code at lines 211-218.

Snapshot handlers (`snapshot.routes.ts`):

- `regionId` parser and 400 enforcement:
  - parser at lines 41-52.
  - required check at lines 73-74 and 99-100.

## Recommendations for New Tests (Issue #23)

### A) Client unit tests to add

Suggested files under `apps/client/tests/unit`:

- `realtime-delta-handler.malformed-payload.test.ts`
  - Asserts behavior when `sequenceId` is non-numeric or missing-like input cast reaches handler.
  - Asserts deterministic ack policy does not throw on malformed sequence values and documents expected fallback behavior.
- `reconnect-caller.response-shape.test.ts`
  - Asserts handling when reconnect response omits required fields (`replay`, `checksum`) or has wrong primitive types.
- `bootstrap-store.response-shape.test.ts`
  - Asserts bootstrap response shape assumptions and failure behavior for malformed JSON payloads.

### B) Client integration tests to add

Suggested files under `apps/client/tests/integration`:

- `session-bootstrap-retry-contract.test.ts`
  - Verifies shell-init retry policy contract assumptions from bootstrap payload (matches harness narrative around bootstrap retry semantics).
- `realtime-delta-sequence-contract.test.ts`
  - Validates cross-component sequence handling assumptions for monotonic apply and duplicate acks.

### C) Telemetry-focused tests to add

If client telemetry is introduced for issue #23:

- `telemetry-emitter.test.ts` (new module expected in `apps/client/src/telemetry`)
  - Verifies event naming, payload shape, and opt-out/off mode behavior.
- `realtime-delta-handler.telemetry.test.ts`
  - Verifies telemetry emission on apply-failure, dedupe-hit, and ack-send outcomes.

If client telemetry is not introduced yet, add server-side guard coverage instead:

- `apps/server/tests/unit/session.routes.validation.test.ts`
  - malformed heartbeat/reconnect payloads -> expected status + telemetry assertions.

## Acceptance-Criteria Traceability

| AC / Requirement | Evidence | Coverage Status | Suggested Follow-up |
|---|---|---|---|
| Q1: Identify client test patterns and structure for new tests | `apps/client/tests/unit/heartbeat-caller.test.ts` lines 12, 30-172; `apps/client/tests/unit/realtime-delta-handler.test.ts` lines 45-313; `apps/client/tests/integration/auth-state-machine.test.ts` lines 26-141; `apps/client/vitest.config.ts` lines 7-10 | Covered | Add malformed payload + response-shape tests listed above |
| Q2: Perf budget checks relevant to harness mapping 2,6 | `docs/cicd-harness.md` lines 191-200, 216-228, 240, 250-251, 335; `apps/server/tests/load/e3-s4-latency-budget.load.ts` lines 13-14 | Covered (latency budgets), no fps/frame pacing found | Decide whether fps/frame pacing is required for issue #23; if yes, define new client metric contract |
| Q3: How telemetry is emitted and tested in client/server | `apps/server/src/telemetry/telemetry-sink.ts` lines 15-47, 429, 453, 477, 499, 520, 552; `apps/server/src/http/routes/session.routes.ts` lines 73, 126, 133, 206; `apps/server/tests/unit/tile.repository.telemetry.test.ts` lines 8-10, 145-146; `apps/client/src/session/realtime-delta-handler.ts` line 99 | Covered | Add explicit session-route telemetry assertion tests and decide on client telemetry implementation |
| Q4: Malformed payload validation patterns in realtime/session handlers | `apps/server/src/http/routes/session.routes.ts` lines 149, 183; `apps/server/src/http/routes/region-diff.routes.ts` lines 72-136, 147; `apps/server/src/http/routes/tile.routes.ts` lines 87-115, 117-123, 157-160, 211-218; `apps/client/src/session/replay-checksum.ts` lines 44, 74-76, 150-164 | Covered | Add client realtime malformed sequence tests and server reconnect payload negative tests |
| Requirement: include concrete test file recommendations and likely names | Recommendations section above | Covered | Finalize with assignee based on issue #23 scope split |
| Requirement: gather repo evidence with line numbers | All sections include file + line citations | Covered | None |

## Open Questions

- For "Harness mapping 2,6", should issue #23 scope stay aligned to existing latency budgets (`placementAckMedianMs`, `reconnectP95Ms`) or add net-new client FPS/frame-pacing budgets?
- Is client telemetry intentionally deferred, or should issue #23 include a minimal client telemetry emitter contract now?
- For malformed realtime payloads on client, should expected behavior be fail-fast (throw) or tolerant (drop + telemetry/log + no ack)? Current code path is not explicitly schema-validated.

## Proposed Next Research (If Needed)

- Confirm intended definitions for Harness mapping 2 and 6 from issue/epic planning artifacts.
- Inspect `.github/workflows/verify-release.yml` and `.github/workflows/nonprod-load.yml` for direct matrix mapping to issue #23 acceptance checks.
- Align with maintainers on client telemetry event taxonomy before writing implementation tests.
