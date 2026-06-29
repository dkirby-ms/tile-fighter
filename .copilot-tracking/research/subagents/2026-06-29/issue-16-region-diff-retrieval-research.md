---
title: Issue 16 Region Diff Retrieval Research
description: Requirement extraction and codebase mapping for story(layer1) E2-S4 region diff retrieval API in dkirby-ms/tile-fighter.
author: GitHub Copilot Researcher Subagent
ms.date: 2026-06-29
ms.topic: reference
keywords:
  - issue-16
  - region-diff
  - api
  - layer1
  - server
estimated_reading_time: 12
---

## Research Scope

This document maps GitHub issue #16, story(layer1): E2-S4 region diff retrieval API, to the current apps/server implementation.

Research questions:

1. What are the explicit requirements and acceptance criteria from issue #16?
2. Which current server code paths are relevant to HTTP routing, auth, snapshot or diff persistence, and integration tests?
3. What API conventions are currently used for auth, errors, and response payloads?
4. What gaps exist between the issue requirements and the current implementation?
5. What requirement ambiguities should be clarified before implementation?

## Issue Requirement Extraction

Source: GitHub issue dkirby-ms/tile-fighter#16, title story(layer1): E2-S4 region diff retrieval API.

Extracted requirements:

* Story intent: client requests region tile diffs to fetch only nearby state.
* Acceptance criteria 1: viewport request returns only relevant region tiles.
* Acceptance criteria 2: unchanged version returns an empty diff response.
* Acceptance criteria 3: stale version returns incremental updates.
* Technical note: add region version index and diff endpoint.
* Test requirements: unit diff assembler, integration versioned diff, load read amplification.
* Telemetry requirements: tile_diff_requested and tile_diff_returned events.
* Security or abuse checks: request bounds and max payload limits.
* Dependency: E2-S1.

## Relevant Existing Code Paths In apps/server

### HTTP routes and app wiring

* Global route wiring applies auth middleware before most API routes, then mounts protected, snapshot, tile, and session routes. This is the main insertion point for a new diff endpoint.
  source: apps/server/src/http/app.ts:33
  source: apps/server/src/http/app.ts:34
  source: apps/server/src/http/app.ts:37
  source: apps/server/src/http/app.ts:44
  source: apps/server/src/http/app.ts:127
* Current route inventory has health, protected profile, session bootstrap or join-token or heartbeat, tile place or edit, and admin snapshot create or restore-latest.
  source: apps/server/src/http/routes/health.routes.ts:7
  source: apps/server/src/http/routes/health.routes.ts:11
  source: apps/server/src/http/routes/protected.routes.ts:6
  source: apps/server/src/http/routes/session.routes.ts:50
  source: apps/server/src/http/routes/session.routes.ts:101
  source: apps/server/src/http/routes/session.routes.ts:139
  source: apps/server/src/http/routes/tile.routes.ts:103
  source: apps/server/src/http/routes/tile.routes.ts:144
  source: apps/server/src/http/routes/snapshot.routes.ts:58
  source: apps/server/src/http/routes/snapshot.routes.ts:79
* No region diff retrieval route currently exists.
  source: apps/server/src/http/routes/health.routes.ts:1
  source: apps/server/src/http/routes/protected.routes.ts:1
  source: apps/server/src/http/routes/session.routes.ts:1
  source: apps/server/src/http/routes/tile.routes.ts:1
  source: apps/server/src/http/routes/snapshot.routes.ts:1

### Auth and authorization

* Auth middleware extracts Bearer token, verifies it with AuthService, stores principal in res.locals, and returns 401 Unauthorized on failures.
  source: apps/server/src/http/auth-middleware.ts:61
  source: apps/server/src/http/auth-middleware.ts:62
  source: apps/server/src/http/auth-middleware.ts:65
  source: apps/server/src/http/auth-middleware.ts:69
* Principal authorization flag is derived in middleware via roles, groups, wids, or scp and normalized to authorization.isOperator.
  source: apps/server/src/http/auth-middleware.ts:45
  source: apps/server/src/http/auth-middleware.ts:51
* Snapshot restore is currently operator-only and returns 403 Forbidden for non-operators.
  source: apps/server/src/http/routes/snapshot.routes.ts:79
* Shared principal type already includes authorization and role-like claims.
  source: packages/shared-types/src/index.ts:3
  source: packages/shared-types/src/index.ts:14

### Region snapshot and persistence foundations

* Server DB schema currently includes tiles plus snapshot tables region_snapshots and region_snapshot_tiles.
  source: apps/server/src/persistence/db.ts:43
  source: apps/server/src/persistence/db.ts:44
  source: apps/server/src/persistence/db.ts:45
* Snapshot repository supports create snapshot, fetch latest snapshot for region, and restore region from snapshot.
  source: apps/server/src/persistence/region-snapshot.repository.ts:38
  source: apps/server/src/persistence/region-snapshot.repository.ts:42
  source: apps/server/src/persistence/region-snapshot.repository.ts:46
* Snapshot service computes deterministic region hash and provides createSnapshot and restoreLatest orchestration.
  source: apps/server/src/domain/region-snapshot.service.ts:78
  source: apps/server/src/domain/region-snapshot.service.ts:88
  source: apps/server/src/domain/region-snapshot.service.ts:113
* Tile repository supports full region reads and point coordinate reads, which are potential primitives for diff assembly.
  source: apps/server/src/persistence/tile.repository.ts:208
  source: apps/server/src/persistence/tile.repository.ts:223
* Existing migrations create tile table and snapshot tables, but do not define any version index for tile diffs.
  source: apps/server/src/persistence/migrations/1720000000000_tiles.js:7
  source: apps/server/src/persistence/migrations/1730000000000_region_snapshots.js:7

### Integration and load tests

* Snapshot and restore behavior is covered by dedicated integration tests and restore drill smoke test.
  source: apps/server/tests/integration/region-snapshot-replay.integration.test.ts:20
  source: apps/server/tests/integration/region-restore-drill.smoke.test.ts:12
* Auth integration covers unauthorized and valid token flows.
  source: apps/server/tests/integration/http-auth.integration.test.ts:10
* Tile persistence integration covers region query and coordinate conflict behavior.
  source: apps/server/tests/integration/tile-persistence.integration.test.ts:50
* Existing load test focus is room join behavior, not read amplification for diff retrieval.
  source: apps/server/tests/load/room-join-load.ts:1

## Current API Conventions

### Error handling conventions

* Unauthorized requests typically return status 401 with {"error":"Unauthorized"}.
  source: apps/server/src/http/auth-middleware.ts:69
* Validation errors return status 400 with an error string message.
  source: apps/server/src/http/routes/tile.routes.ts:111
  source: apps/server/src/http/routes/session.routes.ts:107
  source: apps/server/src/http/routes/snapshot.routes.ts:70
* Domain conflict or policy conflicts return status 409 when applicable.
  source: apps/server/src/http/routes/tile.routes.ts:127
  source: apps/server/src/http/routes/snapshot.routes.ts:112
* Forbidden actions return status 403 with {"error":"Forbidden"}.
  source: apps/server/src/http/routes/snapshot.routes.ts:89
* Rate limiting returns status 429 with explicit error strings.
  source: apps/server/src/http/routes/session.routes.ts:64
  source: apps/server/src/http/routes/session.routes.ts:157

### Response shape conventions

* Route responses are JSON and mostly explicit per endpoint, not centrally wrapped.
  source: apps/server/src/http/routes/protected.routes.ts:8
  source: apps/server/src/http/routes/session.routes.ts:75
* Tile command endpoints use discriminated union shape with ok true or false and reason-specific payloads.
  source: apps/server/src/http/routes/tile.routes.ts:124
  source: apps/server/src/http/routes/tile.routes.ts:135
  source: apps/server/src/http/routes/tile.routes.ts:168
* Snapshot endpoints currently return direct command result objects, not ok-wrapped unions.
  source: apps/server/src/http/routes/snapshot.routes.ts:76
  source: apps/server/src/http/routes/snapshot.routes.ts:103

### Auth conventions

* Auth is app-wide for API routes after health checks because auth middleware is mounted globally before protected, snapshot, tile, and session routes.
  source: apps/server/src/http/app.ts:33
* Role-sensitive authorization checks are done in route logic using principal.authorization.isOperator.
  source: apps/server/src/http/routes/snapshot.routes.ts:88

### Telemetry conventions

* Telemetry uses TelemetrySink.emit with event name and flat attributes.
  source: apps/server/src/telemetry/telemetry-sink.ts:15
* Event-specific helper methods exist for tile and snapshot lifecycle events.
  source: apps/server/src/telemetry/telemetry-sink.ts:100
  source: apps/server/src/telemetry/telemetry-sink.ts:166
  source: apps/server/src/telemetry/telemetry-sink.ts:184
  source: apps/server/src/telemetry/telemetry-sink.ts:204

## Gap Analysis Against Issue #16

1. Missing region diff retrieval endpoint

* No endpoint currently handles viewport plus version requests for diff retrieval.
* Existing HTTP routes do not include any /api/regions/.../diff style path.

2. Missing region version index model

* Current DB and repositories have tiles and snapshots, but no explicit per-region version index or tile-change versioning for stale or unchanged version comparisons.
* No shared type contract exists for diff request or response payloads in shared-types.

3. Missing diff assembler logic

* There is no server service or repository method that computes incremental updates between client version and current region state.
* No logic exists for unchanged version returning empty diff payload.

4. Missing required telemetry events for diff API

* Required events tile_diff_requested and tile_diff_returned are not currently emitted or defined in TelemetrySink helper methods.
* Existing telemetry is centered on session, tile placement or edit, and snapshot restore flows.

5. Missing issue-specific security controls

* Issue requires request bounds and max payload limits for diff retrieval.
* Current request validation checks type and required fields for existing endpoints, but there is no viewport boundary validation or payload-size cap policy for diff responses.

6. Missing required tests for issue #16

* No unit tests for diff assembler behavior.
* No integration tests for versioned diff scenarios.
* No load test for diff read amplification; existing load test is room join focused.

## Suggested Open Questions

1. Endpoint contract

* Should diff retrieval be GET with query params or POST with JSON viewport payload?
* Expected canonical path: /api/regions/diff, /api/regions/:regionId/diff, or another route?

2. Version model

* What exact version token should clients send: integer sequence, snapshot_id, hash, or timestamp?
* Should version be region-wide or viewport-scoped?

3. Diff semantics

* Should responses include additions and updates only, or also deletions as tombstones?
* For viewport filtering, how are boundary inclusivity and coordinate normalization defined?

4. Response and pagination limits

* What hard max payload limit is required?
* Should large diffs support paging or continuation tokens?

5. Auth and tenancy behavior

* Is diff retrieval available to all authenticated players or gated by role for some regions?
* Any tenant boundary checks beyond tenantScopedSubject identity mapping?

6. Telemetry schema

* Which attributes are mandatory for tile_diff_requested and tile_diff_returned?
* Should telemetry include viewport dimensions, result tile count, version delta size, and elapsed time?

## Research Status

Complete for requested scope.

The issue requirements were extracted, relevant apps/server code paths and conventions were mapped with line-level citations, and implementation gaps plus open requirement questions were identified.