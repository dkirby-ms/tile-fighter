<!-- markdownlint-disable-file -->
# Task Research: SemVer Adoption for tile-fighter

Research how to add Semantic Versioning (SemVer) to this monorepo, including package versioning, release process, CI/CD integration, and changelog/tag strategy.

## Task Implementation Requests

* Assess current versioning and release signals across the repository.
* Recommend one SemVer implementation approach for this monorepo.
* Provide actionable implementation details, examples, and pitfalls.

## Scope and Success Criteria

* Scope: Monorepo-level SemVer strategy for apps, packages, tags, releases, and CI workflows.
* Assumptions:
  * The repository uses npm workspaces (or equivalent monorepo package management).
  * Existing CI can be extended to automate release/version operations.
  * Current branch strategy continues to use PRs into main.
* Success Criteria:
  * A selected SemVer approach is documented with rationale.
  * Alternatives are evaluated with trade-offs.
  * Implementation-ready examples are included for this repo layout.

## Outline

1. Baseline current repository version/release state.
2. Identify SemVer models suitable for this monorepo.
3. Evaluate alternatives against repo constraints.
4. Select one approach and provide implementation plan.

## Potential Next Research

* Define whether shared packages remain internal-only or will be published externally.
  * Reasoning: Determines whether to enable npm publish in release automation.
  * Reference: packages/* ownership roadmap
* Decide app versioning scope and tag policy.
  * Reasoning: Determines whether apps receive SemVer tags/changelogs or remain deploy-by-SHA only.
  * Reference: apps/* release governance
* Define pre-1.0 breaking-change policy.
  * Reasoning: Avoids ambiguous bump behavior and inconsistent release notes.
  * Reference: SemVer policy doc + commit conventions

## Research Executed

### File Analysis

* package.json
  * npm workspace monorepo configured with workspaces apps/* and packages/*, package manager pinned to npm 10.9.0, workspace fanout scripts exist.
  * Evidence: package.json:3, package.json:5-8, package.json:11-14
* apps/client/package.json
  * App version is currently 0.1.0.
  * Evidence: apps/client/package.json:3
* apps/server/package.json
  * App version is currently 0.1.0; internal shared packages are referenced via file: protocol.
  * Evidence: apps/server/package.json:3, apps/server/package.json:22-24
* apps/tools/package.json
  * App version is currently 0.1.0.
  * Evidence: apps/tools/package.json:3
* packages/shared-auth/package.json
  * Shared package version is currently 0.1.0.
  * Evidence: packages/shared-auth/package.json:3
* packages/shared-persistence/package.json
  * Shared package version is currently 0.1.0.
  * Evidence: packages/shared-persistence/package.json:3
* packages/shared-types/package.json
  * Shared package version is currently 0.1.0.
  * Evidence: packages/shared-types/package.json:3
* .github/workflows/ci.yml
  * CI validates workspace install/build/test/lint but does not perform SemVer bump, changelog, or tag automation.
  * Evidence: .github/workflows/ci.yml:1-75
* .github/workflows/release-dev.yml
  * Dev release builds/pushes image tagged by commit SHA.
  * Evidence: .github/workflows/release-dev.yml:22, .github/workflows/release-dev.yml:76
* .github/workflows/release-prod.yml
  * Prod release builds/pushes image tagged by commit SHA.
  * Evidence: .github/workflows/release-prod.yml:19, .github/workflows/release-prod.yml:73
* .github/workflows/verify-release.yml
  * Release verification workflow validates runtime behavior and policy gates; no package SemVer automation.
  * Evidence: .github/workflows/verify-release.yml:1-220
* README.md
  * Release process documentation focuses on environment deployment and verification.
  * Evidence: README.md:73-75
* docs/cicd-harness.md
  * CI/CD harness documents immutable commit-SHA artifact identity and deployment checks.
  * Evidence: docs/cicd-harness.md:17-18, docs/cicd-harness.md:106-113

### Code Search Results

* Search for monorepo release/version tools and artifacts returned none:
  * .changeset/, CHANGELOG.md, release-please-config.json, .release-please-manifest.json, .releaserc, lerna.json, turbo.json, nx.json
* Git tag baseline:
  * Current repository has no git tags (observed during subagent investigation).

### External Research

* changesets/changesets
  * Finding: Designed for multi-package repos with first-class internal dependency/version/changelog handling.
  * Source: https://github.com/changesets/changesets
* changesets/action
  * Finding: Supports release-PR flow and publish-on-merge flow for monorepos.
  * Source: https://github.com/changesets/action
* Changesets config options
  * Finding: fixed, linked, updateInternalDependencies, privatePackages allow controlled monorepo strategy.
  * Source: https://github.com/changesets/changesets/blob/main/docs/config-file-options.md
* semantic-release
  * Finding: Strong CI-driven SemVer from commit history; monorepo setups typically require extra orchestration/plugins.
  * Source: https://github.com/semantic-release/semantic-release
* semantic-release GitHub Actions guidance
  * Finding: Recommends OIDC trusted publishing and strict CI release permissions.
  * Source: https://semantic-release.org/recipes/ci-configurations/github-actions/
* release-please
  * Finding: Manifest mode supports monorepos well through release PRs and path/package configuration.
  * Source: https://github.com/googleapis/release-please
* release-please manifest releaser
  * Finding: Supports node-workspace and linked-versions plugins for multi-package releases.
  * Source: https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md
* Conventional Commits 1.0.0
  * Finding: SemVer bump mapping is fix -> patch, feat -> minor, breaking -> major.
  * Source: https://www.conventionalcommits.org/en/v1.0.0/
* SemVer 2.0.0
  * Finding: 0.y.z allows instability and needs explicit team policy for breaking changes.
  * Source: https://semver.org/

### Project Conventions

* Standards referenced:
  * SemVer 2.0.0
  * Conventional Commits 1.0.0
  * GitHub Actions least-privilege and OIDC publishing guidance
* Instructions followed: Task Researcher mode research workflow

## Key Discoveries

### Project Structure

* Repository is an npm workspace monorepo with 7 package manifests (1 root, 3 apps, 3 shared packages).
* Every manifest is currently at version 0.1.0.
* Existing release workflows are deployment-focused and commit-SHA centric; package-version release automation is not implemented.

### Implementation Patterns

* Current deployment identity is immutable SHA tags for containers.
* Internal shared packages consumed by server currently use file: references rather than workspace protocol/ranged semver constraints.
* CI already has strong verification gates and can host additive SemVer automation without replacing deployment workflows.

### Complete Examples

{
  "name": "@game/server",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@game/shared-auth": "workspace:*",
    "@game/shared-persistence": "workspace:*",
    "@game/shared-types": "workspace:*"
  }
}

### API and Schema Documentation

* Changesets monorepo configuration and release flow:
  * https://github.com/changesets/changesets
  * https://github.com/changesets/action
* release-please manifest mode:
  * https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md
* semantic-release workflow and branch model:
  * https://semantic-release.org/foundation/workflow-configuration/
* Conventional Commits specification:
  * https://www.conventionalcommits.org/en/v1.0.0/
* SemVer specification:
  * https://semver.org/

### Configuration Examples

name: semver-release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - uses: changesets/action@v2
        with:
          version: npm run version-packages
          publish: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

## Technical Scenarios

### Scenario 1: SemVer Model for Monorepo Packages

Adopt SemVer for internal/shared package APIs and release notes, while preserving existing SHA-based deployment artifact identity.

**Requirements:**

* Keep existing dev/prod deploy workflows and verification gates unchanged.
* Add package-level SemVer and changelog generation in a way compatible with npm workspaces.
* Support private packages now with optional future publish enablement.
* Keep release behavior reviewable and auditable via PRs.
* Avoid lockstep version churn unless packages are intentionally coupled.

**Preferred Approach:**

* Use Changesets with independent versioning by default, plus selective linked/fixed groups only when needed.
* Keep apps private and optionally versioned for metadata; prioritize SemVer for shared packages under packages/*.
* Enforce Conventional Commits (or equivalent PR-title policy) to keep bump semantics predictable.

```text
.changeset/
  config.json
  README.md
.github/workflows/
  semver-release.yml
  ci.yml (add changeset presence check)
package.json (release scripts)
apps/server/package.json (file: -> workspace:* for internal deps)
```

**Implementation Details:**

1. Bootstrap Changesets and release scripts.
2. Migrate internal server deps from file: to workspace:* so dependency intent aligns with workspace SemVer flows.
3. Add CI guard on PRs to require changesets (with no-release escape hatch using empty changeset).
4. Add main-branch release workflow with changesets/action for release PR maintenance and optional publish.
5. Keep deploy workflows unchanged and continue SHA tagging for container immutability.
6. Define and document pre-1.0 policy (how breaking changes are expressed while versions are 0.y.z).

```bash
# bootstrap
npm install -D @changesets/cli
npx changeset init

# per change
npx changeset

# local version/changelog generation
npx changeset version

# release pipeline publish command (if/when enabled)
npx changeset publish
```

#### Considered Alternatives

* Alternative A: semantic-release monorepo orchestration.
  * Rejected for default: powerful publish-on-merge model, but monorepo behavior is less direct and typically requires additional plugin/orchestration complexity for this repo shape.
  * Evidence: semantic-release docs and monorepo wrapper ecosystem complexity.
* Alternative B: release-please manifest mode.
  * Not selected as default: strong option and viable second choice, especially for release-PR-first teams; however Changesets provides more direct package-graph-centric controls for npm workspace internals and private package flows in this specific repo.
  * Evidence: release-please manifest docs and plugin model.
* Alternative C: custom scripts using npm version + manual tags/changelog.
  * Rejected: highest maintenance burden and weakest auditability/consistency over time.

## Selected Approach

Selected approach: Changesets with independent versioning by default and optional linked/fixed groups for intentionally coupled packages.

Rationale:

* Aligns with current npm workspaces structure (apps + shared packages).
* Supports current private-package posture and future optional publication without tool replacement.
* Provides reviewable release metadata (changeset files and version PR flow), reducing accidental release drift.
* Integrates cleanly alongside existing SHA-based deployment identity rather than replacing it.

## Actionable Implementation Plan

1. Add Changesets to root devDependencies and initialize .changeset.
2. Update internal dependencies in apps/server/package.json to workspace:*.
3. Add root scripts:
  * version-packages: changeset version
  * release: changeset publish
  * changeset-status: changeset status --since=origin/main
4. Add PR CI step to run changeset-status and fail when release-impacting changes lack a changeset.
5. Add .github/workflows/semver-release.yml using changesets/action@v2 on pushes to main.
6. Decide policy defaults:
  * Pre-1.0 breaking-change interpretation.
  * Whether apps receive SemVer tags/changelog entries.
  * Tag naming convention (package-scoped recommended for independent versioning).
7. Document SemVer policy and developer workflow in README.md or docs/cicd-harness.md.

## Risks and Mitigations

* Risk: Missing breaking-change signals causes under-bumps.
  * Mitigation: enforce Conventional Commits/PR-title checks and reviewer checklist for API changes.
* Risk: Versioning confusion between package SemVer and deployment SHA tags.
  * Mitigation: document that SemVer tracks API/release notes while SHA tracks immutable deployment artifacts.
* Risk: Unnecessary churn from lockstep versioning.
  * Mitigation: use independent default, only add fixed/linked groups when justified.

## References

Primary report: .copilot-tracking/research/2026-06-30/semver-adoption-research.md
Subagent inputs:
* .copilot-tracking/research/subagents/2026-06-30/semver-repo-baseline-research.md
* .copilot-tracking/research/subagents/2026-06-30/semver-tooling-options-research.md
