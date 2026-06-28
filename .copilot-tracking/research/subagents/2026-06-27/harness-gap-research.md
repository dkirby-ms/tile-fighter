---
title: Harness Gap Research
description: Targeted gap analysis for implementing the deployment CI/CD 7-point harness in Tile Fighter, focused on platform choice, command contracts, and file locations.
author: GitHub Copilot (Researcher Subagent)
ms.date: 2026-06-27
ms.topic: reference
keywords:
  - ci/cd
  - harness
  - deployment
  - workflows
  - constraints
estimated_reading_time: 6
---

## Scope and status

* Status: Complete
* Workspace analyzed: /home/saitcho/tile-fighter
* Task focus:
  * Existing CI workflow/pipeline files
  * Command contracts needed for harness jobs
  * Deployment file locations and parameter sources
  * Unresolved decisions that block implementation planning

## Repository evidence summary

### CI platform artifacts present today

* No GitHub Actions workflow files are committed.
  * Evidence: file search for .github/workflows/* returned no files.
* No Azure DevOps pipeline files are committed.
  * Evidence: file search for azure-pipelines*.yml and .azure-pipelines/** returned no files.

Planning implication:
* CI/CD is not yet codified in-repo on either platform, so platform selection remains a governance decision rather than a technical migration constraint.

### Verified command contracts for harness implementation

Root-level baseline commands (present and executable via scripts):
* npm ci
* npm run lint
* npm run test
* npm run build

Evidence:
* package.json scripts:
  * build = tsc -b
  * lint = npm run --workspaces lint
  * test = npm run --workspaces test

Server-specific commands (present):
* npm run -w @game/server dev
* npm run -w @game/server build
* npm run -w @game/server test
* npm run -w @game/server test:load
* npm run -w @game/server migrate:up
* npm run -w @game/server migrate:down

Evidence:
* apps/server/package.json scripts block

Command-contract drift that can block pipeline authoring if copied from docs:
* README.md documents migrate:generate, but that script does not exist.
* apps/server/README.md also lists migrate:generate.
* apps/server/README.md says migration stack is drizzle-kit/drizzle-orm, while package scripts and dependency use node-pg-migrate.

Planning implication:
* Harness plan must treat package scripts as source of truth until docs are reconciled.

### Verified deployment and environment file locations

Deployment IaC:
* apps/server/infra/containerapps/bicep/main.bicep
* apps/server/infra/containerapps/bicep/main.dev.bicepparam
* apps/server/infra/containerapps/bicep/main.prod.bicepparam

Environment templates:
* .env.example
* apps/server/infra/containerapps/env/dev.env
* apps/server/infra/containerapps/env/prod.env

Container build contract:
* apps/server/docker/Dockerfile

Key constraints found:
* main.bicep expects an existing Container Apps managed environment; it does not create one.
* bicepparam files include placeholder secret values and static image tags (:dev/:prod), so deployment jobs must override secrets and imageName at runtime.
* Dockerfile copies .eslintrc.cjs, but repo uses eslint.config.mjs; current docker build contract is inconsistent and may fail before deploy stage.

## Unresolved decisions that block harness implementation planning

### 1) Authoritative CI platform decision

Open decision:
* GitHub Actions, Azure DevOps, or dual-platform strategy.

Why this blocks planning:
* Determines workflow file locations, environment approvals model, secret stores, and deployment identity setup.

### 2) Secret source of truth and injection path

Open decision:
* Pipeline-native secret store only, Azure Key Vault integration, or hybrid.

Why this blocks planning:
* main.bicep requires secure values at deploy-time; harness cannot finalize deploy job contract without secret retrieval/injection pattern.

### 3) Managed environment lifecycle ownership

Open decision:
* Where and how managed environment resources are provisioned and versioned (separate IaC, manual bootstrap, or expanded Bicep scope).

Why this blocks planning:
* Deployment stage currently assumes pre-existing managed environment; harness needs an explicit precondition gate and ownership boundary.

### 4) Migration tool contract for deployment stages

Open decision:
* Canonical migration tool and commands (node-pg-migrate vs documented drizzle narrative).

Why this blocks planning:
* Any pre-deploy/post-deploy DB migration gate depends on a stable executable contract.

### 5) Load test role in CI/CD policy

Open decision:
* Required check, scheduled check, or manual release gate.

Why this blocks planning:
* test:load needs endpoint/token provisioning and should not be placed in default PR checks without infrastructure.

## Non-blocking but important planning constraints

* TENANT_MODE is hardcoded to single in Bicep container env; multi/both mode requires template change.
* revisionMode defaults to Multiple in both dev and prod params; traffic/rollback policy should be defined explicitly in harness docs.
* Root test fan-out uses --passWithNoTests in non-server packages; quality gate strictness is currently undefined.

## Recommended next research (if requested)

* Compare GitHub Actions vs Azure DevOps implementation deltas for this exact repo structure and Azure deployment path.
* Define a concrete secret-handling blueprint (variable names, ownership, rotation, and runtime injection method).
* Validate a candidate deploy command sequence (including image tag override and secure parameter passing) against current Bicep layout.

## Research status

* Complete for the requested targeted gap analysis.
* No non-.copilot-tracking files were modified in this session.
