---
applyTo: '.copilot-tracking/changes/2026-06-30/semver-adoption-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: SemVer Adoption

## Overview

Adopt SemVer for tile-fighter monorepo packages through Changesets-driven release PRs while preserving existing SHA-based deployment artifact identity.

## Objectives

### User Requirements

* Assess current versioning and release signals across the repository and incorporate findings into an implementation path — Source: .copilot-tracking/research/2026-06-30/semver-adoption-research.md
* Recommend one SemVer approach for this monorepo with alternatives and trade-offs — Source: .copilot-tracking/research/2026-06-30/semver-adoption-research.md
* Provide actionable implementation details for package versioning, release process, CI integration, and tag/changelog strategy — Source: user request and research scope

### Derived Objectives

* Keep deployment workflows based on immutable SHA image tags unchanged while layering package SemVer on top — Derived from: docs/cicd-harness.md and research findings
* Align internal package references to workspace protocol for compatibility with monorepo release tooling — Derived from: apps/server/package.json and selected Changesets approach
* Introduce reviewable release metadata through changeset files and release PR flow — Derived from: selected Changesets implementation path

## Context Summary

### Project Files

* package.json - Root workspaces and scripts for release tooling integration
* apps/server/package.json - Internal shared package dependency protocol alignment target
* .github/workflows/ci.yml - CI validation workflow extension point for changeset enforcement
* .github/workflows/release-dev.yml - Existing SHA-tagged dev deploy workflow to preserve
* .github/workflows/release-prod.yml - Existing SHA-tagged prod deploy workflow to preserve
* docs/cicd-harness.md - Release/deployment policy documentation target
* README.md - Contributor workflow and SemVer usage documentation target

### References

* .copilot-tracking/research/2026-06-30/semver-adoption-research.md - Primary SemVer research, alternatives, and selected approach
* /memories/repo/ci-notes.md - CI validation and planning traceability conventions

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown authoring requirements for .md planning files
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Writing style requirements for markdown planning content

## Implementation Checklist

### [x] Implementation Phase 1: SemVer Policy and Tooling Bootstrap

<!-- parallelizable: false -->

* [x] Step 1.1: Define SemVer policy for package scope, app scope, pre-1.0 behavior, and tag strategy
  * Details: .copilot-tracking/details/2026-06-30/semver-adoption-details.md (Lines 12-28)
* [x] Step 1.2: Install and configure Changesets for independent workspace versioning
  * Details: .copilot-tracking/details/2026-06-30/semver-adoption-details.md (Lines 31-52)
* [x] Step 1.3: Validate phase changes
  * Run lint and build commands for modified files
  * Skip if validation conflicts with parallel phases

### [x] Implementation Phase 2: Workspace Dependency and CI Guardrails

<!-- parallelizable: false -->

* [x] Step 2.1: Update internal dependency protocol from file: to workspace:*
  * Details: .copilot-tracking/details/2026-06-30/semver-adoption-details.md (Lines 66-81)
* [x] Step 2.2: Add CI checks enforcing changeset presence for release-impacting changes
  * Details: .copilot-tracking/details/2026-06-30/semver-adoption-details.md (Lines 83-103)
* [x] Step 2.3: Add commit/PR-title policy enforcement aligned with SemVer bump intent
  * Details: .copilot-tracking/details/2026-06-30/semver-adoption-details.md (Lines 105-118)
* [x] Step 2.4: Validate phase changes
  * Run lint and targeted server build commands

### [x] Implementation Phase 3: Release Workflow and Documentation

<!-- parallelizable: false -->

* [x] Step 3.1: Add SemVer release workflow using changesets/action on main
  * Details: .copilot-tracking/details/2026-06-30/semver-adoption-details.md (Lines 124-145)
* [x] Step 3.2: Document release PR lifecycle, tag interpretation, and rollback path
  * Details: .copilot-tracking/details/2026-06-30/semver-adoption-details.md (Lines 147-163)
* [x] Step 3.3: Validate phase changes
  * Run lint and test commands for workflow/documentation updates

### [x] Implementation Phase 4: Validation

<!-- parallelizable: false -->

* [x] Step 4.1: Run full project validation
  * Execute all lint commands (npm run lint, language linters)
  * Execute build scripts for all modified components
  * Run test suites covering modified code
* [x] Step 4.2: Fix minor validation issues
  * Iterate on lint errors and build warnings
  * Apply fixes directly when corrections are straightforward
* [x] Step 4.3: Report blocking issues
  * Document issues requiring additional research
  * Provide user with next steps and recommended planning
  * Avoid large-scale fixes within this phase

## Planning Log

See .copilot-tracking/plans/logs/2026-06-30/semver-adoption-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* npm workspace tooling remains the repository package manager standard
* GitHub Actions repository permissions allow workflow updates and tag creation
* Maintainer decisions for app versioning policy and pre-1.0 break treatment

## Success Criteria

* Changesets is configured and scripts are available for version/changelog operations — Traces to: semver-adoption-research selected approach
* CI enforces release metadata presence for SemVer-impacting changes — Traces to: semver-adoption-research risk mitigations
* Release workflow generates reviewable release PRs and SemVer tags without replacing SHA deployment identity — Traces to: semver-adoption-research selected approach
* Team documentation clearly defines versioning policy, release flow, and rollback guidance — Traces to: user request for actionable adoption plan