---
title: Client scaffold contracts research
description: Evidence-backed findings for adding a minimal runnable browser app and first playable loop in tile-fighter.
author: GitHub Copilot
ms.date: 2026-07-01
ms.topic: how-to
keywords:
	- tile-fighter
	- client scaffold
	- colyseus
	- session contracts
	- monorepo
estimated_reading_time: 11
---

## Scope

Research goal: determine the most reliable path to scaffold a minimal browser app in this monorepo with a first playable loop:

1. Connect
2. Join
3. Place tile
4. Render state

Research tasks covered:

* Root/package scripts and workspace layout for browser-app run strategy from repo root
* Current apps/client APIs and tests for browser readiness
* Server HTTP + realtime room contracts for join/place/state updates
* Minimal file set needed for a runnable browser app under apps/client (preferred) or web
* One recommended scaffold path + at least two alternatives with trade-offs

## Evidence Log

Monorepo and scripts

* Root workspaces are apps/* and packages/*: package.json:6
* Root dev script starts only server workspace: package.json:11
* Root README documents server-focused run commands: README.md:38, README.md:46
* apps/client has build/lint/test but no dev/start script: apps/client/package.json:6, apps/client/package.json:7, apps/client/package.json:9
* apps/client tsconfig is library-style compile to dist (no bundler/runtime): apps/client/tsconfig.json:5, apps/client/tsconfig.json:6
* apps/client tests run in node environment (not browser/jsdom): apps/client/vitest.config.ts:10

Client API surface and browser readiness

* apps/client exports auth/session helpers but no UI/app entrypoint: apps/client/src/index.ts:1
* Join-token caller depends on access token and calls POST /api/session/join-token: apps/client/src/auth/join-token-caller.ts:8
* Bootstrap store calls GET /api/session/bootstrap with bearer auth: apps/client/src/session/bootstrap-store.ts:41
* Heartbeat caller calls POST /api/session/heartbeat with bearer auth: apps/client/src/session/heartbeat-caller.ts:14
* Reconnect caller calls POST /api/session/reconnect and maps status classes: apps/client/src/session/reconnect-caller.ts:50
* Realtime delta handler expects room.on("delta") and sends room.send("delta_ack"): apps/client/src/session/realtime-delta-handler.ts:56, apps/client/src/session/realtime-delta-handler.ts:130
* Client replay checksum module imports node:crypto (not browser-safe as-is): apps/client/src/session/replay-checksum.ts:1
* MSAL browser integration exists (interactive + silent token flow): apps/client/src/auth/external-id-session.ts:7, apps/client/src/auth/msal-config.ts:1

Server HTTP contracts

* HTTP app applies auth middleware globally before protected/session/tile routes: apps/server/src/http/app.ts:121, apps/server/src/http/app.ts:123
* Health and readiness are unauthenticated: apps/server/src/http/routes/health.routes.ts:7, apps/server/src/http/routes/health.routes.ts:11
* Protected profile route for identity check: apps/server/src/http/routes/protected.routes.ts:6
* Session routes:
	* GET /api/session/bootstrap: apps/server/src/http/routes/session.routes.ts:55
	* POST /api/session/join-token: apps/server/src/http/routes/session.routes.ts:106
	* POST /api/session/heartbeat: apps/server/src/http/routes/session.routes.ts:144
	* POST /api/session/reconnect: apps/server/src/http/routes/session.routes.ts:176
* Join-token route only accepts roomId equal to ArenaRoom.ROOM_KEY (arena): apps/server/src/http/routes/session.routes.ts:115
* Tile routes:
	* POST /api/tiles/place: apps/server/src/http/routes/tile.routes.ts:143
	* POST /api/tiles/edit: apps/server/src/http/routes/tile.routes.ts:242
* Tile place commandId validation and malformed identity error: apps/server/src/http/routes/tile.routes.ts:52, apps/server/src/http/routes/tile.routes.ts:158
* Tile place response mapping includes 201 success, 409 conflict, 429 throttled: apps/server/src/http/routes/tile.routes.ts:239, apps/server/src/http/routes/tile.routes.ts:217, apps/server/src/http/routes/tile.routes.ts:178
* Region diff endpoint exists for HTTP polling fallback state sync: apps/server/src/http/routes/region-diff.routes.ts:138

Server realtime contracts

* Colyseus room "arena" is registered in server bootstrap: apps/server/src/index.ts:133
* Arena room auth requires join token verification: apps/server/src/rooms/arena.room.ts:88
* Arena room sends "joined" message on join: apps/server/src/rooms/arena.room.ts:104
* Realtime delta event names are "delta" and "delta_ack": apps/server/src/rooms/arena.room.ts:32, apps/server/src/rooms/arena.room.ts:34
* Room handles DELTA_ACK via onMessage("delta_ack", ...): apps/server/src/rooms/arena.room.ts:83

Auth/runtime constraints that affect scaffold viability

* Access token validation is required for protected/session/tile endpoints: apps/server/src/auth/auth-service.ts:37
* Runtime config requires DATABASE_URL, ENTRA_ISSUER, ENTRA_AUDIENCE, ENTRA_JWKS_URL, JOIN_TOKEN_SIGNING_SECRET: apps/server/src/config/env.ts:13, apps/server/src/config/env.ts:14, apps/server/src/config/env.ts:15, apps/server/src/config/env.ts:16, apps/server/src/config/env.ts:26
* .env.example includes those auth settings and ENTRA_CLIENT_ID for browser shell: .env.example:3, .env.example:4, .env.example:5, .env.example:6, .env.example:9, .env.example:17
* TENANT_MODE single requires ENTRA_TENANT_ID: apps/server/src/config/env.ts:103

Workspace reality check

* No top-level web app directory currently exists (despite prior structure snapshot): list_dir on /home/saitcho/tile-fighter/web returned ENOENT
* apps/client currently contains only library/test assets plus dist artifacts: apps/client

## Key Findings

1. There is currently no runnable browser app in the repo.

* apps/client is a TypeScript library/test package with no dev server command and no HTML entry.
* Root dev command only starts @game/server.

2. The server contracts for first playable loop are already present and usable.

* HTTP contracts for bootstrap, join-token, heartbeat, reconnect, tile place are implemented.
* Realtime room contracts for delta + delta_ack exist and align with the client delta handler.

3. Authentication is the main gating factor for an end-to-end playable browser loop.

* All game-related HTTP routes require Bearer token auth.
* Room join requires server-issued join token bound to room "arena".
* A browser app must either integrate MSAL + real Entra settings or rely on a dev-only auth bypass strategy.

4. apps/client has one browser-incompatibility that must be handled for a browser-target build.

* replay-checksum.ts imports node:crypto directly.
* Any bundler/browser build that includes this module will need a browser-safe checksum implementation path.

5. A minimal playable loop can be implemented without new server endpoints.

* Connect/join uses existing Colyseus room + join token route.
* Place tile uses existing POST /api/tiles/place.
* Render state can be driven by "delta" realtime messages, with HTTP region diff fallback available.

## Recommended Approach

Recommended scaffold path: add a small Vite browser shell inside apps/client, keep existing client helpers, and add a thin browser-only adapter layer.

Why this is preferred

* Keeps client implementation co-located with existing auth/session caller code.
* Introduces a real browser dev command from repo root with minimal repo churn.
* Reuses existing tested API callers and realtime handler contracts.

Minimal files to add/update (apps/client preferred)

1. Update apps/client/package.json
* Add scripts: dev, preview, and optionally build:web.
* Add deps/devDeps for Vite and Colyseus browser client.

2. Add apps/client/index.html
* Single mount point.

3. Add apps/client/src/main.ts
* Bootstraps app and mounts DOM.

4. Add apps/client/src/browser/app.ts
* Orchestrates the loop:
	* bootstrap identity check
	* fetch join token
	* Colyseus join
	* send tile place command
	* subscribe/apply delta updates

5. Add apps/client/src/browser/api.ts
* Fetch wrappers for bootstrap/join-token/place with base URL config.

6. Add apps/client/src/browser/room.ts
* Colyseus room client wiring and delta callback binding.

7. Add apps/client/src/browser/state.ts
* In-memory tile map and renderer adapter.

8. Add apps/client/src/browser/render.ts
* Basic grid DOM/canvas renderer (first playable visuals).

9. Add apps/client/src/browser/env.ts
* Client env parsing for API + WS URLs and room/region defaults.

10. Update apps/client/src/session/replay-checksum.ts
* Provide browser-compatible checksum implementation path (Web Crypto API) or isolate node-only usage from browser entry.

11. Optional for dev quality
* apps/client/src/browser/command-id.ts for deterministic commandId creation compatible with TILE_PLACE_COMMAND_ID_PATTERN.

Root-level command examples

Current commands that already work

* npm run dev
* npm run -w @game/server dev
* npm run -w @game/client build
* npm run -w @game/client test

Recommended post-scaffold commands to add

* npm run -w @game/client dev
* npm run -w @game/client preview
* npm run dev:client (root alias to @game/client dev)
* npm run dev:full (run server and client together)

Contract mapping for first playable loop implementation

* Bootstrap identity/session readiness: GET /api/session/bootstrap
* Join token: POST /api/session/join-token with { roomId: "arena" }
* Realtime connect/join: Colyseus room "arena" with joinToken in room options
* Place tile: POST /api/tiles/place with TilePlaceCommand
* Render updates: realtime "delta" events (+ send "delta_ack")
* Recovery/fallback state sync: POST /api/regions/diff and POST /api/session/reconnect

## Alternatives Considered

Alternative 1: Create a separate top-level web workspace (new web package)

What it means

* Create a new workspace package (for example apps/web or web) with its own Vite app.
* Keep apps/client as shared SDK-only package.

Pros

* Clean separation: SDK vs app shell.
* Lower risk of browser tooling constraints leaking into SDK package.

Cons

* More files and wiring now (workspace updates, shared imports, scripts).
* Slower to first playable loop versus in-place apps/client scaffold.

Trade-off summary

* Better long-term architecture if a full product UI is imminent.
* Higher immediate setup cost.

Alternative 2: Keep apps/client library-only, build a static no-bundler dev page for first loop

What it means

* Compile TS to dist and hand-wire an HTML page loading compiled modules.

Pros

* Minimal dependency additions.

Cons

* Weak developer ergonomics (no HMR/dev server).
* Harder browser module resolution and polyfill handling.
* Realtime/auth debugging becomes slower.

Trade-off summary

* Fastest “proof of concept” path for one engineer.
* Not a durable team dev workflow.

Alternative 3: HTTP-only prototype first (skip realtime room initially)

What it means

* Use bootstrap/join-token/place/diff endpoints only, postpone Colyseus realtime client.

Pros

* Lower initial complexity.
* Easier debugging with plain fetch.

Cons

* Does not satisfy full connect/join/realtime loop intent.
* You still must add realtime soon after; potential rework.

Trade-off summary

* Good fallback if auth/realtime integration blocks day-one progress.
* Not the best fit for requested first playable loop.

## Risks/Pitfalls

1. Browser incompatibility from node:crypto import
* apps/client/src/session/replay-checksum.ts:1
* Risk: bundler/runtime errors in browser build if imported by browser entry.

2. Auth dependency may block local “quick start”
* Protected APIs require valid bearer token via auth middleware and AuthService validation.
* Risk: no playable loop without real Entra config or dev auth strategy.

3. Room ID/region coupling assumptions
* Join-token route enforces ArenaRoom.ROOM_KEY.
* Region membership checks can deny diff requests if lifecycle state is not established.

4. Placement command ID validation
* CommandId must satisfy shared pattern and length constraints.
* Risk: repeated 400 malformed_command_identity if client ID generation is not contract-compliant.

5. Throttle and conflict semantics on tile placement
* 429 and 409 are normal domain outcomes and must be handled in UI flow.

6. Missing root client aliases today
* There is no current root-level client dev script, so repo root DX is server-only until scaffold scripts are added.

## Implementation-ready checklist

Scaffold prep

* Confirm server starts from root: npm run dev
* Confirm required env values are set (DATABASE_URL, ENTRA_*, JOIN_TOKEN_SIGNING_SECRET)
* Decide auth mode for local browser loop:
	* real Entra + MSAL now
	* or explicit dev-only auth bypass plan (requires server changes, not currently present)

Create browser shell under apps/client

* Add Vite + Colyseus client dependencies to apps/client/package.json
* Add scripts in apps/client/package.json: dev, preview
* Add root aliases in package.json: dev:client and optionally dev:full
* Add index.html + src/main.ts mount path

Wire first playable loop

* Build bootstrap request to /api/session/bootstrap
* Build join-token request to /api/session/join-token with roomId arena
* Connect to Colyseus room arena using joinToken option
* Subscribe to realtime delta event and send delta_ack
* Issue POST /api/tiles/place on user input with valid commandId
* Render tile state updates in grid/canvas view

Close browser compatibility gaps

* Refactor replay checksum to browser-safe crypto path or isolate node-only import
* Keep node-only modules out of browser entry graph

Validation pass

* Run npm run -w @game/client dev
* Run npm run dev in separate terminal for server
* Verify loop manually:
	* bootstrap succeeds
	* join token issued for arena
	* room join receives joined event
	* place returns 201 or expected domain error
	* delta arrives and renderer updates

Follow-on research recommended (not completed here)

* Decide and document explicit local auth developer story for browser shell bring-up
* Validate exact Colyseus browser client API shape/version against @colyseus/sdk used in this repo
* Decide whether region-diff should be part of initial render bootstrap or only reconnect fallback
