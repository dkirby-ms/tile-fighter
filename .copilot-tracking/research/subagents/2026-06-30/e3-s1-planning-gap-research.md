---
title: E3-S1 Planning Gap Research
description: Planning gap analysis for E3-S1 reliable room join and rejoin, with validated codepaths and command conventions.
author: Researcher Subagent
ms.date: 2026-06-30
ms.topic: reference
---

## Research Scope and Questions

* Scope: Identify planning gaps for E3-S1 (reliable room join and rejoin) using existing research and quick verification of implementation files and workspace command conventions.
* Questions:
* What is already implemented versus still missing for E3-S1 acceptance criteria?
* Which gaps are true blockers for planning and sequencing?
* What phase ordering is lowest risk given current code structure?
* Which validation commands align with repository and workspace scripts?

## Sources Reviewed

* .copilot-tracking/research/2026-06-30/e3-s1-implementation-research.md
* .copilot-tracking/research/2026-06-29/e3-epic-research.md
* package.json
* apps/server/package.json
* apps/client/package.json
* apps/server/src/rooms/arena.room.ts
* apps/server/src/session/session-lifecycle.service.ts
* apps/server/src/domain/region-diff.service.ts
* apps/client/src/session/heartbeat-caller.ts
* apps/client/src/auth/join-token-caller.ts
* apps/client/tests/unit/heartbeat-caller.test.ts
* apps/client/tests/unit/join-token-caller.test.ts
* apps/server/vitest.config.ts
* apps/client/vitest.config.ts

## Validated Current Implementation State

### What is already present

* Join token auth gate exists in room join path.
* Evidence: apps/server/src/rooms/arena.room.ts
* In-memory session presence and stale cleanup exist.
* Evidence: apps/server/src/session/session-lifecycle.service.ts
* Region diff retrieval has deterministic sort and latest-per-coordinate compaction for viewport polling.
* Evidence: apps/server/src/domain/region-diff.service.ts
* Client authenticated join-token and heartbeat callers exist, including one-time retry on 401 and interaction-required escalation.
* Evidence: apps/client/src/auth/join-token-caller.ts, apps/client/src/session/heartbeat-caller.ts
* Client unit tests exist for these caller behaviors.
* Evidence: apps/client/tests/unit/join-token-caller.test.ts, apps/client/tests/unit/heartbeat-caller.test.ts

### What remains missing for E3-S1

* No durable session checkpoint model for reconnect/rejoin continuity.
* Gap: no persisted checkpoint table/service storing player identity, region, last confirmed version, checksum, and reconnect metadata.
* No explicit reconnect grace-period state machine.
* Gap: room/session lifecycle currently removes stale presence based on TTL, but has no stale-to-resume checkpoint transition semantics.
* No E3-S1 replay-specific server flow from checkpoint version to current version.
* Gap: region diff exists, but no dedicated rejoin replay orchestration tied to checkpoint version and resume token.
* No client checksum validation path for replay completion.
* Gap: client heartbeat/join callers are auth-ready, but replay hash verification flow is not implemented.
* No confirmed delta-retention SLA tied to active checkpoints.
* Gap: existing delta retrieval exists, but no validated policy and cleanup design that guarantees replay availability window.

## Planning Gaps That Should Influence Sprint Planning

* Data model gap first: E3-S1 planning is under-specified without a checkpoint persistence contract.
* API contract gap: reconnect and rejoin semantics need explicit payload and token contract before implementation can proceed cleanly.
* Ownership gap: replay orchestration boundary is unclear.
* Clarify whether replay coordinator lives in session lifecycle service, room lifecycle, or HTTP route layer.
* Operational gap: delta retention and checkpoint retention must be co-designed; implementing either alone risks replay failure or unbounded growth.
* Verification gap: acceptance tests for reconnect within grace period and rejoin after grace expiry are not yet represented as named integration tests in current test tree.

## Recommended Implementation Phase Ordering

1. Define durable checkpoint contract and schema.
2. Implement server-side checkpoint lifecycle and reconnect grace state transitions.
3. Implement replay orchestration from checkpoint version using existing diff primitives.
4. Add client replay apply and checksum validation flow.
5. Add retention and cleanup policies for checkpoints and deltas with telemetry.
6. Add integration and smoke test coverage for AC1, AC2, and AC3.

## Validation Command Conventions

Repository-level conventions (from root package scripts):

* Lint all workspaces: npm run lint
* Test all workspaces: npm run test
* Build monorepo: npm run build

Workspace-specific conventions:

* Server lint: npm run -w @game/server lint
* Server tests: npm run -w @game/server test
* Server load scripts: npm run -w @game/server test:load
* Client lint: npm run -w @game/client lint
* Client tests: npm run -w @game/client test

Recommended E3-S1 validation sequence:

1. npm run -w @game/server test
2. npm run -w @game/client test
3. npm run test
4. npm run lint

## Unresolved Gaps and Clarifying Questions

* Should reconnect be authorized by a dedicated reconnect token or by reusing join-token semantics with additional claims?
* What exact grace period and retention defaults should be considered product requirements versus environment configuration?
* Is checksum expected per replay batch completion only, or per delta step for diagnostics and fail-fast behavior?
* Should replay validation be scoped strictly to viewport state or full-region canonical state for anti-desync guarantees?
* What is the expected behavior when replay data needed by checkpoint is beyond retention window?

## Research Status

* Status: Complete
* Confidence: High for codepath and command-convention verification; Medium-high for policy defaults pending product decisions on reconnect token semantics and retention SLAs.
