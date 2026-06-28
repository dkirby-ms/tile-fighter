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
