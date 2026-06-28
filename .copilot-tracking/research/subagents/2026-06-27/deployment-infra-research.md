---
title: Deployment Infrastructure Research
description: Deep analysis of Tile Fighter deployment infrastructure, Bicep parameters, environment conventions, Docker runtime assumptions, and auth/secrets wiring.
author: GitHub Copilot (Researcher Subagent)
ms.date: 2026-06-27
ms.topic: reference
keywords:
  - azure container apps
  - bicep
  - docker
  - entra
  - deployment pipeline
estimated_reading_time: 14
---

## Research Scope

* Analyze deployment infrastructure under apps/server/infra/containerapps and runtime build assumptions.
* Inspect Bicep and bicepparam design, environment templates, and secret handling.
* Correlate infrastructure settings with actual server/auth/environment code paths.
* Produce deployment implications, unresolved gaps, and recommended CI/CD structure grounded in repository evidence.

## Evidence Inventory

### Bicep and Parameter Inputs

* apps/server/infra/containerapps/bicep/main.bicep:1-171
* apps/server/infra/containerapps/bicep/main.dev.bicepparam:1-12
* apps/server/infra/containerapps/bicep/main.prod.bicepparam:1-12

### Environment Templates

* apps/server/infra/containerapps/env/dev.env:1-8
* apps/server/infra/containerapps/env/prod.env:1-8
* .env.example:1-11

### Container Runtime

* apps/server/docker/Dockerfile:1-26
* apps/server/docker/.dockerignore:1-7

### Runtime/Auth/Health Source Paths

* apps/server/src/config/env.ts:1-61
* apps/server/src/index.ts:1-79
* apps/server/src/auth/auth-service.ts:1-30
* packages/shared-auth/src/index.ts:1-136
* apps/server/src/http/routes/health.routes.ts:1-17
* apps/server/src/http/auth-middleware.ts:1-21
* apps/server/src/rooms/arena.room.ts:1-34
* apps/server/src/persistence/db.ts:1-43

### Documentation and Script Contracts

* README.md:49-97
* apps/server/README.md:18-53
* package.json:10-14
* apps/server/package.json:8-16

## Findings and Deployment Implications

### 1. Container Apps template expects pre-existing managed environment

Evidence:

* main.bicep declares existing managed environment, not creation: apps/server/infra/containerapps/bicep/main.bicep:48-50
* Container app binds managedEnvironmentId from that existing resource: apps/server/infra/containerapps/bicep/main.bicep:56

Implications:

* Deployment stage must provision the managed environment separately (bootstrap IaC or one-time setup).
* Pipeline should fail fast with a clear check if managed environment name is missing or incorrect.
* Environment bootstrap and app deployment are separate lifecycle concerns and should be separate jobs/stages.

### 2. App ingress and probes are correctly aligned to implemented endpoints

Evidence:

* Ingress external enabled and targetPort bound to containerPort: apps/server/infra/containerapps/bicep/main.bicep:60-63
* Liveness/startup use /healthz and readiness uses /readyz: apps/server/infra/containerapps/bicep/main.bicep:135-162
* Server implements /healthz and /readyz exactly: apps/server/src/http/routes/health.routes.ts:7-14
* /readyz uses DB-backed readinessCheck from bootstrap: apps/server/src/index.ts:24-43

Implications:

* Probe path mismatch risk is currently low because infra and source are consistent.
* Readiness meaningfully reflects DB connectivity, so rollout gating can rely on readiness during revision activation.
* Any future route path changes must be coupled with Bicep update to avoid unhealthy revisions.

### 3. Secret plumbing in Bicep is structurally sound but parameter files currently contain plaintext placeholders

Evidence:

* Secret params are marked @secure in main.bicep: apps/server/infra/containerapps/bicep/main.bicep:28-46
* Secrets mapped into container app secrets and secretRef env mapping: apps/server/infra/containerapps/bicep/main.bicep:65-133
* dev/prod bicepparam files currently hold placeholder plaintext values for secret params: apps/server/infra/containerapps/bicep/main.dev.bicepparam:8-12 and apps/server/infra/containerapps/bicep/main.prod.bicepparam:8-12

Implications:

* The model is correct for secure parameters, but committed bicepparam defaults are not deploy-safe and must never become real secret values in Git.
* Pipeline should inject secure parameter values at deploy time (CLI parameter overrides, secret variable groups, or Key Vault retrieval), not rely on committed values.
* Security posture improves if bicepparam files keep non-secret values only and secret inputs are externalized.

### 4. Hardcoded TENANT_MODE single in Bicep can override env template intent

Evidence:

* Bicep container env explicitly sets TENANT_MODE='single': apps/server/infra/containerapps/bicep/main.bicep:110-113
* env template files also set TENANT_MODE=single: apps/server/infra/containerapps/env/dev.env:3 and apps/server/infra/containerapps/env/prod.env:3
* Runtime supports single/multi/both modes and conditional ENTRA_TENANT_ID requirement for single mode: apps/server/src/config/env.ts:13-17 and apps/server/src/config/env.ts:44-46

Implications:

* Deployment cannot switch to multi-tenant mode via bicepparam today because TENANT_MODE is not parameterized in Bicep.
* If roadmap requires multi/both mode, template change is required; otherwise pipeline complexity will grow through ad hoc post-deploy overrides.

### 5. NODE_ENV is forced to production in both Docker image and Container Apps env

Evidence:

* Docker runtime stage sets ENV NODE_ENV=production: apps/server/docker/Dockerfile:15
* Bicep env also sets NODE_ENV='production': apps/server/infra/containerapps/bicep/main.bicep:103-105
* Runtime parser accepts production/development/test with default development: apps/server/src/config/env.ts:7

Implications:

* Production-safe default is strong for deployed app, but this dual declaration can mask accidental config drift during troubleshooting.
* Keep one source of truth for production mode at deployment boundary where possible (prefer runtime platform env injection).

### 6. Dockerfile currently references missing file and can break image build

Evidence:

* Dockerfile copies .eslintrc.cjs from repo root: apps/server/docker/Dockerfile:5
* Repo root contains eslint.config.mjs and not .eslintrc.cjs: eslint.config.mjs exists; .eslintrc.cjs missing (verified in workspace)

Implications:

* docker build will fail at COPY step unless a missing file is added or Dockerfile is corrected.
* CI image-build gate should run before deployment and block promotion on this error.

### 7. Docker image includes full workspace node_modules and packages; runtime footprint is broad

Evidence:

* Builder runs npm ci at monorepo root: apps/server/docker/Dockerfile:9
* Runtime copies full /workspace/node_modules and /workspace/packages: apps/server/docker/Dockerfile:19 and apps/server/docker/Dockerfile:22

Implications:

* Image likely larger than necessary and includes dependencies outside server runtime critical path.
* Slower pull/start times and larger attack surface are possible.
* Consider production-pruned install or workspace-focused dependency pruning in pipeline optimization phase.

### 8. Auth and secret conventions are consistently applied across HTTP and room auth boundaries

Evidence:

* Runtime requires DATABASE_URL/ENTRA_* and validates urls/types via zod: apps/server/src/config/env.ts:9-17 and apps/server/src/config/env.ts:41-60
* AuthService forwards issuer/audience/jwks and tenant policies: apps/server/src/auth/auth-service.ts:9-19
* JWT validator enforces algorithm allowlist, rejects alg none, verifies issuer/audience with JWKS key retrieval: packages/shared-auth/src/index.ts:47-54 and packages/shared-auth/src/index.ts:68-88
* HTTP middleware requires bearer token for protected routes: apps/server/src/http/auth-middleware.ts:10-19
* Colyseus room join auth validates token during onAuth: apps/server/src/rooms/arena.room.ts:26-29

Implications:

* Deployment secrets for ENTRA_* and tenant controls directly affect both REST and WebSocket access control behavior.
* Misconfigured audience/issuer/jwks will present as startup/authorization failures, so smoke tests should include protected HTTP and room join validation.

### 9. Migration tooling and docs are inconsistent

Evidence:

* Actual scripts: migrate:up and migrate:down only: apps/server/package.json:14-15
* Root README references migrate:generate which is not defined: README.md:60
* Server README claims drizzle-based migration stack: apps/server/README.md:52
* Actual migration tooling dependency/script is node-pg-migrate: apps/server/package.json:14 and apps/server/package.json:36

Implications:

* Pipeline steps copied from docs may fail due to missing command.
* Documentation drift increases deployment runbook risk and onboarding errors.
* Migration strategy should be codified as an executable pipeline step sourced from package scripts, not docs prose.

### 10. No repository CI workflow files detected

Evidence:

* No .github/workflows files were found in workspace inventory.

Implications:

* Deployment process appears scaffolded but not yet codified in repo-native CI/CD automation.
* Manual deployments can diverge by operator and environment without deterministic promotion gates.

## Runtime Assumptions Mapped to Deployment

* App listens on runtimeConfig.port from PORT: apps/server/src/index.ts:57 and apps/server/src/config/env.ts:8.
* Database connectivity must succeed at startup or process exits: apps/server/src/index.ts:19-21 and apps/server/src/index.ts:76-79.
* Readiness requires DB checks to pass continuously: apps/server/src/index.ts:24-43 and apps/server/src/persistence/db.ts:37-39.
* Graceful shutdown is implemented and should align with platform termination behavior: apps/server/src/index.ts:61-73.
* Pool sizing/timeouts are fixed in code and may need environment tuning for scale: apps/server/src/persistence/db.ts:23-28.

## Unresolved Questions and Gaps

* How is the managed Container Apps environment (aca-env-dev/prod) provisioned and lifecycle-managed if not in this Bicep module?
* What is the intended canonical migration stack: node-pg-migrate (code) or drizzle (README)?
* Should TENANT_MODE be environment-parameterized in Bicep to support multi/both modes without template edits?
* What is the secret source of truth in CI/CD: pipeline secret store, Azure Key Vault, or both?
* Is there an image hardening policy (base image pin by digest, vulnerability scan thresholds, SBOM/signing) required before deploy?
* Is revision traffic management expected to remain Multiple mode always, or switch to Single in some environments?

## Recommended Deployment Pipeline Structure (Evidence-Based)

### Stage 0: Validate and Prepare

* Run workspace install and compile/test/lint gates using declared scripts: package.json:10-14 and apps/server/package.json:8-16.
* Add explicit docs-vs-scripts consistency check for migration command mismatch (README.md:60 vs apps/server/package.json:14-15).

### Stage 1: Build Container Image

* Build from apps/server/docker/Dockerfile after fixing missing .eslintrc.cjs reference.
* Fail pipeline if docker build fails; this should be a hard gate before infra deployment.
* Tag images immutably (commit SHA) and publish to registry; feed exact image tag into bicepparam override for imageName.

### Stage 2: Security and Compliance Gates

* Run container vulnerability scan and dependency/license checks.
* Enforce no real secret literals in bicepparam files (currently placeholders at apps/server/infra/containerapps/bicep/main.dev.bicepparam:8-12 and apps/server/infra/containerapps/bicep/main.prod.bicepparam:8-12).

### Stage 3: Infra Preconditions

* Validate that target managed environment exists before app deploy because template expects existing resource: apps/server/infra/containerapps/bicep/main.bicep:48-50.
* Validate required secure deployment variables are populated for DATABASE_URL and ENTRA_*.

### Stage 4: Deploy by Environment

* Use bicep deployment with environment-specific bicepparam and secure parameter injection at runtime.
* Override imageName per build artifact to avoid static tags like :dev/:prod in committed params.
* Keep revision mode policy explicit; current default is Multiple: apps/server/infra/containerapps/bicep/main.bicep:26 and apps/server/infra/containerapps/bicep/main.dev.bicepparam:7.

### Stage 5: Post-Deploy Verification

* Probe /healthz and /readyz on ingress URL output from Bicep: apps/server/infra/containerapps/bicep/main.bicep:170-171.
* Execute authenticated smoke test against protected HTTP route and room join flow to validate ENTRA_* secret wiring and token policy.
* Record rollback instruction based on Container Apps revisions when readiness/auth smoke checks fail.

### Stage 6: Operational Hardening (Near-Term)

* Parameterize TENANT_MODE and optionally ALLOWED_* controls in Bicep to match runtime capabilities from env parser.
* Reduce runtime image footprint by pruning non-runtime workspace deps.
* Align docs and scripts for migrations and deployment runbook accuracy.

## Clarifying Questions Requiring User Input

* Which CI/CD platform is intended (GitHub Actions, Azure DevOps, or other) for implementing the recommended staged pipeline?
* Should dev and prod share one managed environment per subscription, or separate environments/subscriptions per stage?
* Is the expected production auth mode strictly single-tenant, or should multi/both tenant modes be first-class deployment options?
* Should secrets be sourced directly from Azure Key Vault references in Container Apps, or injected as secure Bicep parameters during deployment?

## Research Status

* Complete for repository-local deployment infrastructure analysis requested in scope.
* Blockers: none for static analysis; dynamic validation (actual az deployment, live probes, runtime auth checks) was not executed in this session.
