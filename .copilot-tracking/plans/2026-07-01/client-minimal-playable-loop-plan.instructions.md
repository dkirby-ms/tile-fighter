---
applyTo: '.copilot-tracking/changes/2026-07-01/client-minimal-playable-loop-changes.md'
---
<!-- markdownlint-disable-file -->
# Implementation Plan: Minimal Browser App Scaffold with First Playable Loop

## Overview

Scaffold a minimal Vite-powered browser runtime inside `apps/client` and wire the first playable loop (connect, join, place tile, render state) using existing server contracts and client helpers.

## Objectives

### User Requirements

* Scaffold a minimal browser app in this monorepo — Source: `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md`
* Ensure a working `dev` command for local development — Source: `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md`
* Implement the first playable loop: connect, join, place tile, render state — Source: `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md`

### Derived Objectives

* Keep the implementation in `apps/client` instead of introducing a new top-level app — Derived from: selected approach in research minimizes repo churn and reuses tested client modules.
* Preserve root `npm run dev` behavior while adding explicit browser aliases — Derived from: existing server-first workflow and need for low-risk incremental adoption.
* Isolate browser-incompatible checksum code paths to prevent Vite build/runtime failures — Derived from: discovered `node:crypto` compatibility gap.

## Context Summary

### Project Files

* `package.json` - Root workspace scripts and developer command entry points.
* `apps/client/package.json` - Client workspace scripts and browser tooling dependencies.
* `apps/client/src/auth/join-token-caller.ts` - Existing join token HTTP caller for room connect flow.
* `apps/client/src/session/realtime-delta-handler.ts` - Existing realtime delta and acknowledgement handling.
* `apps/client/src/session/replay-checksum.ts` - Browser compatibility risk due to `node:crypto` import.
* `apps/server/src/http/routes/session.routes.ts` - Bootstrap and join-token endpoint contracts.
* `apps/server/src/http/routes/tile.routes.ts` - Tile placement endpoint contract and status mapping.
* `apps/server/src/rooms/arena.room.ts` - Arena room join and delta event behavior.

### References

* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` - Primary research and selected implementation approach.

### Standards References

* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/markdown.instructions.md` — Markdown authoring requirements for planning artifacts.
* `/home/saitcho/.vscode-server/extensions/ise-hve-essentials.hve-core-all-3.3.101/.github/instructions/hve-core/writing-style.instructions.md` — Writing style and clarity conventions for markdown content.

## Implementation Checklist

### [x] Implementation Phase 1: Browser Runtime Scaffold and Workspace Scripts

<!-- parallelizable: true -->

* [x] Step 1.1: Add browser runtime tooling and entry files in `apps/client`
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 9-28)
* [x] Step 1.2: Add root and client scripts for server/client development workflows
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 30-47)
* [x] Step 1.3: Validate scaffold-level build and lint for client workspace
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 70-76)
* [x] Step 1.4: Verify standalone root browser dev command
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 78-90)

### [ ] Implementation Phase 2: First Playable Loop Integration

<!-- parallelizable: false -->

* [x] Step 2.0: Establish auth preflight path for local browser bring-up
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 98-122)
* [x] Step 2.1: Implement browser orchestration for bootstrap, join-token, room join, and tile place
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 124-149)
* [x] Step 2.2: Add minimal render/state module to reflect joined and delta-updated tile state
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 151-169)
* [x] Step 2.3: Isolate browser-incompatible checksum implementation from browser entry path
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 171-187)
* [ ] Step 2.4: Validate playable loop manually with local server and browser runtime
  * Details: `.copilot-tracking/details/2026-07-01/client-minimal-playable-loop-details.md` (Lines 189-207)

### [x] Implementation Phase 3: Final Validation

<!-- parallelizable: false -->

* [x] Step 3.1: Run full project validation for impacted workspaces
  * Execute lint for root and `@game/client`.
  * Execute build for root workspaces (or targeted server/client build if root build is too broad).
  * Execute tests covering client session/auth callers and any new browser-targeted unit tests.
* [x] Step 3.2: Fix minor validation issues
  * Iterate on lint/build/test failures caused by this task only.
* [x] Step 3.3: Report blocking issues
  * Document unresolved auth/local token constraints and any environment prerequisites.

## Planning Log

See `.copilot-tracking/plans/logs/2026-07-01/client-minimal-playable-loop-log.md` for discrepancy tracking, implementation paths considered, and suggested follow-on work.

## Dependencies

* Node.js/npm workspace tooling compatible with existing monorepo scripts.
* Vite runtime dependencies in `@game/client`.
* Local browser auth preflight using existing MSAL/external ID flow to obtain bearer token before bootstrap/join calls.
* Local server runtime with auth environment configured for protected endpoints.

## Success Criteria

* `npm run dev:client` starts browser runtime from repository root as a standalone command — Traces to: research success criteria and command-path verification requirement.
* Browser auth preflight obtains a token through the configured local MSAL/external ID path or fails with explicit setup guidance before gameplay calls — Traces to: auth-gating risk in research.
* User can complete one end-to-end action loop (bootstrap, join, place, state render update) in local development — Traces to: user requirement and technical scenario.
* No browser build break occurs from Node-only imports in the first-loop path — Traces to: identified browser compatibility risk.
