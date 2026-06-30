---
applyTo: '.copilot-tracking/changes/2026-06-30/issue-88-bicep-dev-prod-environments-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Issue 88 - Bicep Dev and Prod Environments

## Overview

Add `JOIN_TOKEN_SIGNING_SECRET` as a secure Bicep parameter, inject it as a container env var, extend both release workflows to validate and pass it, create a decoupled environment provisioning layer (Log Analytics workspace + managed environment) with dedicated `workflow_dispatch` workflows, and reconcile `docs/cicd-harness.md` with actual workflow behavior.

## Objectives

### User Requirements

* Issue #88: "chore: create bicep templates for dev and prod environments" — Source: GitHub issue #88 and attached research document `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md`

### Derived Objectives

* Inject `JOIN_TOKEN_SIGNING_SECRET` into the container app so the runtime schema in `apps/server/src/config/env.ts` (line 29) can be satisfied at deploy time — Derived from: runtime schema requires `JOIN_TOKEN_SIGNING_SECRET: z.string().min(32)` with no default, meaning any deployment without it will fail on startup
* Remove contract drift in `docs/cicd-harness.md` where the Secret Naming Contract lists `ENTRA_TOKEN_VERSION`, `TELEMETRY_SINK_MODE`, `TELEMETRY_SINK_URL`, and `TELEMETRY_SINK_NAME` as required secrets even though the release workflows neither validate nor pass them — Derived from: research comparison of docs vs. workflow behavior
* Provision the Azure Container Apps managed environment and its required Log Analytics workspace via dedicated Bicep files and `workflow_dispatch` workflows, decoupled from the app deployment layer — Derived from: release workflows precheck that the managed environment exists but no IaC currently creates it

## Context Summary

### Project Files

* `apps/server/infra/containerapps/bicep/main.bicep` - Shared container app template; currently has 5 secure params but is missing `joinTokenSigningSecret`
* `apps/server/infra/containerapps/bicep/main.dev.bicepparam` - Dev non-secret defaults; no changes needed
* `apps/server/infra/containerapps/bicep/main.prod.bicepparam` - Prod non-secret defaults; no changes needed
* `.github/workflows/release-dev.yml` - Dev release workflow; validates secrets and runs `az deployment group create`
* `.github/workflows/release-prod.yml` - Prod release workflow; same structure as dev
* `apps/server/src/config/env.ts` - Runtime env schema; `JOIN_TOKEN_SIGNING_SECRET` is required at line 29
* `docs/cicd-harness.md` - CI/CD contract documentation; Secret Naming Contract section has drift; needs new Environment Provisioning section
* `apps/server/infra/containerapps/bicep/environment.bicep` - **new** shared template for Log Analytics workspace + managed environment
* `apps/server/infra/containerapps/bicep/environment.dev.bicepparam` - **new** dev non-secret defaults for environment provisioning
* `apps/server/infra/containerapps/bicep/environment.prod.bicepparam` - **new** prod non-secret defaults for environment provisioning
* `.github/workflows/provision-env-dev.yml` - **new** `workflow_dispatch` workflow to provision dev environment
* `.github/workflows/provision-env-prod.yml` - **new** `workflow_dispatch` workflow to provision prod environment

### References

* `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md` - Full gap analysis and approach selection
* `.copilot-tracking/research/subagents/2026-06-30/aca-environment-provisioning-research.md` - Required resources, naming conventions, workflow trigger strategy

### Standards References

* No language-specific instruction files apply. Bicep conventions from the project's existing template style are used.

## Implementation Checklist

### [ ] Implementation Phase 1: Extend Bicep template with joinTokenSigningSecret

<!-- parallelizable: false -->

* [ ] Step 1.1: Add secure parameter declaration in `main.bicep`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 15-35)
* [ ] Step 1.2: Add `join-token-signing-secret` to the secrets array in `main.bicep`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 36-55)
* [ ] Step 1.3: Add `JOIN_TOKEN_SIGNING_SECRET` env var injection in the container env array in `main.bicep`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 56-75)
* [ ] Step 1.4: Validate phase changes
  * Run `az bicep build --file apps/server/infra/containerapps/bicep/main.bicep` to confirm compilation succeeds

### [ ] Implementation Phase 2: Extend release-dev.yml for JOIN_TOKEN_SIGNING_SECRET

<!-- parallelizable: true -->

* [ ] Step 2.1: Add `JOIN_TOKEN_SIGNING_SECRET` to the `Validate required deployment inputs` env block and required array
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 78-110)
* [ ] Step 2.2: Add `JOIN_TOKEN_SIGNING_SECRET` to the `Deploy to Azure Container Apps` env block and `az deployment group create` parameters
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 111-135)

### [ ] Implementation Phase 3: Extend release-prod.yml for JOIN_TOKEN_SIGNING_SECRET

<!-- parallelizable: true -->

* [ ] Step 3.1: Add `JOIN_TOKEN_SIGNING_SECRET` to the `Validate required deployment inputs` env block and required array
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 138-165)
* [ ] Step 3.2: Add `JOIN_TOKEN_SIGNING_SECRET` to the `Deploy to Azure Container Apps` env block and `az deployment group create` parameters
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 166-190)

### [ ] Implementation Phase 4: Reconcile docs/cicd-harness.md Secret Naming Contract

<!-- parallelizable: true -->

* [ ] Step 4.1: Replace the Secret Naming Contract list to add `JOIN_TOKEN_SIGNING_SECRET` and remove the four never-passed optional vars
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 193-225)

### [ ] Implementation Phase 5: Create environment.bicep and bicepparam files

<!-- parallelizable: false -->

* [ ] Step 5.1: Create `apps/server/infra/containerapps/bicep/environment.bicep`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 228-290)
* [ ] Step 5.2: Create `apps/server/infra/containerapps/bicep/environment.dev.bicepparam`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 291-310)
* [ ] Step 5.3: Create `apps/server/infra/containerapps/bicep/environment.prod.bicepparam`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 311-330)
* [ ] Step 5.4: Validate phase changes
  * `az bicep build --file apps/server/infra/containerapps/bicep/environment.bicep`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/environment.dev.bicepparam`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/environment.prod.bicepparam`

### [ ] Implementation Phase 6: Create provision-env-dev.yml workflow

<!-- parallelizable: true -->

* [ ] Step 6.1: Create `.github/workflows/provision-env-dev.yml`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 333-400)

### [ ] Implementation Phase 7: Create provision-env-prod.yml workflow

<!-- parallelizable: true -->

* [ ] Step 7.1: Create `.github/workflows/provision-env-prod.yml`
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 403-470)

### [ ] Implementation Phase 8: Add Environment Provisioning section to docs/cicd-harness.md

<!-- parallelizable: true -->

* [ ] Step 8.1: Add Environment Provisioning section documenting new Bicep files, workflows, trigger rationale, and RBAC notes
  * Details: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` (Lines 473-510)

### [ ] Implementation Phase 9: Validation

<!-- parallelizable: false -->

* [ ] Step 9.1: Run full Bicep compilation for all six Bicep files
  * `az bicep build --file apps/server/infra/containerapps/bicep/main.bicep`
  * `az bicep build --file apps/server/infra/containerapps/bicep/environment.bicep`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/main.dev.bicepparam`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/main.prod.bicepparam`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/environment.dev.bicepparam`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/environment.prod.bicepparam`
* [ ] Step 9.2: Confirm both release workflows reference `JOIN_TOKEN_SIGNING_SECRET` in validate, env, and deploy steps
* [ ] Step 9.3: Confirm `docs/cicd-harness.md` Secret Naming Contract matches the actual required array in both workflows
* [ ] Step 9.4: Confirm provisioning workflows reference only the four OIDC secrets and deploy the correct bicepparam files
* [ ] Step 9.5: Fix any minor validation issues inline
* [ ] Step 9.6: Report blocking issues requiring further research

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-30/issue-88-bicep-dev-prod-environments-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Azure CLI with Bicep extension available (`az bicep build`, `az bicep build-params`) for local validation
* No new npm packages or TypeScript changes required
* Provisioning workflows require the `Contributor` role on the deployment resource group (same RBAC as the existing release workflows)

## Success Criteria

* `az bicep build` compiles all six Bicep files without error — Traces to: runtime requirement for `JOIN_TOKEN_SIGNING_SECRET` and environment provisioning derived objective
* Both `release-dev.yml` and `release-prod.yml` fail fast when `JOIN_TOKEN_SIGNING_SECRET` is absent — Traces to: user requirement for reliable deploy-time validation
* `docs/cicd-harness.md` Secret Naming Contract exactly mirrors the required secrets validated and passed by both release workflows — Traces to: drift removal derived objective
* `provision-env-dev.yml` and `provision-env-prod.yml` exist and are triggered only by `workflow_dispatch`, reuse only the four OIDC secrets, and deploy `environment.bicep` with the correct per-environment param file — Traces to: decoupled environment provisioning derived objective
