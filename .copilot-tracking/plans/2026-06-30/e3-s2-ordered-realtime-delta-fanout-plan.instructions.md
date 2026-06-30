---
applyTo: '.copilot-tracking/changes/2026-06-30/e3-s2-ordered-realtime-delta-fanout-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: E3-S2 Ordered Realtime Delta Fanout

## Overview

Implement ordered realtime placement fanout with single-timeout retransmit and client sequence dedupe so nearby players converge on the same world update order.

## Objectives

### User Requirements

* Deliver E3-S2 acceptance criteria for ordered placement delivery, single retransmit on ack timeout, and duplicate dedupe by sequence ID — Source: GitHub issue #18
* Implement telemetry events delta_sent, delta_acked, and delta_retransmitted — Source: GitHub issue #18
* Enforce per-connection outbound cap as abuse protection — Source: GitHub issue #18
* Provide test coverage across unit, integration, and load scopes for sequence behavior and timeout retransmit rate — Source: GitHub issue #18

### Derived Objectives

* Reuse committed region version from tile mutation as canonical realtime sequence ID — Derived from: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md
* Implement room-scoped in-memory pending-ack tracking with bounded memory growth controls — Derived from: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md
* Keep implementation single-node aligned for Sprint 2 and capture multi-instance durability as follow-on work — Derived from: .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md

## Context Summary

### Project Files

* apps/server/src/rooms/arena.room.ts - Current realtime room transport; requires delta message and ack handling integration
* apps/server/src/http/app.ts - Placement flow integration point for post-commit fanout dispatch
* apps/server/src/persistence/tile.repository.ts - Sequence authority source from committed region version
* apps/server/src/config/env.ts - Runtime config parser for ack timeout/retransmit/cap settings
* apps/server/src/telemetry/telemetry-sink.ts - Required telemetry helper additions for E3-S2
* apps/client/src/session/heartbeat-caller.ts - Existing session transport utility and possible ack transport integration point
* apps/client/src/index.ts - Client export surface for new realtime handler
* apps/server/tests/unit - Unit test location for fanout coordinator state machine
* apps/server/tests/integration - Integration test location for ordered fanout across subscribers
* apps/server/tests/load - Load test location for timeout/retransmit behavior
* apps/client/tests/unit - Unit test location for dedupe/ordering behavior

### References

* .copilot-tracking/research/2026-06-30/e3-s2-ordered-realtime-delta-fanout-research.md - Primary implementation research and selected approach rationale
* .copilot-tracking/research/subagents/2026-06-30/e3-s2-requirements-research.md - Supporting subagent findings referenced by primary research
* /memories/repo/ci-notes.md - Workspace command and test-environment conventions

### Standards References

* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md - Markdown authoring requirements for .md planning files
* /home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md - Writing style requirements for markdown planning content

## Implementation Checklist

### [x] Implementation Phase 1: Realtime Delta Protocol and Fanout Core

<!-- parallelizable: false -->

* [x] Step 1.1: Define ordered delta and ack contracts in room/service boundaries
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 12-28)
* [x] Step 1.2: Implement in-memory fanout coordinator with pending ack map, timeout scheduling, and one retransmit max
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 30-50)
* [x] Step 1.3: Validate phase changes
  * Run lint and build commands for modified files
  * Skip if validation conflicts with parallel phases

### [x] Implementation Phase 2: Server Fanout Integration and Telemetry

<!-- parallelizable: true -->

* [x] Step 2.1: Dispatch fanout from committed tile mutation sequence source
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 64-83)
* [x] Step 2.2: Add room subscriber/ack handling and outbound cap enforcement
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 85-100)
* [x] Step 2.3: Add required telemetry helper methods and state transition emissions
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 102-119)
* [x] Step 2.4: Validate phase changes
  * Run lint and targeted server test commands

### [x] Implementation Phase 3: Client Dedupe and Ack Flow

<!-- parallelizable: true -->

* [x] Step 3.1: Add realtime delta handler with ordered apply and sequence dedupe
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 133-152)
* [x] Step 3.2: Emit client acks after apply/dedupe decisions using deterministic policy
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 154-170)
* [x] Step 3.3: Validate phase changes
  * Run lint and targeted client unit test commands

### [x] Implementation Phase 4: Automated Coverage and Abuse Validation

<!-- parallelizable: false -->

* [x] Step 4.1: Add server unit tests for fanout state transitions and retransmit cap
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 184-199)
* [x] Step 4.2: Add client unit tests for duplicate dedupe and ack behavior
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 201-219)
* [x] Step 4.3: Add integration test for cross-subscriber sequence ordering convergence
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 221-237)
* [x] Step 4.4: Add load scenario for ack-timeout and retransmit telemetry rates
  * Details: .copilot-tracking/details/2026-06-30/e3-s2-ordered-realtime-delta-fanout-details.md (Lines 239-254)
* [x] Step 4.5: Validate phase changes
  * Run server/client tests and load scope checks

### [x] Implementation Phase 5: Validation

<!-- parallelizable: false -->

* [x] Step 5.1: Run full project validation
  * Execute all lint commands (npm run lint, language linters)
  * Execute build scripts for all modified components
  * Run test suites covering modified code
* [x] Step 5.2: Fix minor validation issues
  * Iterate on lint errors and build warnings
  * Apply fixes directly when corrections are straightforward
* [x] Step 5.3: Report blocking issues
  * Document issues requiring additional research
  * Provide user with next steps and recommended planning
  * Avoid large-scale fixes within this phase

## Planning Log

See .copilot-tracking/plans/logs/2026-06-30/e3-s2-ordered-realtime-delta-fanout-log.md for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* E3-S1 session lifecycle/reconnect foundation for stable identity continuity assumptions
* E2-S2 and existing tile persistence ordering guarantees for canonical sequence generation
* Colyseus room messaging remains active realtime transport for Sprint 2 implementation
* Server and client workspace test harnesses (Vitest) configured in current monorepo

## Success Criteria

* Two placements in order are received and applied in identical order by all subscribers — Traces to: GitHub issue #18 acceptance criteria
* Missing ack causes exactly one retransmit for targeted subscriber sequence entry — Traces to: GitHub issue #18 acceptance criteria
* Duplicate delta arrivals are deduped client-side using sequence ID with no duplicate apply — Traces to: GitHub issue #18 acceptance criteria
* Telemetry emits delta_sent, delta_acked, and delta_retransmitted at expected state transitions — Traces to: GitHub issue #18 telemetry requirements
* Per-connection outbound cap is enforced and validated under integration/load checks — Traces to: GitHub issue #18 security and abuse checks
