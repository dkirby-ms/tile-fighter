---
title: Colyseus Azure Scaffold Prompt
description: Generate a production-ready Colyseus 0.17 server-authoritative TypeScript scaffold with PostgreSQL persistence, Azure Container Apps deployment assets, and Entra External ID OAuth integration.
author: GitHub Copilot
ms.date: 2026-06-27
ms.topic: how-to
argument-hint: "[workspaceRoot=.] [packageManager={npm|pnpm|yarn}] [workspaceMode={workspace|single-package}] [serverPackageName=@game/server] [serverAppPath=apps/server] [sharedPackagesPath=packages] [includeSharedTypes={true|false}] [includeSharedAuth={true|false}] [includeSharedPersistence={true|false}] [includeToolsApp={true|false}] [includeRedis={true|false}] [tenantMode={single|multi|both}] [includeDapr={true|false}] [infraStyle={bicep|yaml|both}] [includeLoadTests={true|false}]"
---

## Inputs

* ${input:workspaceRoot:.}: (Optional, defaults to `.`) Workspace-relative root where files are created.
* ${input:packageManager:npm}: (Optional, defaults to `npm`) Package manager to use. Allowed values: `npm`, `pnpm`, `yarn`.
* ${input:workspaceMode:workspace}: (Optional, defaults to `workspace`) Package manager mode. Allowed values: `workspace`, `single-package`.
* ${input:serverPackageName:@game/server}: (Optional, defaults to `@game/server`) Workspace package name for the Colyseus backend.
* ${input:serverAppPath:apps/server}: (Optional, defaults to `apps/server`) Monorepo path for the Colyseus backend package.
* ${input:toolsAppPath:apps/tools}: (Optional, defaults to `apps/tools`) Monorepo path for optional scripts/tools package.
* ${input:includeToolsApp:true}: (Optional, defaults to `true`) Include optional `apps/tools` workspace for scripts and automation.
* ${input:sharedPackagesPath:packages}: (Optional, defaults to `packages`) Root path for shared workspace packages.
* ${input:sharedTypesPackageName:@game/shared-types}: (Optional, defaults to `@game/shared-types`) Shared types package name.
* ${input:sharedAuthPackageName:@game/shared-auth}: (Optional, defaults to `@game/shared-auth`) Shared auth utilities package name.
* ${input:sharedPersistencePackageName:@game/shared-persistence}: (Optional, defaults to `@game/shared-persistence`) Shared persistence utilities package name.
* ${input:includeSharedTypes:true}: (Optional, defaults to `true`) Include shared types package.
* ${input:includeSharedAuth:true}: (Optional, defaults to `true`) Include shared auth package.
* ${input:includeSharedPersistence:true}: (Optional, defaults to `true`) Include shared persistence package.
* ${input:includeRedis:false}: (Optional, defaults to `false`) Include Redis Presence/Driver wiring for horizontal scale.
* ${input:tenantMode:single}: (Optional, defaults to `single`) Entra token validation mode. Allowed values: `single`, `multi`, `both`.
* ${input:includeDapr:false}: (Optional, defaults to `false`) Include optional Dapr sidecar configuration for Azure Container Apps.
* ${input:infraStyle:bicep}: (Optional, defaults to `bicep`) Azure Container Apps IaC style. Allowed values: `bicep`, `yaml`, `both`.
* ${input:includeLoadTests:true}: (Optional, defaults to `true`) Include load test harness for room joins and state updates.

## Purpose

Create a concrete, runnable monorepo scaffold for a Colyseus 0.17 server-authoritative backend in TypeScript, with PostgreSQL persistence, Azure Container Apps deployment assets, and OAuth/OIDC authentication via Entra External ID.

## Prerequisites

* Node.js 22.x LTS installed.
* A reachable PostgreSQL instance for integration and readiness checks.
* Docker installed for container validation steps.
* Local JWT test fixtures for offline auth tests, including valid token, wrong audience token, wrong issuer token, expired token, and `alg: none` token.

## Dependency Baseline

Install these dependency families at compatible, pinned or bounded versions:

* `colyseus` and `@colyseus/schema` at `0.17.x`.
* TypeScript toolchain on a stable major (`typescript`, `tsx` or equivalent runner) with strict compile enabled.
* PostgreSQL client and pooling package (`pg`) with migration tool (`node-pg-migrate` or `drizzle-kit`) chosen explicitly.
* JWT/JWKS validation packages that support algorithm allowlists and JWKS key resolution by `kid`.
* Workspace tooling for monorepo orchestration (`workspaces`/`pnpm-workspace.yaml`/Yarn workspaces), TypeScript project references or equivalent alias strategy, and shared lint/test config.

Create a lockfile and keep it under version control.

## Required Steps

### Pre-requisite: Context and Constraints

1. Inspect the workspace before writing files.
2. Read existing top-level docs and detect existing scaffold files to avoid conflicts.
3. Read and apply project instruction files that match any files you will create or modify.
4. Resolve input values and apply deterministic fallbacks:
   * If `workspaceMode` is `workspace`, enforce monorepo structure under `${input:workspaceRoot}`.
   * If `serverPackageName` is empty, set it to `@game/server`.
   * If `serverAppPath` is empty, set it to `apps/server`.
   * If `sharedPackagesPath` is empty, set it to `packages`.
5. Print an execution plan with exact file paths, package names, and resolved input values before creating files.

### Step 1: Scaffold Project Structure

1. Create a deterministic monorepo layout rooted at `${input:workspaceRoot}`.
2. Add root workspace and shared tooling files:
   * Root `package.json` with workspace config for the selected package manager.
   * Workspace lockfile (`package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`).
   * Shared TypeScript and lint/test config at root (for example, `tsconfig.base.json`, root lint config).
3. Create `${input:serverAppPath}` as the Colyseus backend package.
4. In `${input:serverAppPath}`, include at minimum these paths:
   * `src/config`, `src/rooms`, `src/domain`, `src/persistence`, `src/auth`, `src/http/routes`, `src/shutdown`
   * `tests/unit`, `tests/integration`
   * `infra/containerapps/env`
   * `docker`
5. If `${input:includeToolsApp}` is `true`, add `${input:toolsAppPath}` with workspace scripts for dev/test/release helpers.
6. Under `${input:sharedPackagesPath}`, create optional shared packages based on toggles:
   * `${input:includeSharedTypes}` -> `${input:sharedTypesPackageName}` package path.
   * `${input:includeSharedAuth}` -> `${input:sharedAuthPackageName}` package path.
   * `${input:includeSharedPersistence}` -> `${input:sharedPersistencePackageName}` package path.
7. If `${input:includeLoadTests}` is `true`, add `${input:serverAppPath}/tests/load`.
8. If `${input:infraStyle}` is `bicep` or `both`, add `${input:serverAppPath}/infra/containerapps/bicep`.
9. If `${input:infraStyle}` is `yaml` or `both`, add `${input:serverAppPath}/infra/containerapps/aca.yaml`.

### Step 2: Generate TypeScript Runtime and Config

1. Create and configure strict-mode TypeScript for monorepo use.
2. Ensure `${input:serverAppPath}` extends root TypeScript config.
3. If shared packages are enabled, wire TypeScript references or path aliases between server and enabled shared packages.
4. Implement Colyseus server bootstrap and register at least one authoritative room and state schema.
5. Keep room classes thin and move simulation logic into domain services/commands.
6. Add typed environment loading and validation in one config module.
7. Add health endpoints:
   * Liveness endpoint for process status.
   * Readiness endpoint validating DB connectivity and critical config.
8. Add graceful shutdown handlers for `SIGTERM` and `SIGINT`.

### Step 3: Wire Persistence and Migrations

1. Add PostgreSQL connection pooling and fail-fast startup checks.
2. Choose one migration stack and keep it consistent across scripts and docs.
3. Add migration tooling and create an initial migration.
4. Ensure room tick/message handlers do not perform blocking persistence work inline.
5. Add migration scripts to `${input:serverPackageName}` scripts and README runbook.

### Step 3.5: Optional Redis Wiring

1. If `${input:includeRedis}` is `true`, add Redis Presence or Driver wiring with config variables and startup validation.
2. If `${input:includeRedis}` is `true`, add integration tests proving the Redis path initializes and reconnects correctly.
3. If `${input:includeRedis}` is `false`, do not add Redis runtime dependencies.

### Step 4: Wire Auth and JWT Validation

1. Implement OAuth/OIDC token validation for Entra External ID.
2. Validate JWT signature, issuer, audience, expiration, and JWKS key selection by `kid`.
3. Enforce auth on protected HTTP routes.
4. Enforce auth in room join flow.
5. Implement tenant handling based on `${input:tenantMode}`.
6. Enforce JWT algorithm allowlist and explicitly reject `alg: none` tokens.
7. If `${input:tenantMode}` includes multi-tenant behavior, enforce explicit allow and deny rules for issuer and tenant claims.
8. Add negative tests for wrong audience, wrong issuer, expired token, and `alg: none`.

### Step 5: Add Containerization and Azure Container Apps Assets

1. Create `${input:serverAppPath}/docker/Dockerfile` and `${input:serverAppPath}/docker/.dockerignore` optimized for reproducible builds.
2. Add Azure Container Apps deployment assets with:
   * Ingress target port aligned with runtime `PORT`.
   * Startup, readiness, and liveness probes.
   * Secret references, never plaintext secrets.
   * Revision strategy suitable for safe rollout.
3. Add separate dev and prod parameter files.
4. If `${input:includeDapr}` is `true`, include optional Dapr configuration without making it mandatory for local run.

### Step 6: Add Tests and Quality Gates

1. Add unit and integration tests covering:
   * Auth middleware and token validation behavior.
   * Room join authorization.
   * At least one authoritative state transition.
2. If `${input:includeLoadTests}` is `true`, add a basic load scenario.
3. Add lint, test, and build scripts.
4. Run all commands from monorepo root `${input:workspaceRoot}` and target workspace package scripts explicitly.
5. Use this command matrix based on `${input:packageManager}`:
   * `npm`: `npm ci` when lockfile exists, otherwise `npm install`; then `npm run -w ${input:serverPackageName} lint`, `npm run -w ${input:serverPackageName} test`, `npm run -w ${input:serverPackageName} build`.
   * `pnpm`: `pnpm install --frozen-lockfile`; then `pnpm --filter ${input:serverPackageName} lint`, `pnpm --filter ${input:serverPackageName} test`, `pnpm --filter ${input:serverPackageName} build`.
   * `yarn`: `yarn install --immutable`; then `yarn workspace ${input:serverPackageName} lint`, `yarn workspace ${input:serverPackageName} test`, `yarn workspace ${input:serverPackageName} build`.
6. Validate cross-package resolution by running server build with shared package references enabled (TypeScript project references or configured path aliases).
7. Run container validation commands:
   * `docker build -f ${input:serverAppPath}/docker/Dockerfile -t <server-image-name>:local ${input:workspaceRoot}`
   * `docker run --rm -p 3000:3000 -e PORT=3000 <server-image-name>:local`
8. Capture and report output summary with pass/fail and notable warnings.

### Step 7: Finalize Documentation

1. Create `.env.example` with required variables and safe placeholders.
2. Document secret boundaries for local, CI/CD, and Azure runtime.
3. Update `README.md` with:
   * Monorepo workspace layout and package responsibilities.
   * Root install command and workspace script execution pattern.
   * Local setup.
   * Migration commands.
   * Test commands.
   * Container build/run.
   * Azure Container Apps deployment steps.
4. Provide assumptions and unresolved decisions in a compact list.

## Non-Goals

* Do not generate game client code or frontend UI.
* Do not implement full gameplay features beyond a minimal authoritative example.
* Do not include distributed state orchestration beyond optional Redis/Dapr toggles.
* Do not require premium Azure-only components outside requested hosting/auth scope.
* Do not commit credentials, tokens, client secrets, or private keys.

## Guardrails

* Use pinned or constrained dependency versions compatible with Colyseus 0.17.
* Avoid custom JWT parsing when maintained validation libraries are available.
* Verify Azure and identity API usage against current official documentation before finalizing generated code.
* Do not treat sticky sessions as a substitute for authoritative state design.
* Do not place business logic directly inside schema models.
* Do not rely on ORM auto-sync destructive behaviors in production.
* Keep environment access centralized in a typed config layer.
* Prefer explicit failures at startup over silent fallback defaults for required security settings.
* Keep generated files ASCII unless a file already contains justified Unicode.

## Acceptance Criteria Checklist

* [ ] Monorepo root workspace config is present and valid for selected package manager.
* [ ] Workspace install succeeds and exactly one lockfile exists at monorepo root.
* [ ] Server workspace package scripts for lint, test, and build run from monorepo root.
* [ ] Cross-package TypeScript references or path aliases resolve successfully in server build.
* [ ] Strict TypeScript build succeeds.
* [ ] Lint and tests run successfully.
* [ ] Negative auth tests cover wrong audience, wrong issuer, expired token, and `alg: none`.
* [ ] Colyseus room registration and authoritative state update are implemented.
* [ ] PostgreSQL pool and initial migration are present and runnable.
* [ ] If `includeRedis=true`, Redis wiring and tests are implemented and passing.
* [ ] JWT validation covers signature, issuer, audience, expiration, and JWKS key lookup.
* [ ] Protected HTTP routes and room join flow enforce auth.
* [ ] Health and readiness endpoints are implemented and dependency-aware.
* [ ] Graceful shutdown is wired for container lifecycle signals.
* [ ] Docker build is reproducible and runs on configured `PORT`.
* [ ] Azure Container Apps assets include ingress, probes, secrets, and revision strategy.
* [ ] README includes local runbooks, migrations, tests, deploy flow, and secret handling.

## Required Final Deliverable Summary Format

Return a structured summary with these exact sections:

1. `Execution Context`
   * Resolved input values.
   * Workspace path, monorepo root, server package name, and package paths.
2. `Files Created and Updated`
   * Group by root tooling, apps, packages, persistence, auth, tests, docker, infra, docs.
3. `Command Results`
   * Workspace install, server workspace lint/test/build outcomes.
   * Key output highlights and any failures.
4. `Security and Auth Notes`
   * Token validation model, tenant mode behavior, and secret boundaries.
5. `Azure Deployment Notes`
   * Ingress/probe/secret/revision configuration summary.
6. `Acceptance Criteria Status`
   * Checklist with pass/fail per item.
7. `Open Questions and Assumptions`
   * Compact list of unresolved decisions and defaults chosen.

## Required Protocol

1. Execute the Required Steps in order without skipping validation commands.
2. If a required decision is ambiguous, apply safe defaults and record them under `Open Questions and Assumptions`.
3. If a step fails, attempt an in-scope fix, rerun affected commands, and report final status.
4. Do not mark work complete unless the acceptance checklist is explicitly evaluated.

---
Use this prompt to generate and validate the scaffold directly in the current workspace, making concrete file edits and running commands instead of returning only a high-level plan.
