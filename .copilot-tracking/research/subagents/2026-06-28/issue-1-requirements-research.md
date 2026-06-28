---
title: Issue 1 Requirements Research
description: Verified requirements and epic intent analysis for GitHub Issue #1 in dkirby-ms/tile-fighter
author: GitHub Copilot
ms.date: 2026-06-28
ms.topic: reference
---

## Research scope

* Topic: GitHub Issue #1 in dkirby-ms/tile-fighter
* Target issue title: epic(layer1): E1 core platform and auth session spine
* Goal: capture exact metadata, summarize requirements and intent, and identify gaps with evidence

## 1) Exact issue metadata

* Repository: dkirby-ms/tile-fighter
* Issue number: 1
* Title: epic(layer1): E1 core platform and auth session spine
* URL: <https://github.com/dkirby-ms/tile-fighter/issues/1>
* State: OPEN
* Labels:
  * feature
  * infrastructure
  * priority:p1
  * status:ready
  * backlog
* Milestone:
  * Number: 1
  * Title: Layer 1 MVP
  * Description: Layer 1 playable MVP backlog (4-6 month window)
  * Due: 2026-11-29T00:00:00Z
* Assignees: none
* Created at: 2026-06-28T14:04:06Z
* Updated at: 2026-06-28T14:31:46Z

## 2) Full issue body summary and explicit criteria/checklists

### Body summary

Issue #1 frames Epic E1 as the prerequisite platform/auth spine required before other multiplayer and protected operations can proceed. It defines explicit boundaries and risk areas:

* Why now: auth/session reliability is a prerequisite for multiplayer gameplay and protected operations
* In-scope:
  * Session bootstrap
  * Join-token issuance
  * Session heartbeat lifecycle
  * Health/protected-route verification harness
* Out-of-scope:
  * Progression profiles
  * Social graph/friends
* Primary risks:
  * Token mismatch across client/server
  * Startup instability under reconnect churn
* Harness mapping: 1 source validation, 2 deterministic build/type safety, 6 post-deploy verification
* Stories listed: E1-S1, E1-S2, E1-S3, E1-S4

### Explicit acceptance criteria / exit criteria in issue text

* Authenticated player reaches playable shell in <5s p50
* Health, readiness, protected-route smoke checks pass

### Explicit checklists in issue text

* No markdown checkbox list (`- [ ]`) appears in Issue #1 body
* The body uses sectioned bullets and a "Stories" list (E1-S1..E1-S4)

## 3) Linked issues/PRs or referenced docs

### Directly linked/cross-referenced issues

* Issue timeline contains a `cross-referenced` event from Issue #41:
  * Source issue: #41
  * Source title: epic(layer1): E1 core platform and auth session spine
  * Issue #41 is closed and labeled `duplicate`

Interpretation: Issue #1 is the active epic record; Issue #41 is a duplicate/older parallel epic entry.

### Story issue mappings referenced by E1-S1..E1-S4 identifiers

Two sets of story issues currently exist for E1 naming:

* Open set:
  * #9 E1-S1 authenticated session bootstrap (OPEN)
  * #10 E1-S2 room join token issuance (OPEN)
  * #11 E1-S3 session heartbeat lifecycle (OPEN)
  * #12 E1-S4 protected health verification gate (CLOSED)
* Closed set:
  * #49 E1-S1 authenticated session bootstrap (CLOSED)
  * #50 E1-S2 signed room join credential (CLOSED)
  * #51 E1-S3 session heartbeat and presence cleanup (CLOSED)
  * #52 E1-S4 health and protected route smoke gates (CLOSED)

This indicates duplicate/superseded story tracking that should be clarified for execution and reporting.

### Referenced docs

* Issue #1 body contains no direct URL and no direct doc path references.
* Related references discovered from linked artifacts:
  * Issue #41 body references docs/layer1-backlog.md for epic map and risk context
  * docs/layer1-backlog.md contains an E1 epic row and E1 story definitions that align with Issue #1 intent

## 4) Clear extracted requirement list for Epic E1

### Functional requirements

* Provide authenticated session bootstrap flow from client open to server bootstrap response
* Issue join credentials/tokens usable for room entry authorization
* Implement session heartbeat lifecycle handling, including presence continuity/cleanup behavior
* Maintain health/readiness/protected-route verification path and make it testable via smoke checks

### Non-functional and quality requirements

* Meet startup performance target: authenticated playable shell in <5s p50
* Ensure auth/session consistency between client and server token handling
* Maintain resilience under reconnect churn and startup volatility
* Align implementation and validation with harness mapping points 1, 2, and 6

### Scope constraints

* Exclude progression profile features from this epic
* Exclude social graph/friends features from this epic

### Delivery decomposition requirements

* Epic decomposition must include stories E1-S1 through E1-S4 (as explicitly listed)

## 5) Open questions and gaps

* Which E1 story set is canonical for delivery tracking: open #9-#12, closed #49-#52, or a merge strategy?
* Why is #12 closed while #9-#11 remain open, given the epic lists all four stories as required?
* Should Issue #1 include explicit links to the canonical story issues and docs/layer1-backlog.md to remove ambiguity?
* Is the <5s p50 target measured in local dev, CI smoke, staging, or production-like environment?
* What is the concrete definition of "playable shell" for acceptance, beyond authentication success?

## 6) Evidence log

### Commands executed

1. `gh issue view 1 --repo dkirby-ms/tile-fighter --json number,title,body,labels,milestone,assignees,state,createdAt,updatedAt,url`
2. `gh issue view 1 --repo dkirby-ms/tile-fighter --json foo` (field discovery; returns available fields)
3. `gh api repos/dkirby-ms/tile-fighter/issues/1/timeline`
4. `gh issue list --repo dkirby-ms/tile-fighter --state all --limit 200 --search "E1-S" --json number,title,state,url`
5. `gh api repos/dkirby-ms/tile-fighter/issues/1/timeline --jq '.[] | {event,created_at,actor:.actor.login,source_issue:(.source.issue.number // null),source_title:(.source.issue.title // null),commit_id:(.commit_id // null)}'`
6. `gh issue list --repo dkirby-ms/tile-fighter --state all --limit 300 --json number,title,state,url,milestone,labels`
7. `gh issue list --repo dkirby-ms/tile-fighter --state all --limit 300 --json number,title,state,url --jq '.[] | select(.title | test("E1-S[1-4]")) | [.number,.title,.state,.url] | @tsv'`
8. `gh issue view 1 --repo dkirby-ms/tile-fighter --json comments --jq '.comments'`
9. `gh issue view 1 --repo dkirby-ms/tile-fighter --json body --jq '.body' | rg -n "https?://|README|docs/|\.md|E1-S[1-4]"`
10. `gh issue view 41 --repo dkirby-ms/tile-fighter --json number,title,state,labels,milestone,createdAt,updatedAt,closedAt,url,body`
11. `gh issue list --repo dkirby-ms/tile-fighter --state all --limit 300 --json number,title,state,milestone --jq '.[] | select(.number==9 or .number==10 or .number==11 or .number==12 or .number==49 or .number==50 or .number==51 or .number==52) | [.number,.title,.state, (.milestone.title // "none")] | @tsv'`
12. `gh issue view 9 --repo dkirby-ms/tile-fighter --json body,title,number,state,url`
13. `gh issue view 49 --repo dkirby-ms/tile-fighter --json body,title,number,state,url`
14. `rg -n "^#|\bE1\b|E1-S[1-4]|core platform|auth session|Harness|exit criteria|Why now" docs/layer1-backlog.md`

### Primary source references

* GitHub Issue #1: <https://github.com/dkirby-ms/tile-fighter/issues/1>
* GitHub Issue #41 (cross-reference duplicate): <https://github.com/dkirby-ms/tile-fighter/issues/41>
* Story issues: #9, #10, #11, #12, #49, #50, #51, #52 in dkirby-ms/tile-fighter
* Repository planning doc: docs/layer1-backlog.md

## Research status

Complete for requested scope. Requirements and intent are verified from issue metadata/body plus timeline and story-link evidence. Remaining uncertainties are documented under open questions.
