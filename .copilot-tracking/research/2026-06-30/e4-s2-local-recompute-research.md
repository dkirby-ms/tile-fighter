# E4-S2 Local Recompute Research

Status: Complete
Date: 2026-06-30
Scope: server-side local bonding recompute with bounded queue, no redundant bond events, and burst-lag budget

## Confirmed story intent

- docs/layer1-backlog.md:35 places E4 on the critical path for deterministic bonding and visual hooks.
- docs/layer1-backlog.md:264-270 defines E4-S2 as: recalculate only local neighborhoods, suppress redundant bond events when adjacency does not change, and keep recompute queue lag within budget.
- docs/layer1-backlog.md:271 adds the abuse concern: queue flood protection by account/IP.

## Current authoritative flow and touchpoints

- apps/server/src/http/app.ts:196-245 is the current post-commit placement path. It:
  - persists the tile,
  - emits tile_placed,
  - queries the neighborhood with selectBondNeighborhoodTiles,
  - runs evaluateBondType immediately,
  - emits bonding_triggered if a bond is found,
  - and includes bondType in the realtime delta fanout payload.
- apps/server/src/persistence/tile.repository.ts:920-956 is the neighborhood helper. It already queries only the four orthogonal local cells around the placed tile, ordered deterministically, so the remaining work is queueing and dedupe, not widening the spatial lookup.
- apps/server/src/telemetry/telemetry-sink.ts:117-172 already has the bond and placement-throttle telemetry surfaces: emitBondingTriggered and emitTilePlaceThrottled.
- apps/server/src/http/routes/tile.routes.ts:163-210 is where placement throttling is enforced before the repository write.
- apps/server/src/http/routes/session.routes.ts:15-47 shows the repo’s existing in-memory rate-window pattern for bootstrap, heartbeat, and reconnect.
- apps/server/src/domain/delta-fanout.service.ts:62-181 and 214-259 is the closest bounded-queue analogue: pending ack map, subscriber cap, timeout cleanup, and one-retransmit behavior.
- apps/server/src/index.ts:103-139 wires tilePlaceThrottlePolicy and deltaFanoutConfig into the server, which is the natural place to thread new recompute-queue limits.
- packages/shared-types/src/bonding.ts:1-116 keeps the bonding rule pure and deterministic, and packages/shared-types/src/index.ts:225-226 exports it.
- apps/server/tests/unit/bonding-evaluator.test.ts:8-46 already proves deterministic evaluator behavior, including equivalent reorderings.
- apps/server/tests/unit/delta-fanout.service.test.ts:186-259 already exercises bounded send behavior and window reset, which is the best local pattern to mirror for recompute queue tests.
- apps/server/tests/unit/tile.repository.telemetry.test.ts:6-146 already asserts one conflict telemetry pair per fresh conflict.
- apps/server/tests/load/placement-conflict-hotspot.load.ts:17, 122-217 is the existing burst-contention/load pattern to adapt for recompute lag and skip-rate validation.

## Recommended implementation path

1. Keep evaluateBondType pure in packages/shared-types and treat it as the rule engine, not the queue.
2. Introduce a dedicated server-side BondRecomputeCoordinator in apps/server/src/domain rather than extending delta fanout.
3. Enqueue recompute work after a successful placement commit, keyed by region plus affected local cell or local neighborhood fingerprint.
4. Coalesce duplicate pending work for the same key so repeated placements do not generate repeated bond events for unchanged adjacency.
5. Drain the queue with a bounded worker and explicit limits for maximum pending items, maximum drain batch, and max wait time; emit bond_recalc_started, bond_recalc_completed, and bond_recalc_skipped around the worker.
6. Use a last-emitted fingerprint per key (bond type plus neighborhood signature or equivalent) to suppress redundant bond events when the queue replays the same state.
7. Reuse the existing account/IP throttling style at the HTTP edge for enqueue flood protection, but keep the recompute queue itself separate from placement throttle logic.

Why this path: it preserves the current authoritative placement commit flow, keeps neighborhood lookup local, and isolates burst handling behind a small coordinator instead of overloading the realtime delivery pipeline.

## Alternatives considered

- Keep recompute synchronous inside apps/server/src/http/app.ts. Rejected because it preserves duplicate work under burst placement and gives no queue-lag budget.
- Reuse apps/server/src/domain/delta-fanout.service.ts for recompute. Rejected because that service is about outbound delivery, ack tracking, and retransmit, not bond-state dedupe.
- Persist recompute jobs in the database. Viable for crash resilience, but heavier than needed for this story and likely unnecessary if the objective is just bounded local recompute under live load.
- Put the coordinator in the route layer. Rejected because the queue belongs with domain behavior, not request parsing.

## Open questions and risks

- Queue shape is the main design risk: a FIFO of raw placements is simple, but a coalescing map keyed by region plus cell is better for redundant-event suppression. The unresolved point is whether the key should be region+cell, region+placement neighborhood, or region+signature.
- Flood protection needs a decision on scope. The backlog says account/IP, while the current placement throttle key is account plus region in apps/server/src/http/app.ts:264-306 and apps/server/src/http/routes/tile.routes.ts:163-210. Those are not the same policy surface.
- The story does not define whether no redundant bond events means no duplicate telemetry only, or no duplicate realtime fanout payloads as well. That affects whether dedupe lives before emitBondingTriggered or at the fanout boundary.
- If the queue is asynchronous, there is a contract question about whether bondType remains inline in the placement delta or becomes a follow-up bond event. The current app path injects bondType directly into the delta payload, so changing this may affect client expectations.
- Lag budget needs a precise measurement definition: enqueue-to-start, enqueue-to-complete, or end-to-end placement-to-bond publish. The load test should use the same definition the product expects.

## Likely test additions

- Add a unit test for the new BondRecomputeCoordinator that enqueues the same neighborhood repeatedly and asserts a single bond event for unchanged adjacency.
- Add a unit test that simulates queue saturation and verifies skipped-work telemetry plus bounded memory growth.
- Extend apps/server/tests/unit/delta-fanout.service.test.ts style timing tests for queue drain and stale-entry cleanup behavior.
- Add an integration test that places tiles in a burst and asserts only local neighbors are touched, bond output remains deterministic, and duplicate events are not emitted when the same state is reprocessed.
- Add a load test derived from apps/server/tests/load/placement-conflict-hotspot.load.ts to measure burst lag and skip rate under sustained placement bursts.

## Bottom line

The current code already does the right local neighborhood lookup and deterministic bond evaluation. E4-S2 mainly needs a bounded recompute coordinator, dedupe state, and queue-level flood protection so burst placements do not turn the bond step into an unbounded synchronous side effect.