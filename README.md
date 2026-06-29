---
title: Tile Fighter Monorepo
description: Colyseus 0.17 server-authoritative backend scaffold with PostgreSQL, Entra auth, and Azure Container Apps assets.
author: GitHub Copilot
ms.date: 2026-06-27
ms.topic: how-to
keywords:
	- colyseus
	- typescript
	- azure container apps
	- entra external id
estimated_reading_time: 12
---

## Overview

This repository now contains a workspace-based TypeScript monorepo focused on backend infrastructure for Tile Fighter.

## Workspace Layout

- apps/server: Colyseus 0.17 authoritative game server with HTTP health/auth endpoints
- apps/tools: Optional helper scripts package for local automation
- packages/shared-types: Shared runtime and DTO typings
- packages/shared-auth: Shared JWT validation helpers
- packages/shared-persistence: Shared persistence constants and contracts

## Install

```bash
npm install
```

## Run Commands from Root

Server package commands:

```bash
npm run -w @game/server lint
npm run -w @game/server test
npm run -w @game/server build
```

Start the server locally from the root workspace:

```bash
npm run dev
```

## Local Setup

1. Copy root `.env.example` values into your local environment.
2. Start local PostgreSQL with Docker Compose:

```bash
docker compose up -d postgres
```

3. Ensure the compose service is running PostgreSQL 18.4 and `DATABASE_URL` points at the local database (`postgres://postgres:postgres@localhost:5432/tile_fighter`).
4. Ensure Entra OIDC values are set:
   - `ENTRA_ISSUER`: the External ID tenant issuer used to validate API tokens.
   - `ENTRA_AUDIENCE`: the API application ID URI for the server (`api://tile-fighter-server`).
   - `ENTRA_JWKS_URL`: the tenant JWKS endpoint.
   - `ENTRA_CLIENT_ID`: the browser shell app registration client ID used by MSAL.
5. Start the server package in dev mode.

## Database Migrations

```bash
npm run -w @game/server migrate:up
npm run -w @game/server migrate:down
```

## CI/CD Harness

Deployment and release policy details are documented in [docs/cicd-harness.md](docs/cicd-harness.md).

## Tests

```bash
npm run -w @game/server test
npm run -w @game/server test:load
```

## Container Build and Run

```bash
docker build -f apps/server/docker/Dockerfile -t tile-fighter-server:local .
docker run --rm -p 3000:3000 --env-file .env.example -e PORT=3000 tile-fighter-server:local
```

## Azure Container Apps Deploy Assets

The Bicep deployment files are in `apps/server/infra/containerapps/bicep` and include:

- Managed environment parameters
- Container app ingress configuration
- Readiness/liveness/startup probes
- Secret references for DB and auth values
- Revision mode defaults for safe rollout

## Secret Boundaries

- Local: `.env` values loaded outside source control
- CI/CD: Pipeline secrets injected as environment variables
- Azure runtime: Container Apps secret references, never plaintext in templates

## Assumptions

- Tenant mode defaults to single-tenant validation.
- Redis and Dapr are intentionally disabled in this scaffold.
- YAML ACA manifest is omitted because infra style is Bicep-only.
