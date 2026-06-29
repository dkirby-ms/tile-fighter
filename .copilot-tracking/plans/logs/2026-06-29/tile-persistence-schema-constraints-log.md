<!-- markdownlint-disable-file -->
# Planning Log: Tile Persistence Schema and Constraints (Issue #13)

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* DR-01: Tile endpoint HTTP route design (GET /tiles, POST /tiles for placement)
  * Source: Research file, section "API and Schema Documentation"
  * Reason: HTTP route implementation deferred to follow-on work (Phase 5); current scope focuses on persistence schema and repository only
  * Impact: low — HTTP layer is planned but not required for schema validation
* DR-02: Client-side tile placement UI and validation
  * Source: Research file, section "Finalized Hybrid Decisions"
  * Reason: Client implementation is separate from server persistence schema; deferred to follow-on work
  * Impact: low — Server can accept tile placements before client UI is complete
* DR-03: Tile archival and lifecycle management (delete, update operations)
  * Source: Research file, section "Scope and Success Criteria"
  * Reason: Issue #13 focuses on insert and read-only persistence; update/delete deferred to follow-on work
  * Impact: medium — Full tile lifecycle not yet implemented; read-only model may need extension

### Plan Deviations from Research

* DD-01: Telemetry sink integration is optional in Phase 3
  * Research recommends: Emit tile_persisted and tile_persist_conflict events (mandatory)
  * Plan implements: Telemetry is injected as optional dependency to avoid breaking existing code
  * Rationale: Allows phased deployment; telemetry can be enabled once sink is fully integrated with observability system

* DD-02: Shared types are optional in Phase 5
  * Research implies: Tile DTOs and result contracts should be defined
  * Plan implements: Shared types are deferred decision based on whether tile endpoints are shared between client/server in v0
  * Rationale: Minimizes blast radius if tile persistence is initially server-internal; can be added once HTTP endpoints are designed

## Implementation Paths Considered

### Selected: Canonical Hybrid Schema with Coordinate-Based Uniqueness

* Approach: Single tiles table with integer grid coordinates (cell_x, cell_y) as authority, visual offsets (offset_x, offset_y) as expression layer, unique constraint on (region_id, cell_x, cell_y), deterministic SQLSTATE 23505 mapping to coordinate_conflict error
* Rationale: Matches game design intent (cell-based occupancy with visual offset expression), aligns with existing Kysely + node-pg-migrate patterns in repository, provides type-safe repository abstraction via Kysely, supports efficient region/coordinate indexing
* Evidence: Research file "Finalized Hybrid Decisions" section confirms this approach; existing persistence patterns in db.ts and migrations validate feasibility

### IP-01: Separate Shape/Color/Payload Tables with Foreign Keys

* Approach: Decompose tiles into multiple tables (tile_placements, tile_appearances) with foreign key constraints and normalized schema
* Trade-offs: 
  * Benefits: Stricter schema validation, potential code reuse for tile types/appearances
  * Drawbacks: More complex queries, higher JOIN cost, additional migration maintenance, overengineered for v0 scope
* Rejection rationale: Research emphasizes "minimal viable implementation" and existing persistence patterns favor flat tables; denormalization acceptable for v0

### IP-02: Event Sourcing for Tile Placement History

* Approach: Event log table (tile_events) recording all placement/update/delete operations instead of direct tile state
* Trade-offs:
  * Benefits: Complete audit trail, time-travel queries, replay semantics
  * Drawbacks: Query complexity, higher storage overhead, not required for Issue #13 scope
* Rejection rationale: Issue #13 explicitly requires "persist tile fields" and deterministic conflict handling, not full event history; overengineered for v0

## Implementation Paths Considered

### Alternate: Redis Pub/Sub for Real-Time Tile Updates (Considered but Rejected)

* Approach: Use Redis for tile state synchronization and conflict detection instead of PostgreSQL
* Trade-offs:
  * Benefits: Low latency, real-time updates, good for multiplayer sync
  * Drawbacks: Loss of durability without persistence layer, network partition issues, requires dual write to Postgres for durability anyway
* Rejection rationale: Issue #13 explicitly requires persistent storage; Redis alone insufficient; would still require PostgreSQL backend

## Suggested Follow-On Work

Items identified during planning that fall outside current scope.

* WI-01: Implement HTTP tile placement endpoint (POST /tiles)
  * Description: Add HTTP route handler for clients to submit tile placements; validate placement request, call tile repository, return TileDTO or conflict error; wire endpoint to authentication and authorization middleware
  * Priority: high
  * Source: GitHub Issue #13 acceptance criteria (implied); game mechanics require placement endpoint
  * Dependency: Phase 1-4 complete (tile persistence schema and repository must exist first)
  * Effort estimate: medium (1-2 days)

* WI-02: Implement tile update operation (PUT /tiles/:id)
  * Description: Support tile property updates (color, shape, style payload) without coordinate changes; validate owner authorization; emit tile_updated telemetry event
  * Priority: medium
  * Source: Game design requirements; follows from insertion
  * Dependency: WI-01 complete; tile persistence schema established
  * Effort estimate: medium (1-2 days)

* WI-03: Implement tile delete operation (DELETE /tiles/:id)
  * Description: Remove tile from region; validate owner authorization; emit tile_deleted telemetry event; support cascading if future entities reference tiles
  * Priority: medium
  * Source: Game design requirements; completes CRUD
  * Dependency: WI-02 complete
  * Effort estimate: small (1 day)

* WI-04: Add tile archival and cleanup strategy
  * Description: Define TTL or archive policy for old tiles; implement periodic cleanup or archive to separate table; optimize storage for long-running game sessions
  * Priority: low
  * Source: Scalability consideration; not required for v0
  * Dependency: WI-01, WI-03 complete
  * Effort estimate: medium (1-2 days)

* WI-05: Performance optimization: composite index on (region_id, owner_id)
  * Description: Add index to support queries like "find all tiles owned by player in region"; analyze query plans after HTTP endpoints are live to confirm index benefit
  * Priority: low
  * Source: Query performance consideration; defer until profiling shows need
  * Dependency: WI-01 complete and HTTP routes being used
  * Effort estimate: small (0.5 day)

* WI-06: Client-side tile placement UI and validation
  * Description: Add client-side form/canvas for tile placement; validate offsets are in range [-0.49, 0.49]; display conflict feedback; integrate with authentication
  * Priority: medium
  * Source: Game UI requirements
  * Dependency: WI-01 complete (HTTP endpoint must exist)
  * Effort estimate: medium-high (2-3 days)

* WI-07: Add tile query pagination and filtering
  * Description: Implement paginated list endpoint (GET /tiles?region=X&limit=50&offset=0); add filtering by owner or region; support sorting by created_at or position
  * Priority: low
  * Source: User experience for large tile datasets
  * Dependency: WI-01 complete
  * Effort estimate: small-medium (1 day)

* WI-08: Integrate with room state for real-time sync
  * Description: Emit tile placement events to Colyseus room state so clients receive live updates; synchronize tile state across connected players
  * Priority: high
  * Source: Multiplayer game mechanics
  * Dependency: WI-01 complete; tile persistence must exist first
  * Effort estimate: medium (1-2 days)

## Decision Log

### Shared Types Location (Phase 5 Decision)

**Decision**: Defer shared-types update until HTTP endpoints are designed and tile contracts are confirmed as shared between client/server.

**Rationale**: Reduces risk of defining types prematurely if tile persistence is initially server-internal; minimizes breaking changes to shared package in v0.

**Impact**: Slightly delays client integration but ensures types accurately reflect usage patterns.

**Reversal trigger**: If client team confirms tile placement endpoint is needed in v0, execute WI-06 and add shared types immediately.

### Telemetry Sink Integration (Phase 3 Decision)

**Decision**: Telemetry events are injected as optional dependency rather than required.

**Rationale**: Allows tile repository to work without observable system integration; can be added incrementally.

**Impact**: Events are not emitted until telemetry sink is wired; minor delay in observability coverage.

**Reversal trigger**: If observability is critical path blocker, make telemetry required and initialize sink in server startup.

## Validation Status

* Research phase: Complete — Research document provides comprehensive technical specifications
* Planning phase: Complete — Implementation plan and details files created
* Validation readiness: Pending — Plan Validator subagent review recommended before implementation

### Pre-Validator Checklist

* [x] All user requirements from Issue #13 are mapped to implementation steps
* [x] Derived objectives include schema extension, repository abstraction, and test coverage
* [x] File paths are specific and traceable to repository structure
* [x] Phases are ordered with clear dependencies and parallelization markers
* [x] Test coverage includes unit, integration, and smoke scenarios
* [x] Discrepancies between research and plan are documented
* [x] Implementation paths considered are evaluated with rationale
* [x] Follow-on work items are prioritized and scoped

### Outstanding Questions

* Q1: Should tile endpoints be exposed as REST API in v0, or kept internal for now?
  * Answer needed from: product/game design team
  * Impact on plan: Determines if shared-types update (Phase 5) is executed
  * Recommendation: Treat as follow-on work (WI-01); schema is independent of HTTP layer

* Q2: Is telemetry sink fully integrated with observability platform?
  * Answer needed from: observability/monitoring team
  * Impact on plan: Determines if telemetry injection (Phase 3.2) is enabled
  * Recommendation: Make telemetry optional in Phase 3; enable once sink is confirmed

* Q3: What is expected cardinality of tiles per region for v0?
  * Answer needed from: game design or load testing
  * Impact on plan: Confirms index strategy is sufficient or if additional tuning is needed
  * Recommendation: Proceed with current indexes; add performance optimization (WI-05) if load tests show need
