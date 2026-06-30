---
title: Issue 88 Bicep Dev and Prod Research
description: Research-backed implementation guidance for GitHub issue #88, including infra inventory, workflow touchpoints, configuration requirements, alternatives, and recommended approach.
author: Researcher Subagent
ms.date: 2026-06-30
ms.topic: reference
---

## Scope and Questions

* Scope: Determine what is needed to implement GitHub issue #88 in dkirby-ms/tile-fighter, "chore: create bicep templates for dev and prod environments", using repository evidence only.
* Questions:
* What infra files already exist under apps/server/infra/containerapps?
* Which deployment workflow touchpoints currently drive build/deploy/verification?
* What configuration inputs are required for environment deployments (names, regions, SKUs, secrets, image tags, DB/auth/runtime variables)?
* Is the current template structure reusable for both dev/prod, or should templates be split?
* What exact file additions/changes should be made to complete issue intent safely?

## Evidence Log (file + line references)

* apps/server/infra/containerapps/bicep/main.bicep:4-7 (target scope and location behavior)
* apps/server/infra/containerapps/bicep/main.bicep:9-19 (managed environment name, app name, image, port params)
* apps/server/infra/containerapps/bicep/main.bicep:21-34 (revision mode and tenant mode params)
* apps/server/infra/containerapps/bicep/main.bicep:36-54 (secure secret params)
* apps/server/infra/containerapps/bicep/main.bicep:56-58 (managed environment is existing)
* apps/server/infra/containerapps/bicep/main.bicep:65 (workload profile)
* apps/server/infra/containerapps/bicep/main.bicep:97-99 (scale min/max)
* apps/server/infra/containerapps/bicep/main.bicep:105-107 (container CPU/memory)
* apps/server/infra/containerapps/bicep/main.bicep:109-141 (runtime env vars currently injected)
* apps/server/infra/containerapps/bicep/main.dev.bicepparam:1-8 (dev parameterization)
* apps/server/infra/containerapps/bicep/main.prod.bicepparam:1-8 (prod parameterization)
* apps/server/infra/containerapps/env/dev.env:1-8 (dev env template)
* apps/server/infra/containerapps/env/prod.env:1-8 (prod env template)
* .github/workflows/release-dev.yml:16-23 (dev release job + image tag from commit SHA)
* .github/workflows/release-dev.yml:28-55 (required deployment secrets list)
* .github/workflows/release-dev.yml:70-80 (build/push immutable image)
* .github/workflows/release-dev.yml:90-99 (precheck managed environment from dev bicepparam)
* .github/workflows/release-dev.yml:101-122 (deployment command and parameter overrides)
* .github/workflows/release-prod.yml:13-20 (prod release job + image tag from commit SHA)
* .github/workflows/release-prod.yml:25-52 (required deployment secrets list)
* .github/workflows/release-prod.yml:67-77 (build/push immutable image)
* .github/workflows/release-prod.yml:87-96 (precheck managed environment from prod bicepparam)
* .github/workflows/release-prod.yml:98-119 (deployment command and parameter overrides)
* .github/workflows/verify-release.yml:4-8 (verify runs after release workflows)
* .github/workflows/verify-release.yml:47-60 (verification runtime inputs and secrets)
* .github/workflows/verify-release.yml:154-163 (health/readiness endpoint checks)
* .github/workflows/verify-release.yml:190-197 (authenticated room-join smoke)
* .github/workflows/nonprod-load.yml:12-16 (dev environment load workflow)
* .github/workflows/nonprod-load.yml:30-45 (nonprod load secret validation)
* docs/cicd-harness.md:17 (declared workflow touchpoints)
* docs/cicd-harness.md:21-31 (secret source of truth and alternate model)
* docs/cicd-harness.md:35-53 (documented release secret naming contract)
* docs/cicd-harness.md:86-90 (declared bicep contract and bicepparam role)
* README.md:119-127 (root docs claim bicep deployment assets)
* package.json:10-15 (root scripts do not include deploy script)
* apps/server/package.json:8-15 (server scripts do not include deploy script)
* apps/server/src/config/env.ts:10-41 (authoritative runtime env schema)
* apps/server/src/config/env.ts:88-94 (runtime hard requirements/validation)
* .env.example:1-20 (expected environment variable set for local/runtime parity)

## Key Findings

* Existing infra inventory under apps/server/infra/containerapps is complete but minimal: five files only.
* Evidence: apps/server/infra/containerapps/bicep/main.bicep:1-179, apps/server/infra/containerapps/bicep/main.dev.bicepparam:1-8, apps/server/infra/containerapps/bicep/main.prod.bicepparam:1-8, apps/server/infra/containerapps/env/dev.env:1-8, apps/server/infra/containerapps/env/prod.env:1-8.

* The current pattern is already environment-aware via one shared template plus two environment-specific parameter files.
* Evidence: main template parameters in apps/server/infra/containerapps/bicep/main.bicep:9-54 and environment files in apps/server/infra/containerapps/bicep/main.dev.bicepparam:3-8 and apps/server/infra/containerapps/bicep/main.prod.bicepparam:3-8.

* Deployment touchpoints are GitHub Actions workflows, not npm scripts.
* Evidence: release workflows use az deployment group create in .github/workflows/release-dev.yml:112-122 and .github/workflows/release-prod.yml:109-119; root and server package scripts include lint/test/build/migrate only in package.json:10-15 and apps/server/package.json:8-15.

* Region input currently comes from the target resource group location by default; no explicit dev/prod region override is provided in existing bicepparam files.
* Evidence: apps/server/infra/containerapps/bicep/main.bicep:7 and bicepparam files at apps/server/infra/containerapps/bicep/main.dev.bicepparam:1-8 and apps/server/infra/containerapps/bicep/main.prod.bicepparam:1-8.

* SKU/scale are currently hardcoded in main template (Consumption workload profile, cpu 0.5, memory 1Gi, minReplicas 1, maxReplicas 5), so dev/prod cannot currently diverge without editing main.bicep.
* Evidence: apps/server/infra/containerapps/bicep/main.bicep:65, 97-99, 105-107.

* Image tags are immutable per run in workflows (github.sha), overriding bicepparam defaults at deploy time.
* Evidence: .github/workflows/release-dev.yml:22, 76, 116 and .github/workflows/release-prod.yml:19, 73, 113.

* Secrets currently passed to Bicep are limited to DB + core Entra values; runtime config requires at least one additional mandatory input (JOIN_TOKEN_SIGNING_SECRET) that Bicep does not inject.
* Evidence: release secret set in .github/workflows/release-dev.yml:36-40 and .github/workflows/release-prod.yml:33-37; injected env vars in apps/server/infra/containerapps/bicep/main.bicep:123-140; required runtime variable in apps/server/src/config/env.ts:26 and mapped usage at apps/server/src/config/env.ts:112.

* Runtime auth/telemetry controls exist in code and docs but are not currently represented as deploy-time Bicep params/env for Container Apps.
* Evidence: apps/server/src/config/env.ts:17-25 and 92-94; docs contract includes ENTRA_TOKEN_VERSION and TELEMETRY_SINK_* in docs/cicd-harness.md:48-51, 129-140; these are absent from apps/server/infra/containerapps/bicep/main.bicep:109-141.

* Managed environment is expected to pre-exist and is validated in workflows by reading managedEnvironmentName from environment bicepparam.
* Evidence: apps/server/infra/containerapps/bicep/main.bicep:56-58, .github/workflows/release-dev.yml:95-99, .github/workflows/release-prod.yml:92-96.

* env/dev.env and env/prod.env currently act as documentation templates only and are not consumed by workflows.
* Evidence: env files at apps/server/infra/containerapps/env/dev.env:1-8 and apps/server/infra/containerapps/env/prod.env:1-8; deployment command consumes only bicep + bicepparam + secret overrides in .github/workflows/release-dev.yml:112-122 and .github/workflows/release-prod.yml:109-119.

## Alternatives Evaluated

### Alternative 1: Keep one shared main.bicep + dev/prod .bicepparam (extend current pattern)

* Summary: Preserve current structure and add missing runtime/deploy parameters and secret wiring.
* Pros:
* Minimal churn and low cognitive overhead.
* Already integrated into release workflows.
* Keeps environment differences explicit in bicepparam files.
* Cons:
* Requires disciplined parameter growth to avoid a large template surface.
* Needs clear naming contract to avoid drift between workflows and runtime schema.

### Alternative 2: Split into separate full templates (main.dev.bicep and main.prod.bicep)

* Summary: Duplicate resource declarations into environment-specific templates.
* Pros:
* Easy to apply major environment divergence without conditional logic.
* Each file can encode environment policy directly.
* Cons:
* High duplication risk and higher maintenance burden.
* Increases drift probability between environments.
* Requires workflow and doc rewiring for two template files.

### Alternative 3: Keep shared main.bicep but drive via generated parameters from env files

* Summary: Treat env/dev.env and env/prod.env as source-of-truth and generate deployment parameters before az deployment.
* Pros:
* Single config source could improve operator ergonomics.
* Could reduce hand-maintained duplication across docs/params.
* Cons:
* Adds generation tooling complexity and parsing risk.
* Harder secret boundary controls if not designed carefully.
* Not currently aligned with existing pipeline contract.

## Recommended Approach

* Selected approach: Alternative 1 (shared main.bicep with dev/prod .bicepparam), because this is already the implemented architecture and only needs completion and hardening to satisfy issue #88 intent without introducing unnecessary duplication.

Recommended file additions/changes with rationale:

* apps/server/infra/containerapps/bicep/main.bicep
* Add secure params/secrets/env wiring for JOIN_TOKEN_SIGNING_SECRET (required), and add non-secret/optional params for ENTRA_TOKEN_VERSION and TELEMETRY_SINK_* plus optional auth allow/deny lists.
* Rationale: Align deployment surface with authoritative runtime requirements in apps/server/src/config/env.ts:10-41 and enforcement in apps/server/src/config/env.ts:88-94.

* apps/server/infra/containerapps/bicep/main.dev.bicepparam
* Add explicit non-secret defaults for new non-secret params (for example entraTokenVersion, telemetrySinkMode, scale limits if parameterized, optional location override).
* Rationale: Keep dev behavior explicit and auditable; current file only defines 6 values (apps/server/infra/containerapps/bicep/main.dev.bicepparam:3-8).

* apps/server/infra/containerapps/bicep/main.prod.bicepparam
* Add explicit non-secret defaults for new params and production-specific values where needed (for example stricter revision mode or scale limits if required).
* Rationale: Preserve separation of environment intent while reusing shared resource graph (apps/server/infra/containerapps/bicep/main.prod.bicepparam:3-8).

* .github/workflows/release-dev.yml
* Extend required secret validation and az deployment overrides for any new secure params (at minimum JOIN_TOKEN_SIGNING_SECRET).
* Rationale: Workflow currently validates/passes only DB + core Entra secrets (.github/workflows/release-dev.yml:36-40, 50-54, 118-122).

* .github/workflows/release-prod.yml
* Mirror release-dev changes for new secure parameters.
* Rationale: Keep parity and prevent prod-only drift (.github/workflows/release-prod.yml:33-37, 47-51, 115-119).

* docs/cicd-harness.md
* Update secret naming contract and Bicep parameter contract sections to include any newly required deployment secrets and non-secret parameters.
* Rationale: Existing docs already define a contract and are used as runbook (docs/cicd-harness.md:33-53, 86-90).

* README.md (optional but recommended)
* Update Azure Container Apps deploy assets section to reflect finalized parameter model and environment split.
* Rationale: Root onboarding doc references these assets (README.md:119-127).

## Implementation Checklist

1. Confirm final env parity set between apps/server/src/config/env.ts and Container Apps injected env variables.
2. Update apps/server/infra/containerapps/bicep/main.bicep with missing params/secrets/env mappings.
3. Extend apps/server/infra/containerapps/bicep/main.dev.bicepparam with explicit dev defaults for newly added non-secret params.
4. Extend apps/server/infra/containerapps/bicep/main.prod.bicepparam with explicit prod defaults for newly added non-secret params.
5. Update .github/workflows/release-dev.yml to validate and pass new secure parameters.
6. Update .github/workflows/release-prod.yml to validate and pass new secure parameters.
7. Decide whether location, scale, and workload profile should become per-environment parameters; if yes, parameterize and set in both bicepparam files.
8. Validate Bicep compilation and deployment command correctness for both environments.
9. Update docs/cicd-harness.md secret and parameter contract.
10. Run release verification workflow to confirm health/readiness and authenticated smoke after deployment.

## Risks

* Runtime startup failure risk if JOIN_TOKEN_SIGNING_SECRET remains undeployed.
* Evidence: required in apps/server/src/config/env.ts:26 and consumed at apps/server/src/config/env.ts:112.

* Contract drift risk between docs and actual workflow/template parameters.
* Evidence: docs contract in docs/cicd-harness.md:35-53 and actual workflow secret validation in .github/workflows/release-dev.yml:28-55 and .github/workflows/release-prod.yml:25-52.

* Environment behavior drift risk if scale/SKU remain hardcoded and future dev/prod divergence is needed.
* Evidence: hardcoded workload profile/resources/scale in apps/server/infra/containerapps/bicep/main.bicep:65, 97-99, 105-107.

* Operational confusion risk because env/*.env templates are not consumed in deployment path.
* Evidence: apps/server/infra/containerapps/env/dev.env:1-8 and apps/server/infra/containerapps/env/prod.env:1-8 are not referenced by deployment commands in .github/workflows/release-dev.yml:112-122 and .github/workflows/release-prod.yml:109-119.

## Open Questions for User

* Should dev and prod run in different Azure regions, or should both keep resourceGroup().location behavior?
* Should production use different scale/SKU settings from dev (for example min/max replicas, CPU, memory, workload profile)?
* Do you want telemetry variables (TELEMETRY_SINK_MODE/URL/NAME) to be first-class deployment parameters now, or deferred?
* Should ENTRA_TOKEN_VERSION be explicitly configurable per environment, or rely on runtime default 2.0?
* Do you want env/dev.env and env/prod.env to become deployment inputs, or remain documentation-only reference files?
