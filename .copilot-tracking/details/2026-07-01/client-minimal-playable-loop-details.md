<!-- markdownlint-disable-file -->
# Implementation Details: Minimal Browser App Scaffold with First Playable Loop

## Context Reference

Sources: `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md`, user request in current session, and existing monorepo workspace conventions.

## Implementation Phase 1: Browser Runtime Scaffold and Workspace Scripts

<!-- parallelizable: true -->

### Step 1.1: Add browser runtime tooling and entry files in `apps/client`

Create a minimal Vite browser shell inside `apps/client` and keep reusable SDK callers in the same workspace.

Files:
* `apps/client/index.html` - Browser entry document with root mount element.
* `apps/client/vite.config.ts` - Vite configuration (dev server defaults, TS path compatibility if needed).
* `apps/client/src/main.ts` - Browser bootstrap entrypoint.
* `apps/client/src/browser/app.ts` - First-loop orchestrator for connect/join/place/render.
* `apps/client/src/browser/env.ts` - Runtime configuration for API base and room host.
* `apps/client/src/browser/api.ts` - HTTP wrappers around existing callers.
* `apps/client/src/browser/room.ts` - Room connection helper and delta wiring.
* `apps/client/src/browser/state.ts` - Minimal client-side state model.
* `apps/client/src/browser/render.ts` - DOM renderer for current game state.

Success criteria:
* `apps/client` can start a browser runtime with `vite`.
* File layout matches selected approach from research.

Context references:
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 146-182) - Preferred structure and files.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 83-96) - Existing reusable client implementation patterns.

Dependencies:
* Existing `apps/client` TypeScript setup.
* Vite dependencies added in Step 1.2.

### Step 1.2: Add root and client scripts for server/client development workflows

Update scripts to expose browser dev flow without disrupting existing server-first root command behavior.

Files:
* `apps/client/package.json` - Add `dev` and `preview` scripts and browser dependencies.
* `package.json` - Add `dev:client` and `dev:full` aliases.

Success criteria:
* `npm run dev:client` starts browser runtime from repository root.
* `npm run dev:full` runs server and client concurrently.
* Existing `npm run dev` remains server-only.

Context references:
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 44-50) - Current root and client script state.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 130-136) - Script pattern recommendation.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 183-188) - Dev command requirements.

Dependencies:
* Step 1.1 completion.
* Workspace dependency install (`npm install`) after package updates.

### Step 1.3: Validate phase changes

Run lint/build commands for this phase when they do not conflict with parallel work.

Validation commands:
* `npm run -w @game/client lint` - Validate client workspace code quality.
* `npm run -w @game/client build` - Validate TypeScript and browser bundle compilation.

### Step 1.4: Verify standalone root browser dev command

Validate explicit root command behavior independent of combined server/client workflow.

Validation commands:
* `npm run dev:client` - Must start browser runtime from repository root and expose local URL.

Success criteria:
* Root command launches client runtime without requiring `dev:full`.
* Command behavior is documented in root and client script comments/README updates if present.

## Implementation Phase 2: First Playable Loop Integration

<!-- parallelizable: false -->

### Step 2.0: Establish auth preflight path for local browser bring-up

Define and implement an explicit preflight path for obtaining a bearer token before protected API calls.

Files:
* `apps/client/src/browser/app.ts` - Add auth preflight gate and clear failure-path messaging.
* `apps/client/src/auth/msal-config.ts` - Confirm authority, client ID, and scope configuration usage for browser runtime.
* `apps/client/src/auth/external-id-session.ts` - Reuse token/session acquisition helpers and expose explicit error states.
* `apps/client/src/browser/render.ts` - Surface auth setup failures and retry affordance in UI state.

Discrepancy references:
* DR-01 - Resolved by explicitly planning real local token acquisition flow and failure behavior.

Success criteria:
* Browser flow attempts token acquisition before bootstrap/join requests.
* Missing or invalid auth configuration fails fast with actionable setup guidance in UI/logs.
* Successful auth preflight enables protected bootstrap and join-token calls.

Context references:
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 30-33) - Auth strategy gap and risk.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Line 213) - Token-gated flow risk.

Dependencies:
* Implementation Phase 1 complete.
* Server auth environment configured for local runtime.

### Step 2.1: Implement browser orchestration for bootstrap, join-token, room join, and tile place

Implement the first-loop flow in browser orchestration, reusing existing auth/session/realtime callers where possible.

Files:
* `apps/client/src/browser/app.ts` - Sequence orchestration and action handlers.
* `apps/client/src/browser/api.ts` - Bootstrap, join-token, and tile place request functions.
* `apps/client/src/browser/room.ts` - Arena room join using join token and delta subscriptions.
* `apps/client/src/auth/msal-config.ts` - Reuse or minimally adapt for browser token acquisition path if required.
* `apps/client/src/auth/external-id-session.ts` - Reuse external identity session handling in browser loop.

Discrepancy references:
* DR-01 - Addressed by Step 2.0 auth preflight implementation.

Success criteria:
* Browser app can call `/api/session/bootstrap` and `/api/session/join-token` successfully.
* Browser app can join `arena` room and receive delta events.
* Browser user action submits `/api/tiles/place` with valid command identity.

Context references:
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 86-96) - Contract sequence requirements.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 100-124) - Orchestration example.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 189-197) - First-loop implementation sequence.

Dependencies:
* Implementation Phase 1 complete.
* Running local server with valid auth/join token signing configuration.

### Step 2.2: Add minimal render/state module to reflect joined and delta-updated tile state

Render authoritative state from join/delta payloads using a minimal DOM-oriented renderer suitable for first-loop verification.

Files:
* `apps/client/src/browser/state.ts` - State update and projection helpers.
* `apps/client/src/browser/render.ts` - UI render function and simple interaction binding.
* `apps/client/src/browser/app.ts` - Wire room updates and placement actions to render updates.

Discrepancy references:
* None.

Success criteria:
* Joined state is visible in browser UI.
* Delta updates change rendered state deterministically.
* Placement response outcomes including conflict/limit states are surfaced in UI feedback.

Context references:
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 204-214) - Risks and expected API outcomes.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 199-203) - Renderer contract sketch.

Dependencies:
* Step 2.1 complete.

### Step 2.3: Isolate browser-incompatible checksum implementation from browser entry path

Refactor or guard Node-only checksum logic so browser build path does not import `node:crypto` directly.

Files:
* `apps/client/src/session/replay-checksum.ts` - Introduce environment-safe checksum strategy.
* `apps/client/src/browser/app.ts` - Ensure browser path uses browser-compatible checksum flow.
* `apps/client/tests/unit/replay-checksum.test.ts` - Extend tests to cover browser-safe behavior.

Discrepancy references:
* None.

Success criteria:
* `@game/client` build succeeds under Vite/browser target.
* Existing replay checksum unit tests pass with updated behavior.

Context references:
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 94-96) - Identified browser compatibility gap.
* `.copilot-tracking/research/2026-07-01/client-minimal-playable-loop-research.md` (Lines 195-197) - Explicit browser compatibility requirement.

Dependencies:
* Step 2.1 complete.

### Step 2.4: Validate playable loop manually with local server and browser runtime

Run integrated local validation of first-loop gameplay flow.

Validation commands:
* `npm run dev:full` - Launch server and browser runtime together.
* `npm run dev:client` - Standalone root client runtime command verification.
* Browser walkthrough: bootstrap -> join-token -> room join -> place tile -> observe rendered state updates.
* `npm run -w @game/client test -- replay-checksum` - Verify checksum-related behavior after compatibility updates.

Success criteria:
* End-to-end first loop works in local environment.
* Known operational responses (409 conflict, 429 throttling) are observable and readable in UI.

Dependencies:
* Steps 2.1-2.3 complete.

## Implementation Phase 3: Final Validation

<!-- parallelizable: false -->

### Step 3.1: Run full project validation

Execute all validation commands relevant to modified code:
* `npm run lint`
* `npm run build`
* `npm run test --workspace @game/client`

### Step 3.2: Fix minor validation issues

Iterate on lint errors, build warnings, and scoped test failures caused by this implementation.

### Step 3.3: Report blocking issues

If validation failures require broader auth/test infrastructure changes:
* Document blockers and affected files.
* Add follow-on planning task(s) rather than performing large refactors inline.

## Dependencies

* Local auth environment values required by server (`apps/server/src/config/env.ts`).
* Colyseus room availability for `arena`.

## Success Criteria

* Minimal browser scaffold exists and is runnable from root.
* First playable loop works end-to-end in local development.
* Browser/runtime compatibility issues are resolved for the selected path.
