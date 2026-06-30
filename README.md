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

## Versioning and Release Signals

This repository uses SemVer for package change tracking and commit SHA tags for deployment artifact identity.

- `packages/*` is the primary SemVer surface for API compatibility and release notes.
- `apps/*` stays private and deploys by immutable SHA-based image tags.
- Pre-1.0 (`0.y.z`) changes are treated as unstable, and breaking changes must be called out with migration notes.
- SemVer tags and SHA deployment tags are complementary and both are required for full release traceability.

## SemVer Release PR Lifecycle

SemVer release automation is handled by `.github/workflows/semver-release.yml` on `main`.

1. Contributors add a changeset file for release-impacting changes.
2. Pushes to `main` update or create a release PR with pending version and changelog changes.
3. Maintainers review and merge the release PR.
4. Merge creates SemVer tags for versioned packages.
5. Deployment remains on SHA-tagged images through the existing dev/prod workflows.

Tag interpretation:

- SemVer tags (for example `@game/shared-types@0.2.0`) identify package API/version history.
- SHA tags (for example `${GITHUB_SHA}` in release workflows) identify the exact deployed container artifact.
- Use SemVer tags to reason about package compatibility and SHA tags to reason about deployed runtime state.

Rollback path for mistaken changeset or version bump:

1. If the release PR is still open, remove or correct the bad changeset and let the release PR refresh.
2. If the release PR is merged but not deployed, submit a correcting follow-up changeset and merge the next release PR.
3. If deployment already happened, use the rollback steps in `docs/cicd-harness.md` to restore the previous healthy revision, then apply a correcting changeset PR.

See the SemVer policy and operational details in [docs/cicd-harness.md](docs/cicd-harness.md).

## Pull Request Title Policy

Pull request titles must follow a Conventional Commit-style format so CI can validate SemVer intent:

- `fix(scope): summary`
- `feat(scope): summary`
- `feat(scope)!: summary` for breaking intent

Accepted types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`.

## Tests

All integration tests **require** `TEST_DATABASE_URL` to be set. This is enforced in both local development and CI to ensure consistent test coverage.

### Running Tests Locally

1. **Start PostgreSQL**:
   ```bash
   docker compose up -d postgres
   ```

2. **Set TEST_DATABASE_URL** before running tests:
   ```bash
   export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tile_fighter_test"
   npm run -w @game/server test
   ```
   
   Or inline:
   ```bash
   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tile_fighter_test" npm run -w @game/server test
   ```

3. **Load Testing** (optional, requires DB):
   ```bash
   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tile_fighter_test" npm run -w @game/server test:load
   ```

### Integration Test Database Policy

- **Local development**: `TEST_DATABASE_URL` is required; process exits if not set
- **CI**: `TEST_DATABASE_URL` must be configured in environment or GitHub secrets
- **Rationale**: Prevents silent test skips that could hide missing database setup; ensures consistent coverage across environments

If you see "TEST_DATABASE_URL environment variable is required" error, follow the setup steps above to configure your PostgreSQL instance.

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
