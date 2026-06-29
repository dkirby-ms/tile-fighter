---
title: codepath-placement-edit-research
description: Verified research on current tile placement/edit implementation across server, room/domain, client, and shared contracts.
ms.date: 2026-06-29
ms.topic: reference
---

## Research scope

1. Identify server endpoints/handlers/services for creating/updating tiles and any authorization checks.
2. Identify room/state/domain logic enforcing placement authority today.
3. Identify client-side behavior that currently performs optimistic updates or edit checks.
4. Identify shared types/contracts relevant to tile ownership, timestamps, and editability.
5. Provide exact file paths and line references for all findings.

## Status

Complete (codebase-level research for current implementation as of 2026-06-29).

## Findings

### 1) Server endpoints and handlers for tile create/update + auth checks

No current HTTP endpoint or handler exists for tile create/update operations.

Evidence:

* Express app wiring only mounts health, protected profile, and session routes:

```ts
app.use(createHealthRoutes(dependencies.readinessCheck));
app.use(dependencies.authMiddleware);
app.use(createProtectedRoutes());
app.use(
  createSessionRoutes({
    telemetrySink: dependencies.telemetrySink,
    authService: dependencies.authService,
    lifecycleService: dependencies.lifecycleService
  })
);
```

Source: apps/server/src/http/app.ts:22-32

* Session route file exposes bootstrap, join-token, heartbeat only:

```ts
router.get("/api/session/bootstrap", async (req, res) => { ... });
router.post("/api/session/join-token", async (req, res) => { ... });
router.post("/api/session/heartbeat", async (req, res) => { ... });
```

Source: apps/server/src/http/routes/session.routes.ts:50,101,139

* There is no `/api/tiles` route and no placement/edit route in current `apps/server/src/http/routes/*` files.

Auth checks currently in place (global middleware):

```ts
const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

try {
  const principal = await authService.verifyAccessToken(token);
  res.locals.principal = principal;
  next();
} catch {
  res.status(401).json({ error: "Unauthorized" });
}
```

Source: apps/server/src/http/auth-middleware.ts:10-19

Interpretation:

* Auth is enforced globally for mounted routes after health routes.
* No tile-specific HTTP authorization policy exists yet because no tile create/update endpoint is currently wired.

### 2) Room/state/domain logic enforcing placement authority today

No current Colyseus room message/command handling for tile placement or edit authority.

Evidence from room implementation:

```ts
override async onAuth(client: Client, options: JoinOptions): Promise<boolean> {
  const payload = this.authService.verifyJoinToken(options.joinToken ?? "", ArenaRoom.ROOM_KEY);
  (client as AuthedClient).auth = {
    tenantScopedSubject: payload.sub
  };
  return true;
}
```

Source: apps/server/src/rooms/arena.room.ts:37-43

This room currently does:

* Join-token verification in `onAuth`.
* Session lifecycle updates in `onJoin`/`onLeave`.
* Tick simulation in `setSimulationInterval`.

No `onMessage("tile_*", ...)` handlers are present.

Room state has only combat/tick fields:

```ts
export class ArenaState extends Schema {
  @type("number")
  tick = 0;

  @type("number")
  playerAHealth = 100;

  @type("number")
  playerBHealth = 100;
}
```

Source: apps/server/src/rooms/arena.state.ts:3-12

Domain service only mutates tick and health; no tile placement policy logic:

```ts
step(state: ArenaState): void {
  state.tick += 1;
  if (state.tick % 5 === 0) {
    state.playerAHealth = Math.max(0, state.playerAHealth - 1);
  }
  if (state.tick % 7 === 0) {
    state.playerBHealth = Math.max(0, state.playerBHealth - 1);
  }
}
```

Source: apps/server/src/domain/combat-simulation.service.ts:4-13

Interpretation:

* Placement/edit authority rules (owner checks, edit windows, occupancy decisions) are not implemented in room/state/domain yet.

### 3) Client behavior: optimistic updates or edit checks

No client-side tile placement/edit module exists in current client source.

Evidence:

* Client exports currently include auth/session bootstrap/join-token/heartbeat only:

```ts
export { getJoinToken } from "./auth/join-token-caller.js";
export { SessionBootstrapStore } from "./session/bootstrap-store.js";
export { sendHeartbeat } from "./session/heartbeat-caller.js";
```

Source: apps/client/src/index.ts:5,7,9

* No tile placement/edit calls or optimistic tile mutation logic found in `apps/client/src/**`.

Related network behavior that does exist:

* Join-token call handles token acquisition and one 401 retry:

```ts
const response = await fetch(joinTokenEndpoint, { ... });
if (response.status === 401) {
  const retryTokenState = await authSession.handleBootstrapUnauthorizedReacquire();
  ...
}
```

Source: apps/client/src/auth/join-token-caller.ts:24-55

* Bootstrap and heartbeat have similar token retry flow, but none perform tile placement/edit checks.

Sources:

* apps/client/src/session/bootstrap-store.ts:24-69
* apps/client/src/session/heartbeat-caller.ts:24-62

Interpretation:

* There is currently no optimistic tile placement/update behavior in shipped client code.
* There are currently no client-side editability checks (ownership, age window) in shipped client code.

### 4) Shared types/contracts for tile ownership, timestamps, editability

Shared package contracts currently do not define tile ownership/editability types.

Evidence:

```ts
export interface AuthenticatedPrincipal { ... }
export interface MatchTickSnapshot { ... }
export interface ReadinessReport { ... }
```

Source: packages/shared-types/src/index.ts:3-25

No tile DTO or editability contract is present in `packages/shared-types/src/index.ts`.

Current tile ownership/timestamp contract exists at server persistence layer:

* DB type definition includes `owner_id` and `created_at`:

```ts
type TilesTable = {
  ...
  owner_id: string;
  created_at: Date;
};
```

Source: apps/server/src/persistence/db.ts:13-25

* Migration DDL persists ownership and timestamp:

```js
owner_id: {
  type: "text",
  notNull: true
},
created_at: {
  type: "timestamptz",
  notNull: true,
  default: pgm.func("now()")
}
```

Source: apps/server/src/persistence/migrations/1720000000000_tiles.js:47-55

* Repository insert output exposes created timestamp and conflict semantics:

```ts
export type InsertTileResult =
  | { ok: true; tile: { id: number; createdAt: Date } }
  | { ok: false; reason: "coordinate_conflict"; error: TileConflictError };
```

Source: apps/server/src/persistence/tile.repository.ts:32-34

Editability contract status:

* No `updated_at` column in `tiles` schema.
* No edit window fields/policies in shared contracts.
* No ownership-based edit method in repository (insert/select only).

### 5) Placement-related service layer currently present

Tile persistence repository exists but is not currently wired to HTTP or room command handlers.

Repository capabilities:

```ts
insertTile(db, input)
selectTilesByRegion(db, regionId)
selectTileByCoordinate(db, regionId, cellX, cellY)
```

Source: apps/server/src/persistence/tile.repository.ts:39-53

Telemetry helpers exist for persistence events:

```ts
async emitTilePersisted(...)
async emitTilePersistConflict(...)
```

Source: apps/server/src/telemetry/telemetry-sink.ts:58-95

No call sites found in `apps/server/src/**` for:

* `createTileRepository`
* `emitTilePersisted`
* `emitTilePersistConflict`

Interpretation:

* Persistence primitives are implemented but not integrated into active placement/edit command flow yet.

## Planned vs implemented gap (supporting context)

Backlog documents specify intended behavior not yet implemented in runtime code:

```md
- User story: As a player, I can place a tile and edit my own tile within 10 minutes ...
- Technical notes: authoritative placement command handler with edit-window policy.
- Security and abuse checks required: per-account placement rate-limit; server-side owner check.
```

Source: docs/layer1-backlog.md:134-143

This aligns with observed code gaps above.

## Direct answers to requested goals

1. Server endpoints/handlers/services for creating/updating tiles + auth checks:
   * No tile create/update endpoints/handlers currently wired.
   * Existing auth middleware verifies bearer access token and sets `res.locals.principal` for protected routes.
   * Tile repository service exists (`insertTile`, `select*`) but is not connected to HTTP/room handlers.

2. Room/state/domain placement authority today:
   * No placement authority logic today.
   * Room enforces join-token auth only and tracks lifecycle; state/domain currently combat tick/health only.

3. Client optimistic updates/edit checks:
   * No tile optimistic update flow or editability checks in current client source.
   * Client currently handles auth/session bootstrap, join token, heartbeat network flows with 401 retry behavior.

4. Shared types/contracts for ownership/timestamps/editability:
   * Shared package does not define tile ownership/editability contracts yet.
   * Server persistence schema defines `owner_id` and `created_at`; no `updated_at` and no editability contract.

5. Exact file paths and line references:
   * Included throughout findings sections above.

## Suggested next research

* Trace recent commits/PRs for any unmerged tile placement/edit handler work to avoid duplicating design effort.
* Map expected command/event contract for tile placement (`tile_place`, `tile_edit`) across client-room-server boundaries before implementation.
* Define shared tile DTO types in `packages/shared-types` first, including editability fields and server-authoritative ack/reject payloads.
* Validate whether edit window policy should use server wall-clock time or room tick time, then codify one source of truth.

## Open clarifying questions

* Should tile editability be represented by absolute timestamp (`editableUntil`) or computed policy (`canEdit`) in API responses?
* Should tile placement/edit travel over HTTP, Colyseus messages, or both (write path vs sync path)?
* Is `updated_at` required in phase scope for edits, or is immutable create + replacement row model preferred?
