<!-- markdownlint-disable-file -->
# PR Review Handoff: epic3

## PR Overview

Review completed for branch epic3 against main with focus on realtime fanout correctness, load-gate validity, and configuration wiring. Four review items were finalized: three direct PR comments and one backlog-directed follow-up.

* Branch: epic3
* Base Branch: main
* Total Files Changed: 61
* Total Review Comments: 4

## PR Comments Ready for Submission

### File: apps/server/src/http/app.ts

#### Comment 1 (Lines 186 through 213)

* Category: Functional correctness / Reliability
* Severity: Critical

Realtime fanout dispatch is effectively disabled. The HTTP path looks up a coordinator from the shared registry, but there is no corresponding room-side registry registration lifecycle, and publish is called with an empty subscriber set and no-op sender callback. This prevents deltas from reaching connected clients even when placements commit.

Suggested change

```ts
// Register coordinator in room lifecycle and keep registry in sync.
// Publish to actual subscriber sessions with a real send callback.
```

### File: apps/server/src/rooms/arena.room.ts

#### Comment 2 (Lines 49 through 59)

* Category: Functional correctness / Reliability
* Severity: Critical

Coordinator construction in room lifecycle does not register into the shared delta fanout registry used by the HTTP mutation path. Without registry registration and teardown cleanup, HTTP fanout lookup cannot resolve room coordinator state.

Suggested change

```ts
// onCreate: registry.set(regionOrRoomKey, this.deltaFanoutCoordinator)
// onDispose/onLeave-final: registry.delete(regionOrRoomKey)
```

### File: apps/server/src/domain/delta-fanout.service.ts

#### Comment 3 (Lines 173 through 195)

* Category: Functional correctness / Performance
* Severity: High

Outbound cap handling is monotonic and never resets. Once outboundCount reaches cap, publishes are dropped indefinitely for that subscriber until unregister. windowResetAt is tracked but not used.

Suggested change

```ts
// Add reset-window semantics or convert cap to in-flight pending-ack cap.
// Ensure send eligibility recovers after reset criteria are met.
```

### File: apps/server/src/index.ts

#### Comment 4 (Lines 35 through 37)

* Category: Configuration correctness
* Severity: Medium

Replay-window runtime configuration is parsed but not wired into repository construction. The repository falls back to default replay window and ignores runtime override.

Suggested change

```ts
const tileRepository = createTileRepository({
  telemetrySink,
  replayWindowSeconds: runtimeConfig.placementCommandReplayWindowSeconds
});
```

## Backlog Follow-Up

### Item: Environment-backed latency budget validation path

* Source finding: RI-003
* File(s): apps/server/tests/load/e3-s4-latency-budget.load.ts, .github/workflows/nonprod-load.yml, .github/workflows/verify-release.yml
* Priority: High
* Decision: Document in backlog (non-blocking for this PR)

Current latency-budget gate uses a mocked in-process application path. Add an environment-backed load scenario for nonprod/release workflows and gate promotion on externally measured evidence.

## Review Summary by Category

* Security Issues: 0
* Code Quality: 0
* Functional Correctness and Reliability: 3
* Configuration and Operations: 1
* Documentation: 0

## Instruction Compliance

* ✅ /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md: Tracking markdown artifacts follow required structure.
* ✅ /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md: Review artifacts maintain clear technical language and actionable recommendations.
* ✅ /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/pull-request.instructions.md: PR review workflow artifacts were generated and maintained under .copilot-tracking/pr/review/epic3.

## Outstanding Risks

* Realtime placement fanout behavior can be silent-fail until registry and subscriber wiring are corrected.
* Long-lived sessions can starve after outbound cap threshold is crossed.
* Replay-window runtime controls are currently ineffective until constructor wiring is fixed.
