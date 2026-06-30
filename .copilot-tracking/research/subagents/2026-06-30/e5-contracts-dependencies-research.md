---
title: E5 Contracts and Dependencies Research
description: Research-only findings for epic 5 covering cross-cutting contracts, startup dependencies, and UX constraints for creator onboarding and first-tile latency.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
keywords:
  - epic-5
  - creator-ux
  - contracts
  - realtime
  - onboarding
estimated_reading_time: 8
---

## Research Scope

* Investigate cross-cutting contracts and dependencies that constrain epic #5 creator UX work.
* Focus on server/client session and realtime flow, shared types and contracts, and timing-sensitive bootstrap, replay, heartbeat, auth, and state mechanisms.
* Restrict changes to `.copilot-tracking/research/` only.

## Research Questions

* Which existing startup and realtime contracts directly affect first-tile latency and onboarding?
* Which shared client/server types define the creator flow boundary?
* Which timing, replay, heartbeat, auth, and bootstrap mechanisms shape UX timing or accessibility behavior?
* Which parts of epic #5 appear deliverable entirely client-side, and which likely require shared or server changes?

## Working Hypothesis

* The highest-impact constraints for epic #5 are in the auth-to-session-bootstrap path and the realtime/reconnect contract, because creator UX cannot hit the first-tile target unless the client reaches token-ready, room join, bootstrap, and stable delta flow quickly.

## Evidence Log

### Product Intent

* Epic E5 targets first tile placement in under 30 seconds for a new session, with keyboard usability and reduced-motion usability. The adjacent E1 contract already sets a stricter dependency budget for token-ready to authenticated room join in under 5 seconds p50. References: docs/layer1-backlog.md:32, docs/layer1-backlog.md:36.

### Client Startup and Auth

* Client auth is a state machine with explicit states for signed-out, silent token acquisition, interaction-required, token-ready, bootstrap-in-flight, and bootstrap-failed. Unauthorized retry is capped at one attempt. Any creator onboarding flow that depends on authenticated APIs inherits this limit. References: apps/client/src/auth/external-id-session.ts:10, apps/client/src/auth/external-id-session.ts:24, apps/client/src/auth/external-id-session.ts:39, apps/client/src/auth/external-id-session.ts:93.
* Join-token acquisition is synchronous on auth readiness. If the token is missing or a 401 occurs after one retry, the client triggers interactive auth and the flow stops. That makes join-token a hard gate for any first-time creator experience that requires room entry before showing placement-ready UI. References: apps/client/src/auth/join-token-caller.ts:8, apps/client/src/auth/join-token-caller.ts:34, apps/client/src/auth/join-token-caller.ts:38, apps/client/src/auth/join-token-caller.ts:51.
* Session bootstrap is also auth-gated and returns a minimal shellInit contract containing only token-ready state and retry policy. There is no richer bootstrap payload for onboarding hints, accessibility defaults, room metadata, palette data, or viewport defaults today. References: apps/client/src/session/bootstrap-store.ts:3, apps/client/src/session/bootstrap-store.ts:9, apps/client/src/session/bootstrap-store.ts:18, apps/client/src/session/bootstrap-store.ts:49.
* The client stores reconnect context locally with tenantScopedSubject, roomId, reconnectToken, checkpointVersion, and savedAtMs. That supports resilience after entry, but it does not reduce initial cold-start latency for new users. References: apps/client/src/session/bootstrap-store.ts:18, apps/client/src/session/bootstrap-store.ts:34, apps/client/src/session/bootstrap-store.ts:41.
* Integration tests confirm auth startup can end in interaction-required or bootstrap-failed, not only token-ready. This is relevant for onboarding because UX has to handle these branches without trapping keyboard users in partial startup screens. References: apps/client/tests/integration/auth-state-machine.test.ts:27, apps/client/tests/integration/auth-state-machine.test.ts:52, apps/client/tests/integration/auth-state-machine.test.ts:67, apps/client/tests/integration/auth-state-machine.test.ts:81.

### Session Bootstrap and Realtime

* Heartbeat is the mechanism that issues reconnect tokens. It is not only presence tracking. Any UX that expects seamless resume or background recovery depends on heartbeat cadence and successful auth. References: apps/client/src/session/heartbeat-caller.ts:3, apps/client/src/session/heartbeat-caller.ts:9, apps/client/src/session/heartbeat-caller.ts:15; apps/server/src/http/routes/session.routes.ts:144, apps/server/src/http/routes/session.routes.ts:166, apps/server/src/http/routes/session.routes.ts:168.
* Reconnect returns replay deltas plus a checksum scoped to full_region_canonical. Client recovery therefore depends on deterministic local application of replay data and checksum verification. References: apps/client/src/session/reconnect-caller.ts:16, apps/client/src/session/reconnect-caller.ts:50; apps/client/src/session/replay-checksum.ts:16, apps/client/src/session/replay-checksum.ts:42, apps/client/src/session/replay-checksum.ts:106.
* Reconnect failures are normalized into reauth-required, stale-session, forbidden, rate-limited, and request-failed. UX around onboarding and resume must distinguish these, especially stale-session and rate-limited outcomes that are not fixed by retrying UI actions immediately. References: apps/client/src/session/reconnect-caller.ts:33, apps/client/src/session/reconnect-caller.ts:40, apps/client/src/session/reconnect-caller.ts:113.
* Realtime deltas are strictly ordered by numeric sequenceId. The client deduplicates old or duplicate deltas and always acks successfully processed or duplicate deltas, but intentionally withholds ack on apply failure so the server can retry. Creator interactions that animate placement confirmation should account for the fact that local apply errors can prolong server retransmit noise. References: apps/client/src/session/realtime-delta-handler.ts:10, apps/client/src/session/realtime-delta-handler.ts:28, apps/client/src/session/realtime-delta-handler.ts:85, apps/client/src/session/realtime-delta-handler.ts:97, apps/client/src/session/realtime-delta-handler.ts:107, apps/client/src/session/realtime-delta-handler.ts:116, apps/client/src/session/realtime-delta-handler.ts:126.
* Unit tests confirm the realtime handler uses deterministic always-ack behavior for duplicates and numeric ordering for sequence IDs, which any preview or optimistic-placement UI must preserve if it reuses the same delta model. References: apps/client/tests/unit/realtime-delta-handler.test.ts:40, apps/client/tests/unit/realtime-delta-handler.test.ts:131, apps/client/tests/unit/realtime-delta-handler.test.ts:179, apps/client/tests/unit/realtime-delta-handler.test.ts:225.

### Server Session and Domain Contracts

* Server session routes expose four key endpoints: bootstrap, join-token, heartbeat, and reconnect. All are rate-limited independently, and all room-bound flows require a valid authenticated principal. References: apps/server/src/http/routes/session.routes.ts:20, apps/server/src/http/routes/session.routes.ts:22, apps/server/src/http/routes/session.routes.ts:24, apps/server/src/http/routes/session.routes.ts:55, apps/server/src/http/routes/session.routes.ts:106, apps/server/src/http/routes/session.routes.ts:144, apps/server/src/http/routes/session.routes.ts:176.
* Join-token currently accepts only one supported room ID, ArenaRoom.ROOM_KEY. If creator UX needs region selection, tutorial rooms, or pre-room draft creation, that likely requires server changes rather than a client-only story. References: apps/server/src/http/routes/session.routes.ts:108, apps/server/src/http/routes/session.routes.ts:115, apps/server/src/http/routes/session.routes.ts:128.
* Session lifecycle presence is driven by heartbeat TTL and cleanup, and region membership checks are enforced server-side when serving region diffs. If onboarding or accessibility flows rely on delayed room entry or background browse before join, current contracts will likely resist that. References: apps/server/src/session/session-lifecycle.service.ts:5, apps/server/src/session/session-lifecycle.service.ts:29, apps/server/src/session/session-lifecycle.service.ts:101, apps/server/src/session/session-lifecycle.service.ts:122, apps/server/src/session/session-lifecycle.service.ts:135; apps/server/src/http/app.ts:128, apps/server/src/http/app.ts:130.
* Reconnect reason taxonomy is server-defined and includes invalid_signature, token_expired, token_replay_detected, checkpoint_not_found, checkpoint_archived, grace_period_expired, stale_token, subject_mismatch, and room_mismatch. These reasons directly constrain what accessibility-friendly recovery messaging can truthfully say. References: apps/server/src/session/session-lifecycle.types.ts:7, apps/server/src/session/session-lifecycle.types.ts:40, apps/server/src/session/session-lifecycle.types.ts:51.
* Realtime fanout is ack-driven with timeout, one-or-more retransmit attempts up to a configured max, and an outbound cap per connection. This means creator UX cannot assume low-noise realtime under congestion unless it stays within existing ordering and ack semantics. References: apps/server/src/domain/delta-fanout.service.ts:49, apps/server/src/domain/delta-fanout.service.ts:50, apps/server/src/domain/delta-fanout.service.ts:52, apps/server/src/domain/delta-fanout.service.ts:140, apps/server/src/domain/delta-fanout.service.ts:181, apps/server/src/domain/delta-fanout.service.ts:214, apps/server/src/domain/delta-fanout.service.ts:227, apps/server/src/domain/delta-fanout.service.ts:265.
* Placement submission is throttled server-side by account and region, defaulting to 5 requests per 60 seconds. That is a material UX constraint for onboarding tutorials, keyboard nudging, preview-confirm loops, or accidental repeated placement attempts. References: apps/server/src/http/app.ts:68, apps/server/src/http/app.ts:69, apps/server/src/http/app.ts:70, apps/server/src/http/app.ts:231, apps/server/src/http/app.ts:242, apps/server/src/http/app.ts:245.
* Successful tile placement can publish realtime deltas through the delta fanout registry after commit. Any creator UX that introduces local previews or optimistic apply must remain consistent with post-commit server fanout, not replace it. References: apps/server/src/http/app.ts:197, apps/server/src/http/app.ts:198, apps/server/src/http/app.ts:216.
* Region diff service compacts latest delta by coordinate and filters deletes out of normal diff responses. This means browse or onboarding surfaces that load world state via region diffs only see live tiles, not explicit deletion events. References: apps/server/src/domain/region-diff.service.ts:91, apps/server/src/domain/region-diff.service.ts:173, apps/server/src/domain/region-diff.service.ts:174, apps/server/src/domain/region-diff.service.ts:202.

### Shared Types and Contracts

* Shared types define the placement command boundary, including commandId length and pattern requirements. Any client creator flow that generates placement commands must preserve these identifiers exactly, including for keyboard-first or reduced-motion flows. References: packages/shared-types/src/index.ts:50, packages/shared-types/src/index.ts:52, packages/shared-types/src/index.ts:56.
* Shared placement result contracts distinguish occupied, command_payload_mismatch, and throttled. Those reasons are critical for onboarding copy, inline validation, and accessible error announcements. References: packages/shared-types/src/index.ts:84, packages/shared-types/src/index.ts:110.
* Shared region diff policy defines max viewport area, max tiles per request, default max tiles, delete semantics, and required region membership. Pan, zoom, culling, and first-load viewport behavior are therefore not purely a rendering concern; they are contract-limited. References: packages/shared-types/src/index.ts:177, packages/shared-types/src/index.ts:181, packages/shared-types/src/index.ts:185, packages/shared-types/src/index.ts:191, packages/shared-types/src/index.ts:192, packages/shared-types/src/index.ts:208.
* Shared-auth is the main package-level auth dependency beyond shared-types. It constructs tenantScopedSubject from token claims and enforces tenant and issuer policy, which means onboarding latency and failure states are coupled to identity configuration, not only client interaction design. References: packages/shared-auth/src/index.ts:16, packages/shared-auth/src/index.ts:31, packages/shared-auth/src/index.ts:51, packages/shared-auth/src/index.ts:69, packages/shared-auth/src/index.ts:109.
* Shared-persistence contributes little directly to creator UX beyond fixed migration/readiness conventions. It is not a primary epic #5 contract surface. Reference: packages/shared-persistence/src/index.ts:1.

### Tests and Performance Signals

* Server smoke tests treat reconnect as a first-class reliability surface, with a smoke reconnect SLA of 500 ms and explicit handling for grace_period_expired. There is no comparable smoke for initial bootstrap-to-first-placement onboarding. References: apps/server/tests/integration/join-rejoin-smoke.test.ts:119, apps/server/tests/integration/join-rejoin-smoke.test.ts:122, apps/server/tests/integration/join-rejoin-smoke.test.ts:129, apps/server/tests/integration/join-rejoin-smoke.test.ts:141.
* Load validation sets median placement acknowledgement budget to 200 ms and reconnect p95 to 3000 ms at 50 CCU. Epic E5 depends on these existing budgets because creator polish that increases request volume, replay churn, or repeated placement attempts can push against them. References: apps/server/tests/load/e3-s4-latency-budget.load.ts:13, apps/server/tests/load/e3-s4-latency-budget.load.ts:14, apps/server/tests/load/e3-s4-latency-budget.load.ts:23, apps/server/tests/load/e3-s4-latency-budget.load.ts:254, apps/server/tests/load/e3-s4-latency-budget.load.ts:336, apps/server/tests/load/e3-s4-latency-budget.load.ts:337.
* Client reconnect and replay tests confirm that stale reconnect maps to a distinct client error class and that checksum validation is deterministic across ordering. That reduces ambiguity for recovery flows but also means contract drift will surface quickly in UX-critical code. References: apps/client/tests/unit/reconnect-caller.test.ts:58, apps/client/tests/unit/reconnect-caller.test.ts:112; apps/client/tests/unit/replay-checksum.test.ts:11, apps/client/tests/unit/replay-checksum.test.ts:61, apps/client/tests/unit/replay-checksum.test.ts:121.

## Preliminary Risks

* Startup dependency risk: first-tile latency is dominated by auth readiness, bootstrap, join-token, room join, and initial world/realtime readiness, but the codebase only has explicit budgets for parts of that chain. This is the highest-impact risk for the under-30-second exit criterion.
* Contract sparsity risk: bootstrap payload is too thin to support richer onboarding or accessibility defaults without either additional client assumptions or contract expansion.
* Throttle and rate-limit risk: bootstrap, heartbeat, reconnect, and placement all have server-side rate limits or throttles that can conflict with guided onboarding, repeated keyboard actions, or recovery-heavy accessibility flows.
* Region membership risk: region diff requires active membership and upsert-only semantics, which constrains pre-join browsing, passive onboarding, and delete-aware viewport UX.
* Reliability messaging risk: reconnect failure reasons are precise but numerous; if creator UX abstracts them too aggressively, it may mislead users about whether retry, reauth, or restart is needed.
* Realtime consistency risk: optimistic or animated placement UX must not diverge from server-ordered delta apply, duplicate ack behavior, and replay checksum expectations.

## Client-Side Versus Shared or Server Delivery

* Likely client-side only:
  * Palette and shape picker UI that maps onto existing shape/color/stylePayload placement commands.
  * Placement preview visuals that do not require server acknowledgment to render, as long as commit state stays aligned with existing place/realtime contracts.
  * Keyboard navigation, focus management, screen-reader announcements, and reduced-motion behaviors implemented on top of current client state transitions.
  * Onboarding copy, progress states, and non-blocking affordances for auth/bootstrap/join/reconnect outcomes.
* Likely needs shared or server changes:
  * Any richer bootstrap contract for onboarding defaults, a11y preferences, initial room metadata, or recommended viewport.
  * Multiple creator entry rooms, draft rooms, tutorial rooms, or any room selection beyond ArenaRoom.ROOM_KEY.
  * New placement semantics, additional throttling exceptions, or tutorial-friendly placement behavior that conflicts with the current 5-per-60-second throttle.
  * Any diff or replay contract changes needed for viewport-aware onboarding, explicit delete visibility, or alternative state-bootstrap paths.
  * Any new telemetry or end-to-end performance harness for bootstrap-to-first-tile latency.

## Open Questions

* Where does the actual client room join and initial state bootstrap happen after join-token issuance? The files in scope define auth/session helpers, but not the final creator-shell orchestration that would measure true first-tile latency.
* Is there an existing client-side viewport/state model outside the searched folders that already handles pan, zoom, culling, and placement preview?
* Should E5 treat pre-auth onboarding and post-auth onboarding as separate experiences, given the hard interaction-required branch in auth startup?
* Does the product want pre-join browsing or tutorial content before room membership, which would conflict with current region-diff membership requirements?
* Is there an intended contract for accessibility defaults or reduced-motion preference persistence, or is that expected to remain entirely local to the client?