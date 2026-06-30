---
title: Changesets Guide
description: Repository-specific guidance for SemVer changeset authoring and release behavior in Tile Fighter.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: how-to
keywords:
  - changesets
  - semver
  - monorepo
estimated_reading_time: 4
---

## Changesets in This Repository

Use Changesets to track SemVer-impacting changes for packages in this monorepo.

## Scope

- `packages/*` is the primary SemVer version surface.
- `apps/*` remains private deployment units.
- Deployment image identity remains SHA-based in release workflows.

## Workflow

1. Add code changes.
2. Create a changeset when SemVer-relevant behavior changes:

```bash
npx changeset
```

3. Inspect pending release impact:

```bash
npm run changeset-status
```

4. Apply version and changelog updates locally when preparing release updates:

```bash
npm run version-packages
```

## No-Release Changes

When CI requires a changeset for release-impacting paths but your change should not publish a package version, add an empty changeset with a short rationale.

Example:

```md
---
---

No release: internal refactor only.
```

The empty frontmatter indicates no package bumps while still documenting reviewer intent.

## Pre-1.0 Policy Notes

- Versions are currently pre-1.0 (`0.y.z`).
- For breaking changes before `1.0.0`, increment minor and include migration notes in the changeset summary.

## SemVer and SHA Tags

SemVer tags are used for package change history. SHA deployment tags remain the immutable source of truth for deployed artifacts. Both are used together.