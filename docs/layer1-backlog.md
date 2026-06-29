---
title: Layer 1 Implementation Backlog
description: Execution-ready, dependency-aware backlog for Chroma Commons Layer 1 MVP aligned to the 7-point SDLC harness
author: GitHub Copilot
ms.date: 2026-06-28
ms.topic: reference
keywords:
  - backlog
  - mvp
  - layer 1
  - sprint planning
  - github issues
estimated_reading_time: 35
---

## Assumptions

- Existing repo foundations remain in place (TypeScript monorepo, auth middleware, Colyseus room scaffolding, CI workflows).
- Layer 1 scope is strictly limited to persistent tile creation, deterministic bonding, lightweight social, and baseline moderation.
- Mobile is view-first in Layer 1, with limited editing support only.
- Solo-dev sustainable throughput for planning is 18-24 story points per 2-week sprint.
- GitHub issues are the execution system of record; this document is the design-time backlog snapshot.

## 1. MVP outcome statement

Playable Layer 1 means any authenticated player can open the web client, place tiles on a persistent shared canvas, immediately see deterministic bonding effects, and see those updates synchronize to nearby players in near-real time with median placement acknowledgement under 200 ms in target conditions. Players can browse with pan/zoom, react with hearts, publish and discover map pins, and report abusive creations. Operations can validate 50 CCU, deploy immutable artifacts safely by environment, verify post-deploy health and protected flows, and perform rollback with a documented, exercised procedure.

## 2. Epic map (ordered by dependency)

| Epic ID | Name                                            | Why now                                            | In-scope                                                                                                       | Out-of-scope                                        | Primary risks                               | Harness mapping | Exit criteria                                                                         |
| ------- | ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| E1      | Core Platform and Auth Session Spine            | Enables every other gameplay flow                  | session bootstrap, auth handshake, health probes, session telemetry                                            | social graph, profile progression                   | token/session mismatch, startup fragility   | 1,2,6           | token-ready to authenticated room join in <5s p50; health/ready/protected smoke green |
| E2      | Authoritative Tile State and Persistence        | Core world truth before multiplayer polish         | tile schema, placement rules, edit window, snapshots                                                           | deletion undo systems, ownership markets            | data consistency, write amplification       | 1,2             | placement rules deterministic; snapshots restorable without state drift               |
| E3      | Real-time Sync and Room Reliability             | Multiplayer credibility hinges on sync             | room join/rejoin, ordered diffs, conflict handling, 50 CCU runbook                                             | cross-region migration, >50 CCU scale-out           | dropped updates, reconnect churn            | 2,6,7           | 50 CCU test passes; reconnect recovers state within 3s p95                            |
| E4      | Deterministic Bonding Engine and Visual Effects | Core delight mechanic must be correct              | glow/blend/pulse logic, local recalculation, visual hooks                                                      | advanced chain combos (Layer 2+)                    | non-determinism, expensive recalcs          | 1,2,6           | bond outputs are deterministic in test corpus and stable under load                   |
| E5      | Creator UX, Navigation, and Accessibility       | Fast path to creation and retention                | palette + shape picker, placement preview, pan/zoom, onboarding, a11y toggles                                  | deep mobile editor parity, cosmetics UI             | interaction complexity, accessibility debt  | 2,6             | first tile placement in <30s for new session; keyboard + reduced motion usable        |
| E6      | Simple Social: Hearts, Pins, Shared Discovery   | Layer 1 community loop requires lightweight social | heart reaction, cluster counts, pin publish/list, shared pin browsing                                          | ranking feed, guild hubs, recommendation engine     | spam abuse, hot-spot contention             | 1,2,3           | hearts and pins functional with abuse limits; shared list supports discovery          |
| E7      | Moderation Baseline: Report and Review          | Minimum safe operations for UGC                    | report submission, review queue, audit log, decision workflow                                                  | automated takedown ML, player block/mute (Layer 2)  | moderation backlog, insufficient evidence   | 3,6,7           | report-to-decision path operational with audit records and on-call runbook            |
| E8      | Release Hardening and Live Operations           | Converts internal playable to launch candidate     | harness gates, immutable artifacts, env-safe deploy, verification, rollback drills, crash-free/perf dashboards | monetization release gates, advanced SRE automation | deployment regression, rollback uncertainty | 2,3,4,5,6,7     | release pipeline passes end-to-end and rollback drill succeeds in staging             |

## 3. Story backlog per epic

### E1 stories

#### E1-S1

- User story: As a player, I can open the game shell and establish an authenticated session so I can enter the shared world.
- Acceptance criteria:
  - Given shell state token-ready after External ID OAuth acquisition, when bootstrap runs, then session bootstrap returns player context and shell init metadata.
  - Given invalid token, when bootstrap runs, then access is denied with a non-leaky error code.
  - Given bootstrap receives 401, when the client performs one silent reacquire attempt, then bootstrap retries exactly once.
  - Given bounded retry still returns unauthorized, when retry completes, then the client transitions to interaction-required and stops silent retry loops.
  - Given bootstrap success, when telemetry initializes, then session_started is emitted once.
- Technical notes: shell uses External ID OAuth authorization code with PKCE and state machine `signed-out`, `acquiring-token-silently`, `interaction-required`, `token-ready`, `bootstrap-in-flight`, `bootstrap-failed`; server auth middleware + bootstrap endpoint; bounded retry policy (`maxBootstrap401Retry=1`).
- Test requirements: unit (token parser and version pinning), integration (bootstrap auth + telemetry), smoke (open shell path from token-ready state).
- Telemetry events required: `session_started`, `session_bootstrap_failed`.
- Security and abuse checks required: JWT issuer/audience/token-version validation, tenant-scoped subject normalization, IP/session rate-limit on bootstrap.
- External ID registration contract:
  - Shell app registration client ID must request delegated scope for `api://tile-fighter-server/access_as_user`.
  - Game API registration must expose the `api://tile-fighter-server` audience and accept only External ID tenant issuer `.../v2.0`.
  - Authority and user-flow ownership must be tenant-controlled in the dedicated player External ID tenant.
- Dependencies: none.
- Estimate: 3.
- Confidence: High.

#### E1-S2

- User story: As a player, I can request a signed room join credential so room access remains authoritative.
- Acceptance criteria:
  - Given an authenticated session, when join token is requested, then the client attaches an Authorization bearer token and server returns a short-lived signed room token.
  - Given the first join-token request returns 401, when client performs one silent reacquire, then request retries exactly once.
  - Given retry remains unauthorized, when retry completes, then client transitions to interaction-required terminal fallback.
  - Given expired join token, when room join is attempted, then join is rejected and refresh path is offered.
  - Given valid join token, when join occurs, then server binds player identity to room presence.
- Technical notes: auth service token minting; room admission guard.
- Test requirements: unit (token mint/verify), integration (join token flow), smoke (join protected room).
- Telemetry events required: `room_join_token_issued`, `room_join_token_rejected`.
- Security and abuse checks required: token TTL <= 120s; replay nonce validation.
- Dependencies: E1-S1.
- Estimate: 3.
- Confidence: High.

#### E1-S3

- User story: As an operator, I can observe session liveness so I can detect churn and startup failures.
- Acceptance criteria:
  - Given an active session, when heartbeat interval elapses, then client heartbeat request includes Authorization bearer token and server persists session_heartbeat.
  - Given first heartbeat call returns 401, when client silently reacquires token once, then heartbeat retries exactly once.
  - Given retry remains unauthorized, when retry completes, then client transitions to interaction-required terminal fallback and heartbeat loop stops until re-auth.
  - Given heartbeat timeout, when server marks stale session, then player presence is cleared.
  - Given session end, when client disconnects cleanly, then session_ended is emitted.
- Technical notes: heartbeat channel in room + telemetry sink.
- Test requirements: unit (timeout rules), integration (presence cleanup), load (heartbeat overhead check).
- Telemetry events required: `session_heartbeat`, `session_ended`, `presence_cleared`.
- Security and abuse checks required: heartbeat flood throttling per session.
- Dependencies: E1-S2.
- Estimate: 2.
- Confidence: High.

#### E1-S4

- User story: As a release engineer, I can run service health and protected-route smoke checks to gate promotion.
- Acceptance criteria:
  - Given a deployment, when `/healthz` and `/readyz` are called, then both return success.
  - Given a valid token, when `/api/protected/profile` is called, then profile payload is returned.
  - Given smoke failure, when workflow runs, then release stage blocks promotion.
- Technical notes: workflow wiring to existing verify pipeline and env secrets.
- Test requirements: integration (endpoint checks), smoke (pipeline gate), operations drill (failure path).
- Telemetry events required: `verify_health_passed`, `verify_health_failed`.
- Security and abuse checks required: protected route auth validation in verification harness.
- Dependencies: E1-S1.
- Estimate: 2.
- Confidence: High.

### E2 stories

#### E2-S1

- User story: As a server, I can persist tile entities with ownership and timestamps so world state is durable.
- Acceptance criteria:
  - Given a tile placement command, when persisted, then row stores shape/color/position/owner/created_at.
  - Given duplicate coordinates, when insert is attempted, then constraint violation returns deterministic conflict.
  - Given migration run, when schema applies, then indexes exist for region and coordinate lookup.
- Technical notes: DB migration + repository layer.
- Test requirements: unit (repository), integration (migration + insert conflict), smoke (startup migration).
- Telemetry events required: `tile_persisted`, `tile_persist_conflict`.
- Security and abuse checks required: parameterized queries; owner id not client-trusted.
- Dependencies: E1-S1.
- Estimate: 3.
- Confidence: High.

#### E2-S2

- User story: As a player, I can place a tile and edit my own tile within 10 minutes so collaboration remains fair.
- Acceptance criteria:
  - Given/When/Then: empty coordinate -> placement accepted with ack
  - Given/When/Then: occupied coordinate -> placement rejected with occupied reason
  - Given/When/Then: own tile older than 10m -> edit denied
- Technical notes: authoritative placement command handler with edit-window policy.
- Test requirements: unit (window policy), integration (place/edit/occupied), load (hot-cell contention).
- Telemetry events required: `tile_placed`, `tile_place_rejected`, `tile_edited`.
- Security and abuse checks required: per-account placement rate-limit; server-side owner check.
- Policy defaults for this remediation cycle (pending PD-01 decision due 2026-07-02):
  - Default placement throttle key is account plus region.
  - Default throttle window is 60 seconds.
  - Default rejection contract is HTTP 429 with deterministic error payload.
- Dependencies: E2-S1.
- Estimate: 5.
- Confidence: Med.

#### E2-S3

- User story: As an operator, I can restore a region snapshot so service recovery is predictable.
- Acceptance criteria:
  - Given/When/Then: snapshot trigger -> immutable snapshot metadata written
  - Given/When/Then: region failure -> replay restores last consistent snapshot
  - Given/When/Then: post-replay check -> expected hash matches
- Technical notes: snapshot worker + replay command path.
- Test requirements: integration (snapshot/replay), smoke (restore drill), ops test (failure simulation).
- Telemetry events required: `snapshot_created`, `snapshot_restore_started`, `snapshot_restore_completed`.
- Security and abuse checks required: restricted replay command to operator role.
- Dependencies: E2-S2.
- Estimate: 5.
- Confidence: Med.

#### E2-S4

- User story: As a client, I can request region tile diffs so I only fetch nearby state.
- Acceptance criteria:
  - Given/When/Then: viewport request -> only relevant region tiles returned
  - Given/When/Then: unchanged version -> empty diff response
  - Given/When/Then: stale version -> incremental updates returned
- Technical notes: region-version index and diff endpoint.
- Test requirements: unit (diff assembler), integration (versioned diff), load (read amplification).
- Telemetry events required: `tile_diff_requested`, `tile_diff_returned`.
- Security and abuse checks required: query bounding and max payload limits.
- Policy defaults for this remediation cycle (pending PD-03/PD-04/PD-05 decisions due 2026-07-02):
  - Default diff delete semantics include explicit `delete` operations so stale clients can remove tiles deterministically.
  - Default hard limits are env-configurable with conservative caps enforced server-side.
  - Default authorization model requires active membership for the requested region before diff retrieval.
- Dependencies: E2-S1.
- Estimate: 3.
- Confidence: Med.

### E3 stories

#### E3-S1

- User story: As a player, I can join and rejoin a room without desync after network interruptions.
- Acceptance criteria:
  - Given first join, when socket connects, then current region state initializes.
  - Given transient disconnect, when reconnect within grace period, then session resumes same player identity.
  - Given reconnect, when state replay completes, then client region checksum matches server checksum.
- Technical notes: Colyseus room lifecycle and reconnect token.
- Test requirements: integration (join/rejoin), smoke (drop/reconnect), load (mass reconnect).
- Telemetry events required: `room_joined`, `room_rejoined`, `room_rejoin_failed`.
- Security and abuse checks required: reconnect token validation; stale-token rejection.
- Dependencies: E1-S2, E2-S4.
- Estimate: 5.
- Confidence: Med.

#### E3-S2

- User story: As a nearby player, I receive ordered placement deltas so world state appears consistent.
- Acceptance criteria:
  - Given two placements in order, when broadcast happens, then all subscribers apply same order.
  - Given ack timeout, when retransmit policy triggers, then missed delta is resent once.
  - Given message replay, when duplicate delta arrives, then client ignores duplicate via sequence id.
- Technical notes: sequence IDs and delta ack strategy.
- Test requirements: unit (sequence validation), integration (ordered fanout), load (ack timeout rates).
- Telemetry events required: `delta_sent`, `delta_acked`, `delta_retransmitted`.
- Security and abuse checks required: per-connection outbound cap to prevent amplification abuse.
- Dependencies: E3-S1, E2-S2.
- Estimate: 5.
- Confidence: Med.

#### E3-S3

- User story: As the server, I resolve concurrent placement conflicts deterministically.
- Acceptance criteria:
  - Given simultaneous claims for one coordinate, when commands race, then deterministic winner rule applies.
  - Given loser command, when rejected, then response includes idempotent conflict code.
  - Given retry from same command id, when processed, then duplicate side effects are prevented.
- Technical notes: command idempotency key + optimistic transaction boundary.
- Test requirements: unit (winner rule), integration (race simulation), load (conflict hotspots).
- Telemetry events required: `placement_conflict_detected`, `placement_conflict_resolved`.
- Security and abuse checks required: command-id entropy and replay window checks.
- Dependencies: E2-S2.
- Estimate: 3.
- Confidence: Med.

#### E3-S4

- User story: As a producer, I can validate 50 CCU and placement ack latency under 200 ms median.
- Acceptance criteria:
  - Given load harness at 50 CCU, when run for 30 minutes, then median ack latency is <200 ms.
  - Given load run, when completed, then p95 reconnect <3s and error budget is within threshold.
  - Given regression beyond budget, when CI load job runs, then release candidate is blocked.
- Technical notes: test/load harness + metrics export.
- Test requirements: load (50 CCU scenario), integration (metrics ingestion), smoke (quick 10 CCU sanity).
- Telemetry events required: `load_run_started`, `load_run_completed`, `latency_budget_violation`.
- Security and abuse checks required: synthetic load credentials isolated from production users.
- Dependencies: E3-S2, E3-S3.
- Estimate: 5.
- Confidence: Med.

### E4 stories

#### E4-S1

- User story: As a player, bonding outcomes are predictable so I can create intentionally.
- Acceptance criteria:
  - Given same-hue adjacency, when evaluator runs, then glow-chain bond type is emitted.
  - Given two-color adjacency, when evaluator runs, then blend-gradient bond type is emitted.
  - Given alternating pair pattern, when evaluator runs, then pulse-rhythm bond type is emitted.
- Technical notes: pure bonding evaluator in shared domain module.
- Test requirements: unit (rule matrix), integration (placement triggers), property-based deterministic tests.
- Telemetry events required: `bonding_triggered` with bond type.
- Security and abuse checks required: input bounds validation for tile attributes.
- Dependencies: E2-S2.
- Estimate: 5.
- Confidence: High.

#### E4-S2

- User story: As the server, I recalculate only local neighborhoods so bonding stays fast.
- Acceptance criteria:
  - Given tile placement, when recompute runs, then only local neighborhood cells are evaluated.
  - Given no adjacency change, when recompute runs, then no redundant bond events publish.
  - Given burst placement, when recompute queue drains, then queue lag remains within budget.
- Technical notes: neighborhood index and bounded recompute queue.
- Test requirements: unit (neighborhood bounds), integration (event publish correctness), load (burst writes).
- Telemetry events required: `bond_recalc_started`, `bond_recalc_completed`, `bond_recalc_skipped`.
- Security and abuse checks required: queue flood protection by account/IP.
- Dependencies: E4-S1, E3-S2.
- Estimate: 3.
- Confidence: Med.

#### E4-S3

- User story: As a player, I see bond visuals with accessibility-safe motion settings.
- Acceptance criteria:
  - Given bond event, when client renders, then correct visual effect appears at tile region.
  - Given reduced motion enabled, when bond event renders, then animation intensity is reduced.
  - Given low-end device mode, when many effects are active, then frame pacing remains stable.
- Technical notes: client render layer and effect quality tiers.
- Test requirements: integration (event-to-render), smoke (reduced motion toggle), perf (FPS budget).
- Telemetry events required: `bond_effect_rendered`, `reduced_motion_enabled`.
- Security and abuse checks required: render payload validation against malformed events.
- Dependencies: E4-S2, E5-S2.
- Estimate: 3.
- Confidence: Med.

#### E4-S4

- User story: As QA, I can run a regression suite proving bond reliability across updates.
- Acceptance criteria:
  - Given fixture maps, when regression suite runs, then bond outputs match golden snapshots.
  - Given random seed corpus, when evaluator runs twice, then outputs are identical.
  - Given release candidate build, when suite runs in CI, then failure blocks merge.
- Technical notes: deterministic fixture pack and golden comparison harness.
- Test requirements: unit + integration + CI regression gate.
- Telemetry events required: `bond_regression_passed`, `bond_regression_failed`.
- Security and abuse checks required: fixture sanitization to prevent unsafe test payloads.
- Dependencies: E4-S1, E8-S1.
- Estimate: 3.
- Confidence: High.

### E5 stories

#### E5-S1

- User story: As a creator, I can pick shape/color and preview placement before committing.
- Acceptance criteria:
  - Given palette open, when shape and color are selected, then preview updates instantly.
  - Given occupied cell hover, when preview appears, then blocked indicator is shown.
  - Given valid cell click, when place command sends, then optimistic indicator appears until ack.
- Technical notes: client tool state and occupancy preview adapter.
- Test requirements: unit (tool reducer), integration (preview + place), smoke (basic creation flow).
- Telemetry events required: `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`.
- Security and abuse checks required: sanitize client inputs before command submit.
- Dependencies: E2-S2.
- Estimate: 3.
- Confidence: High.

#### E5-S2

- User story: As a player, I can pan/zoom smoothly and only render visible map content.
- Acceptance criteria:
  - Given viewport movement, when panning occurs, then camera updates without input lag.
  - Given zoom changes, when level changes, then tile legibility remains acceptable.
  - Given off-screen tiles, when render pass runs, then culling prevents unnecessary draw.
- Technical notes: camera controller + spatial culling.
- Test requirements: unit (camera math), integration (viewport fetch), perf (FPS and memory budget).
- Telemetry events required: `viewport_changed`, `zoom_level_changed`.
- Security and abuse checks required: bounded viewport request ranges.
- Dependencies: E2-S4.
- Estimate: 5.
- Confidence: Med.

#### E5-S3

- User story: As a first-time player, I can place my first tile in under 30 seconds.
- Acceptance criteria:
  - Given first session, when tutorial overlay appears, then user can skip or complete in <=30 seconds.
  - Given tutorial completion, when first tile placed, then confirmation callout appears once.
  - Given first session analytics, when measured, then p50 time-to-first-tile <=30 seconds.
- Technical notes: lightweight onboarding stepper and success metric capture.
- Test requirements: integration (tutorial path), smoke (skip path), analytics validation test.
- Telemetry events required: `tutorial_started`, `tutorial_completed`, `first_tile_time_recorded`.
- Security and abuse checks required: no PII in onboarding telemetry payload.
- Dependencies: E5-S1.
- Estimate: 3.
- Confidence: Med.

#### E5-S4

- User story: As a player with accessibility needs, I can use keyboard controls and contrast/motion settings.
- Acceptance criteria:
  - Given keyboard-only mode, when navigating tools, then placement is possible without pointer.
  - Given high-contrast mode, when toggled, then UI and tile edges meet readability target.
  - Given reduced motion, when enabled, then bond animations use low-motion variant.
- Technical notes: accessibility settings panel + input map.
- Test requirements: integration (keyboard flow), smoke (mode toggles), accessibility audit.
- Telemetry events required: `a11y_mode_enabled`, `keyboard_placement_used`.
- Security and abuse checks required: client settings isolation per account session.
- Dependencies: E5-S1, E4-S3.
- Estimate: 3.
- Confidence: Med.

### E6 stories

#### E6-S1

- User story: As a player, I can give one heart reaction to a creation cluster.
- Acceptance criteria:
  - Given eligible cluster, when heart is submitted, then reaction is counted once.
  - Given same user retries, when duplicate reaction is sent, then duplicate is rejected.
  - Given reaction accepted, when nearby clients sync, then count updates.
- Technical notes: reaction endpoint with `(user,cluster)` uniqueness.
- Test requirements: unit (dedupe key), integration (reaction sync), load (reaction bursts).
- Telemetry events required: `reaction_given`, `reaction_rejected_duplicate`.
- Security and abuse checks required: rate-limit reactions per account/IP.
- Dependencies: E3-S2, E2-S4.
- Estimate: 3.
- Confidence: High.

#### E6-S2

- User story: As a viewer, I can see heart counts on clusters to find active creations.
- Acceptance criteria:
  - Given cluster with reactions, when viewed, then aggregated count appears.
  - Given count updates, when delta arrives, then UI count refreshes within 1 second.
  - Given no reactions, when cluster shown, then count badge is hidden.
- Technical notes: cluster aggregation query + client overlay.
- Test requirements: unit (aggregation), integration (overlay update), smoke (zero-count behavior).
- Telemetry events required: `reaction_count_viewed`.
- Security and abuse checks required: server-side aggregation only; no client count trust.
- Dependencies: E6-S1.
- Estimate: 2.
- Confidence: High.

#### E6-S3

- User story: As a player, I can create map pins and publish them to a shared list.
- Acceptance criteria:
  - Given map coordinate and title, when pin is created, then pin persists with author and timestamp.
  - Given publish toggle on, when saved, then pin appears in shared pin feed.
  - Given invalid coordinate/title, when submit occurs, then validation message is returned.
- Technical notes: pins table + publish field + basic validation.
- Test requirements: unit (validation), integration (create/list), smoke (publish path).
- Telemetry events required: `pin_created`, `pin_published`, `pin_create_failed`.
- Security and abuse checks required: input sanitization and profanity filter hook placeholder.
- Dependencies: E2-S1, E5-S2.
- Estimate: 3.
- Confidence: Med.

#### E6-S4

- User story: As a player, I can browse shared pins and jump my camera to them.
- Acceptance criteria:
  - Given shared pin list, when opened, then items load in deterministic sort order.
  - Given pin selected, when jump action triggers, then camera centers on target region.
  - Given stale/deleted pin, when selected, then graceful fallback message appears.
- Technical notes: shared pin feed endpoint + camera jump command.
- Test requirements: integration (list + jump), smoke (stale pin handling), perf (list size budget).
- Telemetry events required: `pin_list_viewed`, `pin_jump_used`.
- Security and abuse checks required: bounded query pagination and anti-scrape throttling.
- Dependencies: E6-S3, E5-S2.
- Estimate: 2.
- Confidence: Med.

### E7 stories

#### E7-S1

- User story: As a player, I can report an inappropriate tile cluster for review.
- Acceptance criteria:
  - Given cluster selected, when report submitted with reason, then report record is stored.
  - Given report throttle exceeded, when submit occurs, then request is rejected gracefully.
  - Given report accepted, when queued, then moderation queue receives item with evidence links.
- Technical notes: report endpoint + queue integration.
- Test requirements: unit (reason validation), integration (report enqueue), load (spam throttle).
- Telemetry events required: `report_submitted`, `report_rejected_rate_limited`.
- Security and abuse checks required: abuse throttles and payload sanitation.
- Dependencies: E2-S4, E6-S4.
- Estimate: 3.
- Confidence: Med.

#### E7-S2

- User story: As a moderator, I can review reports in a minimal internal tool and set disposition.
- Acceptance criteria:
  - Given pending reports, when queue screen loads, then oldest-first items are visible.
  - Given disposition action, when reviewer marks outcome, then status updates atomically.
  - Given already resolved item, when action retried, then duplicate action is blocked.
- Technical notes: internal review page + moderation API state machine.
- Test requirements: integration (review flow), smoke (state transitions), role-access test.
- Telemetry events required: `report_review_started`, `report_disposition_set`.
- Security and abuse checks required: role-based access control and audit identity capture.
- Dependencies: E7-S1.
- Estimate: 5.
- Confidence: Med.

#### E7-S3

- User story: As compliance support, I can see immutable moderation audit trails.
- Acceptance criteria:
  - Given any moderation action, when committed, then audit record stores actor, action, target, timestamp.
  - Given audit lookup, when filtered by report id, then full action history is returned.
  - Given tamper attempt, when write-once policy applies, then mutation is denied.
- Technical notes: append-only audit table and query endpoint.
- Test requirements: unit (audit writer), integration (history retrieval), smoke (tamper denial).
- Telemetry events required: `moderation_audit_written`, `moderation_audit_query`.
- Security and abuse checks required: append-only constraints and privileged read controls.
- Dependencies: E7-S2.
- Estimate: 3.
- Confidence: Med.

#### E7-S4

- User story: As on-call, I have a moderation incident runbook and escalation flow.
- Acceptance criteria:
  - Given spike in reports, when threshold exceeded, then alert event is generated.
  - Given incident declared, when runbook followed, then mitigation steps are trackable.
  - Given post-incident review, when completed, then action items are logged.
- Technical notes: operational docs + alert thresholds.
- Test requirements: operations game-day simulation + smoke alert test.
- Telemetry events required: `moderation_alert_triggered`, `incident_declared`, `incident_closed`.
- Security and abuse checks required: restricted incident channel access.
- Dependencies: E7-S2, E8-S4.
- Estimate: 2.
- Confidence: Med.

### E8 stories

#### E8-S1

- User story: As a developer, every merge runs deterministic build, type-safety, and required test gates.
- Acceptance criteria:
  - Given pull request build, when CI runs, then lockfile-true install and typecheck must pass.
  - Given test suites, when CI runs, then unit/integration gates are required for merge.
  - Given flaky test detection, when threshold exceeded, then build marks unstable.
- Technical notes: workflow hardening around existing CI.
- Test requirements: smoke (pipeline), integration (gate orchestration).
- Telemetry events required: `ci_gate_passed`, `ci_gate_failed`.
- Security and abuse checks required: dependency audit high/critical fail remains enforced.
- Dependencies: E1-S4.
- Estimate: 3.
- Confidence: High.

#### E8-S2

- User story: As release engineering, every deploy uses immutable image artifacts and env-safe parameters.
- Acceptance criteria:
  - Given release build, when image is pushed, then SHA-tag immutable artifact is produced.
  - Given deploy invocation, when env parameters applied, then secret values come from environment secrets only.
  - Given artifact provenance check, when release runs, then deployed revision matches expected SHA.
- Technical notes: release workflow and Bicep parameter enforcement.
- Test requirements: integration (release job), smoke (artifact-to-revision trace).
- Telemetry events required: `release_artifact_built`, `release_deploy_started`, `release_deploy_completed`.
- Security and abuse checks required: Trivy high/critical gating and secret-source validation.
- Dependencies: E8-S1.
- Estimate: 5.
- Confidence: High.

#### E8-S3

- User story: As QA, I can execute post-deploy verification including auth and room join smoke.
- Acceptance criteria:
  - Given successful deploy, when verify workflow runs, then health/ready/protected route checks pass.
  - Given load smoke command, when executed, then authenticated room join smoke passes.
  - Given verification failure, when detected, then promotion is blocked and incident entry opened.
- Technical notes: verify-release + nonprod-load workflows orchestration.
- Test requirements: smoke (verification), integration (workflow chaining), load (mini-join test).
- Telemetry events required: `post_deploy_verify_passed`, `post_deploy_verify_failed`.
- Security and abuse checks required: verification token least-privilege and rotation policy.
- Dependencies: E8-S2, E3-S4.
- Estimate: 3.
- Confidence: High.

#### E8-S4

- User story: As operations, I can execute rollback within minutes and monitor crash-free/perf budgets.
- Acceptance criteria:
  - Given failed revision, when rollback command runs, then last-known-good revision activates.
  - Given rollback completion, when verification reruns, then health and protected smoke pass.
  - Given live monitoring, when crash-free drops below target, then alert triggers and runbook link is included.
- Technical notes: rollback script/commands + dashboard/alerts.
- Test requirements: operations drill, smoke (rollback verification), integration (alert pipeline).
- Telemetry events required: `rollback_started`, `rollback_completed`, `crash_free_budget_breached`.
- Security and abuse checks required: operator-only rollback permissions and command audit log.
- Dependencies: E8-S3.
- Estimate: 3.
- Confidence: Med.

## 4. Milestone and sprint cut

| Sprint | Sprint goal                                                      | Stories included                         | Why this sequence reduces risk                                                  | Validation checkpoint (harness)                                                       |
| ------ | ---------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1      | Establish authenticated playable shell and core tile persistence | E1-S1, E1-S2, E1-S4, E2-S1, E2-S2        | Builds authoritative core first and blocks auth/data risks early                | Source validation + deterministic build + protected smoke (1,2,6)                     |
| 2      | Stabilize room sync and foundational UX placement flow           | E2-S4, E3-S1, E3-S2, E5-S1               | Makes multiplayer state visible fast and tests ordering before feature layering | Type safety + integration sync validation (2,6)                                       |
| 3      | Lock deterministic bonding and conflict behavior                 | E3-S3, E4-S1, E4-S2, E4-S4               | Eliminates highest gameplay correctness risk before social expansion            | Deterministic logic gate + regression suite (1,2,6)                                   |
| 4      | Deliver creator usability and Layer 1 social basics              | E5-S2, E5-S3, E6-S1, E6-S2, E6-S3        | Adds retention loop once core correctness is stable                             | Perf budget sampling + abuse-throttled social checks (2,3,6)                          |
| 5      | Deliver moderation baseline and shared discovery                 | E5-S4, E6-S4, E7-S1, E7-S2, E7-S3        | Introduces minimum viable safety controls before launch hardening               | Security gate + moderation workflow verification (3,6,7)                              |
| 6      | Achieve launch candidate readiness and operational confidence    | E3-S4, E8-S1, E8-S2, E8-S3, E8-S4, E7-S4 | Final sprint validates non-functional targets and rollback readiness            | Immutable artifact, env-safe deploy, post-deploy verify, rollback drill (2,3,4,5,6,7) |

## 5. Critical path

### Internal playable build chain

E1-S1 -> E1-S2 -> E2-S1 -> E2-S2 -> E2-S4 -> E3-S1 -> E3-S2 -> E4-S1 -> E4-S2 -> E5-S1 -> E5-S2

### Launch candidate chain

Internal playable chain -> E3-S3 -> E3-S4 -> E6-S1 -> E6-S3 -> E6-S4 -> E7-S1 -> E7-S2 -> E8-S1 -> E8-S2 -> E8-S3 -> E8-S4

### Top 5 schedule risks and mitigations

| Risk                                            | Impact                                           | Mitigation                                                                            |
| ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Bonding logic non-determinism under concurrency | Core mechanic breaks trust                       | Build E4-S4 regression corpus early and run in CI every merge                         |
| Placement latency >200 ms at 50 CCU             | MVP quality gate fail                            | Run incremental load tests from Sprint 2, optimize diff payloads and recompute bounds |
| Reconnect desync and ghost presence             | Multiplayer frustration and moderation confusion | Prioritize E3-S1 plus heartbeat cleanup (E1-S3) and checksum validation               |
| Moderation queue overload for solo operator     | Safety and response SLA risk                     | Keep report taxonomy minimal, add threshold alerts and batching in E7-S4              |
| Release rollback uncertainty                    | Extended outage risk                             | Rehearse rollback drill twice before launch candidate sign-off in Sprint 6            |

## 6. Definition of done (project-wide)

- Code quality: lint clean, strict typecheck clean, no unchecked TODOs in merged MVP code paths.
- Tests: required unit and integration tests per story pass in CI; load and smoke tests executed at defined milestones.
- Security gates: dependency and container high/critical gates pass, auth/authorization checks validated for protected endpoints.
- Deployment proof: release uses immutable SHA artifact and environment-scoped secret injection only.
- Post-deploy verification: health, readiness, protected route, and room-join smoke checks pass on target environment.
- Rollback readiness: last-known-good revision identified; rollback tested and documented with execution evidence.
- Telemetry completeness: every story emits declared events; dashboards/queries confirm ingestion and alert thresholds.

## 7. Backlog quality check

| Check                                    | Status | Evidence                                                                                                      |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| All Layer 1 must-haves covered           | Pass   | Placement, bonding, hearts, pins, moderation baseline, sync, deploy readiness                                 |
| No forbidden scope included              | Pass   | No progression, no cosmetics economy, no guild systems, no advanced scripted behaviors, no full mobile parity |
| All stories testable                     | Pass   | Each story includes explicit unit/integration/load/smoke requirements                                         |
| All epics have measurable exit criteria  | Pass   | Exit criteria provided in epic map with numeric/observable targets                                            |
| Harness coverage complete across backlog | Pass   | Harness points 1-7 mapped across epics and sprint checkpoints                                                 |
