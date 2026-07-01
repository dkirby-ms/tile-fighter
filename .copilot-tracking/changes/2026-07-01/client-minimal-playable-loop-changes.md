<!-- markdownlint-disable-file -->
# Release Changes: Minimal Browser App Scaffold with First Playable Loop

**Related Plan**: .copilot-tracking/plans/2026-07-01/client-minimal-playable-loop-plan.instructions.md
**Implementation Date**: 2026-07-01

## Summary

Implementation in progress. Phase 1 is complete and scaffolds a browser runtime in apps/client with root/client development scripts, preserving the existing server-first root dev workflow. Phase 2 implementation is complete for auth preflight, orchestration, render/state updates, and browser-safe checksum isolation; interactive end-to-end manual walkthrough remains environment-gated.

## Changes

### Added

* apps/client/index.html - Browser entry document with mount node and module script.
* apps/client/vite.config.ts - Minimal Vite dev server configuration for local browser runtime.
* apps/client/src/main.ts - Browser bootstrap entrypoint.
* apps/client/src/browser/app.ts - Scaffold orchestrator for environment probe and room connection placeholders.
* apps/client/src/browser/env.ts - Runtime environment resolution for API and room endpoints.
* apps/client/src/browser/api.ts - Stubbed API probe module for scaffold bring-up.
* apps/client/src/browser/room.ts - Stubbed room connector for scaffold bring-up.
* apps/client/src/browser/state.ts - Minimal scaffold state model.
* apps/client/src/browser/render.ts - Minimal DOM renderer for scaffold state.

### Modified

* apps/client/package.json - Added browser runtime scripts (`dev`, `preview`) and Vite dependency.
* package.json - Added root aliases (`dev:client`, `dev:full`) while keeping `dev` server-only.
* package-lock.json - Updated lockfile for added workspace dependencies.
* apps/client/src/browser/app.ts - Implemented auth preflight, bootstrap/join flow orchestration, room wiring, and tile placement action handling.
* apps/client/src/browser/api.ts - Added bootstrap and tile placement API wrappers plus health probe.
* apps/client/src/browser/room.ts - Added Colyseus room join integration and realtime delta wiring.
* apps/client/src/browser/state.ts - Added playable-loop state transitions, delta application, and cell-selection state.
* apps/client/src/browser/render.ts - Expanded renderer and UI interactions for startup, join state, placement action, and outcome feedback.
* apps/client/src/browser/env.ts - Expanded runtime config for MSAL, endpoints, and room parameters.
* apps/client/src/session/replay-checksum.ts - Added browser-safe checksum generation path and removed Node-only browser dependency.
* apps/client/tests/unit/replay-checksum.test.ts - Added browser checksum coverage.

### Removed

* None.

## Additional or Deviating Changes

* Added `concurrently` to root devDependencies to support `dev:full` dual-process workflow.
	* Reason: Required to implement parallel server+client startup from a single root command.
* Addressed scaffold lint issues in browser modules before closing Phase 1 validation.
	* Reason: New files initially triggered unused-parameter and browser-global lint diagnostics.
* Added `@colyseus/sdk` under `@game/client` dependencies.
	* Reason: Phase 2 room join integration required browser-side Colyseus client support.
* Manual end-to-end browser walkthrough is only partially validated.
	* Reason: Full bootstrap->join->place loop in-browser requires interactive external identity auth and correctly provisioned local `VITE_APP_MSAL_*` and server `ENTRA_*` environment values.

## Release Summary

Phase 1 complete. Validation passed for:
* `npm run -w @game/client lint`
* `npm run -w @game/client build`
* `npm run dev:client` (verified startup output and then terminated)

Phase 2 targeted validations passed for:
* `npm run -w @game/client test -- replay-checksum`
* `npm run dev:client` (startup verified)
* `npm run dev:full` (startup verified; Vite used fallback port when 5173 was occupied)

Phase 3 final validation passed for:
* `npm run lint`
* `npm run build`
* `npm run test --workspace @game/client`

Phase 3 fixes applied during validation:
* `apps/client/src/browser/render.ts` - Adjusted browser input element handling to satisfy lint rules.
* `apps/client/src/browser/app.ts` - Tightened optional scope handling for strict TypeScript checks.

Remaining blocker:
* Phase 2 Step 2.4 interactive walkthrough (bootstrap -> join-token -> room join -> place -> render update) is still pending because it requires an interactive external identity sign-in session with correctly configured local `VITE_APP_MSAL_*` and server `ENTRA_*` values.

Net file impact in this implementation pass:
* Added: 9 files
* Modified: 8 files
* Removed: 0 files
