# Epic 1 Issue Gap Analysis Research

## Topic
Updated epic 1 gap state for tile-fighter after the client Entra auth coverage update.

## Status
Complete. The updated issue set for #9, #10, and #11 is reflected in the execution artifacts, and the server-side E1 slices are implemented. The remaining gaps are client caller coverage, client test coverage, and telemetry/event-name alignment.

## Sources Inspected
- .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md
- .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md
- .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md
- .copilot-tracking/github-issues/execution/2026-06-29-client-entra-auth/issues-plan.md
- .copilot-tracking/github-issues/execution/2026-06-29-client-entra-auth/handoff-logs.md
- apps/client/src/auth/external-id-session.ts
- apps/client/src/auth/msal-config.ts
- apps/client/src/session/bootstrap-store.ts
- apps/server/src/auth/auth-service.ts
- apps/server/src/auth/join-token.service.ts
- apps/server/src/config/env.ts
- apps/server/src/http/auth-middleware.ts
- apps/server/src/http/routes/session.routes.ts
- apps/server/src/rooms/arena.room.ts
- apps/server/src/session/session-lifecycle.service.ts
- packages/shared-auth/src/index.ts
- packages/shared-types/src/index.ts
- apps/server/tests/integration/session-bootstrap.integration.test.ts
- apps/server/tests/integration/join-token.integration.test.ts
- apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts
- apps/server/tests/unit/join-token.service.test.ts
- apps/server/tests/unit/jwt-validation.test.ts
- apps/server/tests/unit/session-lifecycle.service.test.ts

## Plan and Log State
The older E1 epic plan treats E1-S1 through E1-S4 as implementation-ready, completed slices with concrete file/test references. The companion log records implementation deviations and says the only blocking item is local validation environment setup.

The newer 2026-06-29 client Entra coverage-update plan is still unchecked and explicitly asks for client-authenticated caller coverage, plan-language updates, and client test coverage. That confirms the gap is still open in planning artifacts even though the issue update log says the story-level updates were applied.

Evidence:
- .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md:56-112
- .copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md:125-127
- .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md:10-37
- .copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md:41-47
- .copilot-tracking/plans/2026-06-29/client-entra-auth-coverage-update-plan.instructions.md:45-76
- .copilot-tracking/plans/2026-06-29/client-entra-auth-coverage-update-plan.instructions.md:88-94
- .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md:1-16

## Updated Issue Requirements
The updated issue plan for #9, #10, and #11 explicitly adds client-side bearer-token attachment, one-time silent reacquire retry, and interaction-required fallback semantics.

Evidence:
- .copilot-tracking/github-issues/execution/2026-06-29-client-entra-auth/issues-plan.md:10-62
- .copilot-tracking/github-issues/execution/2026-06-29-client-entra-auth/issues-plan.md:68-120
- .copilot-tracking/github-issues/execution/2026-06-29-client-entra-auth/issues-plan.md:126-178
- .copilot-tracking/github-issues/execution/2026-06-29-client-entra-auth/handoff-logs.md:17-47

## Verified Implemented Coverage

### #9 E1-S1 authenticated session bootstrap
Implemented on the client and server.
- Client state machine models External ID token acquisition and interactive fallback in apps/client/src/auth/external-id-session.ts:10-21, 34-95.
- Client bootstrap store attaches the bearer token, retries once on 401, and forces interactive auth if retry cannot recover in apps/client/src/session/bootstrap-store.ts:24-68.
- Client MSAL config is wired to a single API scope in apps/client/src/auth/msal-config.ts:3-27.
- Server bootstrap route returns shell init metadata and session_started telemetry in apps/server/src/http/routes/session.routes.ts:15-49.
- Shared JWT validation enforces issuer, audience, token version, tenant policy, and tenant-scoped subject rules in packages/shared-auth/src/index.ts:43-79, 128-156.
- Server and shared auth tests cover bootstrap auth, token validation, issuer/audience/token-version rules, and telemetry behavior in apps/server/tests/integration/session-bootstrap.integration.test.ts:17-142 and apps/server/tests/unit/jwt-validation.test.ts:61-110.

### #10 E1-S2 room join token issuance
Implemented on the server and room auth path.
- JoinTokenService issues signed room tokens, enforces TTL, validates room mismatch, and blocks replay in apps/server/src/auth/join-token.service.ts:28-64, 67-119.
- AuthService wires join-token issuance and verification to runtime config in apps/server/src/auth/auth-service.ts:10-44.
- Session routes expose POST /api/session/join-token and emit join-token telemetry in apps/server/src/http/routes/session.routes.ts:52-79.
- ArenaRoom verifies join tokens in onAuth and binds the tenant-scoped subject into room lifecycle hooks in apps/server/src/rooms/arena.room.ts:37-57.
- Unit and integration tests cover token mint/verify, replay rejection, authenticated join-token issuance, unauthorized requests, and roomId validation in apps/server/tests/unit/join-token.service.test.ts:4-68 and apps/server/tests/integration/join-token.integration.test.ts:17-129.

### #11 E1-S3 session heartbeat lifecycle
Implemented on the server and lifecycle adapter.
- Session routes expose POST /api/session/heartbeat and call the lifecycle service in apps/server/src/http/routes/session.routes.ts:82-92.
- SessionLifecycleService stores auxiliary presence metadata, updates heartbeat timestamps, and removes stale entries on cleanup in apps/server/src/session/session-lifecycle.service.ts:17-121.
- ArenaRoom calls noteRoomJoin and noteRoomLeave from room lifecycle hooks in apps/server/src/rooms/arena.room.ts:45-57.
- Integration and unit tests cover authenticated heartbeat acceptance, stale metadata cleanup, and room-membership separation in apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts:9-76 and apps/server/tests/unit/session-lifecycle.service.test.ts:4-48.

## Confirmed Gaps
- There is no client-side join-token caller surface in apps/client/src. The client tree only contains auth/ and session/, and grep results found only bootstrap/auth-session code, not join-token or heartbeat request code. That means the updated #10 requirement for client bearer attachment and one-time silent retry on join-token calls is not implemented in the shell yet.
- There is no client-side heartbeat caller surface in apps/client/src. That means the updated #11 requirement for client bearer attachment and one-time silent retry on heartbeat calls is not implemented in the shell yet.
- There are no dedicated client test files in apps/client, so the updated client retry/fallback behavior is not directly tested in the client package.
- The heartbeat telemetry contract does not match the issue plan. The issue plan expects session_heartbeat, session_ended, and presence_cleared, but the current code emits session_heartbeat, session_transport_join, session_transport_leave, and session_metadata_stale instead.
- The join-token telemetry contract also appears mismatched. The issue plan expects room_join_token_issued and room_join_token_rejected, while the current code emits session_join_token_issued and session_join_token_failed.

## Likely Gaps / Partial Coverage
- apps/client/src/auth/external-id-session.ts defines bootstrap-in-flight and bootstrap-failed in the state union, but no runtime method actually transitions into those states. The implemented flow only returns token-ready, interaction-required, or bootstrap-failed from silent acquisition and unauthorized retry paths.
- The server-side implementation satisfies the authenticated bootstrap and room admission paths, but the updated issue text now expects client-side caller behavior for #10 and #11. That client-side portion is not present in the workspace.

## Bottom Line
- Already implemented: server bootstrap, join-token issuance, room admission, heartbeat persistence/cleanup, JWT validation, and the main E1 server tests.
- Still missing: shell caller paths for join-token and heartbeat, dedicated client tests, and telemetry-name alignment with the updated issue wording.

## Follow-Up Research Needed
- Determine whether the join-token and heartbeat client callers exist in another workspace or are intended to be added later.
- Confirm whether telemetry names should be updated to match the issue plan, or whether the issue plan should be revised to the existing session_* event names.
- Verify whether session_ended should be emitted on clean room disconnect from ArenaRoom.onLeave instead of session_transport_leave.
- Check whether bootstrap-in-flight and bootstrap-failed are intended to be real runtime states or only documentation vocabulary.
