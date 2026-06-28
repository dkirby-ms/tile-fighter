<!-- markdownlint-disable-file -->
# Release Changes: Deployment CI/CD 7-Point Harness

**Related Plan**: deployment-cicd-7-point-harness-plan.instructions.md
**Implementation Date**: 2026-06-27

## Summary

Implemented the deployment CI/CD seven-point harness across workflows, deployment contracts, verification operations, and supporting documentation.

## Changes

### Added

* .github/workflows/ci.yml - Added baseline CI workflow for pull requests and main pushes with Node 22 install, lint, test, and build gates.
* .github/workflows/release-dev.yml - Added development release workflow with immutable SHA tagging, managed environment precheck, and runtime secure parameter overrides.
* .github/workflows/release-prod.yml - Added production release workflow with manual trigger, environment guard, immutable SHA tagging, precheck, and runtime secure parameter overrides.
* docs/cicd-harness.md - Added CI/CD harness contract covering secret ownership, security thresholds, tenant mode parameterization, and exception workflow.
* .github/workflows/verify-release.yml - Added post-deploy verification workflow with health, readiness, protected-route smoke, and authenticated room-join checks.
* .github/workflows/nonprod-load.yml - Added scheduled and manual non-prod load workflow for continuous room-join validation.

### Modified

* apps/server/docker/Dockerfile - Fixed build context contract by copying eslint.config.mjs instead of missing legacy lint config.
* .github/workflows/ci.yml - Added dependency policy gate using npm audit high-severity threshold.
* .github/workflows/release-dev.yml - Standardized deployment secret naming contract and added Trivy high/critical image scan gate.
* .github/workflows/release-prod.yml - Standardized deployment secret naming contract and added Trivy high/critical image scan gate.
* apps/server/infra/containerapps/bicep/main.bicep - Added explicit tenantMode parameter with allowed values and wired runtime TENANT_MODE from parameter input.
* apps/server/infra/containerapps/bicep/main.dev.bicepparam - Removed secret placeholders and retained non-secret deployment defaults including tenantMode.
* apps/server/infra/containerapps/bicep/main.prod.bicepparam - Removed secret placeholders and retained non-secret deployment defaults including tenantMode.
* README.md - Aligned migration commands and added harness documentation reference.
* apps/server/README.md - Aligned migration guidance to node-pg-migrate scripts and current package commands.
* docs/cicd-harness.md - Added rollback command path, incident triage checklist, and non-prod load secret contract.

### Removed

* None

## Additional or Deviating Changes

* Workflow semantic lint with actionlint was skipped because actionlint was not installed in the execution environment.
	* Validation remained partially satisfied via prettier workflow formatting checks.
* Step 2.6 validation was initially blocked by missing local tooling and was later completed after tooling availability.
	* Completed checks: `docker build -f apps/server/docker/Dockerfile .`, `az bicep build --file apps/server/infra/containerapps/bicep/main.bicep` (validated via stdout compile), and `npm audit --audit-level=high`.
* Step 3.3 load test validation command failed in local environment due to missing non-prod runtime context.
	* `npm run -w @game/server test:load` executed but failed with endpoint/token defaults that were not configured for a reachable non-prod target.
* Step 4.1 full validation was completed after Azure tooling became available.
	* `npm run lint`, `npm run test`, `npm run build`, and Bicep compile checks have all been executed successfully.

## Release Summary

Implemented the CI/CD deployment harness across CI, release, verification, and operations workflows with deployment contract hardening and documentation alignment.

Total files affected: 14

* Added files (6): .github/workflows/ci.yml, .github/workflows/release-dev.yml, .github/workflows/release-prod.yml, .github/workflows/verify-release.yml, .github/workflows/nonprod-load.yml, docs/cicd-harness.md
* Modified files (8): README.md, apps/server/README.md, apps/server/docker/Dockerfile, apps/server/infra/containerapps/bicep/main.bicep, apps/server/infra/containerapps/bicep/main.dev.bicepparam, apps/server/infra/containerapps/bicep/main.prod.bicepparam, plus release workflow hardening and policy updates within the workflows listed above
* Removed files (0): none

Validation outcomes:

* Passed: `npm run lint`, `npm run test`, `npm run build`, workflow formatting checks.
* Deployment contract validation now completed for Docker and Bicep compile checks.
* Environment-context blocked: local `npm run -w @game/server test:load` without non-prod endpoint/token configuration.

Deployment notes:

* Release workflows deploy immutable SHA-tagged images.
* Runtime secrets are injected at deploy time and are no longer stored in bicepparam files.
* Post-deploy verification and scheduled non-prod load workflows are in place to close the seven-point harness loop.
