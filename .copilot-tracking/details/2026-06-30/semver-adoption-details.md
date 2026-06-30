<!-- markdownlint-disable-file -->
# Implementation Details: SemVer Adoption

## Context Reference

Sources: .copilot-tracking/research/2026-06-30/semver-adoption-research.md; package.json; apps/server/package.json; .github/workflows/ci.yml; .github/workflows/release-dev.yml; .github/workflows/release-prod.yml; docs/cicd-harness.md; /memories/repo/ci-notes.md

## Implementation Phase 1: SemVer Policy and Changesets Bootstrap

<!-- parallelizable: false -->

### Step 1.1: Create SemVer policy for packages, apps, and tags

Create a policy document section describing version ownership and release boundaries. Specify that shared packages under packages/* are the primary SemVer surface, apps remain private deployment units, and container image identity remains commit SHA based.

Files:
* docs/cicd-harness.md - Add SemVer policy section, pre-1.0 break guidance, and tag strategy
* README.md - Add contributor workflow summary and pointer to SemVer policy section

Success criteria:
* Policy defines bump semantics for fix, feat, and breaking changes
* Policy resolves whether app version bumps are required or metadata only
* Policy states SemVer and SHA tagging are complementary, not conflicting

Context references:
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 171-259) - Selected approach and policy decisions

Dependencies:
* None

### Step 1.2: Bootstrap Changesets configuration for independent monorepo versioning

Install and initialize Changesets, then configure independent package versioning defaults and changelog behavior. Keep private package handling compatible with current internal-only distribution while preserving future publish enablement.

Files:
* package.json - Add devDependency @changesets/cli and scripts version-packages, release, changeset-status
* .changeset/config.json - Configure independent versioning defaults and internal dependency update strategy
* .changeset/README.md - Generated guidance with repository-specific notes

Discrepancy references:
* None

Success criteria:
* Running npx changeset version updates package versions and changelogs locally
* Configuration explicitly captures independent versioning posture
* Scripts are available at root for CI usage

Context references:
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 134-170) - Recommended Changesets model and configuration

Dependencies:
* Step 1.1 completion

### Step 1.3: Validate phase changes

Run lint and build commands to ensure bootstrap and documentation changes do not regress project checks.

Validation commands:
* npm run lint - Repository lint scope
* npm run build - Repository build scope

## Implementation Phase 2: Workspace Dependency and CI Guardrails

<!-- parallelizable: true -->

### Step 2.1: Align internal dependency declarations with workspace protocol

Replace file protocol internal dependencies with workspace protocol to align dependency intent with monorepo SemVer operations and reduce drift between package graph and release tooling.

Files:
* apps/server/package.json - Replace @game/shared-* file dependencies with workspace:* dependencies

Success criteria:
* Server workspace installs and builds successfully with workspace:* dependency declarations
* Internal dependency graph is compatible with Changesets internal update handling

Context references:
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 123-133) - Workspace protocol example and rationale

Dependencies:
* Implementation Phase 1 completion

### Step 2.2: Add CI enforcement for missing changesets on release-impacting changes

Extend the existing CI workflow to fail pull requests that modify release-impacting paths without a matching changeset, while allowing explicit no-release changes through empty changesets.

Files:
* .github/workflows/ci.yml - Add changeset-status or equivalent guard step for PR validation
* .changeset/README.md - Document no-release and empty changeset workflow

Discrepancy references:
* Addresses DR-03 from .copilot-tracking/plans/logs/2026-06-30/semver-adoption-log.md

Success criteria:
* PRs changing packages/* or SemVer-scoped app surfaces fail without a changeset entry
* Documented escape hatch exists for non-release changes

Context references:
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 260-282) - CI guardrail recommendations and risks
* /memories/repo/ci-notes.md (Lines 1-13) - Existing CI conventions and known pitfalls

Dependencies:
* Step 2.1 completion

### Step 2.3: Enforce Conventional Commits or PR-title policy in CI

Add one enforcement mechanism so SemVer intent remains predictable: commitlint for commit messages, PR-title linting with Conventional Commits pattern, or both according to branch workflow constraints.

Files:
* .github/workflows/ci.yml - Add commit or PR-title validation step with clear failure messaging
* package.json - Add lint script for commit/PR-title validation if tooling is script-driven
* README.md - Document acceptable commit or PR-title format for contributors

Discrepancy references:
* Addresses DR-01 from .copilot-tracking/plans/logs/2026-06-30/semver-adoption-log.md

Success criteria:
* CI fails when commit/PR title format does not meet defined SemVer-friendly convention
* Team workflow documents acceptable patterns for fix, feat, and breaking change signaling

Context references:
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 219-221, 298-300) - Recommendation for predictable bump semantics

Dependencies:
* Step 2.2 completion

### Step 2.4: Validate phase changes

Run targeted validation for CI and workspace dependency updates.

Validation commands:
* npm run -w @game/server build - Server build scope
* npm run lint - Repository lint scope including workflow validation if configured

## Implementation Phase 3: Automated Release Workflow and Tag Strategy

<!-- parallelizable: false -->

### Step 3.1: Add SemVer release workflow on main using Changesets action

Create a dedicated release workflow that runs on push to main, maintains release PRs for pending changesets, and supports optional publish behavior when publication is enabled.

Files:
* .github/workflows/semver-release.yml - New release workflow with minimal required permissions and changesets/action integration
* package.json - Ensure release scripts used by workflow are stable

Discrepancy references:
* Addresses DR-02 by implementing release-PR-first workflow while leaving external publish enablement as a follow-on decision

Success criteria:
* Workflow opens or updates a release PR from accumulated changesets
* Merge of release PR generates version bumps, changelog updates, and git tags according to policy
* Existing release-dev and release-prod workflows remain unchanged for SHA-based container deployment

Context references:
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 182-205) - Release workflow example and permissions
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 111-122) - Existing SHA deployment identity constraints

Dependencies:
* Implementation Phase 2 completion

### Step 3.2: Document release execution path and rollback procedure

Document who triggers release, how release PRs are reviewed, how tags are interpreted, and how to recover from an incorrect release PR or bump.

Files:
* README.md - Add maintainer and contributor SemVer release workflow summary
* docs/cicd-harness.md - Add operational release runbook and rollback notes

Success criteria:
* Documentation covers release PR lifecycle from merge to tag output
* Rollback path is explicit for mistaken changesets or version bumps

Context references:
* .copilot-tracking/research/2026-06-30/semver-adoption-research.md (Lines 234-259) - Risk mitigations and process clarity

Dependencies:
* Step 3.1 completion

### Step 3.3: Validate phase changes

Run targeted validation against release and documentation updates.

Validation commands:
* npm run lint - Repository lint scope
* npm run test - Workspace test scope to ensure no regressions from release setup changes

## Implementation Phase 4: Validation

<!-- parallelizable: false -->

### Step 4.1: Run full project validation

Execute all validation commands for the project:
* npm run lint
* npm run build
* npm run test

### Step 4.2: Fix minor validation issues

Iterate on lint errors, build warnings, and test failures. Apply fixes directly when corrections are straightforward and isolated.

### Step 4.3: Report blocking issues

When validation failures require changes beyond minor fixes:
* Document the issues and affected files.
* Provide the user with next steps.
* Recommend additional research and planning rather than inline fixes.
* Avoid large-scale refactoring within this phase.

## Dependencies

* GitHub Actions permissions for release workflow updates and tag creation
* Main-branch protection continues to require CI checks before merge
* Team agreement on pre-1.0 breaking change interpretation

## Success Criteria

* Changesets workflow is configured and operational in the monorepo
* CI enforces changeset presence for release-impacting changes
* SemVer release workflow coexists with existing SHA-based deployment workflows
* Team-facing documentation explains release policy, process, and rollback