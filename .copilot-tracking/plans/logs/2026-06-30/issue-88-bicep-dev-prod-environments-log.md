<!-- markdownlint-disable-file -->
# Planning Log: Issue 88 - Bicep Dev and Prod Environments

## Discrepancy Log

### Unaddressed Research Items

* DR-01: `ENTRA_TOKEN_VERSION`, `TELEMETRY_SINK_MODE`, `TELEMETRY_SINK_URL`, `TELEMETRY_SINK_NAME` listed in cicd-harness.md secret contract but not passed by workflows
  * Source: `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md` (Key Discoveries / Configuration Examples section)
  * Reason: These have runtime defaults in `env.ts` and are optional; they are not deployment blockers. Addressed in Phase 4 by removing them from the docs contract.
  * Impact: low (documentation drift only; no runtime failure caused by absence)

* DR-02: Scale and workload profile are hardcoded in `main.bicep` (CPU, memory, min/max replicas)
  * Source: `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md` (Potential Next Research section)
  * Reason: Issue scope is to complete the functional deployment contract, not to introduce per-environment scale differentiation. Parameterizing scale is follow-on work.
  * Impact: low (dev and prod run identical scale profiles; acceptable for current scope)

### Plan Deviations from Research

* DD-01: `main.dev.bicepparam` and `main.prod.bicepparam` require no changes
  * Research recommends: both files should be reviewed for environment differences
  * Plan implements: no changes to bicepparam files because they only hold non-secret defaults and no environment-specific secure values belong there
  * Rationale: Secure parameters are injected at workflow deploy time via `--parameters` overrides, not in param files; this is the existing pattern and is preserved

## Implementation Paths Considered

### Selected: Extend shared main.bicep with joinTokenSigningSecret parameter

* Approach: Add one `@secure()` parameter to `main.bicep`, add its secret entry and env injection, extend both workflows, and clean up docs.
* Rationale: Lowest-risk path. No template duplication. Follows existing pattern already established for the five other secure params (databaseUrlSecret, entraIssuerSecret, entraAudienceSecret, entraJwksUrlSecret, entraTenantIdSecret).
* Evidence: `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md` (Technical Scenarios / Single Shared Module section)

### IP-01: Split into main.dev.bicep and main.prod.bicep

* Approach: Create per-environment templates instead of using a shared template with params.
* Trade-offs: Full control per environment but high duplication; any shared change requires two files.
* Rejection rationale: Existing architecture already uses shared template + param files; split creates drift risk with no current benefit.

### IP-02: Generate Bicep parameters from env/dev.env and env/prod.env before deployment

* Approach: A pre-deploy script reads env files and produces `--parameters` overrides.
* Trade-offs: Centralizes environment config but adds tooling complexity and a new workflow step.
* Rejection rationale: No current workflow depends on env files; adding this dependency for one missing secret is over-engineered.

## Suggested Follow-On Work

* WI-01: Parameterize container resources and replica scale in main.bicep — Allow dev to run lower CPU/memory and fewer replicas than prod (medium priority)
  * Source: DR-02 above; research Potential Next Research section
  * Dependency: None; can be done independently after this issue lands

* WI-02: Add ENTRA_TOKEN_VERSION, TELEMETRY_SINK_MODE, TELEMETRY_SINK_URL, TELEMETRY_SINK_NAME as optional Bicep parameters — Inject these runtime-tuning values via Bicep env array so they can be environment-specific without rebuilding images (low priority)
  * Source: DR-01 above; env.ts optional fields
  * Dependency: This issue must land first to establish the pattern

* WI-03: Introduce Azure Key Vault-backed secret retrieval — Replace GitHub Environments secrets with Key Vault references for centralized secret governance (low priority)
  * Source: `docs/cicd-harness.md` Alternate model note in Secret Source of Truth section
  * Dependency: No code dependency; governance decision required first
