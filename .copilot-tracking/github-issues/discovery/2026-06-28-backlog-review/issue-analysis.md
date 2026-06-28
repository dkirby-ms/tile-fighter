<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
Follow all instructions from #file:./github-backlog-planning.instructions.md while executing this workflow.

# Discovery Issue Analysis - Layer 1 Backlog Review

* **Artifact(s)**: docs/layer1-backlog.md, README.md, .copilot-tracking/github-issues/execution/2026-06-28-layer1-mvp/open-issues.tsv
* **Repository**: dkirby-ms/tile-fighter
* **Milestone**: Layer 1 MVP

## Planned Issues

### IS001 - Update - Rebaseline backlog to current product scope

* **Working Title**: meta(backlog): rebaseline Layer 1 backlog to Tile Fighter server scope
* **Key Search Terms**: "chroma commons", "tile canvas", "bonding", "tile persistence"
* **Working Labels**: planning, backlog, triage
* **Found Issue Field Values**:
  * title family: epic(layer1) and story(layer1)
  * state: open (#1-#40)
  * milestone: Layer 1 MVP
* **Suggested Issue Field Values**:
  * update one epic to become scope-baseline epic
  * close or relabel non-matching stories after review

#### IS001 - Related and Discovered Information

* Related Key Details from docs/layer1-backlog.md
  * Backlog describes Chroma Commons canvas gameplay (tile placement, hearts, pins, moderation).
* Related Key Details from README.md
  * Current repo describes Tile Fighter backend scaffold (Colyseus room, auth, health, persistence scaffold).
* Related Key Details from execution/2026-06-28-layer1-mvp/open-issues.tsv
  * 40 canonical open issues exist and are all in one milestone.

### IS002 - Update - Convert body dependencies to native issue relationships

* **Working Title**: meta(backlog): add parent-child links and dependency links
* **Key Search Terms**: "Dependencies", "E1-S1", "E8-S3"
* **Working Labels**: planning, backlog
* **Found Issue Field Values**:
  * dependencies stored in issue body text
  * workflow handoff shows Link count = 0
* **Suggested Issue Field Values**:
  * create parent-child links from stories to epics
  * add blocked-by references where dependencies exist

### IS003 - Update - Add execution metadata for prioritization

* **Working Title**: meta(backlog): add priority, status, and ownership metadata
* **Key Search Terms**: "Target sprint", "assignees", "priority"
* **Working Labels**: planning, triage
* **Found Issue Field Values**:
  * assignees: none across all open issues
  * target sprint captured in body text, not labels/milestones
* **Suggested Issue Field Values**:
  * labels: priority:p0..p3, status:ready|blocked|in-progress
  * assignee or owner field population
  * optional sprint milestones or project fields for target sprint

### IS004 - Consolidate - Merge overlapping ops and verification stories

* **Working Title**: meta(backlog): consolidate overlapping release/ops stories
* **Key Search Terms**: "verify", "rollback", "runbook", "CI gates"
* **Working Labels**: planning, infrastructure
* **Found Issue Field Values**:
  * verification and rollback responsibilities are split across E1-S4, E8-S1, E8-S3, E8-S4, E7-S4
* **Suggested Issue Field Values**:
  * merge into fewer vertical slices with clear done criteria per slice
  * keep technical subtasks in checklist sections instead of separate top-level stories

## Similarity findings

* This run is refinement-only; no new feature issue creation proposed.
* Recommended actions are update/consolidate on existing canonical issue set (#1-#40).
<!-- markdown-table-prettify-ignore-end -->
