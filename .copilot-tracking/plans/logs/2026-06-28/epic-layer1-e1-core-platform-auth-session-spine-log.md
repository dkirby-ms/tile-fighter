<!-- markdownlint-disable-file -->
# Planning Log: Epic Layer1 E1 Core Platform and Auth Session Spine

## Discrepancy Log

Gaps and differences identified between research findings and the implementation plan.

### Unaddressed Research Items

* None currently. The plan now treats the External ID app-registration and authority contract as an explicit E1-S1 implementation step rather than a prerequisite note.

### Plan Deviations from Research

* None currently. The selected E1 verification strategy keeps pre-minted External ID tokens for smoke checks and adds explicit provenance plus expected-claim validation in the verification workflow.

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
