# Codebase Research: Layer1 Core Platform and Auth Session Spine

Date: 2026-06-28  
Scope: Current repository implementation coverage in /home/saitcho/tile-fighter for server auth/session platform spine (boot, auth service, middleware, protected routes, room auth, persistence/auth integration, env config, shutdown, tests, infra).

## 1) Inventory Of Relevant Files (with concise purpose + line-specific references)

- apps/server/src/index.ts
  - Purpose: Service bootstrap wiring for config, DB runtime/readiness, auth service, HTTP app, Colyseus room registration, graceful shutdown.
  - Evidence:
    - Runtime config + DB runtime startup/check: apps/server/src/index.ts:17-20
    - Auth service construction: apps/server/src/index.ts:22
    - Readiness check implementation: apps/server/src/index.ts:24-43
    - Auth middleware injection into app: apps/server/src/index.ts:45-48
    - Arena room registration with injected authService: apps/server/src/index.ts:55
    - Graceful shutdown registration: apps/server/src/index.ts:62-72

- apps/server/src/auth/auth-service.ts
  - Purpose: Token validation service wrapper around shared JWT validator configured by runtime env.
  - Evidence:
    - JwtValidationConfig construction using issuer/audience/JWKS + tenant controls: apps/server/src/auth/auth-service.ts:9-19
    - Enforce non-empty bearer token: apps/server/src/auth/auth-service.ts:24-27
    - Validate token and return principal: apps/server/src/auth/auth-service.ts:28

- apps/server/src/http/auth-middleware.ts
  - Purpose: Express auth middleware parsing Bearer token, validating, setting principal, and enforcing 401 on failure.
  - Evidence:
    - Authorization header parsing to bearer token: apps/server/src/http/auth-middleware.ts:10-11
    - Token validation and principal storage in res.locals: apps/server/src/http/auth-middleware.ts:14-15
    - Unauthorized response path: apps/server/src/http/auth-middleware.ts:17-18

- apps/server/src/http/app.ts
  - Purpose: HTTP pipeline assembly with health routes, then auth middleware, then protected routes.
  - Evidence:
    - Route/middleware order: health first, then auth middleware, then protected routes: apps/server/src/http/app.ts:16-18

- apps/server/src/http/routes/protected.routes.ts
  - Purpose: Current protected API endpoint returning principal profile subset.
  - Evidence:
    - Protected route: GET /api/protected/profile: apps/server/src/http/routes/protected.routes.ts:6
    - Response fields from principal: subject/issuer/tenantId: apps/server/src/http/routes/protected.routes.ts:7-12

- apps/server/src/http/routes/health.routes.ts
  - Purpose: Health/liveness and readiness endpoints.
  - Evidence:
    - /healthz always 200: apps/server/src/http/routes/health.routes.ts:7-9
    - /readyz delegates to readinessCheck and returns 200/503: apps/server/src/http/routes/health.routes.ts:11-14

- apps/server/src/rooms/arena.room.ts
  - Purpose: Colyseus room with auth gate on join path.
  - Evidence:
    - Auth service injected via room options on create: apps/server/src/rooms/arena.room.ts:16-18
    - Room join auth uses verifyAccessToken(options.token): apps/server/src/rooms/arena.room.ts:24-26
    - Join success returns true and emits joined message: apps/server/src/rooms/arena.room.ts:26-31

- apps/server/src/config/env.ts
  - Purpose: Runtime env schema parsing and auth tenancy configuration.
  - Evidence:
    - Required env vars (DB + Entra auth): apps/server/src/config/env.ts:6-18
    - TENANT_MODE single requires ENTRA_TENANT_ID: apps/server/src/config/env.ts:44-46
    - CSV parsing for allow/deny issuer/tenant lists: apps/server/src/config/env.ts:35-39, 57-59

- apps/server/src/persistence/db.ts
  - Purpose: Postgres/Kysely runtime creation, DB connectivity probe, and close lifecycle.
  - Evidence:
    - Pool and Kysely runtime setup: apps/server/src/persistence/db.ts:22-34
    - Readiness SQL connectivity check: apps/server/src/persistence/db.ts:37-39
    - Runtime shutdown (db destroy): apps/server/src/persistence/db.ts:41-43

- apps/server/src/persistence/migrations/1710000000000_init.js
  - Purpose: Initial persistence schema currently for match_events only.
  - Evidence:
    - Table creation match_events with room_id/tick/payload: apps/server/src/persistence/migrations/1710000000000_init.js:6-28
    - Index on room_id, tick: apps/server/src/persistence/migrations/1710000000000_init.js:31

- apps/server/src/shutdown/graceful-shutdown.ts
  - Purpose: Signal handlers for SIGTERM/SIGINT and process exit after onShutdown.
  - Evidence:
    - Signal registration and async shutdown callback: apps/server/src/shutdown/graceful-shutdown.ts:2-7
    - Always exits with code 0 in finally: apps/server/src/shutdown/graceful-shutdown.ts:8-11

- apps/server/tests/integration/http-auth.integration.test.ts
  - Purpose: Integration coverage for protected HTTP auth middleware behavior.
  - Evidence:
    - Unauthorized without token: apps/server/tests/integration/http-auth.integration.test.ts:7-27
    - Authorized profile response with bearer token: apps/server/tests/integration/http-auth.integration.test.ts:29-54

- apps/server/tests/unit/jwt-validation.test.ts
  - Purpose: Unit coverage for JWT validator correctness and key security checks.
  - Evidence:
    - Valid token accepted: apps/server/tests/unit/jwt-validation.test.ts:60-67
    - Wrong audience/issuer rejected: apps/server/tests/unit/jwt-validation.test.ts:69-79
    - Expired token rejected: apps/server/tests/unit/jwt-validation.test.ts:81-85
    - alg:none rejected: apps/server/tests/unit/jwt-validation.test.ts:87-103

- apps/server/tests/unit/room-auth.test.ts
  - Purpose: Unit coverage that room auth path verifies token.
  - Evidence:
    - onAuth calls verifyAccessToken(token): apps/server/tests/unit/room-auth.test.ts:5-15

- apps/server/tests/load/room-join-load.ts
  - Purpose: Load harness joining multiple rooms with bearer token and optional local auto-start.
  - Evidence:
    - Required server env for auto-start: apps/server/tests/load/room-join-load.ts:5-12
    - Join count, endpoint, token inputs: apps/server/tests/load/room-join-load.ts:120-123
    - Batch joinOrCreate("arena", { token }): apps/server/tests/load/room-join-load.ts:132-137

- apps/server/infra/containerapps/bicep/main.bicep
  - Purpose: Azure Container Apps deployment with health probes and secret-ref env wiring.
  - Evidence:
    - Auth and DB secret params: apps/server/infra/containerapps/bicep/main.bicep:33-52
    - Tenant mode parameter and allowed values: apps/server/infra/containerapps/bicep/main.bicep:28-31
    - Runtime env var + secretRef mapping: apps/server/infra/containerapps/bicep/main.bicep:109-152
    - Health/readiness/startup probes paths: apps/server/infra/containerapps/bicep/main.bicep:153-187

- apps/server/infra/containerapps/bicep/main.dev.bicepparam
  - Purpose: Dev deployment parameterization.
  - Evidence: tenantMode single and default image placeholder: apps/server/infra/containerapps/bicep/main.dev.bicepparam:3-8

- apps/server/infra/containerapps/bicep/main.prod.bicepparam
  - Purpose: Prod deployment parameterization.
  - Evidence: tenantMode single and default image placeholder: apps/server/infra/containerapps/bicep/main.prod.bicepparam:3-8

- apps/server/infra/containerapps/env/dev.env, apps/server/infra/containerapps/env/prod.env
  - Purpose: Environment contract files listing runtime env keys for deployment.
  - Evidence:
    - Required auth + DB runtime keys listed: apps/server/infra/containerapps/env/dev.env:1-8, apps/server/infra/containerapps/env/prod.env:1-8

- docs/layer1-backlog.md
  - Purpose: Likely epic intent and acceptance criteria baseline for Layer1 core platform/auth spine.
  - Evidence:
    - E1 scope statement: apps shell/auth handshake/session bootstrap/telemetry/health: docs/layer1-backlog.md:32
    - E1-S1 bootstrap + telemetry requirements: docs/layer1-backlog.md:47-55
    - E1-S2 join token issuance/TTL/replay expectations: docs/layer1-backlog.md:62-70
    - E1-S3 heartbeat/session lifecycle expectations: docs/layer1-backlog.md:77-85
    - E1-S4 protected route + verify expectations: docs/layer1-backlog.md:92-100

## 2) Existing Behaviors Currently Implemented

- Boot and readiness path exists and is functional at baseline.
  - Startup loads runtime config, creates DB runtime, and performs DB connectivity check before serving traffic (apps/server/src/index.ts:17-20).
  - Readiness endpoint executes live DB connectivity check and returns 503 on failure (apps/server/src/index.ts:24-43, apps/server/src/http/routes/health.routes.ts:11-14).

- HTTP auth middleware exists and protects non-health routes.
  - Middleware extracts Bearer token and validates via AuthService/JwtValidator; principal is stored in res.locals for route handlers (apps/server/src/http/auth-middleware.ts:10-15).
  - Middleware returns generic 401 Unauthorized on auth failures (apps/server/src/http/auth-middleware.ts:17-18).
  - Pipeline order makes health routes public while protected routes require auth (apps/server/src/http/app.ts:16-18).

- Protected profile endpoint exists.
  - GET /api/protected/profile returns principal-derived profile data (subject, issuer, tenantId) after middleware auth (apps/server/src/http/routes/protected.routes.ts:6-12).

- Room join auth gate exists.
  - Arena room validates token during onAuth and blocks join if validation throws (apps/server/src/rooms/arena.room.ts:24-26).
  - Room auth currently reuses same access token path rather than a dedicated short-lived join credential (apps/server/src/rooms/arena.room.ts:24-26).

- JWT validation baseline appears robust through shared-auth usage.
  - Auth service enforces RS256 and tenant/issuer/audience settings from env (apps/server/src/auth/auth-service.ts:9-19).
  - Empty token is explicitly rejected early (apps/server/src/auth/auth-service.ts:24-27).
  - Unit tests verify wrong aud/iss/exp and alg:none rejection (apps/server/tests/unit/jwt-validation.test.ts:69-103).

- Shutdown lifecycle exists.
  - SIGTERM/SIGINT triggers shutdown callback; bootstrap handler shuts down game server, closes Node server, and destroys DB runtime (apps/server/src/index.ts:62-72; apps/server/src/shutdown/graceful-shutdown.ts:2-11).

- Persistence integration exists for connectivity and one migration, not auth/session state.
  - DB runtime and readiness SQL integrated in startup path (apps/server/src/persistence/db.ts:22-39; apps/server/src/index.ts:17-20).
  - Existing schema is match_events only (apps/server/src/persistence/migrations/1710000000000_init.js:6-31).

- Deployment wiring includes auth/session-critical envs and health probes.
  - Bicep maps DB/auth env vars from secrets and configures health/readiness/startup probes (apps/server/infra/containerapps/bicep/main.bicep:109-187).

## 3) Gaps, Risks, and Likely Missing Capabilities For A Robust Core Platform/Auth Session Spine

- Missing session bootstrap endpoint/contract.
  - No dedicated session bootstrap route found (e.g., endpoint returning player context + region seed described in E1-S1).
  - Current protected profile endpoint is minimal and not equivalent to bootstrap semantics (apps/server/src/http/routes/protected.routes.ts:6-12 vs docs/layer1-backlog.md:49-52).

- Missing dedicated room join token issuance and validation flow.
  - E1-S2 expects short-lived signed room token with TTL/replay controls; implementation currently validates provided token directly in room onAuth with no mint/refresh/replay controls in server code (apps/server/src/rooms/arena.room.ts:24-26; docs/layer1-backlog.md:64-70).

- Missing explicit session telemetry and lifecycle instrumentation.
  - E1-S1/E1-S3 telemetry events (session_started/session_bootstrap_failed/session_heartbeat/session_ended/presence_cleared) are not emitted in current server paths.
  - No heartbeat channel or stale-session cleanup behavior in room/server code for auth/session spine.

- Missing auth abuse controls for bootstrap/join.
  - No server-side evidence of IP/session rate limiting or replay nonce windows for auth/session endpoints described by backlog.

- Error handling and diagnostics granularity risk.
  - Auth middleware collapses all failures to generic 401 (good non-leaky output), but there is no structured internal metric/log mapping by failure class for operational diagnosis (issuer mismatch vs expiry vs key fetch issues).

- Graceful shutdown idempotency/exit behavior risk.
  - Signal handler always process.exit(0) in finally regardless of shutdown failures, risking false-success termination semantics and potentially masking teardown errors (apps/server/src/shutdown/graceful-shutdown.ts:8-11).

- Persistence/auth-session integration gap.
  - No persistence layer for session state, auth session tracking, join token metadata, heartbeat presence, or auth telemetry storage.
  - Existing migration covers only match_events, not session/auth platform tables (apps/server/src/persistence/migrations/1710000000000_init.js:6-31).

## 4) Testing Coverage Assessment (unit/integration/load) And Gaps

Current coverage present:
- Unit:
  - JWT validation correctness/security checks (aud/iss/exp/alg none): apps/server/tests/unit/jwt-validation.test.ts:60-103.
  - Room onAuth invokes token verification: apps/server/tests/unit/room-auth.test.ts:5-15.
- Integration:
  - Protected route unauthorized/authorized behavior through middleware: apps/server/tests/integration/http-auth.integration.test.ts:7-54.
- Load:
  - Room join load harness exists and can auto-start local server if env complete; uses token-based join: apps/server/tests/load/room-join-load.ts:5-12,120-137.

Major testing gaps for E1 auth/session spine intent:
- No integration tests for session bootstrap endpoint behavior (valid/invalid token responses and payload contract).
- No tests for telemetry event emission (`session_started`, `session_bootstrap_failed`, `session_heartbeat`, `session_ended`).
- No unit/integration tests for room join credential minting/TTL/replay invalidation (because feature appears unimplemented).
- No auth rate-limit tests (IP/session bootstrap/join abuse cases).
- Limited room auth test depth: no negative-path test in room unit test for invalid/expired token rejection behavior.
- Load harness validates join throughput path but does not currently assert auth failure handling, reconnect behavior, or latency SLO contracts from E1/E3 acceptance criteria.

## 5) Deployment/Infra Implications (Bicep/Container Apps/Env) And Gaps

What exists:
- Container Apps deployment has env wiring for auth and DB secrets and probe coverage for health/readiness/startup (apps/server/infra/containerapps/bicep/main.bicep:109-187).
- Tenant mode parameterized at infra and passed as runtime env (`TENANT_MODE`) (apps/server/infra/containerapps/bicep/main.bicep:28-31,121-124).
- Dev/prod parameter files and env contracts align on required auth/runtime keys (apps/server/infra/containerapps/bicep/main.dev.bicepparam:3-8; apps/server/infra/containerapps/bicep/main.prod.bicepparam:3-8; apps/server/infra/containerapps/env/dev.env:1-8; apps/server/infra/containerapps/env/prod.env:1-8).

Likely infra/platform gaps vs robust auth/session spine:
- No explicit infra inputs for telemetry sink/observability endpoint required to operationalize session lifecycle metrics.
- No explicit auth abuse controls at ingress/app gateway level documented in these server infra assets (rate limits/WAF policy linkage not visible in scoped files).
- No explicit join-token secret/signing material settings distinct from access token validation path.
- Revision mode defaults to Multiple in params; robust verify/rollback gating depends on external workflows (documented elsewhere), but this research scope found no in-code/runtime verification that promotion blocks on protected-route + room auth smoke outcomes.

## 6) Evidence Log (exact file references + commands/search patterns)

Commands/search patterns executed during this research:
- Cross-scope discovery:
  - rg -n "auth|jwt|session|middleware|protected|room|shutdown|graceful|env|persistence|db|migration|token|verify" apps/server/src apps/server/tests apps/server/infra apps/server/README.md docs README.md
- Line-reference extraction:
  - nl -ba apps/server/src/index.ts
  - nl -ba apps/server/src/auth/auth-service.ts
  - nl -ba apps/server/src/http/auth-middleware.ts
  - nl -ba apps/server/src/http/app.ts
  - nl -ba apps/server/src/http/routes/protected.routes.ts
  - nl -ba apps/server/src/http/routes/health.routes.ts
  - nl -ba apps/server/src/rooms/arena.room.ts
  - nl -ba apps/server/src/config/env.ts
  - nl -ba apps/server/src/persistence/db.ts
  - nl -ba apps/server/src/persistence/migrations/1710000000000_init.js
  - nl -ba apps/server/src/shutdown/graceful-shutdown.ts
  - nl -ba apps/server/tests/integration/http-auth.integration.test.ts
  - nl -ba apps/server/tests/unit/jwt-validation.test.ts
  - nl -ba apps/server/tests/unit/room-auth.test.ts
  - nl -ba apps/server/tests/load/room-join-load.ts
  - nl -ba apps/server/infra/containerapps/bicep/main.bicep
  - nl -ba apps/server/infra/containerapps/bicep/main.dev.bicepparam
  - nl -ba apps/server/infra/containerapps/bicep/main.prod.bicepparam
  - nl -ba apps/server/infra/containerapps/env/dev.env
  - nl -ba apps/server/infra/containerapps/env/prod.env
  - nl -ba docs/layer1-backlog.md | sed -n '1,260p'

Primary documents/code files used as evidence:
- apps/server/src/index.ts
- apps/server/src/auth/auth-service.ts
- apps/server/src/http/auth-middleware.ts
- apps/server/src/http/app.ts
- apps/server/src/http/routes/protected.routes.ts
- apps/server/src/http/routes/health.routes.ts
- apps/server/src/rooms/arena.room.ts
- apps/server/src/config/env.ts
- apps/server/src/persistence/db.ts
- apps/server/src/persistence/migrations/1710000000000_init.js
- apps/server/src/shutdown/graceful-shutdown.ts
- apps/server/tests/integration/http-auth.integration.test.ts
- apps/server/tests/unit/jwt-validation.test.ts
- apps/server/tests/unit/room-auth.test.ts
- apps/server/tests/load/room-join-load.ts
- apps/server/infra/containerapps/bicep/main.bicep
- apps/server/infra/containerapps/bicep/main.dev.bicepparam
- apps/server/infra/containerapps/bicep/main.prod.bicepparam
- apps/server/infra/containerapps/env/dev.env
- apps/server/infra/containerapps/env/prod.env
- docs/layer1-backlog.md

## Follow-on Clarifying Questions (cannot be fully answered from current code alone)

- Is the intended E1-S1 bootstrap route expected to be HTTP-only, WebSocket handshake metadata, or both?
- Should E1-S2 room join tokens be separate JWTs minted by server with independent signing secret/key, or delegated to existing identity provider claims?
- What is the source-of-truth sink for required telemetry events (App Insights, OpenTelemetry collector, custom DB table, or external stream)?
- Are auth abuse controls expected at app layer, ingress layer, or both for Layer1 acceptance?
