<!-- markdownlint-disable-file -->
# Task Research: Minimal Browser App Scaffold with First Playable Loop

Research on scaffolding a minimal browser app under apps/client (or web/) with a real dev command and first playable loop: connect, join, place tile, render state.

## Task Implementation Requests

* Scaffold a minimal browser app in this monorepo.
* Ensure a working `dev` command for local development.
* Implement the first playable loop: connect, join, place tile, render state.

## Scope and Success Criteria

* Scope: Determine the best location (apps/client vs web/), required files/scripts, protocol touchpoints, and a minimal implementation plan consistent with repository conventions.
* Assumptions:
  * Existing server endpoints and room contracts are authoritative for the first loop.
  * Authentication remains required unless a separate server-side dev bypass is intentionally introduced.
* Success Criteria:
  * A single recommended approach with rationale and trade-offs.
  * File-level implementation plan with exact paths and minimal code shape.
  * Verified command path for `dev` startup from repository root.

## Outline

1. Inventory workspace scripts and entry points.
2. Identify join/connect/place/render contracts.
3. Evaluate scaffold options (apps/client Vite shell vs new web package).
4. Select one approach with implementation-ready checklist.

## Potential Next Research

* Finalize local authentication strategy for browser bring-up.
  * Reasoning: Protected APIs and room join are token-gated; this is the primary delivery risk.
  * Reference: apps/server/src/auth/auth-service.ts, apps/server/src/config/env.ts
* Decide initial renderer for first loop (DOM grid vs canvas).
  * Reasoning: Impacts minimal file design and event-to-render complexity.
  * Reference: apps/client/src/browser/render.ts (planned)

## Research Executed

### File Analysis

* package.json
  * Root workspaces are apps/* and packages/*; root dev currently starts only server.
* apps/client/package.json
  * No dev script exists; package is library/test oriented today.
* apps/client/src/*
  * Existing HTTP/session callers and realtime delta handler are reusable for browser loop.
* apps/server/src/http/routes/*
  * Session and tile routes required for first loop are already implemented.
* apps/server/src/rooms/arena.room.ts
  * Realtime events and join flow already align with client delta handler expectations.
* apps/server/src/config/env.ts
  * Auth and signing env requirements are strict and required for runtime.

### Code Search Results

* Search term: join-token
  * Matches in apps/client/src/auth/join-token-caller.ts and apps/server/src/http/routes/session.routes.ts.
* Search term: delta_ack
  * Matches in apps/client/src/session/realtime-delta-handler.ts and apps/server/src/rooms/arena.room.ts.
* Search term: /api/tiles/place
  * Matches in apps/server/src/http/routes/tile.routes.ts and supporting command validation logic.

### External Research

* None required; repository evidence was sufficient.

### Project Conventions

* Standards referenced: TypeScript workspace scripts, package-per-app structure under apps/.
* Instructions followed: Task Researcher mode constraints and research artifact conventions.

## Key Discoveries

### Project Structure

* There is no runnable browser app shell in the repo today.
* apps/client is currently a package with build/lint/test but without browser dev server tooling.
* Root developer workflow is server-first (npm run dev -> @game/server).

### Implementation Patterns

* First-loop contracts already exist and are reusable:
  * Bootstrap: GET /api/session/bootstrap
  * Join token: POST /api/session/join-token with roomId arena
  * Realtime: Colyseus room arena, delta events, delta_ack acknowledgements
  * Placement: POST /api/tiles/place with command identity validation
* Client helper modules already implement most HTTP and realtime primitives needed.
* One browser compatibility gap exists: node:crypto import in replay checksum module.

### Complete Examples

```ts
// First-loop orchestration sketch (browser shell)
// 1) bootstrap -> 2) join token -> 3) room join -> 4) place tile -> 5) render delta
const bootstrap = await fetch(`${apiBase}/api/session/bootstrap`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

const joinTokenResp = await fetch(`${apiBase}/api/session/join-token`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ roomId: "arena", region: "local" }),
});

const { roomId, sessionId, joinToken } = await joinTokenResp.json();

// Room client wiring uses existing delta handler contract: delta + delta_ack.
// Tile placement follows /api/tiles/place contract with valid commandId.
```

### API and Schema Documentation

* Session bootstrap route: apps/server/src/http/routes/session.routes.ts
* Join token route: apps/server/src/http/routes/session.routes.ts
* Tile place route and status mapping: apps/server/src/http/routes/tile.routes.ts
* Realtime room events: apps/server/src/rooms/arena.room.ts
* Client delta handler expectations: apps/client/src/session/realtime-delta-handler.ts

### Configuration Examples

```json
{
  "scripts": {
    "dev:client": "npm run -w @game/client dev",
    "dev:full": "concurrently \"npm run -w @game/server dev\" \"npm run -w @game/client dev\""
  }
}
```

## Technical Scenarios

### Minimal Browser App Placement and Play Loop

A minimal Vite browser shell is introduced in apps/client, reusing existing client HTTP/session modules and server contracts. The shell runs independently while @game/server runs in parallel.

**Requirements:**

* Browser executable dev flow from workspace root.
* Connection and join handshake.
* Tile placement action.
* Server/state render loop in DOM/canvas.

**Preferred Approach:**

* Selected: scaffold a small Vite browser app inside apps/client and keep apps/client as the source of reusable client SDK code.
* Rationale:
  * Lowest repo churn and fastest path to playable loop.
  * Reuses existing tested callers and realtime handling patterns.
  * Avoids introducing a second app package before behavior is proven.

```text
apps/client/
  index.html                       (new)
  vite.config.ts                   (new)
  src/
    main.ts                        (new)
    browser/
      app.ts                       (new)
      env.ts                       (new)
      room.ts                      (new)
      api.ts                       (new)
      state.ts                     (new)
      render.ts                    (new)
      command-id.ts                (new, optional)
  package.json                     (update scripts/deps)

package.json                       (update root aliases)
```

**Implementation Details:**

* Dev commands:
  * Keep root npm run dev for server-only flow.
  * Add root npm run dev:client and npm run dev:full aliases.
  * Add apps/client dev/preview scripts.
* First-loop flow:
  * Acquire access token (real Entra/MSAL path).
  * GET /api/session/bootstrap.
  * POST /api/session/join-token with roomId arena.
  * Join Colyseus room arena using joinToken.
  * Subscribe to delta and send delta_ack.
  * POST /api/tiles/place from user action.
  * Render state from joined + delta updates.
* Browser compatibility:
  * Replace or isolate node:crypto usage in apps/client/src/session/replay-checksum.ts for browser entry path.

```ts
// Renderer contract sketch
export interface RenderModel {
  version: number;
  tiles: Record<string, { terrain: string; occupant: string | null }>;
}

export type RenderFn = (model: RenderModel) => void;
```

#### Considered Alternatives

* Alternative A: create a new top-level web package.
  * Rejected for now: cleaner long-term separation, but slower to first playable loop and more workspace plumbing today.
* Alternative B: static no-bundler page using compiled outputs.
  * Rejected: poor developer experience and higher friction for realtime/browser debugging.
* Alternative C: HTTP-only prototype before realtime join.
  * Rejected: does not meet requested connect/join/place/render realtime intent.

## Risks and Pitfalls

* Auth gating risk: protected routes and room join require valid bearer and signed join token.
* Browser crypto risk: node-only import can break browser builds if not isolated.
* Contract strictness risk: roomId enforcement and commandId validation will reject malformed requests.
* Domain outcome handling risk: 409 and 429 are expected operational states for placement and must be rendered.

## Implementation-Ready Checklist

* Add Vite browser shell files under apps/client.
* Add apps/client dev scripts and required dependencies.
* Add root aliases for dev:client and dev:full.
* Implement first-loop orchestration (bootstrap -> join token -> room join -> place -> render).
* Patch browser-incompatible checksum path.
* Validate with parallel server/client dev processes.

## Selected Approach Summary

Use apps/client as both SDK and minimal browser shell for now, with Vite-based dev runtime and direct reuse of existing session and realtime contracts. This yields the smallest change set that satisfies the requested first playable loop and can later split into a dedicated web package if UI scope grows.
