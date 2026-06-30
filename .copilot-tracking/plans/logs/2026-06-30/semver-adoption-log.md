<!-- markdownlint-disable-file -->
# Planning Log: SemVer Adoption

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None currently identified.

### Plan Deviations from Research

* None currently identified.

## Implementation Paths Considered

### Selected: Changesets Independent Versioning with Release PR Workflow

* Approach: Use Changesets for package-level SemVer, changelog generation, and release PR maintenance; preserve SHA tags for deployment artifacts.
* Rationale: Best fit for npm workspace monorepo with internal packages and private-app posture.
* Evidence: .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 171-205)

### IP-01: release-please Manifest Mode

* Approach: Use release-please manifest and node-workspace plugins for monorepo release PRs.
* Trade-offs: Strong release PR ergonomics, but package-graph controls and workspace-internal dependency semantics are less direct for current repo needs.
* Rejection rationale: Viable alternative, but Changesets provides simpler package-centric control for this monorepo shape.

### IP-02: semantic-release with monorepo orchestration

* Approach: Use commit-driven publish-on-merge via semantic-release and monorepo orchestration plugins.
* Trade-offs: Highly automated but more complex branch/plugin orchestration and harder to audit for initial adoption.
* Rejection rationale: Higher rollout complexity than required for first SemVer implementation.

## Suggested Follow-On Work

* WI-01: Enable external package publication path — Add npm trusted publishing/OIDC and package access policies for selected shared packages (Medium)
  * Source: .copilot-tracking/research/2026-06-30/semver-adoption-research.md
  * Dependency: Stable release-PR workflow and maintainer approval process
* WI-02: Conventional Commits enforcement — Add PR title or commit lint enforcement to improve bump predictability (Medium)
  * Source: .copilot-tracking/research/2026-06-30/semver-adoption-research.md
  * Dependency: SemVer policy documentation merged
* WI-03: Release telemetry and dashboarding — Add reporting for release cadence, bump types, and changeset compliance rates (Low)
  * Source: .copilot-tracking/research/2026-06-30/semver-adoption-research.md
  * Dependency: Two or more release cycles completed