<!-- markdownlint-disable-file -->
# PR Review Status: epic3

## Review Status

* Phase: Phase 4 complete
* Last Updated: 2026-06-30T00:00:00Z
* Summary: PR diff parsed and high-severity runtime/regression risks identified in realtime fanout and load-budget validation paths.

## Branch and Metadata

* Normalized Branch: epic3
* Source Branch: epic3
* Base Branch: main
* Linked Work Items: Closes #3

## Execution Log

* Ran `git rev-parse --abbrev-ref HEAD`, `git merge-base main HEAD`, and `git diff --name-status main...HEAD` to lock review scope.
* Generated `.copilot-tracking/pr/review/epic3/pr-reference.xml` from `git log main...HEAD` and `git diff main...HEAD`.
* Parsed hunk mappings from unified diff into `/tmp/pr85-hunks.txt`.
* Inspected high-risk runtime files (`app.ts`, `arena.room.ts`, `delta-fanout.service.ts`, `tile.repository.ts`, `index.ts`) and release gating/load files (`e3-s4-latency-budget.load.ts`, workflow YAMLs).

## Diff Mapping

| File | Type | New Lines | Old Lines | Notes |
|---|---|---|---|---|
| apps/server/src/http/app.ts | M | 19-220 | mixed | HTTP mutation path and fanout dispatch wiring |
| apps/server/src/rooms/arena.room.ts | M | 6-157 | mixed | Room lifecycle and delta ack/retransmit callbacks |
| apps/server/src/domain/delta-fanout.service.ts | A | 1-288 | n/a | Coordinator behavior, retry, cap, lifecycle |
| apps/server/tests/load/e3-s4-latency-budget.load.ts | A | 1-344 | n/a | Sustained-load evidence path used by release gates |
| apps/server/src/index.ts | M | 26-126 | mixed | Runtime config wiring and repository construction |
| apps/server/src/config/env.ts | M | 31-125 | mixed | New env schema fields |
| apps/server/src/persistence/tile.repository.ts | M | 1-917 | mixed | Command replay window and deterministic conflict ledger |
| .github/workflows/nonprod-load.yml | M | 51-107 | mixed | Nonprod load workflow and artifact assertion |
| .github/workflows/verify-release.yml | M | 243-325 | mixed | Release verification load gate |

## Instruction Files Reviewed

* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md`: Applies to tracking markdown artifacts.
* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md`: Applies to tracking markdown voice and readability.
* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/pull-request.instructions.md`: Applies to `.copilot-tracking/pr/**` artifacts.

## Coverage Plan

* [x] Parse full diff and hunk line mappings
* [x] Review critical server runtime paths
* [x] Review load gate implementation paths
* [ ] Validate any contested findings with targeted test execution (if requested)
* [ ] Finalize handoff after user decisions on review items

## Review Items

### 🔍 In Review

#### RI-001: Realtime fanout dispatch is effectively disabled in production path

* File: apps/server/src/http/app.ts; apps/server/src/rooms/arena.room.ts
* Lines: app.ts 186-213; arena.room.ts 49-59
* Category: Functional correctness / Reliability
* Severity: Critical

**Description**

`createHttpApp` looks up a coordinator by region (`deltaFanoutRegistry.get(input.regionId)`) and then calls `coordinator.publish(new Set(), ..., async () => {})`. At the same time, `ArenaRoom` creates a coordinator but never registers it into `deltaFanoutRegistry` via `set(...)`. Result: the lookup returns `undefined` and no fanout occurs. Even if a coordinator were found, publishing with an empty subscriber set and no-op sender produces no outbound delta messages.

**Suggested Resolution**

* Register coordinator into shared registry during room creation and remove it on teardown.
* Publish to the room's active subscribers and provide a real `onSend` callback that sends `delta` to the targeted client/session.
* Add an integration test that places a tile through HTTP and asserts client receives `delta` over room channel.

**User Decision**: Approved

**Follow-up Notes**: Blocks E3-S2 ordered realtime fanout acceptance behavior.

#### RI-002: Outbound cap is monotonic and never resets, causing permanent subscriber starvation

* File: apps/server/src/domain/delta-fanout.service.ts
* Lines: 173-195
* Category: Functional correctness / Performance
* Severity: High

**Description**

`canSendToSubscriber` compares `outboundCount < deltaOutboundCapPerConnection`, and `recordOutboundSend` only increments `outboundCount`. `windowResetAt` is never used to roll the count forward. Once a subscriber crosses cap, all future publishes are dropped forever until reconnect/unregister.

**Suggested Resolution**

* Implement time-bucket reset logic using `windowResetAt` and a defined window duration, or convert the cap to a queue-depth cap tracked against pending acknowledgements.
* Add tests proving sends resume after a reset window and do not lock permanently.

**User Decision**: Approved

**Follow-up Notes**: Current behavior can silently blackhole updates for long-lived sessions.

#### RI-003: Release/nonprod latency-budget gate uses mocked in-process app, not target environment

* File: apps/server/tests/load/e3-s4-latency-budget.load.ts
* Lines: 72-171; 196-236
* Category: Functional correctness / CI validity
* Severity: High

**Description**

The test constructs a mocked telemetry sink, mocked auth service, mocked repository, and local Express app via `createHttpApp(...)`. Workflow jobs pass environment values like `LOAD_ENDPOINT` and production-like secrets, but the test never uses `LOAD_ENDPOINT`; it only calls `request(app)` in-process. This can pass budget gates without exercising nonprod/release infrastructure latency.

**Suggested Resolution**

* Split into two scenarios:
  * fast local mocked contract test
  * true environment load test using external endpoint/client transport
* In workflow gating, assert on evidence produced by the external scenario only.
* Add explicit assertion that configured endpoint is consumed when run class is `nonprod` or `release`.

**User Decision**: Modified (Document in backlog)

**Follow-up Notes**: Document as backlog follow-up for environment-backed load validation and release-gate hardening; treat current finding as non-blocking for this PR.

#### RI-004: Replay window runtime config is parsed but not wired into repository construction

* File: apps/server/src/index.ts
* Lines: 35-37
* Category: Configuration correctness
* Severity: Medium

**Description**

`PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS` is defined and parsed in runtime config, and `TileRepository` supports `replayWindowSeconds`, but `createTileRepository` is invoked with only `telemetrySink`. Runtime replay window changes have no effect.

**Suggested Resolution**

* Pass `replayWindowSeconds: runtimeConfig.placementCommandReplayWindowSeconds` into `createTileRepository(...)`.
* Add a startup/config unit test asserting constructor receives configured replay window.

**User Decision**: Approved

**Follow-up Notes**: Behavior currently locked to repository default of 900 seconds.

### ✅ Approved for PR Comment

* RI-001 approved: Realtime fanout dispatch is effectively disabled in production path (apps/server/src/http/app.ts 186-213; apps/server/src/rooms/arena.room.ts 49-59)
* RI-002 approved: Outbound cap is monotonic and never resets, causing permanent subscriber starvation (apps/server/src/domain/delta-fanout.service.ts 173-195)
* RI-003 approved with modification: Document environment-backed latency validation gap as backlog follow-up (apps/server/tests/load/e3-s4-latency-budget.load.ts 72-171, 196-236; .github/workflows/nonprod-load.yml; .github/workflows/verify-release.yml)

### ❌ Rejected / No Action

* None yet

## Open Questions

* Should delta fanout registry key by `regionId`, `roomId`, or both for multi-room same-region scenarios?
* Should outbound cap represent per-time-window sends or max in-flight unacked messages?

## Next Steps

* [x] Present RI-001 to user for decision
* [x] Iterate through RI-002 to RI-004 one at a time and capture approvals/rejections
* [x] Generate `handoff.md` after decisions are finalized
