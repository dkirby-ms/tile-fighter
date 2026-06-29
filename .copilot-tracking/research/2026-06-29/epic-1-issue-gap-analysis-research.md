<!-- markdownlint-disable-file -->
# Task Research: Epic 1 issue gap analysis

Review epic 1 against the updated issue set for #9, #10, and #11, then identify what work is still missing or only partially complete.

## Task Implementation Requests

* Compare the current epic 1 plan and implementation state against the updated issue requirements for #9, #10, and #11.
* Identify gaps, partial implementations, and any follow-up work that still needs to be done.

## Scope and Success Criteria

* Scope: Epic 1 deliverables and the updated requirements for issues #9, #10, and #11.
* Assumptions: The updated issue descriptions are authoritative for the gap review.
* Success Criteria:
  * A clear list of completed vs missing items for each updated issue.
  * Evidence-backed identification of the highest-priority remaining gaps.

## Outline

* Current epic 1 state
* Updated issue #9 gap analysis
* Updated issue #10 gap analysis
* Updated issue #11 gap analysis
* Consolidated missing work
* Recommended next actions

## Potential Next Research

* Verify whether the remaining gaps are already covered by adjacent epic 1 tickets.
  * Reasoning: Some gaps may be intentionally deferred to later work.
  * Reference: Epic 1 backlog and linked issue notes.

## Research Executed

### File Analysis
Complete. The updated issue set for #9, #10, and #11 is reflected in the execution artifacts, and most of epic 1 is already implemented on the server side. The remaining gaps are the client caller surfaces for join-token and heartbeat, client-level test coverage for the updated retry/fallback behavior, and telemetry/event-name alignment with the updated issue text.
* Pending
The older E1 epic plan treats E1-S1 through E1-S4 as implementation-ready, completed slices with concrete file/test references. The companion log records implementation deviations and says the only blocking item is local validation environment setup.

The newer 2026-06-29 client Entra coverage-update plan is still unchecked and explicitly asks for client-authenticated caller coverage and client test coverage. That confirms the gap is still open in planning artifacts even though the issue update log says the story-level updates were applied.
* Pending
Implemented on the client and server.
- Client state machine models External ID token acquisition and interactive fallback in apps/client/src/auth/external-id-session.ts.
- Client bootstrap store attaches the bearer token, retries once on 401, and forces interactive auth if retry cannot recover in apps/client/src/session/bootstrap-store.ts.
- Client MSAL config is wired to a single API scope in apps/client/src/auth/msal-config.ts.
- Server bootstrap route returns shell init metadata and session_started telemetry in apps/server/src/http/routes/session.routes.ts.
- Shared JWT validation enforces issuer, audience, token version, tenant policy, and tenant-scoped subject rules in packages/shared-auth/src/index.ts.
- Server and shared auth tests cover bootstrap auth, token validation, issuer/audience/token-version rules, and telemetry behavior in apps/server/tests/integration/session-bootstrap.integration.test.ts and apps/server/tests/unit/jwt-validation.test.ts.
* Standards referenced: Epic 1 planning artifacts and issue updates.
Implemented on the server and room auth path.
- JoinTokenService issues signed room tokens, enforces TTL, validates room mismatch, and blocks replay in apps/server/src/auth/join-token.service.ts.
- AuthService wires join-token issuance and verification to runtime config in apps/server/src/auth/auth-service.ts.
- Session routes expose POST /api/session/join-token and emit join-token telemetry in apps/server/src/http/routes/session.routes.ts.
- ArenaRoom verifies join tokens in onAuth and binds the tenant-scoped subject into room lifecycle hooks in apps/server/src/rooms/arena.room.ts.
- Unit and integration tests cover token mint/verify, replay rejection, authenticated join-token issuance, unauthorized requests, and roomId validation in apps/server/tests/unit/join-token.service.test.ts and apps/server/tests/integration/join-token.integration.test.ts.
Pending.
Implemented on the server and lifecycle adapter.
- Session routes expose POST /api/session/heartbeat and call the lifecycle service in apps/server/src/http/routes/session.routes.ts.
- SessionLifecycleService stores auxiliary presence metadata, updates heartbeat timestamps, and removes stale entries on cleanup in apps/server/src/session/session-lifecycle.service.ts.
- ArenaRoom calls noteRoomJoin and noteRoomLeave from room lifecycle hooks in apps/server/src/rooms/arena.room.ts.
- Integration and unit tests cover authenticated heartbeat acceptance, stale metadata cleanup, and room-membership separation in apps/server/tests/integration/heartbeat-lifecycle.integration.test.ts and apps/server/tests/unit/session-lifecycle.service.test.ts.
### Complete Examples
- There is no client-side join-token caller surface in apps/client/src. The client tree only contains auth/ and session/, and grep results found only bootstrap/auth-session code, not join-token request code. That means the updated #10 requirement for client bearer attachment and one-time silent retry on join-token calls is not implemented in the shell yet.
- There is no client-side heartbeat caller surface in apps/client/src. That means the updated #11 requirement for client bearer attachment and one-time silent retry on heartbeat calls is not implemented in the shell yet.
- There are no dedicated client test files in apps/client, so the updated client retry/fallback behavior is not directly tested in the client package.
- The heartbeat telemetry contract does not match the issue plan. The issue plan expects session_heartbeat, session_ended, and presence_cleared, but the current code emits session_heartbeat, session_transport_join, session_transport_leave, and session_metadata_stale instead.
- The join-token telemetry contract also appears mismatched. The issue plan expects room_join_token_issued and room_join_token_rejected, while the current code emits session_join_token_issued and session_join_token_failed.
### API and Schema Documentation
- apps/client/src/auth/external-id-session.ts defines bootstrap-in-flight and bootstrap-failed in the state union, but no runtime method actually transitions into those states. The implemented flow only returns token-ready, interaction-required, or bootstrap-failed from silent acquisition and unauthorized retry paths.
- The server-side implementation satisfies the authenticated bootstrap and room admission paths, but the updated issue text now expects client-side caller behavior for #10 and #11. That client-side portion is not present in the workspace.

### Configuration Examples

```text
Pending.
```

## Technical Scenarios

### Epic 1 gap review

Compare delivery against the updated issue criteria.

**Requirements:**

* Determine what has been completed.
* Identify missing or partial work.
* Separate confirmed gaps from inferred gaps.

**Preferred Approach:**

* Use the updated issue artifacts as the source of truth and cross-check against the epic 1 plan plus implementation evidence.

```text
.copilot-tracking/plans/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-plan.instructions.md
.copilot-tracking/plans/logs/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-log.md
.copilot-tracking/plans/2026-06-29/client-entra-auth-coverage-update-log.md
```

**Implementation Details:**

* Focus on mismatches between planned coverage and delivered artifacts.
* Capture missing tests, missing client/server auth behavior, and missing integration coverage if present.

```text
Pending.
```

#### Considered Alternatives

* Reviewing only the plan file without the updated issue logs was rejected because it would miss the new gap definitions.
