<!-- markdownlint-disable-file -->
# Review: SemVer Adoption

**Date**: 2026-06-30
**Related Plan**: .copilot-tracking/plans/2026-06-30/semver-adoption-plan.instructions.md
**Changes Log**: .copilot-tracking/changes/2026-06-30/semver-adoption-changes.md
**Research**: .copilot-tracking/research/2026-06-30/semver-adoption-research.md
**Branch**: `semver` (not yet merged to `main`)

---

## Overall Status

⚠️ **Needs Rework** — Implementation is functionally sound and all phases complete, but one minor logic issue exists in the CI changeset guard and the implementation is uncommitted. One deprecation question requires explicit documentation.

| Metric                  | Count |
|-------------------------|-------|
| Critical Findings       | 0     |
| Major Findings          | 0     |
| Minor Findings          | 2     |
| Follow-Up Items         | 1     |

---

## Validation Commands

| Command         | Status | Notes                            |
|-----------------|--------|----------------------------------|
| `npm run lint`  | ✅ Pass | All workspaces clean             |
| `npm run build` | ✅ Pass | All workspaces compiled          |
| `npm run test`  | Not run | Tests require live PostgreSQL; prior Phase 4 run passed per changes log |

---

## RPI Validation by Phase

### Phase 1: SemVer Policy and Tooling Bootstrap ✅

| Step  | Item                                        | Status   | Evidence                                              |
|-------|---------------------------------------------|----------|-------------------------------------------------------|
| 1.1   | SemVer policy defined                       | ✅ Done  | `docs/cicd-harness.md` SemVer Policy section present  |
| 1.2   | Changesets configured for independent versioning | ✅ Done | `.changeset/config.json` uses `"fixed": []`, `"linked": []`; `updateInternalDependencies: "patch"` |
| 1.2   | Scripts added to root `package.json`        | ✅ Done  | `version-packages`, `release`, `changeset-status` scripts present |
| 1.3   | Phase validation                            | ✅ Pass  | Lint and build both pass                              |

Notes:
- `access: "restricted"` in `.changeset/config.json` correctly reflects that all packages are private; no accidental public publish risk.
- `@changesets/cli@^2.29.6` installed as devDependency in root `package.json`.

---

### Phase 2: Workspace Dependency and CI Guardrails ⚠️

| Step  | Item                                          | Status      | Evidence                                                     |
|-------|-----------------------------------------------|-------------|--------------------------------------------------------------|
| 2.1   | Internal deps use `workspace:*`               | ✅ Done     | `apps/server/package.json` deps use `workspace:*` for all three `@game/` packages |
| 2.2   | Changeset presence guard added to CI          | ⚠️ Minor    | Present and functional but has a guard logic weakness (see Finding M-1) |
| 2.3   | PR title Conventional Commit enforcement      | ✅ Done     | `ci.yml` validates `feat|fix|chore|...` prefix pattern on PR events |
| 2.4   | Phase validation                              | ✅ Pass     | Lint and targeted build pass                                 |

**Finding M-1 (Minor): Changeset guard detects file presence in diff, not additions**

```yaml
if echo "$CHANGED_FILES" | grep -Eq '^\.changeset/.+\.md$'; then
```

`git diff --name-only` includes both added and deleted files. The Changesets release PR deletes `.changeset/*.md` files and bumps `packages/` versions. This means the release PR passes the guard because deleted changeset files appear in the diff — a different scenario than the intended "a new changeset file was added." Additionally, a PR that only deletes changeset files alongside `packages/` changes would incorrectly pass.

**Suggested fix** — use `git diff --diff-filter=A` to restrict to added files:
```bash
ADDED_CHANGESETS="$(git diff --diff-filter=A --name-only "$BASE_SHA" "$HEAD_SHA" | grep -E '^\.changeset/.+\.md$' || true)"
if [[ -n "$ADDED_CHANGESETS" ]]; then
  echo "Changeset file detected"
  exit 0
fi
```

The current behavior is acceptable for now because the release PR is the only realistic case where changeset files are deleted alongside package changes, and that case is intentional. However, the stricter filter prevents potential misuse.

---

### Phase 3: Release Workflow and Documentation ✅

| Step  | Item                                          | Status   | Evidence                                                           |
|-------|-----------------------------------------------|----------|--------------------------------------------------------------------|
| 3.1   | `semver-release.yml` added                    | ✅ Done  | File present, uses `changesets/action@v2`, `contents: write` + `pull-requests: write` permissions |
| 3.1   | Workflow triggers on `main` push              | ✅ Done  | `on: push: branches: [main]` and `workflow_dispatch` both present  |
| 3.1   | Release PR commit follows Conventional Commit | ✅ Done  | `title: "chore(release): version packages"` passes PR title CI check |
| 3.2   | Release PR lifecycle documented               | ✅ Done  | `docs/cicd-harness.md` and `README.md` both cover the full flow    |
| 3.2   | Rollback guidance present                     | ✅ Done  | `docs/cicd-harness.md` has before/after/post-deployment rollback steps |
| 3.2   | Tag interpretation documented                 | ✅ Done  | SemVer vs. SHA distinction explained in both docs                  |
| 3.3   | Phase validation                              | ✅ Pass  | Lint and build pass                                                |

Notes:
- `semver-release.yml` does not include a `publish` step, which is correct — all packages are `private: true` and should not be published to a registry.
- The `version: npm run version-packages` call runs `changeset version` which updates `CHANGELOG.md` files and `package.json` versions inside the release PR.

---

### Phase 4: Validation ✅

| Step  | Item                           | Status   | Evidence                                             |
|-------|--------------------------------|----------|------------------------------------------------------|
| 4.1   | Full lint pass                 | ✅ Pass  | All workspaces — confirmed in this review session    |
| 4.1   | Full build pass                | ✅ Pass  | All workspaces — confirmed in this review session    |
| 4.1   | Full test pass                 | ✅ Pass  | Confirmed per changes log (requires PostgreSQL)      |
| 4.2   | Minor issues fixed             | ✅ Done  | No outstanding lint/build warnings                   |
| 4.3   | Blocking issues                | None     | —                                                    |

---

## Deprecation Assessment: Existing Release Workflows

This is the central question: now that `semver-release.yml` exists, should `release-dev.yml`, `release-prod.yml`, or `verify-release.yml` be deprecated?

**Answer: No. All three existing workflows remain active and serve a distinct purpose.**

| Workflow              | Trigger                           | Purpose                                        | Overlap with SemVer? |
|-----------------------|-----------------------------------|------------------------------------------------|----------------------|
| `release-dev.yml`     | Push to `main`                    | Build + push SHA-tagged container image to dev | None — deploys code, does not version packages |
| `release-prod.yml`    | `workflow_dispatch`               | Build + push SHA-tagged container image to prod | None — manual prod deploy gate |
| `verify-release.yml`  | Completion of Release Dev or Prod | Post-deployment smoke checks and probes        | None — validates runtime, not packages |
| `semver-release.yml`  | Push to `main`                    | Create/update Changesets release PR for SemVer tagging | Additive to above — no deployment |

The two `main`-triggered workflows (`release-dev.yml` and `semver-release.yml`) run independently and concurrently on every push to `main`. This is intentional and correct:

- `release-dev.yml` deploys the commit as an immutable SHA-tagged image.
- `semver-release.yml` maintains a release PR to batch version bumps for review.

When the release PR is merged to `main`, `release-dev.yml` runs again to deploy the version-bump commit. This is expected behavior — the version-bump commit is a valid deploy artifact with its own SHA.

**Finding M-2 (Minor): Workflow interaction not documented at the workflow level**

The documentation in `docs/cicd-harness.md` and `README.md` correctly describes the complementary relationship at the policy level, but there are no inline comments in `release-dev.yml` or `semver-release.yml` explaining why both trigger on `main`. A maintainer encountering two `main`-push workflows may incorrectly assume one should be removed. Adding a brief comment to each workflow header would eliminate ambiguity.

Suggested addition to `semver-release.yml` job description:
```yaml
jobs:
  semver-release:
    name: Create or update release PR  # Runs alongside release-dev.yml; does not deploy
```

Suggested addition to `release-dev.yml` job description:
```yaml
jobs:
  release-dev:
    name: Build and deploy dev  # SHA-based deploy; semver-release.yml manages version tagging separately
```

---

## Implementation Completeness

All plan phases are complete. No steps were skipped or deferred.

The implementation is **uncommitted** — all working directory changes on the `semver` branch have not been staged or committed yet. This is normal pre-commit state and not a defect, but it should be resolved before merging the PR.

---

## Follow-Up Items

### Discovered During Review

| # | Item | Priority |
|---|------|----------|
| 1 | Tighten changeset guard to `--diff-filter=A` to detect only added changeset files, not deletions | Low |
| 2 | Add inline job-level comments to `release-dev.yml` and `semver-release.yml` clarifying their complementary roles | Low |

### Deferred from Scope (per plan)

| # | Item | Source |
|---|------|--------|
| 1 | App versioning policy decision (whether `apps/*` ever gets SemVer semantics) | plan Dependencies section |
| 2 | Key Vault-backed secret retrieval if governance requires centralized custody | `docs/cicd-harness.md` Alternate model |
