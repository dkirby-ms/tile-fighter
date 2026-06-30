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

* DR-03: Log Analytics retention is hardcoded at 30 days in `environment.bicep`; not parameterized
  * Source: `.copilot-tracking/research/subagents/2026-06-30/aca-environment-provisioning-research.md` (clarifying question 1)
  * Reason: GDD targets <$100/month which suggests short retention. A param can be added in follow-on work if environments diverge.
  * Impact: low

* DR-04: `provision-env-dev.yml` uses `workflow_dispatch` only (no paths trigger on infra changes)
  * Source: `.copilot-tracking/research/subagents/2026-06-30/aca-environment-provisioning-research.md` (clarifying question 4)
  * Reason: Automated provisioning on every `environment.bicep` change to `main` risks unintended environment mutations. Operator dispatch is the safer default for an initial implementation.
  * Impact: low (provisioning is a low-frequency operation)

* DR-05: Plan cross-reference line numbers for Phases 5–8 in the details file are approximately 65–70 lines too early due to a duplicate `## Implementation Phase 5` heading in the details file
  * Source: `.copilot-tracking/details/2026-06-30/issue-88-bicep-dev-prod-environments-details.md` — two sections both titled `## Implementation Phase 5` appear sequentially: the first is `Implementation Phase 5: Validation` (an intermediate checkpoint covering only phases 1–4, with steps 5.1–5.5), and the second is `Implementation Phase 5: Create environment.bicep and bicepparam files` (the phase the plan refers to). The extra section adds approximately 28 lines between Phase 4's tail and the real Phase 5 environment.bicep content, shifting Phases 5–8 content to approximately lines 296, 369, 393, 435, 510, and 600 respectively — not the 228, 291, 311, 333, 403, and 473 that the plan cites.
  * Reason: The details file was authored with an intermediate validation checkpoint that was given the same phase number as the subsequent environment-provisioning phase. The actual content is present and structurally correct; only the numeric cross-references in the plan are misleading.
  * Impact: medium — an implementer navigating to the cited line numbers lands in the wrong section of the details file (Phase 4 tail + intermediate validation, not environment.bicep creation). Content is still reachable by heading search. The intermediate validation steps (validate main.bicep only, before environment.bicep exists) are also not represented in the plan checklist.

* DR-06: Subagent research section 5 recommends updating the existing "Precheck managed environment" step description in `docs/cicd-harness.md` to note that the precheck is now a signal of completed provisioning rather than the only safeguard. Phase 8 Step 8.1 adds a new "Environment Provisioning" section but does not include an explicit task to revise the implied meaning of the existing precheck description.
  * Source: `.copilot-tracking/research/subagents/2026-06-30/aca-environment-provisioning-research.md` (Section 5, item 2)
  * Reason: The Phase 8 harness doc update focuses on adding a new section. Revising the existing description is a secondary editorial task with no functional impact.
  * Impact: low (documentation only; no runtime or deployment consequence)

### Plan Deviations from Research

* DD-01: `main.dev.bicepparam` and `main.prod.bicepparam` require no changes
  * Research recommends: both files should be reviewed for environment differences
  * Plan implements: no changes to bicepparam files because they only hold non-secret defaults and no environment-specific secure values belong there
  * Rationale: Secure parameters are injected at workflow deploy time via `--parameters` overrides, not in param files; this is the existing pattern and is preserved

## Implementation Paths Considered

### Selected: Extend shared main.bicep with joinTokenSigningSecret parameter, and add decoupled environment.bicep + provisioning workflows

* Approach: Add one `@secure()` parameter to `main.bicep`; add a separate `environment.bicep` for the managed environment and Log Analytics workspace; create `provision-env-dev.yml` and `provision-env-prod.yml` as `workflow_dispatch`-only workflows; extend both release workflows; clean up docs.
* Rationale: Keeps app deployment and environment lifecycle as independent concerns. No template duplication. Follows existing `main.bicep` pattern for the provisioning Bicep files.
* Evidence: `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md` (Technical Scenarios section); `.copilot-tracking/research/subagents/2026-06-30/aca-environment-provisioning-research.md` (Required resources and decoupling strategy)

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

* WI-04: Add `paths:` trigger to `provision-env-dev.yml` for automatic drift correction — Trigger dev environment provisioning when `environment.bicep` or `environment.dev.bicepparam` changes on `main` (low priority)
  * Source: DR-04 above; researcher clarifying question 4
  * Dependency: This issue must land first; evaluate operator comfort with automated provisioning before enabling

* WI-05: Parameterize Log Analytics retention in `environment.bicep` to allow dev/prod divergence — Allow prod to retain longer for incident investigation while dev stays at 30 days for cost control (low priority)
  * Source: DR-03 above
  * Dependency: None

## Design Decisions

* DD-02: `workloadProfiles` array is declared explicitly in `environment.bicep` with `{ name: 'Consumption', workloadProfileType: 'Consumption' }`
  * Why not implicit: omitting `workloadProfiles` creates a legacy Consumption-only environment where the profile is not visible as a named entity. Explicit declaration ensures the named `'Consumption'` profile required by `main.bicep` is always resolvable and forward-compatible if a dedicated profile is added later.
  * Trade-off: technically enables dedicated-profile capacity even though neither environment uses it today. Accepted as low risk given current cost controls.
