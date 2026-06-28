<!-- markdownlint-disable-file -->
# Implementation Details: Deployment CI/CD 7-Point Harness

## Context Reference

Sources: .copilot-tracking/research/2026-06-27/deployment-cicd-7-point-harness-research.md, .copilot-tracking/research/subagents/2026-06-27/ci-baseline-research.md, .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md, .copilot-tracking/research/subagents/2026-06-27/harness-gap-research.md.

## Implementation Phase 1: CI Validation Harness

<!-- parallelizable: true -->

### Step 1.1: Create baseline PR validation workflow

Create .github/workflows/ci.yml to run deterministic validation for pull requests and main branch pushes. The workflow executes install, lint, test, and TypeScript build using existing root script contracts.

Files:
* .github/workflows/ci.yml - New workflow for root validation gates.
* package.json - Source of truth for scripts consumed by ci.yml.

Discrepancy references:
* Addresses DR-01 by codifying repository-level automation that is currently absent.

Success criteria:
* Workflow triggers on pull_request and push to main.
* Job runs npm ci, npm run lint, npm run test, npm run build in that order.
* Workflow uses Node 22 and npm cache.

Context references:
* package.json (Lines 10-14) - Root script contract.
* .copilot-tracking/research/subagents/2026-06-27/ci-baseline-research.md (Lines 27-36) - Baseline CI recommendations.

Dependencies:
* None.

### Step 1.2: Create deploy workflows for dev and prod

Create environment-specific release workflows under .github/workflows that build and publish immutable images, run Bicep deployment, and capture deployment outputs for downstream verification.

Files:
* .github/workflows/release-dev.yml - Development deployment workflow.
* .github/workflows/release-prod.yml - Production deployment workflow with stricter environment approval.
* apps/server/infra/containerapps/bicep/main.bicep - Deployment template consumed by workflows.
* apps/server/infra/containerapps/bicep/main.dev.bicepparam - Dev parameter baseline consumed by workflow.
* apps/server/infra/containerapps/bicep/main.prod.bicepparam - Prod parameter baseline consumed by workflow.

Discrepancy references:
* Addresses DR-01 by introducing deployment automation.
* Addresses DD-01 by selecting GitHub Actions as the initial automation path.

Success criteria:
* Each workflow tags image with commit SHA and uses that exact tag in deployment parameter overrides.
* Each workflow runs a managed-environment precheck before az deployment group create.
* Each workflow passes secure parameters at runtime and does not rely on committed secret placeholders.

Context references:
* .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md (Lines 43-58) - Existing managed environment behavior.
* .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md (Lines 94-105) - Secure parameter handling implications.

Dependencies:
* Step 1.1 completion.

### Step 1.3: Validate phase changes

Run workflow lint checks and YAML validation for new workflow files. Skip full repository validation in this phase because additional phases will modify docs and deployment-related files that share the same validation scope.

Validation commands:
* npx prettier --check .github/workflows/*.yml - Workflow formatting and syntax hygiene.
* actionlint - Workflow semantic lint where available.

## Implementation Phase 2: Deployment Contract and Security Gates

<!-- parallelizable: false -->

### Step 2.1: Fix Docker build contract for immutable artifact stage

Update apps/server/docker/Dockerfile so the image build no longer references missing root files and remains aligned with current repository config. Keep runtime behavior unchanged.

Files:
* apps/server/docker/Dockerfile - Replace .eslintrc.cjs copy reference and keep deterministic install/build flow.
* eslint.config.mjs - Reference point for lint configuration source.

Discrepancy references:
* Addresses DR-02 by removing known image-build blocker.

Success criteria:
* docker build with current Dockerfile context succeeds locally and in CI.
* Dockerfile no longer copies a non-existent .eslintrc.cjs file.

Context references:
* .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md (Lines 142-151) - Docker mismatch finding.

Dependencies:
* Implementation Phase 1 completion.

### Step 2.2: Decide secret source-of-truth model for deployment jobs

Finalize the deployment secret model as an explicit implementation decision before wiring deployment commands. Use a documented default path and keep Key Vault integration as an extension if governance requires it.

Files:
* docs/cicd-harness.md - Record the chosen secret model and variable ownership.
* .github/workflows/release-dev.yml - Apply selected secret injection approach.
* .github/workflows/release-prod.yml - Apply selected secret injection approach.

Discrepancy references:
* Addresses DR-04 by turning secret-source selection into an executable planning step.

Success criteria:
* Decision is recorded with rationale for one selected model and one alternate.
* Dev and prod workflows reference the same secret naming contract.
* Deployment examples show secure runtime injection rather than committed literals.

Context references:
* .copilot-tracking/research/subagents/2026-06-27/harness-gap-research.md (Lines 82-88) - Secret-source unresolved decision.

Dependencies:
* Step 2.1 completion.

### Step 2.3: Parameterize deploy-time runtime settings and secret injection contract

Adjust Bicep and/or deployment workflow parameters so TENANT_MODE and secret values can be supplied per environment without committing sensitive values. Keep the secure parameter pattern in main.bicep.

Files:
* apps/server/infra/containerapps/bicep/main.bicep - Add explicit parameterization for tenant mode and any release-specific toggles.
* apps/server/infra/containerapps/bicep/main.dev.bicepparam - Keep non-secret defaults only.
* apps/server/infra/containerapps/bicep/main.prod.bicepparam - Keep non-secret defaults only.
* docs/cicd-harness.md - Document secret ownership and runtime override contract.

Discrepancy references:
* Addresses DR-03 for tenant mode flexibility.
* Implements the selected secret-source contract from Step 2.2.

Success criteria:
* TENANT_MODE value is supplied from parameter input rather than hardcoded in template logic.
* bicepparam files contain no real secret literals.
* Deployment docs specify where each secret is sourced and injected.

Context references:
* apps/server/src/config/env.ts (Lines 13-17) - Runtime supported tenant modes.
* .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md (Lines 106-121) - Tenant mode hardcoding finding.

Dependencies:
* Step 2.2 completion.

### Step 2.4: Add explicit security and policy gates

Add executable security controls to the harness for dependency and container image risk detection, and fail release progression when policy thresholds are exceeded.

Files:
* .github/workflows/ci.yml - Add dependency audit gate with explicit fail criteria.
* .github/workflows/release-dev.yml - Add container image scan step and threshold policy.
* .github/workflows/release-prod.yml - Add container image scan step and threshold policy.
* docs/cicd-harness.md - Document policy thresholds and exception handling path.

Discrepancy references:
* Addresses DR-08 by adding the missing security/policy gate implementation.

Success criteria:
* CI gate fails on dependency issues at the defined severity threshold.
* Release gate fails when container scan threshold is exceeded.
* Policy thresholds and override process are documented.

Context references:
* .copilot-tracking/research/2026-06-27/deployment-cicd-7-point-harness-research.md (Lines 217-220) - Security + policy gate requirement.

Dependencies:
* Step 2.3 completion.

### Step 2.5: Align migration and deployment documentation with executable scripts

Update root and server READMEs so migration commands and tooling references match package scripts and dependencies used by the harness.

Files:
* README.md - Correct migration command references and CI/CD runbook sections.
* apps/server/README.md - Replace drifted migration narrative and align with node-pg-migrate scripts.
* apps/server/package.json - Source of truth for migration script names.

Discrepancy references:
* Addresses DR-05 by closing docs-to-code drift before enforcing migration gates.

Success criteria:
* No references to migrate:generate remain unless that script is added.
* Migration tool naming in documentation matches current package dependencies and scripts.

Context references:
* .copilot-tracking/research/subagents/2026-06-27/ci-baseline-research.md (Lines 165-176) - Documented command mismatch.
* .copilot-tracking/research/subagents/2026-06-27/harness-gap-research.md (Lines 41-52) - Planning risk from docs drift.

Dependencies:
* Step 2.4 completion.

### Step 2.6: Validate phase changes

Run focused build/deploy contract checks for infrastructure and Docker changes introduced in this phase.

Validation commands:
* docker build -f apps/server/docker/Dockerfile . - Validate image build contract.
* az bicep build --file apps/server/infra/containerapps/bicep/main.bicep - Validate Bicep compilation.
* npm audit --audit-level=high - Validate dependency policy gate behavior.

## Implementation Phase 3: Verification and Operations Harness

<!-- parallelizable: true -->

### Step 3.1: Add post-deploy verification workflow

Create a verification workflow that executes health and readiness probe checks and authenticated smoke tests for protected HTTP routes and room join behavior.

Files:
* .github/workflows/verify-release.yml - Post-deployment verification workflow.
* apps/server/tests/load/room-join-load.ts - Existing load/auth test harness used as a reusable verification primitive.

Discrepancy references:
* Addresses DR-06 by codifying post-deploy verification checks.

Success criteria:
* Workflow performs /healthz and /readyz checks against deployed ingress URL.
* Workflow runs an authenticated smoke call against protected route and room join path.
* Workflow fails hard on any non-2xx probe or auth smoke failure.

Context references:
* apps/server/src/http/routes/health.routes.ts (Lines 7-14) - Health endpoint contracts.
* .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md (Lines 59-76) - Probe alignment evidence.

Dependencies:
* Implementation Phase 1 completion.

### Step 3.2: Add operations and rollback runbook plus scheduled load checks

Document rollback steps and add scheduled non-prod load validation so operational feedback becomes a codified seventh harness point.

Files:
* docs/cicd-harness.md - Add rollback procedures, revision selection criteria, and incident triage checklist.
* .github/workflows/nonprod-load.yml - Scheduled workflow for non-prod room-join load checks.

Discrepancy references:
* Addresses DR-07 for operational feedback and rollback guidance.

Success criteria:
* Runbook includes clear rollback command path and validation expectations.
* Scheduled load workflow is non-blocking for PR validation and targets non-prod only.

Context references:
* apps/server/package.json (Line 13) - Existing test:load command.
* .copilot-tracking/research/2026-06-27/deployment-cicd-7-point-harness-research.md (Lines 183-188) - Verify and operations stage recommendations.

Dependencies:
* Step 3.1 completion.

### Step 3.3: Validate phase changes

Validate newly added verification/operations workflows and runbook consistency.

Validation commands:
* npx prettier --check .github/workflows/*.yml docs/cicd-harness.md - Formatting validation.
* npm run -w @game/server test:load - Run only in configured non-prod context.

## Implementation Phase 4: Full Validation and Readiness Gate

<!-- parallelizable: false -->

### Step 4.1: Run full project validation

Execute all validation commands for the project:
* npm run lint
* npm run test
* npm run build
* az bicep build --file apps/server/infra/containerapps/bicep/main.bicep

### Step 4.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures. Apply fixes directly when corrections are straightforward and isolated.

### Step 4.3: Report blocking issues

When validation failures require changes beyond minor fixes:
* Document issues and affected files in .copilot-tracking/plans/logs/2026-06-27/deployment-cicd-7-point-harness-log.md.
* Provide next-step implementation tasks and owners.
* Recommend additional research and planning for architecture-level blockers.

## Dependencies

* GitHub Actions repository permissions for workflow execution.
* Azure CLI, Bicep CLI, and registry push permissions for deployment jobs.
* Environment-scoped secret stores for dev and prod runtime values.

## Success Criteria

* The repository has codified CI, release, verification, and operations workflows implementing the seven harness points.
* Deployment contracts are secure, deterministic, and aligned with runtime/source-of-truth scripts.
* Full validation passes and deploy verification gates provide actionable rollback signals.