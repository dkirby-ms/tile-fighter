<!-- markdownlint-disable-file -->
# Implementation Details: Epic3 PR Feedback Remediation

## Context Reference

Sources:

* `.copilot-tracking/pr/review/epic3/handoff.md`
* `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md`
* `.copilot-tracking/research/subagents/2026-06-30/epic3-pr-feedback-scope-research.md`

## Implementation Phase 1: Wire replay-window runtime config

<!-- parallelizable: true -->

### Step 1.1: Wire replay-window runtime config in server bootstrap

Pass runtime replay-window override into tile repository creation so env configuration is effective.

Files:

* `apps/server/src/index.ts` - Add `replayWindowSeconds` to `createTileRepository` options using runtime config value.

Discrepancy references:

* Addresses PR feedback medium finding for configuration correctness.

Success criteria:

* Tile repository receives runtime replay-window value from `runtimeConfig.placementCommandReplayWindowSeconds`.
* Existing default behavior remains when env override is absent.

Context references:

* `.copilot-tracking/pr/review/epic3/handoff.md` (index.ts replay-window finding).
* `.copilot-tracking/research/subagents/2026-06-30/epic3-pr-feedback-scope-research.md` (index wiring finding).

Dependencies:

* None. This step is isolated from fanout lifecycle wiring.

### Step 1.2: Add targeted replay-window wiring test

Add or extend a startup-composition test that verifies replay-window pass-through.

Files:

* `apps/server/tests/unit` bootstrap-related test file (existing or new) - Verify runtime replay-window pass-through in startup composition.

Success criteria:

* Test fails before wiring change and passes after implementation.
* Replay-window override wiring is explicitly asserted.

Context references:

* `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` (Existing Test Coverage and Gaps).

Dependencies:

* Step 1.1 completion.

### Step 1.3: Validate phase changes

Run focused validation for replay-window config wiring.

Validation commands:

* `npm run -w @game/server lint` - Server lint validation.
* `npm run -w @game/server build` - Server TypeScript build validation.

## Implementation Phase 2: Restore fanout registry and dispatch wiring

<!-- parallelizable: false -->

### Step 2.1: Wire room lifecycle registry registration and cleanup

Add shared fanout registry lifecycle wiring in room lifecycle so the HTTP mutation path can resolve active coordinator instances.

Files:

* `apps/server/src/rooms/arena.room.ts` - Register coordinator in shared registry at create/start and delete registry entry on teardown.

Discrepancy references:

* Addresses PR feedback critical finding for missing registry lifecycle wiring.

Success criteria:

* Room lifecycle places coordinator in shared registry under canonical key.
* Registry entry is deleted during room disposal or final lifecycle teardown.
* Coordinator timers/resources are cleaned when room is disposed.

Context references:

* `.copilot-tracking/pr/review/epic3/handoff.md` (registry lifecycle findings section).
* `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` (Verified Findings: Fanout wiring).

Dependencies:

* Existing registry injection and coordinator creation path in `apps/server/src/rooms/arena.room.ts`.

### Step 2.2: Fix HTTP placement publish inputs and sender callback

Update HTTP tile placement fanout path to publish to the actual subscriber set and provide a functional sender callback that targets connected client sessions.

Files:

* `apps/server/src/http/app.ts` - Replace empty publish subscriber set and no-op sender with resolved subscribers and real send function.
* `apps/server/src/rooms/arena.room.ts` - Ensure coordinator key contract aligns with HTTP lookup key.

Discrepancy references:

* Addresses PR feedback critical finding for non-functional realtime fanout dispatch.

Success criteria:

* Successful tile placement leads to publish invocation with non-empty subscriber candidates when subscribers exist.
* Sender callback writes delta payloads to live room clients.
* Publish path no longer silently no-ops for active rooms.

Context references:

* `.copilot-tracking/pr/review/epic3/handoff.md` (app fanout dispatch finding).
* `.copilot-tracking/research/subagents/2026-06-30/epic3-pr-feedback-scope-research.md` (apps/server/src/http/app.ts key finding).

Dependencies:

* Step 2.1 completion for registry lifecycle contract.

### Step 2.3: Add and update targeted tests for fanout wiring

Add focused unit/integration coverage for room registry lifecycle and HTTP fanout dispatch contract.

Files:

* `apps/server/tests/unit/room-auth.test.ts` or a new room lifecycle unit test file - Validate registry register/delete lifecycle behavior.
* `apps/server/tests/integration/realtime-delta-fanout.integration.test.ts` or new app integration test - Validate dispatch path from placement to subscriber delivery.

Success criteria:

* Tests fail before wiring change and pass after implementation.
* Registry lifecycle contract is asserted in tests.
* Publish dispatch contract is asserted in tests.

Context references:

* `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` (Existing Test Coverage and Gaps).

Dependencies:

* Steps 2.1 and 2.2 completion.

### Step 2.4: Validate phase changes

Run focused validation for fanout wiring changes.

Validation commands:

* `npm run -w @game/server lint` - Server lint validation.
* `npm run -w @game/server build` - Server TypeScript build validation.
* `npm run -w @game/server test -- tests/integration/realtime-delta-fanout.integration.test.ts` - Fanout integration.

## Implementation Phase 3: Implement outbound cap reset and tests

<!-- parallelizable: false -->

### Step 3.1: Implement outbound cap reset-window recovery semantics

Use existing `windowResetAt` state to restore subscriber send eligibility after each configured outbound window interval.

Files:

* `apps/server/src/domain/delta-fanout.service.ts` - Add reset checks in send eligibility logic and state updates on window boundary transitions.

Discrepancy references:

* DD-01 in planning log: choose reset-window semantics rather than broader in-flight cap redesign.

Success criteria:

* Subscriber blocked by cap can recover once reset interval elapses.
* Existing ack timeout/retransmit logic remains intact.
* Telemetry and counters remain consistent with updated eligibility model.

Context references:

* `.copilot-tracking/pr/review/epic3/handoff.md` (delta-fanout cap finding).
* `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` (Planning Decisions for Implementation).

Dependencies:

* None.

### Step 3.2: Update cap tests and integration verification

Update and extend tests to validate cap reset recovery semantics.

Files:

* `apps/server/tests/unit/delta-fanout.service.test.ts` - Add reset-window recovery cases and adapt previous monotonic-cap expectations.
* `apps/server/tests/integration/realtime-delta-fanout.integration.test.ts` - Ensure integration behavior remains stable under updated cap policy.

Success criteria:

* Updated tests explicitly verify cap recovery behavior.
* No regressions in ordering/retransmit expectations.

Context references:

* `.copilot-tracking/research/2026-06-30/epic3-pr-feedback-remediation-research.md` (Existing Test Coverage and Gaps).

Dependencies:

* Step 3.1 completion.

### Step 3.3: Validate phase changes

Run targeted validation for cap behavior changes.

Validation commands:

* `npm run -w @game/server lint` - Server lint validation.
* `npm run -w @game/server build` - Server TypeScript build validation.
* `npm run -w @game/server test -- tests/unit/delta-fanout.service.test.ts` - Cap behavior unit tests.
* `npm run -w @game/server test -- tests/integration/realtime-delta-fanout.integration.test.ts` - Integration verification.

## Implementation Phase 4: Full validation and release readiness

<!-- parallelizable: false -->

### Step 4.1: Run full project validation

Execute full workspace checks after all remediation changes merge.

Validation commands:

* `npm run build`
* `npm run lint`
* `npm run test`

### Step 4.2: Fix minor validation issues

Address straightforward lint/type/test failures that are directly tied to this remediation scope.

### Step 4.3: Report blocking issues and deferred work

If failures require broader redesign, document blockers and propose follow-on work rather than expanding this PR scope.

Discrepancy references:

* DR-01 in planning log for deferred environment-backed latency-budget CI gate.

## Dependencies

* Node/npm workspace scripts available locally.
* Existing `@game/server` package scripts for lint/build/test.
* Access to tests requiring any configured test DB/runtime settings where applicable.

## Success Criteria

* All four PR feedback items are addressed with code changes and tests.
* Realtime fanout dispatch from placement path is functionally active and validated.
* Outbound cap policy recovers send eligibility after reset window.
* Runtime replay-window env override is effective.
* Full workspace validation passes or blocking issues are clearly documented.
