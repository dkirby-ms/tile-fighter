---
title: Colyseus Azure Scaffold Prompt Updates
description: Tracking log for monorepo-first optimization of the Colyseus Azure scaffold prompt with executable protocol and strong guardrails.
author: GitHub Copilot
ms.date: 2026-06-27
ms.topic: reference
---

## Status

Complete (monorepo-first optimization applied)

## Purpose and Expectations

* Optimize the existing scaffold prompt for monorepo-first layout while preserving stack scope.
* Keep Colyseus 0.17, TypeScript, PostgreSQL, Azure Container Apps, and Entra External ID OAuth requirements unchanged.
* Ensure execution remains concrete, runnable, and validation-driven from monorepo root.

## Related Files

* Target prompt: `/home/saitcho/tile-fighter/docs/colyseus-azure-scaffold.prompt.md`
* Tracking file: `/home/saitcho/tile-fighter/.copilot-tracking/prompts/2026-06-27/colyseus-azure-scaffold-updates.md`
* Research input: `/home/saitcho/tile-fighter/.copilot-tracking/research/2026-06-27/colyseus-azure-scaffold-research.md`
* Research input: `/home/saitcho/tile-fighter/.copilot-tracking/research/subagents/2026-06-27/colyseus-azure-scaffold-research.md`
* Standards: `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/prompt-builder.instructions.md`
* Standards: `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md`
* Standards: `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md`

## Issues Identified and Addressed

* Prompt structure was package-centric, not monorepo-centric for workspace orchestration.
* Inputs did not capture workspace mode, package names, package paths, or shared package toggles.
* Required steps did not explicitly enforce root-level command execution with workspace package targeting.
* Acceptance criteria lacked explicit workspace install/lockfile checks and cross-package TypeScript validation.

## Planned Modification Checklist

* [x] Preserve current stack scope and security posture.
* [x] Rework scaffold structure to monorepo conventions with `apps/server`, optional `apps/tools`, and `packages/*`.
* [x] Expand Inputs with workspace mode, package names/paths, and shared package toggles.
* [x] Update Required Steps to run commands from monorepo root and target server workspace scripts.
* [x] Update acceptance criteria for workspace install/lockfile, server package lint/test/build, and cross-package TypeScript checks.
* [x] Preserve markdown quality and frontmatter conventions.
* [x] Update this tracking file with implementation rationale and unresolved choices.

## Implemented Changes and Rationale

* Updated prompt `argument-hint` and Inputs to support monorepo-centric configuration:
	* `workspaceMode`, `serverPackageName`, `serverAppPath`, `toolsAppPath`, `includeToolsApp`.
	* `sharedPackagesPath`, shared package names, and per-package include toggles.
* Reworked Step 1 to require root workspace config/shared tooling plus package layout:
	* Root workspace configuration and lockfile.
	* `apps/server` for backend, optional `apps/tools`, optional `packages/*` shared packages.
* Updated Step 2 to require cross-package TypeScript references or path aliases when shared packages are enabled.
* Updated Step 3 and Step 5 paths so scripts and artifacts are package-aware under `apps/server`.
* Updated Step 6 quality gates to require monorepo-root execution and package-targeted commands for `npm`, `pnpm`, and `yarn`.
* Added acceptance checks for workspace install and lockfile, server workspace lint/test/build, and cross-package TypeScript resolution.
* Kept existing security/auth guardrails and tenant-mode requirements intact.
* Kept frontmatter metadata and markdown structure compliant with repository conventions.

## Remaining Issues and Questions

* Optional default choices remain product decisions, not prompt-quality blockers:
	* Keep `tenantMode=single` as the safer default posture.
	* Keep `includeRedis=false` for simpler bootstrap path.
	* Keep `includeDapr=false` as opt-in complexity.
* Open naming choice:
	* Resolved: switched shared package defaults to neutral `@game/*` scope.
* Open structure choice:
	* Resolved: `apps/tools` remains enabled by default.

## Drift and Gap Check

* No stack-scope drift identified.
* Monorepo structure, Inputs, Required Steps, and acceptance criteria updates were implemented as requested.
* Guardrails and security requirements remain strong and unchanged in intent.
* Prompt is ready for the next scaffold run.
