<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
Follow all instructions from #file:./github-backlog-planning.instructions.md while executing this workflow.

# Issues Plan

* **Repository**: dkirby-ms/tile-fighter
* **Milestone**: Layer 1 MVP

## IS001 - Update - story(layer1): E1-S1 authenticated session bootstrap

Update issue #9 to make client Entra startup behavior explicit, including bounded silent reacquire and interaction-required terminal fallback semantics.

IS001 - Similarity: #9=Match, #1=Similar, #10=Distinct, #11=Distinct

* IS001 - issue_number: #9
* IS001 - title: story(layer1): E1-S1 authenticated session bootstrap
* IS001 - state: open
* IS001 - labels: feature, infrastructure, priority:p0, status:ready, backlog
* IS001 - milestone: Layer 1 MVP
* IS001 - assignees: none

### IS001 - body

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
Client startup flow explicitly models sign-in and token lifecycle states: signed-out, acquiring-token-silently, interaction-required, token-ready, bootstrap-in-flight, bootstrap-failed.

## Harness mapping
1,2,6

## Test requirements
unit token parser and startup state transitions; integration bootstrap auth and bounded retry behavior; smoke open shell path from token-ready including interaction-required fallback path

## Telemetry events
session_started, session_bootstrap_failed

## Security and abuse checks
JWT issuer/audience checks; bootstrap rate limiting

## Dependencies
none

## Estimate
3 story points

## Confidence
High

## Target sprint
Sprint 1
```

### IS001 - Relationships

* IS001 - sub-issue-of - #1: E1-S1 remains a child of the E1 auth/session epic

## IS002 - Update - story(layer1): E1-S2 room join token issuance

Update issue #10 to explicitly require bearer-token attachment and one-time silent reacquire retry behavior on join-token calls, with interaction-required terminal fallback.

IS002 - Similarity: #10=Match, #17=Similar, #9=Similar

* IS002 - issue_number: #10
* IS002 - title: story(layer1): E1-S2 room join token issuance
* IS002 - state: open
* IS002 - labels: feature, infrastructure, priority:p0, status:ready, backlog
* IS002 - milestone: Layer 1 MVP
* IS002 - assignees: none

### IS002 - body

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
Auth service token minting and room admission guard, with explicit client-side authenticated caller behavior for join-token requests.

## Harness mapping
1,2

## Test requirements
unit token mint/verify plus caller retry semantics; integration join-token auth flow with bearer attachment and fallback checks; smoke protected join

## Telemetry events
room_join_token_issued, room_join_token_rejected

## Security and abuse checks
TTL <=120s and replay nonce validation

## Dependencies
E1-S1

## Estimate
3 story points

## Confidence
High

## Target sprint
Sprint 1
```

### IS002 - Relationships

* IS002 - sub-issue-of - #1: E1-S2 remains a child of the E1 auth/session epic

## IS003 - Update - story(layer1): E1-S3 session heartbeat lifecycle

Update issue #11 because heartbeat is directly impacted by the same bearer, bounded retry, and interaction-required fallback semantics required for bootstrap and join-token behavior.

IS003 - Similarity: #11=Match, #10=Similar

* IS003 - issue_number: #11
* IS003 - title: story(layer1): E1-S3 session heartbeat lifecycle
* IS003 - state: open
* IS003 - labels: feature, infrastructure, priority:p1, status:ready, backlog
* IS003 - milestone: Layer 1 MVP
* IS003 - assignees: none

### IS003 - body

```markdown
## Story
As an operator, I can observe session liveness so I can detect churn and startup failures.

## Acceptance criteria
- Given an active session, when heartbeat interval elapses, then client heartbeat request includes Authorization bearer token and server persists session_heartbeat.
- Given first heartbeat call returns 401, when client silently reacquires token once, then heartbeat retries exactly once.
- Given retry remains unauthorized, when retry completes, then client transitions to interaction-required terminal fallback and heartbeat loop stops until re-auth.
- Given heartbeat timeout, when server marks stale session, then player presence is cleared.
- Given session end, when client disconnects cleanly, then session_ended is emitted.

## Technical notes
Room heartbeat channel and telemetry sink, with explicit client-side authenticated heartbeat caller behavior.

## Harness mapping
2,6

## Test requirements
unit timeout policy plus caller retry semantics; integration presence cleanup with authenticated heartbeat path; load heartbeat overhead and auth resilience

## Telemetry events
session_heartbeat, session_ended, presence_cleared

## Security and abuse checks
heartbeat flood throttling

## Dependencies
E1-S2

## Estimate
2 story points

## Confidence
High

## Target sprint
Sprint 2
```

### IS003 - Relationships

* IS003 - sub-issue-of - #1: E1-S3 remains a child of the E1 auth/session epic

## IS004 - No Change - epic(layer1): E1 core platform and auth session spine

No direct body mutation required for #1 in this pass because explicit coverage is fully captured at story level in #9, #10, and #11.

IS004 - Similarity: #1=Match

* IS004 - issue_number: #1
* IS004 - title: epic(layer1): E1 core platform and auth session spine
* IS004 - state: open
* IS004 - labels: feature, infrastructure, priority:p1, status:ready, backlog
* IS004 - milestone: Layer 1 MVP
* IS004 - assignees: none

### IS004 - body

```markdown
No change required.
```

### IS004 - Relationships

* IS004 - parent-of - #9: Existing epic relationship maintained
* IS004 - parent-of - #10: Existing epic relationship maintained
* IS004 - parent-of - #11: Existing epic relationship maintained
<!-- markdown-table-prettify-ignore-end -->
