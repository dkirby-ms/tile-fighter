<!-- markdownlint-disable-file -->
---
title: Epic3 PR Feedback Remediation Research
description: Consolidated planning research for implementing PR review feedback on branch epic3.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
---

## Scope

* Task: Plan implementation work for PR feedback in `.copilot-tracking/pr/review/epic3/handoff.md`.
* Branch context: `epic3` against `main`.
* Priority findings to address in code:
  * `apps/server/src/http/app.ts` realtime fanout publish path is non-functional.
  * `apps/server/src/rooms/arena.room.ts` missing delta fanout registry lifecycle registration/cleanup.
  * `apps/server/src/domain/delta-fanout.service.ts` outbound cap never recovers after reaching threshold.
  * `apps/server/src/index.ts` runtime replay window not wired into repository construction.
* Out-of-scope for this remediation PR (tracked follow-on): environment-backed latency budget validation in CI workflows.

## Inputs and Evidence

* Source handoff: `.copilot-tracking/pr/review/epic3/handoff.md`.
* Subagent deep scan: `.copilot-tracking/research/subagents/2026-06-30/epic3-pr-feedback-scope-research.md`.
* Repository memory notes:
  * `/memories/repo/ci-notes.md` (workspace package naming and validation command norms).

## Verified Findings

### Fanout wiring

* HTTP tile placement path calls coordinator publish with an empty subscriber set and no-op sender, resulting in no delivery.
* Room lifecycle creates a coordinator and does subscriber registration per join/leave, but does not register coordinator in shared registry used by HTTP lookup.
* Missing lifecycle cleanup can leave stale registry entries after room teardown.

### Delivery throttling behavior

* Subscriber outbound cap is currently monotonic and only increases.
* `windowResetAt` state exists but is unused for eligibility reset.
* Long-lived subscriber connections can be permanently blocked once cap is hit.

### Runtime config wiring

* Runtime environment parses replay-window override.
* Server bootstrap omits this value when creating tile repository.
* Repository defaults are used even when runtime override is provided.

## Existing Test Coverage and Gaps

Covered today:

* `apps/server/tests/unit/delta-fanout.service.test.ts`
* `apps/server/tests/integration/realtime-delta-fanout.integration.test.ts`
* `apps/server/tests/load/realtime-ack-timeout-load.ts`

Coverage gaps to close in this remediation:

* App-level fanout dispatch argument wiring (non-empty subscribers and functional sender callback).
* Room lifecycle registry registration and teardown cleanup.
* Bootstrap wiring test for replay-window pass-through.
* Delta outbound cap recovery semantics after reset window or alternative bounded-cap model.

## Validation Commands (From Existing Scripts)

Targeted package validation:

```bash
npm run -w @game/server lint
npm run -w @game/server build
npm run -w @game/server test -- tests/unit/delta-fanout.service.test.ts
npm run -w @game/server test -- tests/integration/realtime-delta-fanout.integration.test.ts
```

Optional extended validation:

```bash
npm run -w @game/server test:load
```

Workspace-wide validation:

```bash
npm run build
npm run lint
npm run test
```

## Planning Decisions for Implementation

* Recommended canonical registry key: use room key already shared between room lifecycle and HTTP lookup, and codify contract in both files.
* Recommended cap model for minimal-risk remediation: implement reset-window semantics using existing `windowResetAt` rather than redesigning to in-flight pending-ack cap.
* Recommended sequencing:
  1. Fix bootstrap replay-window wiring (`index.ts`) as isolated change.
  2. Introduce registry lifecycle wiring in room lifecycle.
  3. Update HTTP publish wiring to use registered coordinator/subscribers/send callback.
  4. Implement outbound cap reset and adjust fanout tests.
  5. Run targeted then full validation.

## Discrepancy Candidates for Planning Log

* DR-01 candidate: Environment-backed latency budget CI gate remains out-of-scope for this PR feedback implementation.
* DD-01 candidate: Choose reset-window cap recovery instead of larger in-flight-cap redesign to keep scope bounded to review findings.
