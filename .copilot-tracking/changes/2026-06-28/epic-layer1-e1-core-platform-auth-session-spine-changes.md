<!-- markdownlint-disable-file -->
# Release Changes: Epic Layer1 E1 Core Platform and Auth Session Spine

**Related Plan**: .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md
**Implementation Date**: 2026-06-28

## Summary

Implemented Implementation Phase 1 (E1-S1), Implementation Phase 2 (E1-S2), Implementation Phase 3 (E1-S3), and Implementation Phase 4 (E1-S4): External ID OAuth bootstrap, short-lived join-token room admission, non-authoritative lifecycle/heartbeat metadata hygiene, and verification/p50 evidence gates.

## Changes

### Added

* apps/server/src/telemetry/telemetry-sink.ts
* apps/server/src/http/routes/session.routes.ts
* apps/server/tests/integration/session-bootstrap.integration.test.ts
* apps/server/src/auth/join-token.service.ts
* apps/server/tests/unit/join-token.service.test.ts
* apps/server/tests/integration/join-token.integration.test.ts
* apps/server/src/session/session-lifecycle.service.ts
* apps/server/tests/unit/session-lifecycle.service.test.ts
* apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts
* apps/client/package.json
* apps/client/tsconfig.json
* apps/client/src/auth/msal-config.ts
* apps/client/src/auth/external-id-session.ts
* apps/client/src/session/bootstrap-store.ts

### Modified

* packages/shared-types/src/index.ts
* packages/shared-auth/src/index.ts
* apps/server/src/config/env.ts
* apps/server/src/auth/auth-service.ts
* apps/server/src/http/app.ts
* apps/server/src/http/routes/session.routes.ts
* apps/server/src/http/routes/protected.routes.ts
* apps/server/src/index.ts
* apps/server/src/http/app.ts
* apps/server/tests/load/room-join-load.ts
* apps/server/tests/integration/http-auth.integration.test.ts
* apps/server/tests/integration/session-bootstrap.integration.test.ts
* apps/server/tests/integration/join-token.integration.test.ts
* apps/server/tests/unit/jwt-validation.test.ts
* apps/server/tests/unit/room-auth.test.ts
* apps/server/src/rooms/arena.room.ts
* apps/server/src/config/env.ts
* .env.example
* apps/client/package.json
* apps/server/package.json
* package-lock.json
* apps/server/README.md
* docs/layer1-backlog.md
* docs/cicd-harness.md
* .github/workflows/verify-release.yml
* tsconfig.json

### Removed

* None yet.

## Additional or Deviating Changes

* Added new workspace [apps/client](apps/client) to host the shell OAuth implementation surface requested in Step 1.3.
* Extended protected profile payload with `tenantScopedSubject` and `tokenVersion` as additive fields.
* Updated room-admission verification contract to use stable room key (`arena`) for join-token verification path used by load/verify harness.
* Full validation load run is blocked locally without required runtime env vars (`DATABASE_URL`, `ENTRA_ISSUER`, `ENTRA_AUDIENCE`, `ENTRA_JWKS_URL`, `TENANT_MODE`).

## Validation

* `npm run -w @game/server test -- session-bootstrap.integration.test.ts` - pass (1 file, 3 tests passed)
* `npm run -w @game/server test -- join-token.integration.test.ts` - pass (1 file, 3 tests passed)
* `npm run -w @game/server test -- join-token.service.test.ts` - pass (1 file, 5 tests passed)
* `npm run -w @game/server test -- heartbeat-lifecycle.integration.test.ts` - pass (1 file, 2 tests passed)
* `npm run -w @game/server test -- session-lifecycle.service.test.ts` - pass (1 file, 2 tests passed)
* `npx prettier --check .github/workflows/*.yml docs/cicd-harness.md docs/layer1-backlog.md` - pass
* `npm run lint` - pass
* `npm run test` - pass
* `npm run -w @game/server build` - pass
* `npm run build` - pass
* `npm run -w @game/server test:load` - blocked locally (missing required env vars for auto-start harness)

## Release Summary

Phases 1-4 are implemented and validated with verification gate and p50 evidence output support. Phase 5 full validation completed for lint/test/build; load validation remains environment-blocked locally pending required runtime auth/database env values or execution in provisioned verify environment.
