<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
Follow all instructions from #file:./github-backlog-planning.instructions.md while executing this workflow.

# Backlog Review Handoff

## Workflow Summary

* **Workflow type**: Discovery (backlog review and consolidation)
* **Execution date**: 2026-06-28
* **Repository**: dkirby-ms/tile-fighter
* **Milestone reviewed**: Layer 1 MVP

## Findings

1. Scope mismatch risk: backlog narrative is canvas-social heavy while repository currently emphasizes backend scaffold capabilities.
2. No native relationships: stories and dependencies are represented as text, not issue links.
3. Metadata gap: all issues are unassigned and lack priority/state labels.
4. Overlap exists among release/verification/ops stories and can be consolidated.
5. Tracking artifact mismatch: execution issue map records duplicate range (#41-#80) while canonical open set is #1-#40.

## Recommended Consolidations

* Consolidate E1-S4 + E8-S3 into a single release verification story with checklists for health, protected routes, and authenticated room smoke.
* Consolidate E8-S1 + E4-S4 into one CI quality-gate story with domain test suite sections.
* Consolidate E8-S4 + E7-S4 into one operational readiness story with moderation and rollback runbooks as subtasks.
* Keep E2-S3 separate only if snapshot/replay remains a hard requirement for Layer 1; otherwise defer to Layer 2.

## Follow-up Actions

1. Run a triage pass to apply labels: priority:p0-p3 and status:ready|blocked|in-progress.
2. Add parent-child links from each story to its epic and dependency links for blocked-by chains.
3. Reword or close stories that do not align with current Tile Fighter Layer 1 scope.
4. Regenerate execution mapping artifact from canonical issues only.

## Artifacts

* .copilot-tracking/github-issues/discovery/2026-06-28-backlog-review/issue-analysis.md
* .copilot-tracking/github-issues/discovery/2026-06-28-backlog-review/issues-plan.md
* .copilot-tracking/github-issues/discovery/2026-06-28-backlog-review/planning-log.md
* .copilot-tracking/github-issues/discovery/2026-06-28-backlog-review/handoff.md
<!-- markdown-table-prettify-ignore-end -->
