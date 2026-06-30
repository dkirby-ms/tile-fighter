---
title: Epic3 PR Feedback Scope Research
description: Research findings for PR feedback implementation scope on branch epic3.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
---

## Research Scope

* Branch: epic3
* Focus files:
  * apps/server/src/http/app.ts
  * apps/server/src/rooms/arena.room.ts
  * apps/server/src/domain/delta-fanout.service.ts
  * apps/server/src/index.ts
* Concerns from handoff:
  * Fanout dispatch path and publish call inputs in app bootstrap
  * Registry registration and teardown lifecycle in room handling
  * Outbound cap reset semantics in delta fanout
  * Replay window config wiring at entrypoint
* Additional requested outputs:
  * Existing related tests
  * Exact npm validation commands from package scripts for targeted and full validation

## Findings In Progress

## Status

* Complete

## Key Findings By File

### apps/server/src/http/app.ts

* Current fanout dispatch path is present but non-functional for actual delivery.
* After successful tile commit, code builds a delta payload and calls coordinator.publish, but passes `new Set()` as subscribers and a no-op sender callback.
* Because publish iterates the provided subscriber set, the empty set results in zero sends and zero pending-ack tracking.
* This aligns with handoff concern: publish call inputs currently disable realtime dispatch despite commit success.
* There are no tests in apps/server/tests that assert app-level fanout dispatch arguments, registry lookup behavior, or send callback wiring from this file.

### apps/server/src/rooms/arena.room.ts

* Room creates DeltaFanoutCoordinator when config/registry/telemetry are present.
* onJoin and onLeave correctly call registerSubscriber/unregisterSubscriber on the coordinator.
* Missing registry lifecycle wiring:
  * No registry set on room create (or equivalent ready state) to expose coordinator to HTTP path.
  * No registry delete on teardown/dispose to avoid stale entries.
* There is no onDispose override for coordinator destroy and registry cleanup.
* Existing room test coverage is auth-only (apps/server/tests/unit/room-auth.test.ts); no lifecycle tests for registry registration/teardown.

### apps/server/src/domain/delta-fanout.service.ts

* Outbound cap is monotonic per subscriber: canSendToSubscriber checks `outboundCount < deltaOutboundCapPerConnection`.
* recordOutboundSend only increments outboundCount; no reset path uses windowResetAt.
* windowResetAt is initialized but never consulted for eligibility reset.
* Effect: once cap is reached, subscriber remains blocked until unregisterSubscriber clears stats.
* Existing tests currently encode this monotonic behavior:
  * apps/server/tests/unit/delta-fanout.service.test.ts validates cap-exceeded sends are skipped.
  * apps/server/tests/load/realtime-ack-timeout-load.ts includes a cap scenario.
* PR feedback implies behavior change required (time-window reset or in-flight-based cap), so these tests will need targeted updates and new reset-semantics coverage.

### apps/server/src/index.ts

* Runtime config parses placementCommandReplayWindowSeconds in apps/server/src/config/env.ts.
* index.ts constructs tileRepository via createTileRepository({ telemetrySink }) and does not pass replayWindowSeconds.
* tile.repository defaults replayWindowSeconds to 900 when not provided.
* Result: runtime override via PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS is ignored at bootstrap wiring.
* No direct tests target bootstrap wiring in src/index.ts for this config path.

## Existing Related Tests

Directly relevant and existing:

* apps/server/tests/unit/delta-fanout.service.test.ts
  * Core publish/ack/retransmit and outbound-cap behaviors.
* apps/server/tests/integration/realtime-delta-fanout.integration.test.ts
  * Multi-subscriber ordering and timeout/retransmit integration behavior at coordinator level.
* apps/server/tests/load/realtime-ack-timeout-load.ts
  * High-volume behavior including cap path.
* apps/server/tests/unit/room-auth.test.ts
  * ArenaRoom onAuth token validation only (does not cover registry lifecycle/fanout send path).

Coverage gaps relative to handoff scope:

* No app-level tests assert that createHttpApp tile placement path sends fanout to actual subscriber IDs via coordinator.publish.
* No ArenaRoom tests for registry set/delete lifecycle and coordinator destroy on disposal.
* No wiring test for index bootstrap passing placementCommandReplayWindowSeconds to tile repository.

## Recommended Implementation Sequencing

Recommended order:

1. Wire replay window config in apps/server/src/index.ts.
2. Add ArenaRoom registry lifecycle and teardown semantics in apps/server/src/rooms/arena.room.ts.
3. Fix app dispatch inputs in apps/server/src/http/app.ts so publish receives real subscriber IDs and real send callback.
4. Implement outbound cap reset semantics in apps/server/src/domain/delta-fanout.service.ts.
5. Update/add tests for each change, then run targeted and full validation.

Why this order:

* Step 1 is isolated and low-risk, with no concurrency contention.
* Steps 2 and 3 are tightly coupled through shared registry contract. Implementing room lifecycle before app dispatch ensures lookup contract exists.
* Step 4 changes coordinator behavior and can invalidate existing cap tests; run after dispatch contract is clarified.

Parallelization constraints:

* apps/server/src/rooms/arena.room.ts and apps/server/src/http/app.ts should not be developed fully in parallel without a shared interface decision for publish inputs, because both depend on the same registry/coordinator contract.
* apps/server/src/index.ts replay-window wiring can be done in parallel with any other track.
* delta-fanout.service.ts cap-reset work can begin in parallel at design level, but test finalization should wait until the expected semantic (time-window reset vs in-flight cap) is explicitly selected.

## Suggested Test Strategy

Targeted additions/updates:

* Add unit/integration tests for app fanout dispatch:
  * Assert coordinator.publish invoked with non-empty subscriber set after successful placement.
  * Assert onSend callback routes payload to intended session clients.
* Add ArenaRoom lifecycle tests:
  * onCreate registers coordinator into shared registry.
  * onLeave final client or onDispose removes registry entry.
  * onDispose destroys coordinator timers/resources.
* Update delta-fanout tests:
  * Preserve existing cap tests where still valid.
  * Add explicit reset-window recovery tests (or in-flight cap recovery tests) matching chosen semantics.
* Add bootstrap/config wiring test:
  * Ensure createTileRepository receives replayWindowSeconds from runtime config in index bootstrap path.

Execution approach:

* Start with targeted tests for changed modules to speed iteration.
* Run server package test suite after module-level passes.
* Run workspace-wide validation before completion.

## Exact npm Validation Commands From Existing Scripts

Targeted server tests (using existing @game/server `test` script with vitest file filters):

```bash
npm run -w @game/server test -- tests/unit/delta-fanout.service.test.ts
npm run -w @game/server test -- tests/integration/realtime-delta-fanout.integration.test.ts
npm run -w @game/server test -- tests/unit/room-auth.test.ts
```

Targeted server quality gates:

```bash
npm run -w @game/server lint
npm run -w @game/server build
```

Optional targeted load validation for fanout/cap behavior:

```bash
npm run -w @game/server test:load
```

Full validation from workspace root:

```bash
npm run build
npm run lint
npm run test
```

## Open Questions

* Which exact outbound cap semantic is preferred for PR feedback resolution?
  * Sliding time-window reset using windowResetAt.
  * In-flight pending-ack cap that frees capacity on ack/expiry.
* What key should be canonical for fanout registry lookups across HTTP and rooms?
  * roomId
  * regionId
  * mapped alias with explicit contract
