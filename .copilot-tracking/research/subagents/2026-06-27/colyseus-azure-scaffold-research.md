---
title: Colyseus Azure Scaffold Research
description: Research-backed scaffold requirements for a Colyseus 0.17 TypeScript server-authoritative game with PostgreSQL, Azure Container Apps, and Entra External ID OAuth.
author: GitHub Copilot (Researcher Subagent)
ms.date: 2026-06-27
ms.topic: reference
keywords:
  - colyseus
  - typescript
  - postgresql
  - azure container apps
  - entra external id
  - oauth
estimated_reading_time: 12
---

## Research Scope

* Build a high-quality scaffold prompt for a server-authoritative multiplayer backend using Colyseus 0.17 and TypeScript
* Include PostgreSQL persistence and migration workflow
* Target Azure Container Apps for production hosting
* Integrate OAuth/OIDC identity with Microsoft Entra External ID
* Define must-have scaffold files, environment boundaries, acceptance criteria, and prompt guardrails

## Key Findings

### Colyseus 0.17 backend shape

* Colyseus 0.17 emphasizes authoritative room state and schema synchronization via `@colyseus/schema`.
* Recommended architecture keeps `Room` classes minimal and pushes game logic into separate domain services or command handlers.
* Graceful shutdown is first-class and should be wired (`onBeforeShutdown`, `onShutdown`, room lock/disconnect lifecycle) to avoid state loss.
* HTTP auth middleware exists in Colyseus and can validate tokens in HTTP routes; room join auth should also validate identity claims.
* Deployment remains standard Node container deployment with explicit Dockerfile and `.dockerignore`.

### PostgreSQL persistence

* Scaffold should include migration tooling and schema ownership from day one, not ad-hoc SQL in room handlers.
* Room tick/game loop should not block on database writes; persistence should use async repository/service boundary.
* Connection pooling and startup connectivity checks are required for stable containerized deployments.

### Azure Container Apps

* Ingress supports HTTP/1.1, HTTP/2, WebSocket, and gRPC; this is compatible with Colyseus WebSocket transport.
* HTTPS is default path, and insecure ingress should stay disabled in production (`allowInsecure: false`).
* Health probes (startup/readiness/liveness) are required to avoid crash loops and bad rollout behavior.
* Secrets should be app-level secrets or Key Vault references, then mapped via env vars (`secretref:`), never hard-coded.
* Session affinity exists but is cookie-based and HTTP-ingress specific; it should not be treated as authoritative game state consistency.
* Revisions/traffic split model supports blue-green and safer rollout strategies.

### Entra External ID OAuth/OIDC

* For External ID customer scenarios, use authorization code flow (PKCE for browser/native clients); avoid implicit and ROPC flows.
* API-side token validation must enforce signature, issuer, audience, key selection by `kid`, and tenant semantics (`tid`/issuer matching rules where applicable).
* Rely on supported auth libraries (MSAL on clients, Microsoft identity middleware/JWT validation libs on APIs) rather than custom token parsing.

## Best-Practice Scaffold Structure

```text
.
├─ src/
│  ├─ app.config.ts
│  ├─ main.ts
│  ├─ config/
│  │  ├─ env.ts
│  │  ├─ logger.ts
│  │  └─ featureFlags.ts
│  ├─ rooms/
│  │  ├─ lobby/
│  │  │  ├─ LobbyRoom.ts
│  │  │  └─ LobbyState.ts
│  │  ├─ match/
│  │  │  ├─ MatchRoom.ts
│  │  │  ├─ MatchState.ts
│  │  │  └─ commands/
│  │  │     ├─ MoveCommand.ts
│  │  │     └─ AttackCommand.ts
│  ├─ domain/
│  │  ├─ simulation/
│  │  ├─ services/
│  │  └─ validation/
│  ├─ persistence/
│  │  ├─ db.ts
│  │  ├─ repositories/
│  │  ├─ models/
│  │  └─ migrations/
│  ├─ auth/
│  │  ├─ oidc.ts
│  │  ├─ jwtValidation.ts
│  │  ├─ httpAuthMiddleware.ts
│  │  └─ roomAuth.ts
│  ├─ transport/
│  │  └─ messageSchemas/
│  ├─ http/
│  │  ├─ routes/
│  │  │  ├─ health.ts
│  │  │  ├─ ready.ts
│  │  │  └─ profile.ts
│  │  └─ middleware/
│  ├─ telemetry/
│  │  ├─ metrics.ts
│  │  └─ tracing.ts
│  └─ shutdown/
│     └─ gracefulShutdown.ts
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ load/
├─ infra/
│  ├─ containerapps/
│  │  ├─ bicep/
│  │  ├─ env/
│  │  │  ├─ dev.parameters.json
│  │  │  └─ prod.parameters.json
│  │  └─ aca.yaml
│  └─ scripts/
├─ docker/
│  ├─ Dockerfile
│  └─ .dockerignore
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ deploy-aca.yml
├─ .env.example
├─ .env.development
├─ .env.test
├─ package.json
├─ tsconfig.json
├─ eslint.config.js
├─ prettier.config.js
└─ README.md
```

## Required and Recommended Scaffold Files

### Required

* package.json
* tsconfig.json
* src/main.ts
* src/app.config.ts
* At least one production Room and State pair under src/rooms
* src/auth/jwtValidation.ts
* src/auth/roomAuth.ts
* src/persistence/db.ts
* src/persistence/migrations/ (with initial migration)
* src/http/routes/health.ts
* src/http/routes/ready.ts
* src/shutdown/gracefulShutdown.ts
* docker/Dockerfile
* docker/.dockerignore
* infra/containerapps/bicep/ or equivalent IaC definition
* infra/containerapps/env/dev.parameters.json
* infra/containerapps/env/prod.parameters.json
* .env.example
* README.md with local run, migration, and deployment instructions

### Recommended

* src/rooms/.../commands for command pattern
* src/telemetry/metrics.ts and tracing hooks
* tests/load/ with Colyseus load test harness
* .github/workflows/ci.yml (lint + test + build)
* .github/workflows/deploy-aca.yml (promote artifacts, deploy revision)
* infra/scripts for one-command local/dev/prod bootstrap

## Environment Variables and Secret Boundaries

### Application config variables (non-secret)

* NODE_ENV
* PORT
* LOG_LEVEL
* CORS_ALLOWED_ORIGINS
* GAME_TICK_RATE
* ROOM_MAX_CLIENTS_DEFAULT
* ACA_REVISION_LABEL

### Secrets (never committed)

* DATABASE_URL
* ENTRA_AUTHORITY
* ENTRA_TENANT_ID
* ENTRA_CLIENT_ID
* ENTRA_API_AUDIENCE
* ENTRA_JWKS_URI (optional if discovered dynamically)
* ENTRA_ISSUER
* SESSION_SIGNING_SECRET (if HTTP session/cookies are used)

### Secret handling boundaries

* Local dev: `.env.development` file only on developer machine, excluded from git.
* CI/CD: secret store in pipeline provider, injected at runtime.
* Azure production: Key Vault reference or ACA secret store mapped into env vars via `secretref:`.
* App code reads only typed config object from `src/config/env.ts`; no direct `process.env` reads outside config layer.

### Dev/prod separation requirements

* Separate parameter files for infra (`dev.parameters.json`, `prod.parameters.json`).
* Separate container app revisions and traffic policies per environment.
* Production defaults: HTTPS only, tighter CORS, strict logging redaction, non-debug auth settings.
* Migration strategy must be deterministic and environment-specific (no auto-destructive sync in prod).

## Non-Optional Acceptance Criteria

* Scaffold builds and starts with TypeScript strict mode enabled.
* Colyseus server starts and registers room handlers through `defineServer`/`defineRoom`.
* At least one room implements server-authoritative state mutation (client input validated before state change).
* JWT bearer auth is enforced for protected HTTP routes and room join flow.
* JWT validation includes signature, issuer, audience, expiration, and key selection (`kid`/JWKS).
* PostgreSQL connection is pooled, startup checks fail fast on invalid DB config.
* Migration command exists and creates initial schema successfully.
* Health endpoints exist:
  * liveness endpoint for process up
  * readiness endpoint validating dependencies (DB and critical config)
* Graceful shutdown path implemented and hooked to SIGTERM/SIGINT.
* Container image builds reproducibly and runs on configured `PORT`.
* Azure Container Apps spec includes:
  * ingress targetPort matching app port
  * startup/readiness/liveness probes
  * secret references, not plaintext secrets
  * revision strategy suitable for safe rollout
* README documents local setup, env vars, migrations, tests, and ACA deployment.

## Pitfalls to Avoid in the Scaffold Prompt

* Generating game logic directly inside `Schema` classes.
* Putting heavy logic and persistence calls directly in room message handlers.
* Omitting graceful shutdown hooks, causing abrupt room termination.
* Treating sticky sessions as authoritative-state consistency mechanism.
* Relying on implicit OAuth flow or custom JWT parsing.
* Hard-coding secrets in source, Dockerfile, or IaC parameter files.
* Single `.env` for all environments with no boundary policy.
* Missing health probes or mismatched ingress target port, causing ACA rollout failures.
* Using latest container tags in production deployment definitions.

## Prompt Guardrails to Include

* Require explicit version pins for Colyseus 0.17-compatible packages and critical runtime deps.
* Require a dedicated auth module with middleware and room auth checks.
* Require typed config loader with validation and startup failure on invalid/missing required vars.
* Require migration-first PostgreSQL setup (no runtime schema auto-sync in production).
* Require Dockerfile + ACA IaC output in the scaffold itself.
* Require health/readiness routes and ACA probe wiring.
* Require tests that cover auth, room join authorization, and at least one room state transition.
* Require README with exact runbooks: local dev, migration, test, deploy, rotate secrets.

## Evidence and References

* Colyseus docs root and v0.17 sections: <https://docs.colyseus.io/>
* Colyseus best practices: <https://docs.colyseus.io/best-practices>
* Colyseus TS setup recipe: <https://docs.colyseus.io/recipes/setup-server-from-scratch-typescript>
* Colyseus graceful shutdown: <https://docs.colyseus.io/server/graceful-shutdown>
* Colyseus HTTP auth middleware: <https://docs.colyseus.io/auth/http>
* Colyseus deployment notes: <https://docs.colyseus.io/deployment>
* ACA ingress/protocols/WebSocket/session affinity: <https://learn.microsoft.com/azure/container-apps/ingress-overview>
* ACA ingress configuration: <https://learn.microsoft.com/azure/container-apps/ingress-how-to>
* ACA sticky sessions: <https://learn.microsoft.com/azure/container-apps/sticky-sessions>
* ACA environment variables: <https://learn.microsoft.com/azure/container-apps/environment-variables>
* ACA secrets management: <https://learn.microsoft.com/azure/container-apps/manage-secrets>
* ACA security overview: <https://learn.microsoft.com/azure/container-apps/security>
* ACA health probes: <https://learn.microsoft.com/azure/container-apps/health-probes>
* Entra External ID overview: <https://learn.microsoft.com/entra/external-id/customers/overview-customers-ciam>
* Entra External ID OIDC provider setup: <https://learn.microsoft.com/entra/external-id/customers/how-to-custom-oidc-federation-customers>
* Entra token validation: <https://learn.microsoft.com/entra/identity-platform/access-tokens>
* Entra Node web app to call protected API (External tenant): <https://learn.microsoft.com/entra/identity-platform/how-to-web-app-node-sign-in-call-api-prepare-app>

## Clarifying Questions Discovered

* Should the scaffold support single-tenant, multi-tenant, or both issuer validation modes for Entra tokens?
* Should room-level auth trust only access tokens, or also support ID token/session-based login for web clients?
* Is Redis presence/driver expected in v1 scaffold for multi-replica room/process scaling, or deferred to phase two?
* Should ACA deployment include optional Dapr sidecar patterns, or remain plain Container Apps in v1?
