---
title: Issue 16 Region Diff Retrieval API Alternatives
description: API and data-model alternatives for story(layer1) E2-S4 region diff retrieval with recommendation and implementation sequence.
author: GitHub Copilot Researcher Subagent
ms.date: 2026-06-29
ms.topic: reference
keywords:
  - issue-16
  - region-diff
  - api-design
  - persistence
  - server
estimated_reading_time: 14
---

## Scope

This research evaluates implementation alternatives for Issue #16 region diff retrieval API in this repository.

Questions answered:

1. Which API contract and data-model approaches are viable in current code patterns?
2. How do options compare on architecture flow, complexity, performance, testability, migration impact, and convention fit?
3. Which approach should be selected now, and which should be rejected?
4. What concrete pseudo-contracts and file-level implementation plan should guide delivery?

## Repository Evidence Summary

Current HTTP and auth conventions:

* App-wide auth middleware is applied before most API routes and route modules are mounted from `createHttpApp`: apps/server/src/http/app.ts:27, apps/server/src/http/app.ts:33, apps/server/src/http/app.ts:37, apps/server/src/http/app.ts:44, apps/server/src/http/app.ts:127.
* Existing API shape is primarily `POST` for mutating actions (`/api/tiles/place`, `/api/tiles/edit`) and `GET` for simple reads (`/api/session/bootstrap`): apps/server/src/http/routes/tile.routes.ts:103, apps/server/src/http/routes/tile.routes.ts:144, apps/server/src/http/routes/session.routes.ts:50.
* Current route validation style is explicit type guards and `400` for invalid command payloads: apps/server/src/http/routes/tile.routes.ts:58, apps/server/src/http/routes/tile.routes.ts:79, apps/server/src/http/routes/tile.routes.ts:111, apps/server/src/http/routes/tile.routes.ts:152.
* Unauthorized shape is `401 { error: "Unauthorized" }`: apps/server/src/http/auth-middleware.ts:69.
* Existing bounded abuse pattern uses in-memory per-subject/per-IP rate windows and returns `429`: apps/server/src/http/routes/session.routes.ts:18, apps/server/src/http/routes/session.routes.ts:20, apps/server/src/http/routes/session.routes.ts:22, apps/server/src/http/routes/session.routes.ts:63, apps/server/src/http/routes/session.routes.ts:157.

Current persistence and snapshot baseline:

* `tiles` has region and coordinate indices, but no version column and no change-log table: apps/server/src/persistence/migrations/1720000000000_tiles.js:59, apps/server/src/persistence/migrations/1720000000000_tiles.js:73, apps/server/src/persistence/migrations/1720000000000_tiles.js:74.
* DB typings include `tiles`, `region_snapshots`, and `region_snapshot_tiles` only: apps/server/src/persistence/db.ts:49, apps/server/src/persistence/db.ts:51, apps/server/src/persistence/db.ts:52, apps/server/src/persistence/db.ts:53.
* Tile repository currently supports full-region read and point read, not incremental-by-version read: apps/server/src/persistence/tile.repository.ts:208, apps/server/src/persistence/tile.repository.ts:223.
* Snapshot service and repository are full-copy oriented for create/restore and hash verification, which provides a ready reference for deterministic region-state computation patterns: apps/server/src/domain/region-snapshot.service.ts:78, apps/server/src/domain/region-snapshot.service.ts:88, apps/server/src/domain/region-snapshot.service.ts:113, apps/server/src/persistence/region-snapshot.repository.ts:54, apps/server/src/persistence/region-snapshot.repository.ts:92, apps/server/src/persistence/region-snapshot.repository.ts:119.

Telemetry and testing baseline:

* Telemetry uses helper methods on top of a generic `emit(eventName, attributes)` sink; required Issue #16 events `tile_diff_requested` and `tile_diff_returned` are not present yet: apps/server/src/telemetry/telemetry-sink.ts:15, apps/server/src/telemetry/telemetry-sink.ts:107, apps/server/src/telemetry/telemetry-sink.ts:166, apps/server/src/telemetry/telemetry-sink.ts:184, apps/server/src/telemetry/telemetry-sink.ts:204.
* Integration coverage style for route behavior and role/error branches exists and can be mirrored for diff retrieval: apps/server/tests/integration/http-auth.integration.test.ts:17, apps/server/tests/integration/region-snapshot-replay.integration.test.ts:88, apps/server/tests/integration/region-snapshot-replay.integration.test.ts:120, apps/server/tests/integration/region-snapshot-replay.integration.test.ts:171.
* Load testing currently exists for placement contention and heartbeat throttle, but not diff read amplification: apps/server/tests/load/room-join-load.ts:26, apps/server/tests/load/room-join-load.ts:117.

## Alternative 1: GET Viewport Diff With Region-Watermark Version

### Pseudo-contract

```http
GET /api/regions/{regionId}/diff?sinceVersion=123&minCellX=0&maxCellX=40&minCellY=0&maxCellY=25
Authorization: Bearer <token>
```

```json
{
  "ok": true,
  "regionId": "arena-main",
  "sinceVersion": 123,
  "currentVersion": 126,
  "isEmpty": false,
  "tiles": [
    {
      "cellX": 10,
      "cellY": 12,
      "offsetX": 0.1,
      "offsetY": 0.0,
      "shape": "square",
      "color": "red",
      "stylePayload": { "v": 2 },
      "ownerId": "tenant-a|player-1",
      "version": 124,
      "operation": "upsert"
    }
  ],
  "deleted": [
    { "cellX": 9, "cellY": 12, "version": 125 }
  ]
}
```

### Data model

* Add `region_versions` table with one row per region (`region_id`, `current_version`, `updated_at`).
* Add `tile_deltas` append-only table (`region_id`, `version`, `cell_x`, `cell_y`, `operation`, full tile payload nullable for deletes, `changed_at`).
* On every place/edit/delete, increment region version transactionally and append one delta row.

### Architecture flow

1. Client requests diff with viewport + `sinceVersion`.
2. Route validates bounds and caps area size.
3. Service fetches `currentVersion` from `region_versions`.
4. If `sinceVersion === currentVersion`, return empty diff.
5. Else repository reads `tile_deltas` for `version > sinceVersion`, filtered by viewport.
6. Service compacts deltas by coordinate (latest write wins), returns upserts + deletions and watermark.

### Complexity

* Medium-high.
* Requires new write-path behavior in tile place/edit (and future delete) to maintain version/delta consistency.

### Performance implications

* Best read efficiency for stale clients if index `(region_id, version)` and viewport predicate strategy are tuned.
* Read amplification is bounded by number of changes since version, not full region cardinality.
* Write amplification increases by one delta insert + one version update per mutation.

### Testability

* Strongly testable with deterministic diff assembler unit tests and integration tests for unchanged/stale paths.
* Requires additional concurrency tests for transactional version increments.

### Migration impact

* New migration(s) for `region_versions` + `tile_deltas` and indices.
* Optional backfill of initial version from existing tiles can start at version `0` without data rewrite.

### Compatibility with existing conventions

* Fits existing explicit route validation and typed result style from tile routes.
* Deviates slightly from current POST-heavy command style by introducing a GET with many query parameters.

## Alternative 2: POST Diff Query With Region-Watermark Version (Recommended)

### Pseudo-contract

```http
POST /api/regions/diff
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "regionId": "arena-main",
  "sinceVersion": 123,
  "viewport": {
    "minCellX": 0,
    "maxCellX": 40,
    "minCellY": 0,
    "maxCellY": 25
  },
  "maxTiles": 500
}
```

```json
{
  "ok": true,
  "regionId": "arena-main",
  "sinceVersion": 123,
  "currentVersion": 126,
  "isEmpty": false,
  "nextSinceVersion": 126,
  "tiles": [
    {
      "cellX": 10,
      "cellY": 12,
      "offsetX": 0.1,
      "offsetY": 0.0,
      "shape": "square",
      "color": "red",
      "stylePayload": { "v": 2 },
      "ownerId": "tenant-a|player-1",
      "version": 124,
      "operation": "upsert"
    }
  ],
  "deleted": [
    { "cellX": 9, "cellY": 12, "version": 125 }
  ],
  "truncated": false
}
```

### Data model

Same as Alternative 1:

* `region_versions` watermark table.
* `tile_deltas` append-only indexable changelog.
* Transactional writes from tile command paths.

### Architecture flow

1. Authenticated caller posts `regionId`, `sinceVersion`, and viewport.
2. Route validates all required fields, numeric ranges, viewport bounds, and `maxTiles` cap.
3. Service emits `tile_diff_requested` with request metadata.
4. Repository reads current version and incremental deltas.
5. Service compacts and truncates to `maxTiles` when needed.
6. Service emits `tile_diff_returned` with result metadata (`tile_count`, `version_span`, `truncated`, latency).
7. Route returns diff payload with `nextSinceVersion`.

### Complexity

* Medium-high, similar persistence complexity to Alternative 1.
* Lower contract and parsing complexity than GET query-string encoding for viewport and limits.

### Performance implications

* Same core read/write efficiency profile as Alternative 1.
* More stable contract for adding optional paging token or compression metadata later.

### Testability

* Best fit with current test style that sends JSON request bodies for command-like routes and validates branch behavior.
* Simple unit test vectors for body validator and diff assembler.

### Migration impact

* Same schema migration impact as Alternative 1.
* Small additional shared contract addition for request/response body types.

### Compatibility with existing conventions

* Strong fit with current POST JSON command conventions in tile/session/snapshot routes: apps/server/src/http/routes/tile.routes.ts:103, apps/server/src/http/routes/tile.routes.ts:144, apps/server/src/http/routes/session.routes.ts:101, apps/server/src/http/routes/snapshot.routes.ts:58.
* Reuses existing explicit validation and error response patterns.
* Easily accommodates request bounds and max payload safeguards mandated by the issue.

## Alternative 3: Snapshot-Hash Gated Full Viewport Read (No Delta Log)

### Pseudo-contract

```http
POST /api/regions/diff
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "regionId": "arena-main",
  "clientHash": "sha256:abc123",
  "viewport": {
    "minCellX": 0,
    "maxCellX": 40,
    "minCellY": 0,
    "maxCellY": 25
  }
}
```

```json
{
  "ok": true,
  "regionId": "arena-main",
  "hashMatched": false,
  "currentHash": "sha256:def456",
  "tiles": [
    {
      "cellX": 10,
      "cellY": 12,
      "offsetX": 0.1,
      "offsetY": 0.0,
      "shape": "square",
      "color": "red",
      "stylePayload": { "v": 2 },
      "ownerId": "tenant-a|player-1"
    }
  ]
}
```

### Data model

* No region version index and no delta log.
* Optional per-region cached hash table could be added to avoid recomputing hash from tiles on each call.

### Architecture flow

1. Route validates viewport request.
2. Repository loads all current viewport tiles from `tiles`.
3. Service computes deterministic viewport or region hash.
4. If hash matches client hash, returns empty tiles; else returns full viewport payload.

### Complexity

* Lowest implementation complexity.
* Minimal schema and write-path changes.

### Performance implications

* Potentially high read amplification for stale clients and even for unchanged checks unless hash cache is maintained.
* Does not satisfy true incremental update semantics when clients are stale, because it returns full viewport snapshots, not deltas.

### Testability

* Easy to unit/integration test.
* Harder to prove scaled performance behavior against issue intent.

### Migration impact

* None or very low.

### Compatibility with existing conventions

* Contract can follow existing POST style.
* Semantically weaker fit with Issue #16 acceptance criterion "stale version returns incremental updates".

## Comparative Decision Matrix

| Dimension | Alt 1: GET + Delta Log | Alt 2: POST + Delta Log | Alt 3: Hash-Gated Full Read |
| --- | --- | --- | --- |
| Incremental stale updates | Yes | Yes | No (full snapshot fallback) |
| Unchanged empty response | Yes | Yes | Yes |
| Contract ergonomics | Medium | High | High |
| Write-path change cost | Medium-high | Medium-high | Low |
| Read amplification control | High | High | Low-medium |
| Test alignment with current style | Medium | High | High |
| Migration size | Medium-high | Medium-high | Low |
| Future extensibility (paging, tokens) | Medium | High | Medium |

## Recommendation

Recommend Alternative 2: POST diff query with region-watermark version + append-only `tile_deltas`.

Rationale:

* It is the strongest fit for Issue #16 requirements: unchanged-version empty response and stale-version incremental updates.
* It aligns with repository route conventions that already use JSON `POST` commands and explicit body validation.
* It supports mandatory abuse controls naturally (`viewport` bounds, `maxTiles`, and optional per-subject rate limits) using existing patterns from session throttling.
* It keeps read amplification low under stale clients while remaining extensible for paging or continuation tokens.
* It avoids the awkward GET query explosion for viewport geometry and payload-limit options.

Rejected alternatives:

* Alternative 1 (GET + delta log) is technically viable but less ergonomic and less consistent with existing command-style route patterns.
* Alternative 3 (hash-gated full read) is tempting for speed of delivery but does not satisfy the incremental stale-update requirement and risks read amplification under load.

## Implementation Sequence Plan (File-Mapped)

1. Add shared diff contracts.
   * Likely files: `packages/shared-types/src/index.ts`.
   * Add `RegionDiffRequest`, `RegionDiffTileDelta`, `RegionDiffResponse` with explicit union types.

2. Introduce persistence schema for versions and deltas.
   * Likely files: `apps/server/src/persistence/migrations/<new>_region_versions_and_tile_deltas.js`, `apps/server/src/persistence/db.ts`.
   * Add tables: `region_versions`, `tile_deltas`.
   * Add indices: `(region_id, version)` and optional `(region_id, cell_x, cell_y, version desc)`.

3. Extend tile repository write paths to capture versioned deltas transactionally.
   * Likely files: `apps/server/src/persistence/tile.repository.ts`.
   * On place/edit, increment region version and append `tile_deltas` row in the same transaction.
   * Add delete support hook if deletion exists/planned.

4. Implement diff retrieval repository methods.
   * Likely files: `apps/server/src/persistence/tile.repository.ts` or new `apps/server/src/persistence/region-diff.repository.ts`.
   * Methods: get current region version, fetch deltas since version with viewport filter, compact latest per coordinate if needed.

5. Add domain service for diff assembly and policy checks.
   * Likely files: `apps/server/src/domain/region-diff.service.ts` (new).
   * Responsibilities: bounds validation helpers, unchanged fast-path, delta compaction, truncation, telemetry attributes.

6. Add HTTP route module and wire app dependency.
   * Likely files: `apps/server/src/http/routes/region-diff.routes.ts` (new), `apps/server/src/http/app.ts`, `apps/server/src/index.ts`.
   * Endpoint: `POST /api/regions/diff`.
   * Return 400 for invalid payload, 401 for auth failures, 429 when optional diff rate limiter trips.

7. Extend telemetry sink with Issue #16 events.
   * Likely files: `apps/server/src/telemetry/telemetry-sink.ts`.
   * Add helper methods:
     * `emitTileDiffRequested(regionId, sinceVersion, viewportArea, maxTiles, subject)`
     * `emitTileDiffReturned(regionId, sinceVersion, currentVersion, tileCount, deletedCount, truncated, durationMs)`

8. Add tests in three layers.
   * Unit: `apps/server/tests/unit/region-diff.service.test.ts` (new) for assembler and empty/stale behavior.
   * Integration: `apps/server/tests/integration/region-diff.integration.test.ts` (new) for route + auth + versioned semantics.
   * Load: `apps/server/tests/load/region-diff-load.ts` (new) for read amplification and bounds enforcement.

9. Verify no regressions in adjacent behaviors.
   * Re-run existing integration suites that cover auth, tile, snapshot, lifecycle.

## Clarifying Questions To Confirm Before Implementation

1. Should diff endpoint be available to any authenticated subject, or restricted by room/region membership?
2. Is delete/tombstone behavior required now, or can Issue #16 scope assume place/edit only?
3. What hard limits should be enforced for viewport area and `maxTiles` response size?
4. Is per-subject diff rate limiting required immediately, or only bounds and payload caps?

## Status

Complete for requested research scope.
