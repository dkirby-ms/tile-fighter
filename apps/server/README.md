---
title: Tile Fighter Server Package
description: Operational runbook for the Colyseus server package, including auth, migrations, and deployment artifacts.
author: GitHub Copilot
ms.date: 2026-06-27
ms.topic: how-to
keywords:
  - colyseus
  - postgresql
  - entra
estimated_reading_time: 8
---

## Package Purpose

The `@game/server` package hosts the authoritative Colyseus backend and protected HTTP routes.

## Scripts

* `npm run -w @game/server dev`
* `npm run -w @game/server build`
* `npm run -w @game/server test`
* `npm run -w @game/server migrate:up`
* `npm run -w @game/server migrate:down`

## Environment Variables

* `DATABASE_URL`
* `PORT`
* `ENTRA_ISSUER`
* `ENTRA_AUDIENCE`
* `ENTRA_JWKS_URL`
* `ENTRA_TOKEN_VERSION`
* `TENANT_MODE`
* `ENTRA_TENANT_ID` (required for `TENANT_MODE=single`)
* `ALLOWED_TENANT_IDS`
* `DENIED_TENANT_IDS`
* `ALLOWED_ISSUERS`
* `TELEMETRY_SINK_MODE`
* `TELEMETRY_SINK_URL`
* `TELEMETRY_SINK_NAME`
* `TILE_PLACE_THROTTLE_MAX_REQUESTS` (default: 5)
* `TILE_PLACE_THROTTLE_WINDOW_MS` (default: 60000)
* `TILE_PLACE_THROTTLE_TTL_MS` (default: 86400000 = 24 hours)
* `REGION_DIFF_DEFAULT_MAX_TILES` (default: 500)
* `REGION_DIFF_MAX_TILES_PER_REQUEST` (default: 1000)
* `REGION_DIFF_MAX_VIEWPORT_AREA` (default: 10000)

## Health Endpoints

* `GET /healthz` for liveness
* `GET /readyz` for dependency-aware readiness (DB + config)

## Auth Boundaries

* JWT validation enforces signature, issuer, audience, expiration, and algorithm allowlist.
* `alg: none` tokens are rejected before signature verification.
* Protected HTTP routes and room joins require bearer token validation.

## Tile Placement Rate Limiting

The `/api/tiles/place` endpoint uses a sliding-window throttle to prevent placement spam.

**Default Policy** (configurable via environment variables):
- **Key**: `${tenantScopedSubject}:${regionId}` (account-scoped per region)
- **Window**: 60,000 ms (60 seconds)
- **Limit**: 5 requests per window
- **TTL**: 24 hours (cleanup period)

**Behavior**:
- Each placement attempt is timestamped and recorded in a per-key entry
- When requests exceed the limit within the window, the next request returns HTTP 429 with `retryAfterMs`
- The server maintains a map of throttle entries; periodic cleanup (hourly) removes entries not accessed in 24 hours

**Configuration**:
```bash
export TILE_PLACE_THROTTLE_MAX_REQUESTS=5        # requests allowed per window
export TILE_PLACE_THROTTLE_WINDOW_MS=60000        # sliding window duration (ms)
export TILE_PLACE_THROTTLE_TTL_MS=86400000        # cleanup period for stale entries (ms)
```

**Memory Impact**: O(accounts × regions) entries in the throttle map. Example: 1,000 accounts × 10 regions ≈ 10k entries × ~100 bytes ≈ 1 MB. Periodic cleanup prevents unbounded growth on long-lived servers.

## Persistence

Migration stack uses `node-pg-migrate` via package scripts.

* Apply migrations: `npm run -w @game/server migrate:up`
* Roll back migrations: `npm run -w @game/server migrate:down`

## Epic 2 Policy Defaults (Pending Final Decisions)

These defaults remain active until decision register items PD-01 through PD-06 are finalized.

* Placement throttle default: account-plus-region key, 60-second window, deterministic `429` rejection contract.
* JWT operator contract default: role-first with bounded scope fallback during migration.
* Region diff delete default: deleted tiles are represented by absence in diff payloads (`upsert_only`), reducing client-side tombstone handling complexity.
* Region diff limits default: conservative env-configurable caps are enforced server-side.
* Region diff authorization default: active region membership required before diff retrieval.

## Integration DB Behavior

* Integration tests require an explicit database URL from `TEST_DATABASE_URL` (preferred) or `DATABASE_URL`.
* If both `TEST_DATABASE_URL` and `DATABASE_URL` are set, they must match exactly.
* CI and local runs use the same guard behavior and fail fast on missing or conflicting values.
