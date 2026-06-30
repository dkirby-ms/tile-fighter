<!-- markdownlint-disable-file -->
# Task Research: E5-S1 Creator Placement Preview

## Research Status

Complete

## Task Implementation Requests

* Build an implementation plan for E5-S1.
* Scope strictly to shape and color selection, placement preview, blocked indicator, optimistic indicator until ack, telemetry, and input sanitization.

## Scope and Success Criteria

* Scope: E5-S1 only in apps/client with contract reuse from packages/shared-types and server placement route semantics.
* Assumptions:
  * apps/client remains the implementation surface for creator state primitives.
  * E5-S1 stays client-first and does not require immediate shared-type schema changes.
* Success Criteria:
  * Concrete files and seams for implementation are identified.
  * Deterministic unit and integration test surfaces are identified.
  * Validation commands are explicit.

## Key Findings

### Current Seams

* apps/client/src/index.ts exports session/auth primitives only and no creator flow owner.
* apps/client/src/session/realtime-delta-handler.ts already owns deterministic ack behavior that can resolve optimistic markers.
* packages/shared-types/src/index.ts already defines TilePlaceCommand and TilePlaceResult.
* apps/server/src/http/routes/tile.routes.ts validates placement payload and commandId shape.

### E5-S1 Story Requirements

From docs/layer1-backlog.md E5-S1:

* Preview updates on shape and color selection.
* Blocked indicator for occupied cell hover.
* Optimistic indicator on valid placement until ack.
* Telemetry events: palette_opened, shape_selected, color_selected, placement_preview_shown.
* Input sanitization before command submit.

### Recommended Implementation Path

Add deterministic creator modules in apps/client under a new creator folder:

* tool-state.ts
* placement-preview.ts
* placement-input.ts
* placement-caller.ts
* creator-telemetry.ts

Integrate by exporting the new modules in apps/client/src/index.ts and keep realtime ack ordering behavior unchanged.

### Shared-Type Impact

No required shared-types change for E5-S1. Reuse current TilePlaceCommand and TilePlaceResult.

Optional follow-on: shape and color unions in shared-types to reduce drift.

### Tests and Validation

New tests:

* apps/client/tests/unit/tool-state.test.ts
* apps/client/tests/unit/placement-preview.test.ts
* apps/client/tests/unit/placement-input.test.ts
* apps/client/tests/unit/placement-caller.test.ts
* apps/client/tests/integration/e5-s1-placement-flow.test.ts

Validation commands:

* npm run -w @game/client lint
* npm run -w @game/client test
* npm run -w @game/client build
* npm run lint
* npm run test

## Alternative Path Evaluated

Alternative: one imperative creator-session module with inline state and side effects.

Trade-offs:

* Faster short-term coding.
* Higher regression risk and weaker deterministic test coverage.
* Telemetry hooks become harder to stabilize across later E5 stories.

Decision: reject alternative and keep reducer plus pure evaluator style.

## Open Questions

* Should optimistic indicator clear on HTTP response, realtime ack, or both with precedence rules?
* Should shape and color constraints stay local in E5-S1 or be promoted to shared-types immediately?
