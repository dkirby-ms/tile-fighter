<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
Follow all instructions from #file:./github-backlog-planning.instructions.md while executing this workflow.

# Execution Issue Analysis - Client Entra Auth Coverage Update

* **Artifact(s)**:
  * .copilot-tracking/plans/2026-06-29/client-entra-auth-coverage-update-plan.instructions.md
  * .copilot-tracking/plans/logs/2026-06-29/client-entra-auth-coverage-update-log.md
  * .copilot-tracking/research/2026-06-29/client-entra-auth-story-gap-research.md
  * docs/layer1-backlog.md
* **Repository**: dkirby-ms/tile-fighter
* **Milestone**: Layer 1 MVP

## Planned Issues

### IS001 - Update - story(layer1): E1-S1 authenticated session bootstrap

* **Working Title**: story(layer1): E1-S1 authenticated session bootstrap
* **Key Search Terms**: "E1-S1", "bootstrap", "token-ready", "interaction-required"
* **Working Description**:
  ```markdown
  ## Story
  As a player, I can open the game shell and establish an authenticated session so I can enter the shared world.

  ## Acceptance criteria
  - Given shell state token-ready after External ID OAuth acquisition, when bootstrap runs, then session bootstrap returns player context and shell init metadata.
  - Given invalid token, when bootstrap runs, then access is denied with a non-leaky error code.
  - Given bootstrap receives 401, when the client performs one silent reacquire attempt, then bootstrap retries exactly once.
  - Given bounded retry still returns unauthorized, when retry completes, then the client transitions to interaction-required and stops silent retry loops.
  - Given bootstrap success, when telemetry initializes, then session_started is emitted once.

  ## Technical notes
  Client startup flow must explicitly model sign-in and token lifecycle states: signed-out, acquiring-token-silently, interaction-required, token-ready, bootstrap-in-flight, bootstrap-failed.

  ## Test requirements
  Unit tests cover token-state transitions and bounded retry behavior. Integration/smoke coverage validates startup from token-ready and the interaction-required terminal fallback path.
  ```
* **Working Labels**: feature, infrastructure, priority:p0, status:ready, backlog
* **Working Milestone**: Layer 1 MVP
* **Found Issue Field Values**:
  * title: story(layer1): E1-S1 authenticated session bootstrap
  * state: open
  * labels: feature, infrastructure, priority:p0, status:ready, backlog
  * milestone: Layer 1 MVP
* **Suggested Issue Field Values**:
  * title: story(layer1): E1-S1 authenticated session bootstrap
  * labels: feature, infrastructure, priority:p0, status:ready, backlog
  * milestone: Layer 1 MVP
  * body: update acceptance criteria and test requirements to make startup token lifecycle and bounded 401 retry explicit

#### IS001 - Related and Discovered Information

* Related requirements from docs/layer1-backlog.md
  * E1-S1 requires token-ready startup behavior, bounded retry, and interaction-required fallback.
* Related key details from research artifacts
  * Client token lifecycle and browser auth transitions are currently under-specified unless explicitly carried into issue acceptance criteria.

### IS002 - Update - story(layer1): E1-S2 room join token issuance

* **Working Title**: story(layer1): E1-S2 room join token issuance
* **Key Search Terms**: "E1-S2", "join-token", "Authorization bearer", "401 retry"
* **Working Description**:
  ```markdown
  ## Story
  As a player, I can request a signed room join credential so room access remains authoritative.

  ## Acceptance criteria
  - Given an authenticated session, when join token is requested, then the client attaches an Authorization bearer token and server returns a short-lived signed room token.
  - Given the first join-token request returns 401, when client performs one silent reacquire, then request retries exactly once.
  - Given retry remains unauthorized, when retry completes, then client transitions to interaction-required terminal fallback.
  - Given expired join token, when room join is attempted, then join is rejected and refresh path is offered.
  - Given valid join token, when join occurs, then server binds player identity to room presence.

  ## Technical notes
  Story scope includes explicit client-side authenticated caller semantics for join-token requests while preserving server token minting and room admission guard behavior.

  ## Test requirements
  Unit and integration tests include client-side bearer attachment and one-time retry/fallback semantics for join-token request paths.
  ```
* **Working Labels**: feature, infrastructure, priority:p0, status:ready, backlog
* **Working Milestone**: Layer 1 MVP
* **Found Issue Field Values**:
  * title: story(layer1): E1-S2 room join token issuance
  * state: open
  * labels: feature, infrastructure, priority:p0, status:ready, backlog
  * milestone: Layer 1 MVP
* **Suggested Issue Field Values**:
  * title: story(layer1): E1-S2 room join token issuance
  * labels: feature, infrastructure, priority:p0, status:ready, backlog
  * milestone: Layer 1 MVP
  * body: add explicit bearer, 401 retry, fallback, and tests coverage for join-token caller behavior

#### IS002 - Related and Discovered Information

* Related requirements from docs/layer1-backlog.md
  * E1-S2 must remain authoritative while clarifying client caller obligations.
* Related key details from research artifacts
  * Client bearer behavior and retry/fallback semantics were implicit and need explicit acceptance criteria.

### IS003 - Update - story(layer1): E1-S3 session heartbeat lifecycle

* **Working Title**: story(layer1): E1-S3 session heartbeat lifecycle
* **Key Search Terms**: "E1-S3", "heartbeat", "Authorization", "interaction-required"
* **Working Description**:
  ```markdown
  ## Story
  As an operator, I can observe session liveness so I can detect churn and startup failures.

  ## Acceptance criteria
  - Given an active session, when heartbeat interval elapses, then client heartbeat request includes Authorization bearer token and server persists session_heartbeat.
  - Given first heartbeat call returns 401, when client silently reacquires token once, then heartbeat retries exactly once.
  - Given retry remains unauthorized, when retry completes, then client transitions to interaction-required terminal fallback and heartbeat loop stops until re-auth.
  - Given heartbeat timeout, when server marks stale session, then player presence is cleared.
  - Given session end, when client disconnects cleanly, then session_ended is emitted.

  ## Test requirements
  Add client-side tests for heartbeat bearer attachment and bounded retry/fallback semantics in addition to existing timeout and cleanup coverage.
  ```
* **Working Labels**: feature, infrastructure, priority:p1, status:ready, backlog
* **Working Milestone**: Layer 1 MVP
* **Found Issue Field Values**:
  * title: story(layer1): E1-S3 session heartbeat lifecycle
  * state: open
  * labels: feature, infrastructure, priority:p1, status:ready, backlog
  * milestone: Layer 1 MVP
* **Suggested Issue Field Values**:
  * title: story(layer1): E1-S3 session heartbeat lifecycle
  * labels: feature, infrastructure, priority:p1, status:ready, backlog
  * milestone: Layer 1 MVP
  * body: include explicit heartbeat bearer and bounded retry/fallback semantics with client test expectations

#### IS003 - Related and Discovered Information

* Related requirements from docs/layer1-backlog.md
  * E1-S3 heartbeat lifecycle is directly affected by token lifecycle and auth caller behavior.
* Related key details from research artifacts
  * Heartbeat auth semantics were not explicit in current issue acceptance criteria.

### IS004 - No Change - epic(layer1): E1 core platform and auth session spine

* **Working Title**: epic(layer1): E1 core platform and auth session spine
* **Key Search Terms**: "E1", "auth session spine", "stories"
* **Working Description**:
  ```markdown
  Epic scope remains correct. No body update required for this execution pass because story-level updates in E1-S1, E1-S2, and E1-S3 capture the needed client auth coverage.
  ```
* **Working Labels**: feature, infrastructure, priority:p1, status:ready, backlog
* **Working Milestone**: Layer 1 MVP
* **Found Issue Field Values**:
  * title: epic(layer1): E1 core platform and auth session spine
  * state: open
  * labels: feature, infrastructure, priority:p1, status:ready, backlog
  * milestone: Layer 1 MVP
* **Suggested Issue Field Values**:
  * no change

#### IS004 - Related and Discovered Information

* Related key details
  * Existing epic in-scope list already includes bootstrap, join-token, and heartbeat; story updates are sufficient.

## Similarity and Duplicate Safety Results

### Candidate split stories (E1-S1a and E1-S1b)

* Search query: repo:dkirby-ms/tile-fighter is:issue is:open "E1-S1a" OR "E1-S1b"
  * Result: total_count 0
* Search query: repo:dkirby-ms/tile-fighter is:issue is:open "client authenticated session API caller"
  * Result: total_count 0
* Search query: repo:dkirby-ms/tile-fighter is:issue is:open "interaction-required" bootstrap join-token heartbeat
  * Result: total_count 0

Conclusion: no existing dedicated split-story issue detected. Split creation is not required because updates to canonical issues #9, #10, and #11 fully cover required behavior and tests.
<!-- markdown-table-prettify-ignore-end -->
