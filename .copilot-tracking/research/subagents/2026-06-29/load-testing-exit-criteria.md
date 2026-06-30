---
title: Load Testing and Exit Criteria Infrastructure Research
description: Complete analysis of tile-fighter load testing setup, telemetry collection, and Layer 1 MVP exit criteria
date: 2026-06-29
author: Research Agent
---

## Executive Summary

The tile-fighter project has foundational load testing infrastructure and clearly defined exit criteria for Layer 1 MVP launch. The harness combines CI/CD gates, load testing validation, and post-deploy monitoring to ensure "50 CCU stable, <200ms median placement ack" is measurable and verifiable.

**Key Findings:**
- Load tests exist for region-diff and room-join scenarios with latency percentile reporting
- Telemetry sink emits detailed placement, edit, and sync events (no external dashboards configured yet)
- CICD harness maps to 7-point release cycle with explicit verification gates
- Exit criteria are quantified: 50 CCU for 30 min, median ack <200ms, p95 reconnect <3s

---

## 1. Load Testing Setup

### 1.1 Load Test Files Location and Inventory

**Directory:** `apps/server/tests/load/`

**Files:**
1. `region-diff-load.ts` – Region state synchronization load test
2. `room-join-load.ts` – Placement contention and heartbeat throttle tests

### 1.2 Region Diff Load Test (`region-diff-load.ts`)

**Purpose:** Validate region diff response latency and payload sizing under mixed stale/unchanged workload.

**Test Setup:**
- Total requests: 60
- Stale ratio: 65% (`sinceVersion: 0`)
- Unchanged ratio: 35% (`sinceVersion: 20`)
- Concurrent execution: All 60 jobs fire in parallel using `Promise.all()`

**Latency Measurement:**
```typescript
const start = Date.now();
const response = await request(app)
  .post("/api/regions/diff")
  .set("Authorization", "Bearer valid-token")
  .send({ regionId, sinceVersion, viewport, maxTiles: 500 });
const latencyMs = Date.now() - start;
```

**Metrics Reported:**
- Stale requests: count, avg_bytes, p95_ms
- Unchanged requests: count, avg_bytes, p95_ms
- Status code validation: all requests must return 200
- Payload comparison: stale avg_bytes must exceed unchanged avg_bytes

**Output Sample:**
```
[region-diff-load] stale count=39 avg_bytes=1234.5 p95_ms=45
[region-diff-load] unchanged count=21 avg_bytes=156.2 p95_ms=12
```

**Percentile Calculation:** Uses `sorted[Math.floor((p/100) * length)]` for index-based percentile extraction (not interpolated).

### 1.3 Room Join Load Test (`room-join-load.ts`)

**Purpose:** Validate placement authoritative logic, contention handling, and heartbeat rate limiting under concurrent load.

**Test Scenarios:**

#### Scenario 1: Placement Contention (Hot Cell)
- Concurrent attempts: 12 simultaneous requests to same coordinate
- Expected outcomes:
  - 1 success (201): First placer wins, tile inserted
  - N-1 rejections: Mix of 409 (occupied) and 429 (throttled)
  
**Verification:**
```typescript
expect(createdResponses).toHaveLength(1);
expect(occupiedResponses.length + throttledResponses.length).toBe(attempts - 1);
expect(occupiedResponses.length).toBeGreaterThan(0);
expect(throttledResponses.length).toBeGreaterThan(0);
```

**Response Contracts:**
- Occupied (409): `{ ok: false, reason: "occupied" }`
- Throttled (429): `{ ok: false, reason: "throttled", retryAfterMs: number }`

#### Scenario 2: Heartbeat Rate Limiting
- Burst size: 40 concurrent heartbeat requests
- Expected outcomes:
  - Some succeed (202): Heartbeat accepted
  - Some fail (429): Rate limit threshold exceeded
  
**Throttle Policy (Default):**
- Window: 60,000 ms (1 minute)
- Max requests per window: 5 (per account + region)
- TTL: 24 hours (entries evicted after 24h inactivity)

### 1.4 Current CCU Level Support

**Explicit CCU Coverage:**
- Region-diff load test: 60 concurrent requests (simulates ~60 CCU refresh cycle)
- Room-join load test: 12-40 concurrent placement/heartbeat requests
- Current infrastructure: **Not yet validated for sustained 50 CCU for 30 minutes**

**CCU Runbook Gap:**
Epic E3-S2 in backlog specifies: "User story: As a producer, I can validate 50 CCU and placement ack latency under 200 ms median."

Acceptance criteria:
- Load harness at 50 CCU, run for 30 minutes → median ack latency <200ms
- P95 reconnect <3s, error budget within threshold
- Quick 10 CCU sanity smoke test

**Status:** E3-S2 is planned but not yet implemented. Current tests are scenario-focused (contention, throttle) rather than sustained-load CCU validation.

---

## 2. Telemetry and Metrics

### 2.1 Telemetry Sink Architecture

**File:** `apps/server/src/telemetry/telemetry-sink.ts`

**Configuration Modes:**
- `off` – Telemetry disabled (no-op)
- `optional` – Sink URL optional, silent failure if unavailable
- `required` – Sink URL must succeed or throw (deployment-blocking)

**Telemetry Delivery:**
- HTTP POST to `config.telemetrySinkUrl` with JSON payload
- Header: `X-Telemetry-Sink: ${config.telemetrySinkName}` (if name provided)
- Payload structure:
  ```json
  {
    "eventName": "tile_placed",
    "occurredAt": "2026-06-29T12:00:00.000Z",
    "attributes": {
      "tile_id": 101,
      "region_id": "arena-main",
      "cell_x": 3,
      "cell_y": 4,
      "owner_id": "tenant-a|player-1",
      "timestamp": "2026-06-29T12:00:00.000Z"
    }
  }
  ```

### 2.2 Placement Acknowledgement Latency Measurement

**Definition:** "Placement Ack" = Time from HTTP POST `/api/tiles/place` request to response received.

**Current Implementation:** Not explicitly instrumented in telemetry sink.

**Calculation Method (from load tests):**
```typescript
const start = Date.now();
const response = await request(app).post("/api/tiles/place").send({...});
const latencyMs = Date.now() - start;
```

**Latency Points:**
- Client measures: Request issued → HTTP response received
- Server-side: Request received → Response sent (includes: auth, repo insert, throttle check, telemetry emit)
- Network overhead: Negligible in collocated test environment

**Metrics to Collect (proposed):**
- `latency_ms`: End-to-end HTTP round trip
- `outcome`: 201 (success), 409 (occupied), 429 (throttled)
- `region_id`, `owner_id`: For aggregation by region/player

### 2.3 Emitted Telemetry Events

**Tile Lifecycle Events:**

| Event | Trigger | Attributes |
|-------|---------|-----------|
| `tile_persisted` | Tile inserted to DB | tile_id, region_id, cell_x, cell_y, owner_id, timestamp |
| `tile_persist_conflict` | Coordinate conflict on insert | region_id, cell_x, cell_y, attempted_owner_id, timestamp |
| `tile_placed` | Story-level placement success | tile_id, region_id, cell_x, cell_y, owner_id, timestamp |
| `tile_place_rejected` | Placement denial (policy) | region_id, cell_x, cell_y, attempted_owner_id, reason, timestamp |
| `tile_place_throttled` | Rate limit rejection | region_id, cell_x, cell_y, attempted_owner_id, retry_after_ms, throttle_window_ms, throttle_max_requests, timestamp |
| `tile_edited` | Tile edit within window | tile_id, region_id, cell_x, cell_y, owner_id, timestamp |

**Region Sync Events:**

| Event | Trigger | Attributes |
|-------|---------|-----------|
| `tile_diff_requested` | Region diff query | region_id, since_version, current_version, viewport_area, timestamp |
| `tile_diff_returned` | Diff response assembled | region_id, since_version, current_version, viewport_area, tile_count, truncated, duration_ms, timestamp |
| `snapshot_created` | Region snapshot persisted | region_id, snapshot_id, tile_count, expected_hash, timestamp |
| `snapshot_restore_started` | Snapshot restore initiated | region_id, snapshot_id, tile_count, expected_hash, timestamp |
| `snapshot_restore_completed` | Restore + verification done | region_id, snapshot_id, tile_count, expected_hash, actual_hash, duration_ms, timestamp |

**Session Lifecycle Events (from integration test setup):**
- `session_started` – Session bootstrap succeeded
- `session_heartbeat` – Heartbeat received
- `session_ended` – Session terminated
- `room_joined` – Room membership established
- `room_rejoined` – Reconnect after disconnect
- `room_join_token_issued` – Join credential minted
- `room_join_token_rejected` – Join token auth failed

### 2.4 Dashboards and Monitoring

**Current State:**
- Telemetry sink is **configured but not integrated with dashboards**
- No Application Insights, Datadog, or cloud monitoring dashboard referenced
- Sink URL and mode are environment variables injected at deploy time
- Harness documents telemetry sink config as required secret: `TELEMETRY_SINK_URL`, `TELEMETRY_SINK_MODE`, `TELEMETRY_SINK_NAME`

**Verification Evidence Artifact:**
- `artifacts/verify-room-join-metrics.json` generated by verify-release workflow
- Contains: sample count, durations, `p50Ms` (room-join smoke test metric)
- Promotion blocked if `p50Ms` exceeds 5000

**Gap:** No guidance on where telemetry sink should forward events (Azure Monitor, custom endpoint, etc.)

---

## 3. CICD Harness Structure and Verification

### 3.1 7-Point Harness Overview

The deployment harness maps to **7 discrete stages** referenced throughout backlog exit criteria:

| Point | Stage | Responsibility | Tool/Workflow |
|-------|-------|-----------------|---------------|
| 1 | **CI Build** | Compile, lint, unit tests, dependency audit | `.github/workflows/ci.yml` |
| 2 | **Integration & Load Tests** | DB schema, integration suite, load scenario execution | `npm run test` (server workspace) |
| 3 | **Security Gates** | Container scan (Trivy), policy violation detection | Release workflow + `aquasec/trivy:0.67.2` |
| 4 | **Artifact & Deployment** | Build Docker image, push ACR, provision infra, deploy to Container Apps | `.github/workflows/release-{dev,prod}.yml` |
| 5 | **Smoke & Readiness** | Health probes, protected routes, basic auth flow | `.github/workflows/verify-release.yml` |
| 6 | **Load Validation & Metrics** | 50 CCU sustained load, ack latency p50, reconnect p95 | Planned in E3-S2 |
| 7 | **Rollback Drill & Runbook** | Revision rollback procedure, incident triage checklist | `cicd-harness.md` operations section |

### 3.2 Harness Mapping to Backlog Exit Criteria

**Epic E1 (Core Platform and Auth Session Spine):**
- Harness points: **1, 2, 6**
- Exit criteria: token-ready → authenticated room join <5s p50; health/ready/protected smoke green
- Verification: `/healthz`, `/readyz`, `/api/protected/profile` with bearer token

**Epic E2 (Authoritative Tile State and Persistence):**
- Harness points: **1, 2**
- Exit criteria: placement rules deterministic; snapshots restorable without state drift
- Verification: unit + integration tests for schema, insert conflict, restore replay

**Epic E3 (Real-time Sync and Room Reliability):**
- Harness points: **2, 6, 7**
- Exit criteria: 50 CCU test passes; reconnect recovers state within 3s p95
- Verification: Load test harness at 50 CCU for 30 min; reconnect drop/resume smoke

### 3.3 Post-Deploy Verification Gate

**File:** `.github/workflows/verify-release.yml`

**Verification Checks (Current):**

1. **Readiness Probes:**
   - `GET /healthz` → 200 (liveness)
   - `GET /readyz` → 200 (readiness, includes DB connectivity)
   - `/api/protected/profile` → 200 with valid bearer token

2. **Bootstrap Flow:**
   - `GET /api/session/bootstrap` from token-ready state
   - Returns shell-init retry policy
   - Emits `session_started` telemetry event

3. **Authenticated Room Join Smoke:**
   - Existing harness: `npm run -w @game/server test:load`
   - Exercises placement, edit, and throttle paths
   - Asserts room-membership authority in Colyseus lifecycle hooks

4. **Metrics Artifact:**
   - Workflow writes `artifacts/verify-room-join-metrics.json`
   - Structure: `{ sampleCount, durations: number[], p50Ms: number }`
   - Promotion blocked if `p50Ms > 5000`

**Verification Token Requirements:**
- Must be minted by External ID tenant
- Target audience: `api://tile-fighter-server`
- Issuer, audience, tenant ID must match deployment config

### 3.4 Rollback Procedure and Incident Triage

**Revision Rollback (Azure Container Apps):**
```bash
az containerapp revision list \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME"

az containerapp revision activate \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME" \
  --revision "$LAST_KNOWN_GOOD_REVISION"

az containerapp revision deactivate \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME" \
  --revision "$FAILED_REVISION"
```

**Incident Triage Checklist:**
1. Confirm release job status, capture deployment logs
2. Check `/healthz` and `/readyz` directly from deployed ingress URL
3. Confirm protected route auth, validate verification token claims
4. Confirm bootstrap route auth and shell-init payload contract
5. Confirm telemetry sink configuration for required environments
6. Run room-join smoke with reduced `LOAD_JOIN_COUNT` to isolate failures
7. Decide rollback based on readiness + authenticated smoke, not only liveness
8. Open incident issue with timeline, affected revision, mitigation status

---

## 4. Exit Criteria Assessment

### 4.1 "50 CCU Run Passes" – Operational Definition

**What It Means:**
- **CCU (Concurrent Users):** 50 players simultaneously connected to game server, each heartbeating and issuing placement/edit/diff requests
- **Duration:** Sustained for minimum 30 minutes without degradation
- **Success Criteria:**
  - All placement requests receive deterministic responses (201/409/429)
  - Median acknowledgement latency remains <200ms throughout run
  - P95 reconnect latency <3s after transient disconnect
  - Zero unhandled exceptions or crash-causing defects
  - Memory/CPU remain stable (no runaway leaks)
  - Telemetry events successfully ingested

**Target Environment:**
- Non-production staging: Azure Container Apps, PostgreSQL, Colyseus room cluster
- Network: Collocated test client to app (latency ~5-10ms)
- Load profile: Mixed workload (65% region-diff requests, 35% placement/edit attempts)

**Measurement Method:**
- Load harness: Client runs 50 concurrent player simulators
- Each simulator: Issues heartbeat every 30s, placement attempts every 5-10s, diff requests on viewport change
- Telemetry sink: Collects events with `duration_ms` and `latency_ms` attributes
- Post-run analysis: Calculate p50, p95, p99 latencies by event type

### 4.2 "Median Placement Ack <200ms" – Measurement

**Definition:**
- **Placement Ack:** Time from HTTP POST `/api/tiles/place` to HTTP response received
- **Median:** 50th percentile across all placement requests in 30-min run
- **200ms Threshold:** Product requirement for "near-real-time" feel in browser game

**How to Measure:**
1. Load test emits placement request with `Date.now()` as `startMs`
2. Response latency: `Date.now() - startMs`
3. Collect all latencies into array
4. Sort and compute `p50 = sorted[Math.floor(0.5 * length)]`
5. Assert `p50 < 200`

**Breakdown by Outcome:**
- **201 (Created):** Success path latency (fastest path: no conflict)
- **409 (Occupied):** Conflict path latency (includes uniqueness check)
- **429 (Throttled):** Throttle lookup + cache hit latency

**Current Gap:**
- Load tests calculate latency but **do not assert <200ms threshold**
- E3-S2 story is planned but not implemented
- Harness point 6 (Load Validation & Metrics) is not yet wired into CI/CD pipeline

### 4.3 Target Environment Configuration

**Deployment Target:**
- **Compute:** Azure Container Apps with 1-2 instance replicas
- **Database:** PostgreSQL 15 in Azure Database for PostgreSQL Flexible Server
- **Networking:** Private endpoint or service endpoint for DB access
- **Auth:** External ID tenant issuer for player identity

**Load Test Target (Staging):**
- Pre-prod Container Apps endpoint with dev telemetry sink
- Test DB in dev resource group (isolated from prod)
- Reduced secret/quota limits to catch performance regressions early

**Verification Token Source:**
- Dedicated External ID service principal in test tenant
- Mints tokens with standard claims, 1-hour expiry
- Issued by: `https://login.microsoftonline.com/{tenant-id}/v2.0`

---

## 5. Implementation Roadmap

### 5.1 Current Gaps

1. **No sustained-load CCU harness** – Only scenario-focused tests exist
2. **No external dashboards** – Telemetry sink configured but no sink endpoint defined
3. **Load validation not in CI/CD** – Point 6 (Load Validation) is manual, not automated
4. **No latency SLA enforcement** – Threshold exists (<200ms) but not checked in pipeline
5. **Reconnect recovery drill** – E3-S3 story planned but not implemented

### 5.2 Next Steps (Post-MVP Phase 1)

**Phase 1a (E3-S2 Implementation):**
- Implement 50 CCU load harness runner
- Emit placement ack latency to telemetry sink
- Assert p50 <200ms, p95 reconnect <3s
- Wire harness into GitHub Actions (point 6)

**Phase 1b (Monitoring Integration):**
- Deploy telemetry sink endpoint (e.g., Application Insights, Datadog)
- Create dashboard for placement ack, reconnect latency, error rates
- Add alert thresholds for SLA violations

**Phase 1c (Runbook Execution):**
- Perform rollback drill in staging (point 7)
- Document incident response procedures
- Cross-train ops team on verification workflow

---

## 6. Reference Materials

### File References
- **Load Tests:** `apps/server/tests/load/region-diff-load.ts`, `room-join-load.ts`
- **Telemetry:** `apps/server/src/telemetry/telemetry-sink.ts`
- **Harness Doc:** `docs/cicd-harness.md`
- **Backlog:** `docs/layer1-backlog.md` (Epic E3, especially E3-S2)
- **Game Design:** `docs/game-design-document.md` (Launch criteria section)

### Key Configurations
- **Throttle Policy:** 5 requests per 60s per account+region (default)
- **Self-Edit Window:** 10 minutes post-placement
- **Heartbeat TTL:** 30 seconds (stale threshold)
- **Bootstrap Retry:** Max 1 silent reacquire on 401
- **Reconnect Grace Period:** TBD (configurable, currently no explicit timeout in Colyseus)

### Environment Secrets
- `TELEMETRY_SINK_MODE` – off | optional | required
- `TELEMETRY_SINK_URL` – HTTP endpoint for telemetry ingestion
- `TELEMETRY_SINK_NAME` – Identifier in X-Telemetry-Sink header

---

## 7. Conclusions

1. **Load Testing Foundation:** Exists and validates contention/throttle logic but lacks sustained-CCU harness for production readiness.
2. **Telemetry:** Fully instrumented at event level; measurement infrastructure ready but not connected to dashboards.
3. **Harness:** 7-point CICD harness well-defined; points 1-5 mostly implemented; points 6-7 (metrics + rollback) require post-MVP hardening.
4. **Exit Criteria:** Quantified (50 CCU, <200ms median ack, <3s p95 reconnect) but not yet automated in pipeline; ready for E3-S2 implementation.
5. **Verification Gate:** Smoke tests work; load validation gate is placeholder awaiting E3-S2 completion.

**Recommendation:** Prioritize E3-S2 (50 CCU harness + latency SLA enforcement) immediately post-Phase-1-completion to unlock production readiness signal for Layer 1 launch.

