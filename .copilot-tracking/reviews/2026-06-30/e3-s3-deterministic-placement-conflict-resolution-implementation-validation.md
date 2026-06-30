<!-- markdownlint-disable-file -->
# Implementation Validation: E3-S3 Deterministic Placement Conflict Resolution

## Metadata

* Validation Date: 2026-06-30
* Scope: Full quality review of E3-S3 changed files
* Source Inputs:
  * .copilot-tracking/plans/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-plan.instructions.md
  * .copilot-tracking/changes/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-changes.md
  * .copilot-tracking/research/2026-06-30/e3-s3-deterministic-placement-conflict-resolution-research.md

## Summary

Implementation quality is close to acceptance but currently needs rework due to runtime configuration and evidence-quality gaps in high-risk concurrency paths.

Severity counts:

* Critical: 0
* Major: 2
* Minor: 2

## Findings

### Major

1. Replay-window runtime config is defined but not applied to repository construction.

Evidence:

* Config mapping exists in apps/server/src/config/env.ts.
* Repository construction in apps/server/src/index.ts does not pass replay window.
* Repository default remains fixed in apps/server/src/persistence/tile.repository.ts.

Risk:

* PLACEMENT_COMMAND_REPLAY_WINDOW_SECONDS does not affect runtime behavior.

2. Deterministic race and hotspot tests use mocked repositories for key scenarios.

Evidence:

* Mocked race path in apps/server/tests/integration/placement-conflict-resolution.integration.test.ts.
* Mocked hotspot path in apps/server/tests/load/placement-conflict-hotspot.load.ts.

Risk:

* Real transactional determinism and side-effect bounds can regress while tests still pass.

### Minor

1. Missing direct test coverage for malformed command identity response branch.

Evidence:

* Branch exists in apps/server/src/http/routes/tile.routes.ts.
* No explicit malformed_command_identity assertions identified in tests.

2. Repository input contract still permits missing commandId via legacy fallback path.

Evidence:

* Optional input and fallback generation in apps/server/src/persistence/tile.repository.ts.
* Shared contract requires commandId in packages/shared-types/src/index.ts.

## Recommendations

1. Wire runtime replay window from env config into repository creation and add regression test.
2. Add at least one non-mocked DB-backed contention scenario for race and hotspot validation.
3. Add malformed_command_identity negative tests at API boundary.
4. Decide on fallback commandId deprecation timeline and enforce repository contract accordingly.

## Verdict

Needs Rework
