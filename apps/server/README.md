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
* `TILE_PLACE_THROTTLE_MAX_REQUESTS`
* `TILE_PLACE_THROTTLE_WINDOW_MS`

## Health Endpoints

* `GET /healthz` for liveness
* `GET /readyz` for dependency-aware readiness (DB + config)

## Auth Boundaries

* JWT validation enforces signature, issuer, audience, expiration, and algorithm allowlist.
* `alg: none` tokens are rejected before signature verification.
* Protected HTTP routes and room joins require bearer token validation.

## Persistence

Migration stack uses `node-pg-migrate` via package scripts.

* Apply migrations: `npm run -w @game/server migrate:up`
* Roll back migrations: `npm run -w @game/server migrate:down`

## Epic 2 Policy Defaults (Pending Final Decisions)

These defaults remain active until decision register items PD-01 through PD-06 are finalized.

* Placement throttle default: account-plus-region key, 60-second window, deterministic `429` rejection contract.
* JWT operator contract default: role-first with bounded scope fallback during migration.
* Region diff delete default: explicit `delete` operations are included for stale-client correctness.
* Region diff limits default: conservative env-configurable caps are enforced server-side.
* Region diff authorization default: active region membership required before diff retrieval.

## Integration DB Behavior

* Local runs may skip DB-dependent integration suites when DB prerequisites are unavailable.
* CI runs enforce DB preconditions by requiring `TEST_DATABASE_URL` for integration-capable test runs.
* If `CI=true` and `TEST_DATABASE_URL` is missing, DB-backed integration suites report explicit skip reasons and the workflow fails in the pre-test guard step.
