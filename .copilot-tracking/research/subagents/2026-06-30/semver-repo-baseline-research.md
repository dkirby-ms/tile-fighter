---
title: SemVer Repo Baseline Research
description: Repository baseline research for SemVer adoption in tile-fighter with evidence-backed findings and constraints.
author: GitHub Copilot (Researcher Subagent)
ms.date: 2026-06-30
ms.topic: reference
keywords:
  - semver
  - monorepo
  - release automation
  - npm workspaces
  - versioning
estimated_reading_time: 10
---

## Research Scope

Requested focus:

* Enumerate all `package.json` files and current `version` fields.
* Identify workspace setup (npm/pnpm/yarn workspaces, turbo/nx, etc).
* Inspect `.github` workflows and scripts for release/version/changelog/tag automation.
* Identify internal package dependencies and whether apps consume internal packages with fixed versions/workspace protocol.
* Note current git tag/release conventions observable from repo files/docs.
* Provide evidence with workspace-relative file paths and line numbers.
* Provide preliminary recommendation constraints for SemVer model choice.

## Findings

### 1) Package manifest inventory and versions

All discovered package manifests currently use `0.1.0`:

* Root workspace package:
  * `tile-fighter` at `0.1.0`.
  * Evidence: `package.json:2-3`.
* Apps:
  * `@game/client` at `0.1.0`.
  * Evidence: `apps/client/package.json:2-3`.
  * `@game/server` at `0.1.0`.
  * Evidence: `apps/server/package.json:2-3`.
  * `@game/tools` at `0.1.0`.
  * Evidence: `apps/tools/package.json:2-3`.
* Internal shared packages:
  * `@game/shared-auth` at `0.1.0`.
  * Evidence: `packages/shared-auth/package.json:2-3`.
  * `@game/shared-persistence` at `0.1.0`.
  * Evidence: `packages/shared-persistence/package.json:2-3`.
  * `@game/shared-types` at `0.1.0`.
  * Evidence: `packages/shared-types/package.json:2-3`.

Total manifests found: 7.

### 2) Workspace and monorepo tooling setup

The repository is configured as an npm workspaces monorepo:

* Package manager pinned to npm 10.9.0.
  * Evidence: `package.json:5`.
* Workspaces include `apps/*` and `packages/*`.
  * Evidence: `package.json:6-8`.
* Root scripts delegate to workspaces via npm native workspace flags.
  * Evidence: `package.json:11-14`.
* CI installs with workspace-aware command.
  * Evidence: `.github/workflows/ci.yml:42`.

No evidence of alternative monorepo orchestrators or release/version frameworks in repository files:

* No `turbo.json`, `nx.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `yarn.lock`, `.changeset/`, `lerna.json`, `release-please-config.json`, `.releaserc`, `CHANGELOG.md`.
  * Evidence: repo search returned none for these paths.

### 3) Release/version/changelog/tag automation in workflows

Current automation emphasizes deploy-by-SHA and verification, not SemVer package release automation:

* CI validates lint/test/build and audit, but does not perform version bumping or changelog/tag publication.
  * Evidence: `.github/workflows/ci.yml:1-75`.
* Dev and prod release workflows build and push container images tagged by `github.sha`.
  * Evidence: `.github/workflows/release-dev.yml:22,76`.
  * Evidence: `.github/workflows/release-prod.yml:19,73`.
* Verify workflow validates deployment health/auth/perf invariants; includes token claim check using a `ver` claim secret, but no package semver/tag publishing.
  * Evidence: `.github/workflows/verify-release.yml:54,109,119,143-144`.
* Scheduled non-prod load workflow executes load checks only.
  * Evidence: `.github/workflows/nonprod-load.yml:1-52`.

No workflow content indicates use of `changesets`, `semantic-release`, `release-please`, `lerna version`, `npm version`, or automated changelog generation.

### 4) Internal package dependency model

Internal dependencies are currently consumed by local file path protocol from `@game/server`:

* `@game/shared-auth`: `file:../../packages/shared-auth`
* `@game/shared-persistence`: `file:../../packages/shared-persistence`
* `@game/shared-types`: `file:../../packages/shared-types`
* Evidence: `apps/server/package.json:22-24`.

No `workspace:` protocol usage detected in app manifests.

Implication:

* Internal package version fields exist but are not currently used as semver constraints for local cross-package consumption in `@game/server`.

### 5) Observable git tag and release conventions

Repository-level tags:

* `git tag --list | wc -l` returned `0`.
* Evidence: terminal command output from repository root on 2026-06-30.

Docs and workflow conventions:

* Release process is documented as environment deploy pipelines and policy gates, not semver package publishing.
  * Evidence: `README.md:73-75`.
  * Evidence: `docs/cicd-harness.md:17-18`.
* Harness docs explicitly describe immutable image deployment by commit SHA.
  * Evidence: `docs/cicd-harness.md:106`.

No repository `CHANGELOG.md` found.

## Consolidated Evidence Table

| Topic | Evidence |
| --- | --- |
| Root package version and workspaces | `package.json:3,5-8` |
| Workspace script fanout | `package.json:11-14` |
| App package versions | `apps/client/package.json:3`, `apps/server/package.json:3`, `apps/tools/package.json:3` |
| Shared package versions | `packages/shared-auth/package.json:3`, `packages/shared-persistence/package.json:3`, `packages/shared-types/package.json:3` |
| Internal deps wiring | `apps/server/package.json:22-24` |
| CI workspace install | `.github/workflows/ci.yml:42` |
| SHA-tagged dev/prod image release | `.github/workflows/release-dev.yml:22,76`, `.github/workflows/release-prod.yml:19,73` |
| Verify workflow is runtime verification | `.github/workflows/verify-release.yml:1-220` |
| Release policy docs focus on deploy harness | `README.md:73-75`, `docs/cicd-harness.md:15-18` |
| Immutable SHA artifact convention | `docs/cicd-harness.md:106` |
| Existing git tag baseline | `git tag --list | wc -l` => `0` |

## Preliminary Recommendation Constraints for SemVer Model Choice

These constraints should shape any SemVer strategy decision:

1. Container deployment currently keys on immutable commit SHA, so package SemVer must complement (not replace) SHA-based deploy traceability.
2. Internal dependencies are `file:` links in `@game/server`; adopting per-package SemVer requires migrating internal dependency declarations (`workspace:` or explicit ranges) and deciding lockstep vs independent versioning.
3. All packages are `private: true`; if external publication is out of scope, SemVer should likely target internal API compatibility, release notes, and deploy governance rather than npm registry distribution.
4. No existing tags/changelog automation means the first SemVer model must include a bootstrap decision for tag namespace, changelog ownership, and backfill policy.
5. Existing release workflows are environment-centric (dev/prod + verify) and should remain stable; SemVer automation should be additive and avoid breaking current deployment gates.
6. Root workspace already centralizes lifecycle scripts, which favors monorepo-oriented tooling that can compute affected package versions and emit release metadata in CI.
7. Current uniform `0.1.0` baseline suggests no historical package-level release lineage; first stable scheme needs an explicit starting point policy (e.g., continue pre-1.0 or cut 1.0.0 at a milestone).
8. Verify workflow already checks token `ver` claim, so communication should avoid ambiguity between auth token versioning and package semantic versioning.

## Open Questions and Gaps

Questions that remain unresolved from repository evidence alone:

* Desired SemVer granularity: lockstep monorepo version vs independent package versions?
* Intended consumer scope for shared packages: internal-only or future external consumption?
* Required tag naming convention: global (`vX.Y.Z`) vs package-scoped (`@game/shared-types@X.Y.Z`)?
* Changelog topology: single root changelog, per-package changelogs, or both?
* Release trigger policy: manual, merge-to-main, or milestone-driven?
* Should apps (`@game/server`, `@game/client`, `@game/tools`) participate in SemVer, or only shared packages?

## Research Status

Status: Complete for requested repository baseline scope.
