---
title: SemVer Tooling Options Research
description: Research on SemVer adoption best practices for a TypeScript monorepo with apps and shared packages
ms.date: 2026-06-30
ms.topic: reference
---

## Research Scope

* Changesets approach for monorepos
* semantic-release in monorepos
* release-please for node monorepos
* Fixed vs independent versioning strategies and fit criteria
* Conventional Commits interactions with SemVer bump logic
* Practical CI implementation patterns for GitHub Actions
* Risks and pitfalls: pre-1.0 behavior, breaking change signaling, lockstep versioning

## Evidence Log

* Changesets overview and monorepo focus
	* Source: <https://github.com/changesets/changesets>
	* Finding: Changesets is explicitly designed for multi-package repos and handles internal dependency/version/changelog updates from declared change intents.
* Changesets CI integration guidance
	* Source: <https://github.com/changesets/changesets>
	* Finding: Official guidance recommends CI integration plus the Changesets GitHub Action and optional bot.
* Changesets action behavior (version PR + optional publish)
	* Source: <https://github.com/changesets/action>
	* Finding: `changesets/action@v2` creates/updates a version PR and can publish when merged to base branch; supports `publish`, `version`, outputs for publish status.
* Changesets config options for monorepos
	* Source: <https://github.com/changesets/changesets/blob/main/docs/config-file-options.md>
	* Finding: Monorepo-relevant controls include `fixed`, `linked`, `ignore`, `updateInternalDependencies`, `bumpVersionsWithWorkspaceProtocolOnly`, and `privatePackages` behavior.
* Fixed packages semantics
	* Source: <https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md>
	* Finding: All packages in a fixed group are version-bumped/published together, even if some had no direct code change.
* Linked packages semantics
	* Source: <https://github.com/changesets/changesets/blob/main/docs/linked-packages.md>
	* Finding: Linked packages share version progression only when changed (or bumped as dependents); unlike fixed, not all are always published.
* Changesets app/private package versioning
	* Source: <https://github.com/changesets/changesets/blob/main/docs/versioning-apps.md>
	* Finding: Changesets can version private apps/non-npm artifacts via package.json metadata; `privatePackages` configuration controls private package version/tag behavior.
* Changesets prerelease mode caveats
	* Source: <https://github.com/changesets/changesets/blob/main/docs/prereleases.md>
	* Finding: Official docs warn prereleases are complex and recommend running prerelease from non-default branches to avoid blocking mainline.
* Changesets snapshot release behavior
	* Source: <https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md>
	* Finding: Snapshot versions use synthetic `0.0.0-*` versions and should be published under non-`latest` tags; generated snapshot version commits are generally not merged into main.
* Changesets PR enforcement patterns
	* Source: <https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md>
	* Finding: Two documented modes: non-blocking reminder (bot) and blocking CI (`changeset status --since=main`), with `changeset --empty` for no-release changes.
* semantic-release core model
	* Source: <https://github.com/semantic-release/semantic-release>
	* Finding: semantic-release determines next version from commit messages, creates tags/releases, and runs on CI after successful builds.
* semantic-release release workflow/branch model
	* Source: <https://semantic-release.org/foundation/workflow-configuration/>
	* Finding: Supports release, maintenance, and prerelease branch types with strict version conflict protections (`EINVALIDNEXTVERSION` etc.).
* semantic-release commit-to-bump defaults and customization
	* Source: <https://semantic-release.org/support/faq>
	* Finding: Defaults map breaking->major, `feat`->minor, `fix`/`perf`->patch; behavior is customizable via commit-analyzer release rules.
* semantic-release and pre-1.0 behavior
	* Source: <https://semantic-release.org/support/faq>
	* Finding: semantic-release does not support initializing at `0.0.1`; recommends prereleases when unstable, and generally encourages starting at `1.0.0`.
* semantic-release on GitHub Actions security patterns
	* Source: <https://semantic-release.org/recipes/ci-configurations/github-actions/>
	* Finding: Current guidance prefers npm trusted publishing (OIDC) with `id-token: write`, warns against `setup-node` `registry-url` conflicts, and provides release readiness checklist.
* semantic-release monorepo add-on status
	* Source: <https://github.com/qiwi/multi-semantic-release>
	* Finding: Popular wrapper exists but self-describes as a "proof of concept" and indicates gradual migration to another tool; this increases adoption risk for new setups.
* release-please core model
	* Source: <https://github.com/googleapis/release-please>
	* Finding: Generates release PRs from Conventional Commits, updates changelogs/version files, then tags/creates GitHub releases after merge.
* release-please monorepo manifest model
	* Source: <https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md>
	* Finding: Monorepos are configured via `release-please-config.json` + `.release-please-manifest.json`; supports package-level configuration and plugins including `node-workspace` and `linked-versions`.
* release-please GitHub Action requirements
	* Source: <https://github.com/googleapis/release-please-action>
	* Finding: Action expects workflow permissions (`contents`, `issues`, `pull-requests` write), supports manifest mode by default, and outputs release/path-level metadata for follow-up publish jobs.
* release-please commit conventions and releasable units
	* Source: <https://github.com/googleapis/release-please>
	* Finding: Conventional Commits are expected; key releasable prefixes include `feat` and `fix` (and `deps` for many strategies).
* Conventional Commits SemVer mapping
	* Source: <https://www.conventionalcommits.org/en/v1.0.0/>
	* Finding: `fix` maps to patch, `feat` to minor, and `BREAKING CHANGE`/`!` to major; other types are allowed but have no implicit SemVer effect unless configured by tooling.
* SemVer 2.0.0 baseline behavior
	* Source: <https://semver.org/>
	* Finding: MAJOR for incompatible API changes, MINOR for backward-compatible additions, PATCH for backward-compatible fixes; `0.y.z` is unstable and can change at any time.
* GitHub Actions npm publish reference
	* Source: <https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages>
	* Finding: For npm provenance, include `id-token: write` and publish with `--provenance`; npm/GitHub auth should flow via scoped permissions and secrets/OIDC.

## Findings

* Changesets is currently the strongest fit for TypeScript monorepos that mix apps and shared packages.
	* It natively models monorepo dependency graphs and gives explicit controls for fixed/linked behavior and private package handling.
	* It separates release intent capture (changeset files in PRs) from release execution, which is easier for teams that want transparent reviewable release metadata.
* semantic-release is excellent for fully automated release-on-merge workflows, but monorepo ergonomics often require extra tooling or custom orchestration.
	* semantic-release itself is commit-history driven and optimized for one release stream per project config.
	* Monorepo wrappers/plugins are possible, but the commonly referenced `multi-semantic-release` project has maintenance-risk signals for greenfield adoption.
* release-please is a strong alternative when teams prefer release PRs over direct publish-on-main.
	* Manifest mode is mature, supports Node workspace plugins, and is explicit for multi-package repositories.
	* It handles changelog/version PRs and GitHub release tagging, but package registry publication is a separate CI concern.
* Fixed vs independent strategy guidance:
	* Use independent-by-default for shared packages with distinct APIs/lifecycles.
	* Use fixed/linked groups only where consumers require lockstep compatibility or where operational simplicity outweighs extra version churn.
	* Overusing fixed groups causes unnecessary bump noise and can increase downstream upgrade burden.
* Conventional Commits should be treated as release protocol, not only commit style.
	* Without strict commit hygiene (or a PR-title enforcement policy), semantic bump calculation quality degrades.
	* Teams should explicitly define how `chore`, `refactor`, `perf`, `deps`, and revert commits map to release behavior in their chosen tool.
* Practical GitHub Actions pattern that scales:
	* Separate verify and release jobs.
	* Use minimal scoped permissions.
	* Prefer OIDC trusted publishing to avoid long-lived npm tokens.
	* Ensure full git history/tags are available for version computation.
* Key pitfalls:
	* Pre-1.0 ambiguity: SemVer allows wide change in `0.y.z`; consumers still experience breakage unless your policy defines practical interpretation.
	* Breaking-change signaling failures: missing `!` or `BREAKING CHANGE` footer leads to under-bumped versions.
	* Lockstep strategy misuse: fixed groups can force unnecessary major/minor upgrades across unrelated packages.
	* Release branch complexity: prerelease/maintenance channels are powerful but can easily produce version/channel confusion without clear branch policy.

## Recommended Default For This Repo Profile

Recommended default: Changesets with independent versioning, plus selective linked/fixed groups only when compatibility constraints demand it.

Why this fits this repo:

* The current workspace is an npm workspaces TypeScript monorepo with multiple private packages and apps (`apps/*`, `packages/*`) and file-linked internal deps in server.
* Changesets provides first-class monorepo controls for exactly this layout while supporting private package versioning and optional tagging policy.
* The release-PR model from `changesets/action` keeps release deltas reviewable and reduces accidental direct-release risk while the project is still pre-1.0.
* It is easier to phase from all-private to selectively published shared packages later without replacing the release system.

Suggested baseline policy:

* Versioning strategy
	* Default independent versioning for shared packages.
	* Keep apps private; decide whether app version tags are needed (`privatePackages.tag`).
	* Introduce fixed/linked groups only for intentionally coupled package sets.
* Commit and bump policy
	* Adopt Conventional Commits enforcement (commitlint or PR-title enforcement).
	* Require explicit `BREAKING CHANGE` footer or `!` marker for API breaks.
* CI policy (GitHub Actions)
	* PR: run tests/lint and verify changeset presence (`changeset status --since=main`) with a documented `--empty` escape hatch.
	* Main: run `changesets/action` to maintain version PR and optionally publish.
	* Publish: prefer npm trusted publishing (OIDC) and provenance where applicable.
* Pre-1.0 policy
	* Decide and document whether breaking changes under `0.y.z` map to minor or major in your project policy, then keep tooling/docs aligned.

When to choose release-please instead:

* If the team strongly prefers manifest-driven release PRs with path-centric configuration and explicit plugin control in a single config schema.

When to choose semantic-release instead:

* If the team wants immediate publish-on-merge with strict commit semantics and can absorb monorepo orchestration complexity.

## Open Questions

* Will any `packages/*` become publicly published to npm in the next 1-2 quarters, or remain private/internal?
* Should apps in `apps/*` receive formal SemVer tags/releases, or only server deploy artifacts?
* For pre-1.0, what is the team policy for breaking changes: treat as minor (common in early stage) or still signal as major semantics?
* Is the preferred release UX release-PR-first (Changesets/release-please) or direct publish on merge (semantic-release)?
* Do you want lockstep compatibility guarantees among any subset of shared packages (candidate fixed/linked groups)?
* Do you require changelog files committed in-repo, GitHub Releases only, or both?
