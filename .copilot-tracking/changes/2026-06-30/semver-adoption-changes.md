<!-- markdownlint-disable-file -->
# Release Changes: SemVer Adoption

**Related Plan**: .copilot-tracking/plans/2026-06-30/semver-adoption-plan.instructions.md
**Implementation Date**: 2026-06-30

## Summary

Implemented SemVer adoption end-to-end using Changesets release PR flow, CI guardrails, workspace dependency alignment, and documentation while preserving SHA-based deployment identity.

## Changes

### Added

* .changeset/config.json - Added Changesets configuration for independent workspace versioning and internal dependency update strategy.
* .changeset/README.md - Added repository-specific guidance for creating and managing changesets.
* .github/workflows/semver-release.yml - Added main-branch SemVer release PR workflow using changesets/action.

### Modified

* README.md - Added contributor SemVer workflow summary and policy pointers.
* docs/cicd-harness.md - Added SemVer policy section including package/app scope, pre-1.0 behavior, and tag strategy with SHA complementarity.
* package.json - Added Changesets scripts and @changesets/cli dev dependency.
* package-lock.json - Updated lockfile after adding Changesets dependency.
* apps/server/package.json - Changed internal shared package dependencies from file: to workspace:*.
* .github/workflows/ci.yml - Added PR title SemVer intent validation and release-impacting changeset requirement guard.

### Removed

* None.

## Additional or Deviating Changes

* Non-blocking advisory output during dependency install did not affect validation.
	* npm reported existing vulnerabilities and allow-scripts warnings for transitive packages; no scope change required for Phase 1.
* Phase 4 validation completed without requiring additional bug-fix commits.
	* Full lint, build, and test suites passed across all workspaces.

## Release Summary

Total files affected: 10 (added: 3, modified: 7, removed: 0).

Files added:
* .changeset/config.json - Changesets independent versioning configuration.
* .changeset/README.md - Changeset authoring and no-release guidance.
* .github/workflows/semver-release.yml - Release PR automation on pushes to main.

Files modified:
* package.json - SemVer tooling scripts and @changesets/cli dependency.
* package-lock.json - Lockfile updates from tooling bootstrap.
* apps/server/package.json - Workspace protocol internal dependency alignment.
* .github/workflows/ci.yml - PR title + changeset guardrails for SemVer intent and coverage.
* README.md - Contributor SemVer workflow and PR title policy documentation.
* docs/cicd-harness.md - Operational SemVer policy, tag interpretation, and rollback runbook.
* .copilot-tracking/plans/2026-06-30/semver-adoption-plan.instructions.md - Completed checklist tracking.

Validation status:
* Phase 1: `npm run lint`, `npm run build` passed.
* Phase 2: `npm run -w @game/server build`, `npm run lint` passed.
* Phase 3: `npm run lint`, `npm run test` passed.
* Phase 4: `npm run lint`, `npm run build`, `npm run test` passed.

Deployment impact:
* Existing `.github/workflows/release-dev.yml` and `.github/workflows/release-prod.yml` remain unchanged and continue SHA-tagged image deployment.
* SemVer tags now complement SHA artifact identity through release PR lifecycle, without replacing deployment SHA traceability.
