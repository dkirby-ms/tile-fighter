---
applyTo: '.copilot-tracking/changes/2026-06-30/issue-88-bicep-dev-prod-environments-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Issue 88 - Bicep Dev and Prod Environments

## Overview

Add `JOIN_TOKEN_SIGNING_SECRET` as a secure Bicep parameter, inject it as a container env var, extend both release workflows to validate and pass it, and reconcile `docs/cicd-harness.md` secret naming contract with actual workflow behavior.

## Objectives

### User Requirements

* Issue #88: "chore: create bicep templates for dev and prod environments" — Source: GitHub issue #88 and attached research document `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md`

### Derived Objectives

* Inject `JOIN_TOKEN_SIGNING_SECRET` into the container app so the runtime schema in `apps/server/src/config/env.ts` (line 29) can be satisfied at deploy time — Derived from: runtime schema requires `JOIN_TOKEN_SIGNING_SECRET: z.string().min(32)` with no default, meaning any deployment without it will fail on startup
* Remove contract drift in `docs/cicd-harness.md` where the Secret Naming Contract lists `ENTRA_TOKEN_VERSION`, `TELEMETRY_SINK_MODE`, `TELEMETRY_SINK_URL`, and `TELEMETRY_SINK_NAME` as required secrets even though the release workflows neither validate nor pass them — Derived from: research comparison of docs vs. workflow behavior

## Context Summary

### Project Files

* `apps/server/infra/containerapps/bicep/main.bicep` - Shared container app template; currently has 5 secure params but is missing `joinTokenSigningSecret`
* `apps/server/infra/containerapps/bicep/main.dev.bicepparam` - Dev non-secret defaults; no changes needed
* `apps/server/infra/containerapps/bicep/main.prod.bicepparam` - Prod non-secret defaults; no changes needed
* `.github/workflows/release-dev.yml` - Dev release workflow; validates secrets and runs `az deployment group create`
* `.github/workflows/release-prod.yml` - Prod release workflow; same structure as dev
* `apps/server/src/config/env.ts` - Runtime env schema; `JOIN_TOKEN_SIGNING_SECRET` is required at line 29
* `docs/cicd-harness.md` - CI/CD contract documentation; Secret Naming Contract section has drift

### References

* `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md` - Full gap analysis and approach selection

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

### [ ] Implementation Phase 5: Validation

<!-- parallelizable: false -->

* [ ] Step 5.1: Run full Bicep compilation for both param files
  * `az bicep build --file apps/server/infra/containerapps/bicep/main.bicep`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/main.dev.bicepparam`
  * `az bicep build-params --file apps/server/infra/containerapps/bicep/main.prod.bicepparam`
* [ ] Step 5.2: Confirm both release workflows reference `JOIN_TOKEN_SIGNING_SECRET` in validate, env, and deploy steps
* [ ] Step 5.3: Confirm `docs/cicd-harness.md` Secret Naming Contract matches the actual required array in both workflows
* [ ] Step 5.4: Fix any minor validation issues inline
* [ ] Step 5.5: Report blocking issues requiring further research

## Planning Log

See `.copilot-tracking/plans/logs/2026-06-30/issue-88-bicep-dev-prod-environments-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Azure CLI with Bicep extension available (`az bicep build`) for local validation
* No new npm packages or TypeScript changes required

## Success Criteria

* `az bicep build` compiles `main.bicep`, `main.dev.bicepparam`, and `main.prod.bicepparam` without error — Traces to: runtime requirement for `JOIN_TOKEN_SIGNING_SECRET`
* Both `release-dev.yml` and `release-prod.yml` fail fast when `JOIN_TOKEN_SIGNING_SECRET` is absent — Traces to: user requirement for reliable deploy-time validation
* `docs/cicd-harness.md` Secret Naming Contract exactly mirrors the required secrets validated and passed by both release workflows — Traces to: drift removal derived objective
