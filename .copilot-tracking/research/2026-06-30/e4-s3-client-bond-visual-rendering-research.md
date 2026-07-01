<!-- markdownlint-disable-file -->
# Task Research: E4-S3 Client Bond Visual Rendering With Reduced Motion

Research for GitHub issue #23: story(layer1): E4-S3 client bond visual rendering with reduced motion.

## Task Implementation Requests

* Implement client bond visual rendering for bond events.
* Implement reduced-motion-safe visual variants.
* Maintain stable frame pacing under high effect density.
* Define tests for integration, smoke, and performance budget.
* Add telemetry events: bond_effect_rendered, reduced_motion_enabled.
* Validate malformed render event payloads.

## Scope and Success Criteria

* Scope: Client render-layer research, quality-tier strategy, event-to-render wiring, accessibility behavior, performance safeguards, telemetry, and tests.
* Assumptions:
  * The client app in apps/client is the implementation target.
  * Existing session/realtime handlers are the integration surface.
  * No server protocol change is required unless payload gaps are discovered.
* Success Criteria:
  * Clear architecture for event-to-render flow with reduced-motion branch.
  * One recommended implementation approach with rationale and alternatives.
  * Concrete file-level implementation plan and test strategy.

## Outline

1. Map existing client event/session architecture.
2. Identify current rendering/perf/accessibility patterns.
3. Identify telemetry and schema validation patterns.
4. Evaluate implementation alternatives.
5. Select approach and provide actionable implementation guidance.

## Potential Next Research

* Confirm whether issue dependency E4-S2 or E5-S2 introduces a server-authoritative bond websocket event.
  * Reasoning: determines whether client should infer bond visuals locally or consume explicit bond events.
  * Reference: apps/server/src/http/app.ts, apps/server/src/index.ts, packages/shared-types/src/bonding.ts
* Decide whether frame pacing budget is advisory telemetry or CI gating in Harness mapping 2,6.
  * Reasoning: current harness gates latency, not client rendering frame metrics.
  * Reference: docs/cicd-harness.md, apps/server/tests/load/e3-s4-latency-budget.load.ts

## Research Executed

### File Analysis

* apps/client/src/session/realtime-delta-handler.ts
  * Apply callback seam at lines 36 and 93 is the strongest event-to-render hook; handler already ensures ordering/dedupe/ack.
  * Runtime shape validation is missing for incoming delta payloads before sequence parsing.
* apps/client/src/index.ts
  * Exposes auth/session contracts only; no render/motion/perf policy surface exists.
* packages/shared-types/src/bonding.ts
  * Bond semantics exist (`BondType`, `evaluateBondType`) but no wire payload schema for bond visual events.
* apps/server/src/index.ts
  * Bond recomputation emits telemetry (`emitBondingTriggered`) but not a websocket bond event to client.
* apps/server/src/http/app.ts and apps/server/src/rooms/arena.room.ts
  * Existing realtime transport is delta + delta_ack; no bond event message constant currently present.
* docs/cicd-harness.md
  * Existing verified budgets are latency-oriented (`placementAckMedianMs`, `reconnectP95Ms`) rather than client fps/frame pacing.

### Code Search Results

* Search terms: reduced motion, prefers-reduced-motion, quality tier, effect scheduler, render loop
  * No existing reduced-motion or rendering quality-tier implementation was found under apps/client/src.
* Search terms: bond_effect_rendered, reduced_motion_enabled
  * No current event emission implementation found in client/server code.
* Search terms: malformed payload validation in client realtime pipeline
  * Existing validation pattern is stronger on server routes (session/tile/region/snapshot); client realtime handler path is mostly trust-based.

### External Research

* W3C Media Queries Level 5 (`prefers-reduced-motion`)
  * Use system preference as baseline, with app-level override for accessibility-safe behavior.
  * Source: [W3C Media Queries 5](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion)
* WCAG 2.2 SC 2.3.3 and SC 2.2.2
  * Interaction-triggered motion should be suppressible; moving effects should be reducible/pausable when non-essential.
  * Source: [WCAG 2.2 SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions), [WCAG 2.2 SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
* web.dev rendering performance guidance
  * Prefer consistent frame delivery with deterministic degradation under load.
  * Source: [web.dev Rendering Performance](https://web.dev/articles/rendering-performance)
* W3C Long Tasks and Performance Timeline APIs
  * Use `PerformanceObserver` to monitor long-task pressure and feed scheduler degradation decisions.
  * Source: [Long Tasks](https://www.w3.org/TR/longtasks-1/), [Performance Timeline](https://www.w3.org/TR/performance-timeline/)
* OWASP Input Validation + RFC 6455
  * Apply allowlist runtime checks for inbound realtime payloads and explicit reject policy.
  * Source: [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)

### Project Conventions

* Standards referenced: WCAG 2.2 motion criteria, W3C `prefers-reduced-motion`, Performance APIs, OWASP input validation.
* Instructions followed: Task Researcher mode with all research delegated to Researcher Subagent; primary document consolidated from evidence.

## Key Discoveries

### Project Structure

* `apps/client` is currently headless session/auth logic with no visual subsystem (`apps/client/src/index.ts`).
* Realtime delta ingress and deterministic ordering are centralized in `apps/client/src/session/realtime-delta-handler.ts`.
* Bond domain logic exists in shared types (`packages/shared-types/src/bonding.ts`) and server recompute orchestration (`apps/server/src/index.ts`), but client-facing bond event transport is not present.
* Existing CI/harness perf evidence is centered in server/load latency metrics, not client frame pacing (`docs/cicd-harness.md`, `apps/server/tests/load/e3-s4-latency-budget.load.ts`).

### Implementation Patterns

* Client tests consistently use boundary mocking and explicit branch assertions (`apps/client/tests/unit/*.test.ts`, `apps/client/tests/integration/auth-state-machine.test.ts`).
* Server telemetry pattern uses a centralized sink wrapper (`apps/server/src/telemetry/telemetry-sink.ts`) and route/service call sites.
* Server route validation is explicit and defensive; client realtime validation is comparatively thin.
* Existing realtime client behavior acknowledges duplicates and applies ordered deltas, which should remain invariant when adding render hooks.

### Complete Examples

```ts
type MotionMode = "full" | "reduced";

interface BondEffectEvent {
  bondType: "glow-chain" | "blend-gradient" | "pulse-rhythm";
  regionId: string;
  sequenceId: string;
  intensity?: number;
}

function handleBondEffect(event: BondEffectEvent, motionMode: MotionMode): { variant: "full" | "low-motion" } {
  return { variant: motionMode === "reduced" ? "low-motion" : "full" };
}
```

### API and Schema Documentation

* Client realtime delta seam:
  * `apps/client/src/session/realtime-delta-handler.ts` (ApplyDeltaCallback, delta subscription, ack flow)
* Shared bond semantic API:
  * `packages/shared-types/src/bonding.ts` (`BondType`, `BondEvaluationTile`, `evaluateBondType`)
* Relevant server realtime path:
  * `apps/server/src/http/app.ts` tile placement fanout publish
  * `apps/server/src/rooms/arena.room.ts` realtime message constants and handlers
* Existing harness contract:
  * `docs/cicd-harness.md` E3-S4 latency budget gate and artifact shape

### Configuration Examples

```json
{
  "bondEffect": {
    "maxActiveEffects": 80,
    "maxNewEffectsPerFrame": 10,
    "degradationThresholdMs": {
      "level1": 16.7,
      "level2": 22,
      "level3": 33
    },
    "motionModeDefault": "full"
  }
}
```

## Technical Scenarios

### Bond Visual Rendering With Accessibility And Frame Stability

Issue #23 requires new client rendering behavior in a codebase that currently has session transport primitives but no render subsystem. The technical decision is where to source bond effect events and how to guarantee reduced-motion behavior with stable frame pacing.

**Requirements:**

* Correct visual effect for bond events.
* Reduced motion low-motion variant.
* Stable frame pacing under high effect density.
* Telemetry and malformed payload validation.

**Preferred Approach:**

* Implement client-side bond effect orchestration as a new render policy layer that is invoked from the existing realtime apply seam (`ApplyDeltaCallback`) while preserving sequence/ack semantics.
* Start with local bond-effect derivation from shared `BondType` semantics if no server bond websocket event is available yet, and keep an adapter boundary for future server-authoritative event transport.
* Add explicit reduced-motion resolver (app override + system preference) and deterministic effect scheduler degradation ladder.
* Add client-side runtime payload validation before effect dispatch and emit required telemetry events.

```text
apps/client/src/
  render/
    bond-effect-orchestrator.ts
    effect-scheduler.ts
    motion-preferences.ts
    bond-effect.types.ts
  telemetry/
    client-telemetry.ts
  session/
    realtime-delta-validator.ts

apps/client/tests/
  unit/
    bond-effect-orchestrator.test.ts
    effect-scheduler.frame-pressure.test.ts
    motion-preferences.test.ts
    realtime-delta-validator.test.ts
  integration/
    bond-event-to-render.integration.test.ts
    reduced-motion.smoke.test.ts
```

**Implementation Details:**

1. Integrate at existing event seam
* Keep `RealtimeDeltaHandler` order/dedupe/ack behavior unchanged.
* In the consumer callback, derive or consume bond effect events and route them into `bond-effect-orchestrator`.

2. Reduced-motion policy
* `motion-preferences.ts` resolves mode priority:
  * app override (if set)
  * `matchMedia('(prefers-reduced-motion: reduce)')`
  * default full motion
* Orchestrator maps each bond effect to full or low-motion variant.

3. Frame pacing stability
* `effect-scheduler.ts` enforces per-frame budget and caps concurrent/new effects.
* Degradation ladder:
  * L0 full fidelity
  * L1 spawn throttling
  * L2 simplified variants
  * L3 minimal highlight-only mode

4. Payload validation and abuse checks
* Add runtime validator for incoming render-related payload properties (required fields, type/bounds, enum allowlist).
* Reject malformed payloads safely and emit telemetry counters.

5. Telemetry
* Emit required events:
  * `bond_effect_rendered` with attributes: bondType, variant, degradationLevel
  * `reduced_motion_enabled` when mode enters reduced state (source: app|system)
* Add counters for malformed payload rejects and scheduler throttling.

6. Test mapping to acceptance criteria
* AC: correct visual effect rendered
  * integration test drives event->orchestrator->variant selection by bond type
* AC: reduced motion enabled -> low-motion variant
  * smoke test toggles system/app setting and verifies low-motion branch
* AC: high effect density -> frame pacing stable
  * scheduler unit/perf-style test asserts degradation and caps under synthetic load

7. Harness alignment
* Keep existing latency gates untouched.
* Add non-blocking client frame metrics artifact first; promote to gating after baseline stability data.

```ts
export interface BondEffectRenderEvent {
  bondType: "glow-chain" | "blend-gradient" | "pulse-rhythm";
  regionId: string;
  sequenceId: string;
  intensity: number;
}

export interface MotionContext {
  reducedMotion: boolean;
  source: "app" | "system" | "default";
}

export interface RenderDecision {
  variant: "full" | "low-motion";
  degradationLevel: 0 | 1 | 2 | 3;
}

export function decideRenderVariant(event: BondEffectRenderEvent, motion: MotionContext): RenderDecision {
  if (motion.reducedMotion) {
    return { variant: "low-motion", degradationLevel: 0 };
  }
  return { variant: "full", degradationLevel: 0 };
}
```

#### Considered Alternatives

1. Server-authoritative bond websocket events first
* Pros: single source of truth for bond effects, less client inference logic.
* Cons: requires new server room message contract, shared wire schema, and dependency readiness from E4-S2/E5-S2; expands scope and risk for this story.
* Rejection reason: higher cross-layer dependency and no current websocket bond event path exists.

2. Pure CSS/media-query-only reduced motion
* Pros: low implementation effort for preference detection.
* Cons: does not address event scheduler pressure, non-DOM effect loops, or telemetry/validation requirements.
* Rejection reason: insufficient for acceptance criteria on frame pacing and malformed payload handling.

3. No scheduler, best-effort render all effects
* Pros: simplest implementation.
* Cons: directly conflicts with frame pacing stability objective under high effect density.
* Rejection reason: fails performance acceptance intent and creates unstable UX.
