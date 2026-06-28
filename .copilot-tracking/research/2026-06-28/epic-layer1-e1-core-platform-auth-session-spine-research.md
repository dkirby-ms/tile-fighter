<!-- markdownlint-disable-file -->
# Task Research: Epic Layer1 E1 Core Platform and Auth Session Spine (Issue #1)

Research what is needed to deliver GitHub issue #1 for the tile-fighter repository: epic(layer1): E1 core platform and auth session spine.

## Task Implementation Requests

* Identify required implementation scope for Issue #1.
* Map current repository state to expected epic outcomes and gaps.
* Evaluate implementation alternatives and recommend one approach.

## Scope and Success Criteria

* Scope: Repository evidence, issue details, existing architecture/docs/tests/infra related to core platform and auth session spine.
* Assumptions:
  * Issue #1 is the canonical epic record for E1 (Issue #41 is duplicate).
  * E1 stories map to E1-S1 through E1-S4 and should be delivered as one cohesive backbone.
  * Player authentication is backed by a dedicated Microsoft Entra External ID tenant using OAuth/OIDC, and the shell must acquire a game-API access token before bootstrap.
  * "Authenticated player reaches playable shell in <5s p50" is an acceptance target requiring measurable validation from token-ready state for returning players, not from first interactive sign-in.
* Success Criteria:
  * Epic scope is translated into concrete technical workstreams.
  * Gaps are evidenced with file-level references and/or issue content.
  * One recommended delivery approach is selected with rationale.

## Outline

1. Capture issue #1 requirements and intent.
2. Inventory existing implementation related to platform + auth/session.
3. Identify missing pieces, risks, and sequencing constraints.
4. Evaluate alternatives for implementation sequencing.
5. Select a recommended approach and actionable next steps.

## Potential Next Research

* Resolve canonical E1 story issue set (#9-#12 vs #49-#52) and close tracking ambiguity.
  * Reasoning: duplicate story sets create uncertainty in burn-down and completion signals.
  * Reference: GitHub issue list and timeline findings.
* Validate CI gating and smoke checks for protected routes + room joins.
  * Reasoning: issue exit criteria require measurable checks in pipeline.
  * Reference: docs/cicd-harness.md and workflow files.
* Define and align "playable shell" contract and p50 measurement method.
  * Reasoning: acceptance criterion is currently broad and may be interpreted differently.
  * Reference: Issue #1 exit criteria plus E1-S1 deliverables.

## Research Executed

### File Analysis

* docs/layer1-backlog.md
  * E1 scope and intended deliverables include bootstrap, join credential, heartbeat lifecycle, protected verification gates.
  * Evidence lines cited by subagent: 32, 47-55, 62-70, 77-85, 92-100.
* apps/server/src/index.ts
  * Startup orchestration already wires config, DB readiness, auth service, app startup, room registration, graceful shutdown.
  * Evidence lines: 17-20, 22, 24-43, 45-48, 55, 62-72.
* apps/server/src/http/routes/protected.routes.ts
  * Existing protected route returns minimal principal profile only; no bootstrap payload contract.
  * Evidence lines: 6-12.
* apps/server/src/rooms/arena.room.ts
  * Room onAuth validates supplied token directly via auth service; no dedicated join-token lifecycle.
  * Evidence lines: 24-26.
* apps/server/tests/* and apps/server/infra/containerapps/*
  * Baseline coverage exists for JWT validation, HTTP auth integration, room auth call path, and health/readiness probes in infra.

### Code Search Results

* Search patterns included: auth|jwt|session|middleware|protected|room|shutdown|env|persistence|token|verify.
* No dedicated "bootstrap" endpoint implementation surfaced in server source tree.
* No dedicated "join token issuance" service/route implementation surfaced in server source tree.
* No explicit session heartbeat lifecycle manager/cleanup implementation surfaced in server source tree.

### External Research

* GitHub issue metadata and timeline via gh CLI
  * Issue #1 is open, priority:p1, milestone Layer 1 MVP, no assignee.
  * Explicit in-scope includes session bootstrap, join-token issuance, heartbeat lifecycle, verification harness.
  * Exit criteria include authenticated playable shell <5s p50 and health/readiness/protected-route smoke checks.
  * Timeline cross-reference indicates Issue #41 is duplicate.

### Project Conventions

* Standards referenced:
  * Research-only output under .copilot-tracking/research/**
  * Consolidated evidence and one selected approach with alternatives retained
* Instructions followed:
  * Task Researcher mode constraints
  * No non-research file modifications

## Key Discoveries

### External ID Addendum

* The current server-side auth layer already validates Entra-issued JWTs, but the plan must no longer assume E1 starts with a bearer token already on the client.
* E1-S1 needs an explicit shell auth acquisition contract for OAuth 2.0 authorization code flow with PKCE against an Entra External ID tenant, with silent acquisition before bootstrap and interactive fallback when required.
* The API access token issued by the External ID tenant should remain distinct from the short-lived room join token planned for E1-S2.
* CI verification cannot rely only on an opaque static bearer token secret; it must document token provenance and, where feasible, validate the External ID token minting path or authority contract.
* The existing `/v2.0` issuer and discovery endpoint shape in sample configuration is compatible with planning around a dedicated External ID tenant, but the plan must pin issuer, audience, and token-version expectations explicitly.

### Project Structure

* The server already has a usable platform spine for startup, env parsing, DB readiness, auth middleware, protected route, room auth gating, and shutdown handling.
* Infrastructure deployment already includes auth/DB env wiring and probe definitions for liveness/readiness/startup.
* The epic asks for additional auth/session lifecycle capabilities beyond the current baseline, not a greenfield platform build.

### Implementation Patterns

* Auth validation is centralized through AuthService wrapping shared JWT validation config.
* HTTP route protection is middleware-driven with principal materialization into response locals.
* Room authorization currently mirrors HTTP bearer token validation, suggesting a common trust root but no scoped room-join credential layer.
* Persistence currently supports connectivity checks and match events, but not session/auth lifecycle state.

### Complete Examples

```ts
// Current route stack: health is public, everything after uses auth middleware.
app.use(healthRoutes(readinessCheck));
app.use(createAuthMiddleware(authService));
app.use(protectedRoutes());

// Current room auth path uses provided token directly.
public async onAuth(_client, options: { token?: string }) {
  await this.authService.verifyAccessToken(options.token);
  return true;
}
```

### API and Schema Documentation

* Issue #1 required outcome (epic level):
  * in-scope: session bootstrap, join-token issuance, heartbeat lifecycle, verification harness
  * out-of-scope: progression profiles, social graph/friends
  * exit: playable shell <5s p50 + smoke checks
* Story tracking ambiguity exists due to two E1 story sets (#9-#12 open/partial close, #49-#52 closed).

### Configuration Examples

```bicep
@allowed([
  'single'
  'multi'
])
param tenantMode string = 'single'

// Container app probes already configured:
// /healthz, /readyz startup/readiness/liveness probes
```

## Technical Scenarios

### Epic Delivery Strategy for Layer1 Core Platform/Auth Spine

Deliver E1 as an incremental hardening and capability-extension effort on top of the existing server/auth baseline, not as a platform rewrite, while making the browser shell and server explicitly target OAuth-backed player sign-in through a Microsoft Entra External ID tenant.

**Requirements:**

* Define the shell-side OAuth/OIDC token acquisition contract for External ID-backed player auth, including silent acquisition, interactive fallback, and bounded retry behavior before bootstrap.
* Implement authenticated session bootstrap contract (E1-S1).
* Implement dedicated short-lived room join credential issuance and validation for Colyseus-compatible room admission (E1-S2).
* Implement Colyseus lifecycle-driven presence hygiene with heartbeat as auxiliary metadata and stale-metadata cleanup semantics (E1-S3).
* Maintain and expand protected-route plus health/readiness verification harness (E1-S4).
* Validate acceptance target: authenticated playable shell <5s p50 from token-ready state for returning players, with first interactive sign-in measured separately if needed.
* Preserve Colyseus room lifecycle and admission semantics as the only multiplayer room-membership authority.
* Keep the External ID access token as the protected API credential only, and never reuse it as the room credential.

**Preferred Approach:**

* Approach C (selected): Thin vertical slices by story sequence on existing architecture.
* Rationale:
  * Preserves proven startup/auth foundations and reduces regression risk.
  * Adds missing capabilities in clear contract boundaries (bootstrap API, join token service, heartbeat lifecycle manager).
  * Enables test-first verification per slice and measurable progress against epic exit criteria.

```text
apps/server/src/
  auth/
    auth-service.ts                 # extend with join token mint/verify methods
    join-token.service.ts           # new: signed short-lived room credential issuer/validator
  http/routes/
    session.routes.ts               # new: bootstrap endpoint + heartbeat endpoint(s)
  session/
    session-lifecycle.service.ts    # new: heartbeat TTL and cleanup orchestration
  rooms/
    arena.room.ts                   # change: accept room join token contract
apps/server/tests/
  integration/
    session-bootstrap.integration.test.ts
    join-token.integration.test.ts
    heartbeat-lifecycle.integration.test.ts
  unit/
    join-token.service.test.ts
    session-lifecycle.service.test.ts
docs/
  layer1-backlog.md                 # optional: canonical story links cleanup
apps/web/ or shell client
  session store + OAuth state       # planned client-side token acquisition/retry state for External ID-backed bootstrap
```

**Implementation Details:**

1. Story E1-S1: Session bootstrap
  * Define browser-shell OAuth assumptions for authorization code with PKCE against the External ID tenant.
  * Attempt silent token acquisition before bootstrap and fall back to interactive sign-in only when required.
   * Add protected bootstrap endpoint returning normalized shell-init payload.
   * Include telemetry hooks for success/failure timing and cause class.
   * Add integration tests for unauthorized, authorized, and payload contract assertions.

2. Story E1-S2: Join-token issuance
  * Introduce server-issued short-lived join token signed with dedicated key/secret and claims bound to room + subject + expiry + nonce/jti.
  * Keep the upstream External ID access token scoped to protected HTTP APIs and separate from room admission.
  * Update room `onAuth` to validate join token rather than raw access token while preserving Colyseus lifecycle authority for room membership.
   * Add replay prevention strategy (nonce/jti cache window) and tests for expiry/replay/room mismatch.

3. Story E1-S3: Heartbeat lifecycle
  * Add lifecycle adapter that consumes Colyseus lifecycle transitions (`onJoin`, `onLeave`, disconnect/reconnect path) and tracks auxiliary heartbeat metadata.
  * Add periodic cleanup for stale metadata/presence and emit lifecycle telemetry events.
  * Add integration tests for timeout and cleanup behaviors, including assertions that room membership remains Colyseus-managed.

4. Story E1-S4: Verification gate
  * Expand smoke harness to include protected bootstrap success and room join token path.
  * Document verification-token provenance from the External ID tenant, including issuing authority, API audience, and test-player source.
   * Ensure CI gate covers readiness + protected route + room auth flow.
  * Capture p50 startup metric evidence for epic closure using token-ready start semantics for returning players.

```text
Key dependencies and sequencing:
S1 -> S2 -> S3 -> S4 gate tightening
Auth middleware + shared JWT validation remain stable baseline
Infra env additions needed for join-token signing secret, telemetry sink config, and External ID authority/audience/client-registration contract documentation
Colyseus lifecycle hooks remain authoritative for multiplayer room-membership transitions
```

#### Considered Alternatives

* Approach A: Full auth/session subsystem rewrite first
  * Rejected because it introduces unnecessary risk and delay given existing working baseline in startup/auth middleware/room auth.
* Approach B: Minimal patch only for protected route smoke and defer S2/S3
  * Rejected because it fails issue in-scope requirements (join-token issuance, heartbeat lifecycle) and would not satisfy epic definition.
* Approach C: Incremental vertical slices on existing spine (selected)
  * Selected for lowest regression risk, clear testability, and direct alignment with E1 scope and acceptance criteria.
