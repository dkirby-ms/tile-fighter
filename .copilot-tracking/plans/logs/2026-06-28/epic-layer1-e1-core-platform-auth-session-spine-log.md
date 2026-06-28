<!-- markdownlint-disable-file -->
# Planning Log: Epic Layer1 E1 Core Platform and Auth Session Spine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None currently. The plan now treats the External ID app-registration and authority contract as an explicit E1-S1 implementation step rather than a prerequisite note.

### Plan Deviations from Research

* None currently. The selected E1 verification strategy keeps pre-minted External ID tokens for smoke checks and adds explicit provenance plus expected-claim validation in the verification workflow.

### Implementation Deviations

* DD-01: Created `apps/client` workspace during E1-S1 implementation.
  * Plan specifies: Planned shell auth implementation surface under `apps/client/`.
  * Implementation differs: The workspace did not previously exist and was created as a minimal additive package to host MSAL/token-ready bootstrap logic.
  * Rationale: Required to satisfy Step 1.3 with concrete in-repo implementation files.
* DD-02: Join-token replay tracking explicitly bounded to token expiry.
  * Plan specifies: Replay protection primitives for room admission without introducing a second room-membership state machine.
  * Implementation differs: Added an expiring in-memory consumed-token cache keyed by `jti` and pruned by token `exp`.
  * Rationale: Keep replay defense admission-scoped and time-bounded, preventing drift into long-lived session state management.
* DD-03: Lifecycle adapter implemented as metadata-only service with explicit room-hook integration.
  * Plan specifies: Non-authoritative lifecycle adapter derived from Colyseus lifecycle hooks.
  * Implementation differs: Added heartbeat endpoint and metadata cleanup service, with room join/leave signals emitted from `ArenaRoom` hooks.
  * Rationale: Preserve Colyseus as room-membership authority while enabling stale metadata hygiene and telemetry.
* DD-04: Verification/load harness aligned to stable room key and p50 evidence artifact output.
  * Plan specifies: Verification gate checks bootstrap + room-join flow and captures p50 evidence.
  * Implementation differs: Load harness now executes token-ready bootstrap + join-token mint + authenticated room join and writes `artifacts/verify-room-join-metrics.json`.
  * Rationale: Make p50 metric reproducible and enforceable in verify workflow.
* DD-05: Full validation load check blocked in local environment.
  * Plan specifies: Run full lint/test/build/load validation commands.
  * Implementation differs: Load command fails locally without required runtime env (`DATABASE_URL`, `ENTRA_ISSUER`, `ENTRA_AUDIENCE`, `ENTRA_JWKS_URL`, `TENANT_MODE`).
  * Rationale: Treat as environment blocker; verification workflow remains capable when secrets are provisioned.

## Implementation Paths Considered

### Selected: Incremental Vertical Slices on Existing Spine

* Approach: Implement E1-S1 through E1-S4 as additive slices over existing startup/auth/room infrastructure, with an explicit shell-to-API OAuth contract backed by a dedicated Microsoft Entra External ID tenant.
* Rationale: Lowest regression risk, clear contract boundaries, preserves the current API trust boundary, and closes the prior gap where E1 implicitly assumed the client already had a bearer token.
* Evidence: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 88-143, 156-201); .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 54-78, 157-200)

### IP-01: Full auth/session subsystem rewrite first

* Approach: Replace major portions of auth/session stack before adding story-level features.
* Trade-offs: Potentially cleaner long-term architecture, but large migration risk and delayed usable increments.
* Rejection rationale: Existing platform spine is already functioning and supports additive evolution with lower risk.

### IP-02: Minimal verification-only patch

* Approach: Implement smoke/verification updates only and defer join-token and heartbeat lifecycle work.
* Trade-offs: Fastest near-term gate improvements, but misses core issue scope and cannot close epic acceptance.
* Rejection rationale: Contradicts explicit in-scope epic requirements for join-token issuance and heartbeat lifecycle.

### IP-03: Server-only External ID validation with no shell OAuth contract

* Approach: Keep planning limited to API-side issuer/audience validation and continue assuming the client arrives with a usable bearer token.
* Trade-offs: Smaller server-side scope, but leaves bootstrap timing, retry behavior, CI token provenance, and first-class External ID integration undefined.
* Rejection rationale: Conflicts with the user's requirement to build for OAuth backed by an Entra External ID tenant and would leave E1-S1 acceptance ambiguous.

## Suggested Follow-On Work

* WI-01: Canonical E1 story issue reconciliation — Close duplicate story set ambiguity (#9-#12 vs #49-#52) and align epic tracking references. (high)
  * Source: .copilot-tracking/research/2026-06-28/epic-layer1-e1-core-platform-auth-session-spine-research.md (Lines 36-38, 150-151)
  * Dependency: Initial E1 implementation PRs prepared.
* WI-01A: External ID app-registration contract — Define shell client registration, game API audience/app ID URI, token version, and authority/user-flow ownership for implementation teams. (high)
  * Source: .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 157-181)
  * Dependency: Captured in E1-S1 Step 1.1 for implementation; retain as rollout coordination work for tenant admins and deployment owners.
* WI-02: Join-token secret rotation and key-versioning strategy — Define rotation cadence, versioned signing keys, and operational runbook. (medium)
  * Source: Join-token service design requirements identified in E1-S2 planning.
  * Dependency: E1-S2 token issuance implementation complete.
* WI-03: Presence metadata persistence model hardening — Evaluate durable storage for auxiliary presence metadata beyond in-memory tracking for multi-instance reliability. (medium)
  * Source: Research notes that persistence currently does not model lifecycle-related metadata.
  * Dependency: E1-S3 baseline lifecycle adapter complete.
* WI-03A: CI token mint automation — Revisit whether post-E1 workflows should automate External ID token minting instead of relying on pre-minted verification tokens with provenance and claim validation. (medium)
  * Source: .copilot-tracking/research/subagents/2026-06-28/entra-external-id-auth-research.md (Lines 123-139, 182-190)
  * Dependency: After E1-S4 verification workflow changes are live and stable.
* WI-04: Verification artifact retention policy — Standardize storage duration and naming for p50 evidence and smoke logs in CI artifacts. (low)
  * Source: E1 exit criteria requires measurable proof for closure.
  * Dependency: E1-S4 verification workflow updates complete.
* WI-05: Local load harness env bootstrap profile — Provide developer-safe `.env.load.local` profile and documentation for running `test:load` outside CI. (medium)
  * Source: Phase 5 full validation blocker (local env lacks required runtime auth/DB vars).
  * Dependency: Decide local strategy for External ID token source and database endpoint.
