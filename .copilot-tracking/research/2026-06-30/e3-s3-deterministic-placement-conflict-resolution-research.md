<!-- markdownlint-disable-file -->
# Task Research: E3-S3 Deterministic Placement Conflict Resolution

Research focused on story #19 for deterministic conflict resolution under concurrent tile placement, idempotent conflict handling, and replay-safe command processing.

## Task Implementation Requests

* Analyze E3-S3 scope and acceptance criteria in implementation terms
* Assess current codebase readiness for deterministic conflict resolution
* Identify exact data model, transaction, and API changes required
* Evaluate alternatives and select one recommended approach
* Define test, telemetry, and abuse-check coverage for story completion

## Scope and Success Criteria

* Scope: Server-side conflict resolution rules, idempotency and retry behavior, transaction boundaries, telemetry, and verification strategy for E3-S3
* Assumptions:
  * E3-S3 depends on E2-S2 and is implemented in existing server architecture
  * Current placement flow uses persistence repositories and service-layer orchestration
  * Telemetry sink is available for new conflict events
* Success Criteria:
  * Deterministic winner rule defined with persistence-safe ordering semantics
  * Idempotency/replay strategy defined with storage model and replay window
  * Integration race simulation strategy defined and actionable
  * Load hotspot conflict test shape documented
  * One selected approach justified against alternatives

## Outline

1. Baseline story requirements and constraints
2. Current implementation analysis
3. Deterministic conflict resolution design options
4. Idempotency and transaction boundary strategy
5. Test and telemetry plan
6. Recommended approach and implementation sequence

## Potential Next Research

* Validate exact loser conflict response payload shape expected by issue owners
  * Reasoning: Current API only returns `reason: occupied`; issue text asks for an idempotent conflict code
  * Reference: apps/server/src/http/routes/tile.routes.ts

* Confirm replay window duration and purge policy for command ledger rows
  * Reasoning: E3-S3 requires replay window checks but no duration is yet standardized
  * Reference: apps/server/src/persistence/db.ts

## Research Executed

### File Analysis

* packages/shared-types/src/index.ts
  * `TilePlaceCommand` lacks `commandId`; current shape cannot express idempotent retry identity

* apps/server/src/http/routes/tile.routes.ts
  * Placement endpoint returns `201` success, `409 occupied`, `429 throttled`
  * No command-id replay handling path exists

* apps/server/src/persistence/tile.repository.ts
  * Winner is implicit first-commit via DB unique constraint on coordinate
  * SQLSTATE unique violation maps to `coordinate_conflict`
  * Tile insert, region version bump, and delta append are already transactional

* apps/server/src/telemetry/telemetry-sink.ts
  * Existing placement/conflict-adjacent events exist (`tile_persist_conflict`, `tile_place_rejected`)
  * Required issue events are missing: `placement_conflict_detected`, `placement_conflict_resolved`

* apps/server/tests/load/room-join-load.ts
  * Existing hotspot race proves one winner and losers under contention
  * No same-command-id retry/no-side-effect coverage today

### Code Search Results

* `commandId` (placement path)
  * No matches in placement command type and tile placement route handling

* `coordinate_conflict`
  * Present in tile repository conflict mapping, used as occupied loser outcome

* `placement_conflict_detected|placement_conflict_resolved`
  * No current telemetry emission points found

### External Research

* Not required yet; prioritize repository evidence first

### Project Conventions

* Standards referenced: TypeScript monorepo server patterns, repository/service layering
* Instructions followed: Task Researcher mode constraints, markdownlint-disable-file for tracking artifacts

## Key Discoveries

### Project Structure

* Conflict resolution currently lives in persistence-level constraint behavior, not explicit domain winner logic.
* Placement flow is strongly centered in route -> repository transaction path, with response mapping in HTTP routes.
* Existing architecture is suitable for adding idempotency at persistence boundary with minimal layer churn.

### Implementation Patterns

* Current deterministic behavior is accidental but stable: unique coordinate constraint enforces one winner.
* Transaction boundary already couples mutation + version + delta append, which is ideal for idempotent command outcome recording.
* Replay protections exist for session/reconnect flows, but not for placement command identity.

### Complete Examples

```ts
// Recommended transaction-level placement flow (conceptual)
// 1) lookup command ledger row by (regionId, actorId, commandId)
// 2) if existing with same payload hash -> return stored response (idempotent replay)
// 3) if existing with different hash -> return deterministic mismatch conflict
// 4) if new -> insert pending ledger row, attempt tile insert
// 5) on success, persist applied outcome + response snapshot
// 6) on coordinate conflict, persist conflict outcome + winner metadata
// 7) emit placement_conflict_detected/resolved events as appropriate
```

### API and Schema Documentation

* Required API contract change:
  * Extend `TilePlaceCommand` with `commandId` and validate entropy/format.

* Required schema change:
  * Add `placement_commands` ledger table with unique key `(region_id, actor_id, command_id)`.
  * Store request hash, status, result code, optional winner metadata, stored response, and `expires_at`.

* Required telemetry change:
  * Add `placement_conflict_detected` and `placement_conflict_resolved` event emitters with stable correlation fields.

### Configuration Examples

```yaml
e3s3:
  placement_command_replay_window_seconds: 900
  command_id:
    min_length: 16
    required_entropy: true
  telemetry:
    emit_conflict_detected: true
    emit_conflict_resolved: true
```

## Technical Scenarios

### Concurrent Placement at Same Coordinate

Current behavior:

* Two concurrent claims to the same coordinate race on DB unique constraint.
* One request succeeds; losers receive occupied conflict response.
* Deterministic enough for winner uniqueness, but missing explicit command-id-aware idempotency semantics.

Preferred approach:

* Keep coordinate winner arbitration on existing DB unique constraint.
* Add transactional command ledger to make retry outcomes deterministic and side-effect-free.

```text
Server request flow with selected approach
  place command (with commandId)
    -> transaction begin
      -> command ledger lookup/upsert
      -> idempotent replay or payload-mismatch short-circuit
      -> tile insert attempt (existing unique constraint winner)
      -> version bump + delta append
      -> ledger outcome persist
      -> conflict telemetry emit
    -> transaction commit
```

#### Considered Alternatives

Alternative A (selected): transactional command ledger + existing unique coordinate constraint.

* Selected because it provides strongest correctness proof for all E3-S3 acceptance criteria.
* Integrates cleanly with existing transaction-centric repository path.

Alternative B (rejected): cache-first command dedupe with DB fallback.

* Rejected due to weak guarantees during restart/eviction/partition.
* Would require persistent ledger anyway to meet no-side-effect retry guarantees.

Alternative C (rejected): advisory lock arbitration + minimal command log.

* Rejected due to higher deadlock/operational risk and higher complexity for similar outcomes.
* Adds lock-heavy DB coupling without better business-level traceability than Alternative A.

## Selected Approach

Use a transactional placement command ledger keyed by `(region_id, actor_id, command_id)` while preserving the current unique coordinate constraint as winner arbiter.

Why this is the best fit:

* Directly satisfies all issue #19 acceptance criteria.
* Preserves existing deterministic winner behavior and makes it explicit/auditable.
* Adds precise idempotency and replay-window enforcement without split-brain cache logic.
* Reuses current transactional repository architecture rather than introducing lock orchestration complexity.

## Implementation Impact and Sequence

1. Contract and validation changes.
   * Extend placement command type with `commandId` and validate entropy/format at route boundary.

2. Persistence and transaction changes.
   * Add command ledger table + expiry index.
   * Update placement transaction to replay/mismatch/new-command branches.

3. Conflict telemetry changes.
   * Add issue-required events and include stable correlation metadata.

4. Test coverage changes.
   * Unit: winner rule outcome mapping, command hash replay/mismatch.
   * Integration: concurrent same-coordinate race, same-command-id retries, rollback safety.
   * Load: hotspot + retry storm verifies no duplicate side effects and telemetry consistency.

## Risks

* Ledger growth due to replay retention window.
  * Mitigation: bounded TTL and purge process.

* Payload hash canonicalization errors causing false mismatch conflicts.
  * Mitigation: canonical serialization + golden tests.

* Backward compatibility when requiring `commandId`.
  * Mitigation: temporary compatibility mode with server-generated IDs for legacy clients.
