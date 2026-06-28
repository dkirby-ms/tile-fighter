<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
Follow all instructions from #file:./github-backlog-planning.instructions.md while executing this workflow.

# Issues Plan

* **Repository**: dkirby-ms/tile-fighter
* **Milestone**: Layer 1 MVP

## IS001 - Update - Rebaseline Layer 1 backlog to current repo scope

Backlog content currently describes a broader canvas-social game while the repository is a backend scaffold for Tile Fighter. Rebaseline reduces execution risk and prevents building against stale assumptions.

IS001 - Similarity: #1=Similar, #2=Similar, #3=Similar, #4=Similar, #5=Similar, #6=Similar, #7=Similar, #8=Similar

* IS001 - issue_number: #1
* IS001 - title: epic(layer1): E1 core platform and auth session spine
* IS001 - state: open
* IS001 - labels: feature, infrastructure
* IS001 - milestone: Layer 1 MVP
* IS001 - assignees: none

## IS002 - Link - Add parent-child and dependency relationships

Dependency data is present but not queryable because links were not created during initial import. Add explicit relationships so planning and sequencing are machine-readable.

IS002 - Similarity: #9-#40=Distinct by pair but related as dependency graph

* IS002 - issue_number: #9
* IS002 - title: story(layer1): E1-S1 authenticated session bootstrap
* IS002 - state: open
* IS002 - labels: feature, infrastructure
* IS002 - milestone: Layer 1 MVP
* IS002 - assignees: none

## IS003 - Update - Add priority/status labels and owners

All 40 issues are currently unassigned and lack explicit priority or workflow-state labels. Add metadata to improve sorting, triage, and accountability.

IS003 - Similarity: #1-#40=Similar metadata gap

* IS003 - issue_number: #1
* IS003 - title: epic(layer1): E1 core platform and auth session spine
* IS003 - state: open
* IS003 - labels: feature, infrastructure
* IS003 - milestone: Layer 1 MVP
* IS003 - assignees: none

## IS004 - Consolidate - Reduce overlap in release and operations stories

Verification, CI gate, rollback, and moderation runbook stories can be consolidated into fewer vertical slices with checklist subtasks. This lowers issue overhead while preserving acceptance coverage.

IS004 - Similarity: #12=Similar, #36=Similar, #37=Similar, #39=Similar, #40=Similar

* IS004 - issue_number: #37
* IS004 - title: story(layer1): E8-S1 deterministic CI build and test gates
* IS004 - state: open
* IS004 - labels: infrastructure, security
* IS004 - milestone: Layer 1 MVP
* IS004 - assignees: none
<!-- markdown-table-prettify-ignore-end -->
