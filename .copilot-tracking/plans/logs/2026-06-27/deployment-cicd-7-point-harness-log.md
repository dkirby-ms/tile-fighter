<!-- markdownlint-disable-file -->
# Planning Log: Deployment CI/CD 7-Point Harness

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None currently.

### Plan Deviations from Research

* None currently.

### Implementation Deviations

* DD-01: Phase 2 validation command coverage was initially partial in this environment and later resolved.
  * Plan specifies: Execute Docker build and Azure Bicep compile checks in Step 2.6.
  * Implementation differs: Checks were initially deferred due to missing CLIs, then completed successfully after tooling became available.
  * Rationale: Local execution environment initially lacked `docker` and `az` binaries.
* DD-02: Phase 3 validation command coverage was partial in this environment.
  * Plan specifies: Validate workflow formatting and non-prod load invocation assumptions in Step 3.3.
  * Implementation differs: Formatting validation passed after Prettier fixes, while local `test:load` validation failed due to missing non-prod endpoint/token runtime context.
  * Rationale: Local runtime did not provide reachable non-prod websocket endpoint and bearer token inputs.
* DD-03: Phase 4 full validation command coverage was initially partial in this environment and later resolved.
  * Plan specifies: Run lint, test, build, and Bicep compile checks in Step 4.1.
  * Implementation differs: Bicep compile was initially deferred due to missing Azure CLI, then completed successfully after tooling became available.
  * Rationale: Local execution environment initially lacked the `az` binary.

## Implementation Paths Considered

### Selected: GitHub Actions Single-Platform Harness

* Approach: Implement all seven harness points via .github/workflows CI/release/verify/load workflows with environment protections and secure deploy overrides.
* Rationale: Fastest path to codified automation with current repository structure and no pre-existing pipeline definitions.
* Evidence: .copilot-tracking/research/subagents/2026-06-27/harness-gap-research.md (Lines 22-33)

### IP-01: Azure DevOps Pipeline-First Harness

* Approach: Implement equivalent stages in azure-pipelines.yml with environment checks and approvals.
* Trade-offs: Strong enterprise governance integration, but higher setup overhead and no existing repository baseline to build on.
* Rejection rationale: Slower implementation start for this repository and no discovered existing Azure pipeline artifacts.

### IP-02: Dual-Platform Harness (GitHub + Azure DevOps)

* Approach: Maintain mirrored CI/CD definitions in both GitHub Actions and Azure DevOps.
* Trade-offs: Redundancy and migration flexibility, but doubled maintenance cost and increased drift risk.
* Rejection rationale: Not justified for first implementation while baseline maturity is low.

## Suggested Follow-On Work

* WI-01: Introduce managed environment bootstrap IaC — Create dedicated IaC module/pipeline for Container Apps managed environments and dependency resources before app deploy. (high)
  * Source: .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md
  * Dependency: Completion of harness Phase 2 deploy contract updates.
* WI-02: Add image hardening and supply chain controls — Add digest pinning, SBOM generation, signing, and vulnerability policy gates to release workflows. (medium)
  * Source: .copilot-tracking/research/subagents/2026-06-27/deployment-infra-research.md
  * Dependency: Stable immutable image publishing in Phase 1.
* WI-03: Tighten non-server package test quality gates — Replace passWithNoTests with minimum test expectations where applicable. (medium)
  * Source: .copilot-tracking/research/subagents/2026-06-27/ci-baseline-research.md
  * Dependency: Baseline CI harness running reliably.
* WI-04: Evaluate Key Vault secret resolution model — Decide and implement secret retrieval pattern for deployment jobs. (high)
  * Source: .copilot-tracking/research/subagents/2026-06-27/harness-gap-research.md
  * Dependency: Security governance decision on secret source of truth.
* WI-05: Add workflow semantic lint installation path — Add actionlint into CI tooling to enforce workflow semantic validation in all environments. (medium)
  * Source: Phase 1, Step 1.3 implementation notes.
  * Dependency: Baseline CI workflows merged.
* WI-06: Add non-prod load validation bootstrap guidance — Provide a standard method to source `NONPROD_WS_ENDPOINT` and `NONPROD_LOAD_BEARER_TOKEN` for local/CI dry runs outside scheduled jobs. (medium)
  * Source: Phase 3, Step 3.3 implementation notes.
  * Dependency: Verification and non-prod workflows merged.
* WI-07: Add local validation prerequisites doc — Document required local tooling (`docker`, `az`, optional `actionlint`) for running full harness checks before PR submission. (low)
  * Source: Phase 2 and Phase 4 validation blockers.
  * Dependency: CI/CD harness documentation merged.