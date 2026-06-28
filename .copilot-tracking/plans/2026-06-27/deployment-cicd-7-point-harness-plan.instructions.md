---
applyTo: '.copilot-tracking/changes/2026-06-27/deployment-cicd-7-point-harness-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Deployment CI/CD 7-Point Harness

## Overview

Implement a repository-native seven-point CI/CD harness that validates, builds, secures, deploys, verifies, and operationalizes the Tile Fighter server deployment lifecycle.

## Objectives

### User Requirements

* Plan the work for the harness. — Source: user request on 2026-06-27.

### Derived Objectives

* Define phased implementation for CI validation, release deployment, verification, and rollback operations. — Derived from: research requirement for a complete seven-point harness.
* Resolve deployment contract blockers (Dockerfile mismatch, secret injection contract, tenant mode parameterization). — Derived from: high-impact infrastructure and pipeline gaps discovered in research.
* Align documentation with executable deployment/migration scripts before enforcing gates. — Derived from: docs-to-code drift that can cause failed implementation.

## Context Summary

### Project Files

* package.json - Root scripts define lint/test/build contracts used by CI.
* apps/server/package.json - Server scripts provide deploy-adjacent commands including load and migrations.
* apps/server/docker/Dockerfile - Container image build contract currently has a known mismatch.
* apps/server/infra/containerapps/bicep/main.bicep - Main Container Apps deployment template and secure parameter model.
* apps/server/infra/containerapps/bicep/main.dev.bicepparam - Dev deployment parameter baseline.
* apps/server/infra/containerapps/bicep/main.prod.bicepparam - Prod deployment parameter baseline.
* README.md - Root runbook and migration/deploy docs that require alignment.
* apps/server/README.md - Server-specific commands and operational notes that require alignment.

### References

* .copilot-tracking/research/2026-06-27/deployment-cicd-7-point-harness-research.md - Primary harness architecture research and recommended seven gates.
* .copilot-tracking/research/subagents/2026-06-27/ci-baseline-research.md - Verified root/package script contracts and CI baseline.
* .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md - Deployment infra, secret, probe, and Docker contract findings.
* .copilot-tracking/research/subagents/2026-06-27/harness-gap-research.md - Remaining decision points and planning blockers.

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown formatting and frontmatter standards.
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Markdown writing style and tone conventions.

## Implementation Checklist

### [x] Implementation Phase 1: Workflow Foundation and CI Gate

<!-- parallelizable: true -->

* [x] Step 1.1: Create baseline CI workflow in .github/workflows/ci.yml for install, lint, test, and build gates.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 12-33)
* [x] Step 1.2: Create release workflows in .github/workflows/release-dev.yml and .github/workflows/release-prod.yml for immutable artifact + Bicep deploy.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 34-59)
* [x] Step 1.3: Validate phase changes.
  * Run workflow lint checks for new YAML files.
  * Skip full repository validation in this phase due to shared validation scope with later phases.

### [x] Implementation Phase 2: Deploy Contract Hardening

<!-- parallelizable: false -->

* [x] Step 2.1: Fix Dockerfile build contract mismatch to unblock image gate.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 74-90)
* [x] Step 2.2: Decide secret source-of-truth model and apply a single contract to release workflows.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 91-110)
* [x] Step 2.3: Parameterize tenant/deploy settings and formalize secret injection model in Bicep + docs.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 111-131)
* [x] Step 2.4: Add explicit security and policy gates for dependency and container scanning.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 132-152)
* [x] Step 2.5: Align migration and deployment docs with executable scripts.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 153-171)
* [x] Step 2.6: Validate phase changes.
  * Run docker build contract validation and Bicep compilation.

### [ ] Implementation Phase 3: Verification and Operations Gates

<!-- parallelizable: true -->

* [x] Step 3.1: Add post-deploy verification workflow for health/readiness and authenticated smoke checks.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 204-226)
* [x] Step 3.2: Add rollback runbook and scheduled non-prod load workflow.
  * Details: .copilot-tracking/details/2026-06-27/deployment-cicd-7-point-harness-details.md (Lines 227-243)
* [ ] Step 3.3: Validate phase changes.
  * Validate workflow formatting and non-prod load test invocation assumptions.

### [x] Implementation Phase 4: Full Validation

<!-- parallelizable: false -->

* [x] Step 4.1: Run full project validation.
  * Execute lint, test, build, and Bicep compile checks.
* [x] Step 4.2: Fix minor validation issues.
  * Iterate on straightforward lint/build/test findings.
* [x] Step 4.3: Report blocking issues.
  * Record unresolved blockers and required follow-on planning.

## Planning Log

See .copilot-tracking/plans/logs/2026-06-27/deployment-cicd-7-point-harness-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* GitHub Actions environment and repository permissions.
* Azure CLI/Bicep CLI tooling in release runners.
* Container registry credentials and environment-scoped deployment secrets.
* Decision on secret source-of-truth integration path (pipeline store or Key Vault).

## Success Criteria

* Seven harness points are mapped to codified workflows and runbook artifacts in repository.
* Deployment contracts are secure and deterministic with immutable image promotion and runtime secret injection.
* Full validation succeeds with no critical or major plan discrepancies outstanding.