---
title: E4 Epic and E4-S1 Repository Research
description: Verified repository research for epic E4 (deterministic bonding engine and visual effects) and story E4-S1.
ms.date: 2026-06-30
ms.topic: reference
---

## Title and scope

Research scope: deep repository-only investigation for epic E4 and task/story E4-S1, focused on requirements source, current deterministic simulation architecture, integration points, testing patterns, risks, and implementable alternatives.

## Evidence log

- docs/layer1-backlog.md:35 defines E4 scope as glow/blend/pulse logic, local recalculation, and visual hooks.
- docs/layer1-backlog.md:249-263 defines E4-S1 story text, acceptance criteria, technical note (pure evaluator in shared domain module), required tests, and `bonding_triggered` telemetry.
- docs/layer1-backlog.md:266-290 defines E4-S2 and E4-S3 dependencies: local neighborhood recompute and reduced-motion visual behavior are downstream from E4-S1.
- .copilot-tracking/github-relationships.md:23-27 maps E4 (#4) to stories #21-#24; .copilot-tracking/github-relationships.md:74-76 marks E4-S1 blocking E4-S2 and E4-S4.
- .copilot-tracking/github-issues/sprint/layer1-mvp/issues-plan.md:47-55 records epic creation intent for E4 deterministic bonding and visual reliability.
- apps/server/src/http/app.ts:196-220 dispatches realtime delta payloads on successful placement; this is the existing post-commit hook where bond-trigger events can be emitted.
- apps/server/src/persistence/tile.repository.ts:241-343 is the authoritative placement write path (command hash, insert, region version bump, tile_deltas append).
- apps/server/src/domain/combat-simulation.service.ts:17-50 provides canonical payload hashing for command determinism but no bonding evaluator yet.
- apps/server/src/domain/region-hash.ts:43-53 and 54-98 provide deterministic canonical sorting and hashing patterns reusable for bond-rule determinism.
- apps/server/src/domain/region-diff.service.ts:91-117 compacts and sorts deltas deterministically; useful pattern for stable bond output ordering.
- apps/client/src/session/realtime-delta-handler.ts:10-23 and 85-109 consumes only tile delta fields and always acks; no bond event contract exists yet.
- packages/shared-types/src/index.ts:84-117 (TilePlaceResult) and 195-223 (RegionDiff types) contain no bond-type or bond-event contract.
- apps/server/src/telemetry/telemetry-sink.ts:98-135 has placement events, but no `bonding_triggered` method currently.
- apps/server/tests/unit/tile.repository.command-ledger.test.ts:240-320 shows deterministic payload-mismatch testing pattern.
- apps/server/tests/unit/region-diff.service.test.ts:137-237 shows deterministic ordering, latest-wins compaction, and truncation assertions.
- apps/client/tests/unit/replay-checksum.test.ts:141-172 shows deterministic same-output-for-reordered-input pattern.
- apps/server/tests/integration/placement-conflict-resolution.integration.test.ts:119-225 shows concurrent deterministic winner/loser integration style.
- apps/server/tests/load/placement-conflict-hotspot.load.ts:117-214 and apps/server/tests/load/region-diff-load.ts:25-178 show current load-test harness patterns.

## Key discoveries

- E4 and E4-S1 are clearly defined in backlog and linked to epic/story issue numbers in tracking artifacts.
- E4-S1 requirements are explicit enough to implement without external issue text.
- Placement is authoritative in repository + HTTP wiring; there is a stable post-commit fanout hook in apps/server/src/http/app.ts.
- Determinism primitives already exist: canonical hashing (server and client) and stable diff ordering.
- There is no existing bond evaluator implementation in server, client, or shared packages.
- There is no bond payload in shared contracts or client realtime handler.
- Reduced-motion support is defined in backlog (E4-S3) but no runtime code path currently exists.
- Existing tests provide reusable patterns for deterministic unit tests, concurrent integration tests, and load scenarios.

## Technical scenarios for E4-S1

- Scenario A: Same-hue adjacency on placement
  - Trigger: successful placement at (x,y).
  - Evaluation input: placed tile plus neighboring tiles.
  - Output: `glow-chain` bond type emitted deterministically.
- Scenario B: Two-color adjacency on placement
  - Trigger: successful placement where neighboring colors produce two-color pattern.
  - Output: `blend-gradient` bond type emitted.
- Scenario C: Alternating pair pattern on placement
  - Trigger: successful placement creates alternating pair pattern in local neighborhood.
  - Output: `pulse-rhythm` bond type emitted.

Implementation note for all three: local neighborhood extraction can start with current repository capabilities and remain deterministic via explicit sort order, then be optimized in E4-S2.

## Alternatives considered

1. Server-only evaluator in apps/server/src/domain
- Summary: implement pure evaluator only in server; emit telemetry and optional event from server path.
- Pros: minimal package churn, fastest to ship.
- Cons: does not satisfy "shared domain module" intent cleanly; client reuse in E4-S3 likely duplicates logic.

2. Add evaluator into existing shared types package
- Summary: add bonding types + pure evaluator in packages/shared-types/src (or submodule), consume from server now and client later.
- Pros: satisfies shared module intent with low overhead; enables one deterministic implementation across server/client tests.
- Cons: mixes domain logic into a package currently focused on contracts.

3. New dedicated shared package (for example packages/shared-bonding)
- Summary: create dedicated package for bond rules/types/fixtures and import from server/client.
- Pros: clean boundaries, best long-term architecture for E4-S1/E4-S4.
- Cons: highest setup overhead (package config, build wiring, CI updates), slower initial delivery.

4. Client-side only evaluator
- Summary: compute bond types only on client after receiving tile deltas.
- Pros: low server changes.
- Cons: violates authoritative deterministic behavior goals and weakens E4-S4 regression confidence.

## Recommended approach with rationale

Recommended: Alternative 2 (shared evaluator in existing shared types package) as an incremental path.

Rationale:
- Delivers E4-S1 quickly while aligning with the explicit technical note "pure bonding evaluator in shared domain module".
- Reuses existing deterministic design patterns already present in server/client checksum and diff ordering code.
- Minimizes immediate package/setup complexity versus creating a brand new package.
- Keeps a clean migration path to Alternative 3 later if domain growth warrants package split.

## Constraints, risks, and gaps

- Gap: no local artifact with full GitHub issue #21 body text was found; backlog story text is used as source of truth.
- Gap: no current bond event schema in packages/shared-types/src/index.ts.
- Gap: no server telemetry API for `bonding_triggered` yet.
- Gap: no client render/VFX layer for bond events yet; reduced-motion behavior is backlog-only (E4-S3).
- Risk: if E4-S1 computes neighborhood by scanning whole region via current repository surface, it may create performance debt before E4-S2.
- Risk: introducing non-canonical iteration order in evaluator or neighborhood collection can break deterministic outputs.
- Risk: expanding realtime payload too early can create client compatibility churn; a phased contract addition is safer.

## Concrete implementation checklist for E4-S1

- Add shared bond rule model and evaluator
  - Edit: packages/shared-types/src/index.ts
  - Add: bond type union (`glow-chain`, `blend-gradient`, `pulse-rhythm`) and pure evaluator API with deterministic input ordering contract.
  - Optional add: packages/shared-types/src/bonding.ts and re-export in index.

- Add server evaluation and emission on successful place
  - Edit: apps/server/src/http/app.ts (placement success path around existing fanout at lines 196-220).
  - Wire evaluator call immediately after authoritative placement success and before/alongside fanout.

- Add telemetry event support
  - Edit: apps/server/src/telemetry/telemetry-sink.ts
  - Add method for `bonding_triggered` with bond type and region/cell attributes.

- Add neighborhood retrieval helper for evaluator input
  - Edit: apps/server/src/persistence/tile.repository.ts
  - Prefer bounded neighborhood query API (3x3 or defined local radius) to avoid full-region scans.
  - If using temporary full-region selection, document as interim and track optimization in E4-S2.

- Add tests for E4-S1
  - Add unit: apps/server/tests/unit/bonding-evaluator.test.ts (rule matrix for 3 bond types, deterministic ordering invariance).
  - Add integration: apps/server/tests/integration/tile-bonding-trigger.integration.test.ts (placement triggers expected bond type).
  - Add deterministic/property-style tests: extend corpus approach seen in apps/client/tests/unit/replay-checksum.test.ts.
  - Add load/scenario placeholder or extension: apps/server/tests/load/placement-conflict-hotspot.load.ts or new bonding-focused load test for dense adjacency bursts.

- Add contract tests if payload is exposed to clients
  - Edit/Add: apps/client/tests/unit/realtime-delta-handler.test.ts and shared contract tests as needed once bond payload is included.

## Assumptions

- E4-S1 acceptance source is docs/layer1-backlog.md because GitHub issue #21 body is not present in local repository artifacts.
- E4-S1 should remain server-authoritative, with client rendering concerns deferred to E4-S3.
