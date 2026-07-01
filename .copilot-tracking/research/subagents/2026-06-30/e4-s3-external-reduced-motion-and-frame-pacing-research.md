---
title: E4-S3 External Reduced Motion and Frame Pacing Research
description: External standards and applied recommendations for reduced-motion-safe effects, high-density effect frame pacing, telemetry, and malformed realtime payload validation in tile-fighter.
author: GitHub Copilot (Researcher Subagent)
ms.date: 2026-07-01
ms.topic: reference
keywords:
	- reduced-motion
	- frame-pacing
	- performance
	- telemetry
	- realtime-validation
	- tile-fighter
estimated_reading_time: 12
---

## Research Scope

Status: Complete

Topics investigated:

* Accessibility and standards guidance for reduced motion in web clients.
* Technical strategies for effect-density throttling and frame pacing stability.
* Telemetry recommendations for motion preferences and rendering stability.
* Input validation and malformed payload handling patterns for realtime client flows.
* Mapping all recommendations to current tile-fighter client seams.

## Sources

Authoritative external references:

* W3C Media Queries Level 5 (`prefers-reduced-motion`): <https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion>
* MDN `prefers-reduced-motion`: <https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion>
* WCAG 2.2 Understanding SC 2.2.2 Pause, Stop, Hide: <https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html>
* WCAG 2.2 Understanding SC 2.3.3 Animation from Interactions: <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions>
* web.dev rendering performance guidance (frame budget, `requestAnimationFrame`): <https://web.dev/articles/rendering-performance>
* W3C Long Tasks API: <https://www.w3.org/TR/longtasks-1/>
* W3C High Resolution Time Level 3: <https://www.w3.org/TR/hr-time-3/>
* W3C Performance Timeline (`PerformanceObserver`): <https://www.w3.org/TR/performance-timeline/>
* OWASP Input Validation Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
* RFC 6455 WebSocket Protocol (invalid data handling, close semantics): <https://datatracker.ietf.org/doc/html/rfc6455>
* OpenTelemetry metrics data model: <https://opentelemetry.io/docs/specs/otel/metrics/data-model/>

Tile-fighter code and docs references:

* apps/client/src/index.ts
* apps/client/src/session/realtime-delta-handler.ts
* apps/client/src/session/reconnect-caller.ts
* apps/client/src/session/bootstrap-store.ts
* apps/client/src/session/heartbeat-caller.ts
* apps/client/src/auth/join-token-caller.ts
* apps/client/src/session/replay-checksum.ts
* apps/client/tests/unit/realtime-delta-handler.test.ts
* apps/client/tests/unit/reconnect-caller.test.ts
* docs/cicd-harness.md
* apps/server/artifacts/e3-s4-latency-budget.json

## Applied Findings

### 1. Reduced motion should be first-class preference state, not only CSS

Standards support both automatic OS-driven preference detection (`prefers-reduced-motion`) and app-level motion reduction behavior. WCAG 2.2 SC 2.3.3 expects motion triggered by interaction to be suppressible unless essential. SC 2.2.2 expects users can pause/stop/hide moving content that starts automatically and persists.

Applied to tile-fighter:

* Add a client preference store with sources in priority order:
	1. Explicit in-app toggle.
	2. System preference via `matchMedia('(prefers-reduced-motion: reduce)')`.
	3. Safe default (reduced off).
* Route all non-essential effect triggers through a single motion policy function, for example: `resolveEffectPolicy(pref: MotionPref, effectType: EffectType): EffectPolicy`.
* For reduced motion mode:
	* Replace movement-heavy effects with opacity and color-state transitions.
	* Remove camera shake/parallax style effects.
	* Use shorter, non-oscillating transitions.
* Keep game-state fidelity unchanged. Only visual interpolation changes.

Why this fits current code:

* `apps/client/src/index.ts` exports headless session/auth modules and currently has no UI policy layer. Motion policy can be introduced as an isolated module without changing existing auth/session behavior.

### 2. Frame pacing for high-density effects requires budgeted degradation, not best-effort animation

Web rendering guidance emphasizes consistent frame delivery over occasional high-fidelity bursts. Long Tasks and Performance Timeline APIs provide concrete instrumentation to detect main-thread stalls and dropped-entry pressure.

Applied to tile-fighter:

* Introduce an effect scheduler with explicit per-frame budget in ms.
* Use `requestAnimationFrame` timestamps and elapsed time buckets to classify frame pressure.
* Degradation ladder (deterministic, reversible):
	1. Full effect fidelity.
	2. Spawn-rate reduction and capped concurrent effect count.
	3. Simplified effect variants (no blur/shadows/secondary particles).
	4. Minimal mode (state highlight only).
* Add high-density guardrails:
	* Max active effects.
	* Max new effects per frame.
	* Queue with expiry for non-critical effects.
* Prefer coarse-grained updates under pressure (batch effect state changes per frame).

Why this fits current code:

* Existing client modules are pure logic and easy to compose. A scheduler can sit next to realtime reconciliation and consume post-delta state transitions from `apps/client/src/session/realtime-delta-handler.ts` without changing sequence semantics.

### 3. Telemetry should measure user impact and control-loop health, not only low-level timings

Performance Timeline and Long Tasks APIs support browser-native metrics. OpenTelemetry metrics model supports delta/cumulative streams and reaggregation, which is useful for CI and production dashboards.

Recommended metric set:

* Motion preference:
	* `client.motion.pref_mode` (enum: system_reduce, system_no_preference, app_reduce, app_full).
	* `client.motion.pref_change_total` (counter).
* Frame pacing:
	* `client.render.frame_duration_ms` (histogram).
	* `client.render.long_task_total` (counter).
	* `client.render.degradation_level` (gauge).
	* `client.render.effect_drop_total` (counter).
* Effect density:
	* `client.effect.active_count` (gauge).
	* `client.effect.spawn_total` (counter).
	* `client.effect.spawn_throttled_total` (counter).
* Realtime robustness:
	* `client.realtime.delta_parse_error_total` (counter).
	* `client.realtime.delta_rejected_total` (counter with reason).
	* `client.realtime.ack_emit_total` (counter).

Instrumentation guidance:

* Collect browser timing via `PerformanceObserver` for `longtask` and user timing marks.
* Emit aggregated timeseries at low cadence (for example every 10s) to avoid self-induced overhead.
* Preserve cardinality discipline:
	* Allowed labels: room tier, build version, motion mode, degradation level.
	* Avoid per-user/per-tile high-cardinality labels.

Why this fits current code:

* Client currently lacks telemetry sink (existing behavior is mostly `console.error` in `apps/client/src/session/realtime-delta-handler.ts`). A minimal sink interface can be introduced once and reused by reconnect/bootstrap/heartbeat/realtime modules.

### 4. Malformed realtime payload handling should be explicit, typed, and measurable

OWASP input validation guidance and RFC 6455 invalid-data handling both support early allowlist validation and clear reject behavior. Current tile-fighter client assumes typed payloads at runtime in several places.

Applied to tile-fighter:

* Validate inbound delta payloads at runtime before apply:
	* Required fields present.
	* Field types and numeric bounds.
	* Enum allowlists for known value sets.
	* Maximum lengths for strings.
* Separate failure classes:
	* `parse_error` (invalid JSON/shape).
	* `semantic_error` (unknown region/tile constraints violated).
	* `stale_or_duplicate` (already handled).
* Ack policy recommendation:
	* Do not ack parse/semantic invalid payloads.
	* Ack duplicates/stale already-processed payloads.
	* Emit telemetry for all reject paths.
* Add fail-safe controls:
	* Bounded reject log rate.
	* Optional circuit-breaker if malformed ratio exceeds threshold.

Why this fits current code:

* `apps/client/src/session/realtime-delta-handler.ts` currently compares `sequenceId` with `parseInt` and applies callback logic but has no explicit runtime schema check. The best seam is a `validateRealtimeDeltaPayload` pre-check inside `handleDelta`.

## Concrete Recommendations (Prioritized)

1. Add a new client motion policy module and preference store.
2. Add an effect scheduler with per-frame budget and deterministic degradation ladder.
3. Add a client telemetry sink abstraction and emit the metric set above.
4. Add runtime validation for realtime delta payloads before apply/ack.
5. Extend tests with reduced-motion behavior, frame-pressure degradation, and malformed payload paths.

## Suggested Implementation Seams

Low-risk additions aligned to current architecture:

* `apps/client/src/render/motion-preferences.ts`
* `apps/client/src/render/effect-scheduler.ts`
* `apps/client/src/telemetry/client-telemetry.ts`
* `apps/client/src/session/realtime-delta-validator.ts`

Targeted edits:

* `apps/client/src/session/realtime-delta-handler.ts`
	* Add validator invocation before `compareSequenceIds` and `applyDelta`.
	* Emit structured telemetry on reject/apply-fail/ack-success.
* `apps/client/src/index.ts`
	* Export new render/telemetry/validation modules.

Test additions:

* `apps/client/tests/unit/realtime-delta-handler.malformed-payload.test.ts`
* `apps/client/tests/unit/effect-scheduler.frame-pressure.test.ts`
* `apps/client/tests/unit/motion-preferences.test.ts`

## CI and Budget Alignment

Current CI evidence is latency-centric (`placementAckMedianMs`, `reconnectP95Ms`) in `docs/cicd-harness.md` and `apps/server/artifacts/e3-s4-latency-budget.json`.

Recommended extension for client visual stability:

* Add optional client perf artifact in harness runs with:
	* `frameP95Ms`
	* `longTaskCount`
	* `degradationLevelTimeRatio`
	* `effectDropRate`
* Keep pass/fail thresholds conservative initially and tune from baseline runs.

## Risks and Trade-offs

* Over-instrumentation can create self-inflicted frame pressure. Keep client metric export low-frequency and aggregated.
* Aggressive degradation may reduce UX delight. Use reversible ladder and user override where safe.
* Strict validation can surface upstream producer bugs quickly. Plan controlled rollout with visibility dashboards.

## Top Recommendations

* Treat reduced motion as policy state shared across all effect triggers.
* Use budgeted scheduling with deterministic degradation for frame stability at effect peaks.
* Add browser-native telemetry (`PerformanceObserver`, long tasks) and low-cardinality metrics.
* Add explicit runtime payload validation before realtime delta apply and ack.

## Research Status

Complete.

All requested areas were addressed with external standards references and mapped to current tile-fighter client seams.

