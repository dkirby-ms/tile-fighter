---
title: Entra External ID Auth Research
description: Research on planning impacts for adapting E1 auth/session work to OAuth backed by a Microsoft Entra ID External Identities tenant
author: GitHub Copilot
ms.date: 2026-06-28
ms.topic: reference
keywords:
  - entra external id
  - oauth
  - oidc
  - auth planning
  - tile-fighter
estimated_reading_time: 8
---

## Research Scope

* Status: Complete
* Primary question: how the existing E1 auth/session plan should change when player authentication must use OAuth backed by a Microsoft Entra ID External Identities tenant.
* Focus: planning-relevant impacts to E1 bootstrap, JWT validation, join-token issuance, verification, testing, and CI.
* Constraint followed: research only, with no modifications outside this research output.

## Repository Baseline

* The current server assumes the client already holds a bearer token and that E1 starts at API token validation.
  * apps/server/src/http/auth-middleware.ts:10-19 extracts a `Bearer` token and immediately validates it.
  * apps/server/src/auth/auth-service.ts:8-16 builds a generic Entra JWT validator from issuer, audience, JWKS, and tenant-mode settings.
* The current validator is generic Entra JWT validation, not an External ID specific contract.
  * packages/shared-auth/src/index.ts:5-14 defines `JwtValidationConfig` as `jwksUri`, `issuer`, `audience`, `tenantMode`, tenant allow/deny lists, and allowed issuers.
  * packages/shared-auth/src/index.ts:106-136 enforces tenant policy mostly via `tid`, `iss`, and configured lists.
* Existing E1 planning assumes "valid bearer token on client open" without defining how the shell acquires or refreshes that token.
  * docs/layer1-backlog.md:49 says bootstrap runs with a valid bearer token.
  * docs/layer1-backlog.md:52 says the client needs a session store and retry policy, but does not define OAuth/OIDC behavior.
* Existing verification and load harnesses assume static pre-minted bearer tokens in CI.
  * docs/cicd-harness.md:92 requires `VERIFY_BEARER_TOKEN`.
  * docs/cicd-harness.md:141 requires `NONPROD_LOAD_BEARER_TOKEN`.
  * .github/workflows/verify-release.yml:93 sends that token directly to `/api/protected/profile`.
* Current sample and runtime configuration already point toward an External ID style issuer shape.
  * .env.example:4 uses `https://exampletenant.ciamlogin.com/exampletenant.onmicrosoft.com/v2.0` for `ENTRA_ISSUER`.
  * .env.example:6 uses `https://exampletenant.ciamlogin.com/exampletenant.onmicrosoft.com/discovery/v2.0/keys` for `ENTRA_JWKS_URL`.

## Findings

### 1. External ID should replace the plan's implicit "generic Entra bearer token" assumption with an explicit CIAM tenant model

The E1 plan should no longer assume "any Entra JWT that matches issuer and audience". It should assume a dedicated Microsoft Entra External ID tenant used for customer identities, with a distinct customer directory, user flows, and app registrations.

Planning impact:

* The shell and the game API should be treated as separate app registrations in the External ID tenant.
* The accepted player token is an access token issued by that External ID tenant for the game API resource.
* The bootstrap contract should explicitly depend on the shell obtaining that API access token through OAuth/OIDC before calling the server.

Evidence:

* Repo: the current server begins at token validation and has no token acquisition layer in scope yet.
* Microsoft: External ID for customers uses a dedicated external tenant with customer accounts, app registrations, and user flows. Source: [External Tenant Overview](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam).

### 2. The shell bootstrap path needs an explicit OAuth/OIDC acquisition contract, not only a bootstrap API contract

The current E1-S1 wording starts at "Given a valid bearer token". For External ID, the plan should call out that browser-based player sign-in uses OAuth 2.0 authorization code flow with PKCE via MSAL, and that the shell should attempt silent acquisition before falling back to interactive sign-in.

Planning impact:

* E1-S1 should cover the shell's auth state machine enough to define when bootstrap is attempted.
* Bootstrap should not run until the shell has either acquired a valid API token or classified the auth state as interaction-required.
* Retry behavior should distinguish between:
  * transient token endpoint failures, which may be retried with bounded backoff
  * `interaction_required` or equivalent silent-auth failure, which should trigger interactive reauthentication rather than repeated bootstrap retries
  * `401` from the game API, which should trigger one token refresh attempt before sending the user back through interactive auth

Evidence:

* Repo: docs/layer1-backlog.md:52 mentions a retry policy but does not define token acquisition rules.
* Microsoft: the recommended browser flow is authorization code with PKCE. For SPAs, silent token acquisition is attempted first, then the client falls back to popup or redirect when interaction is required. Source: [OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Acquire a token to call a web API (single-page apps)](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token).

### 3. The plan should explicitly model access-token ownership and should not rely on client-side token parsing

External ID does not change the standard ownership rule: the shell uses the access token as an opaque bearer credential, and the game API validates it. The client should not parse access tokens for authority decisions.

Planning impact:

* The shell-side E1 assumptions should use `expires_in`, library cache state, and MSAL events rather than parsing JWT claims for primary control flow.
* The server remains the trust boundary for `iss`, `aud`, signature, and tenant checks.

Evidence:

* Repo: current architecture already places trust decisions on the server in apps/server/src/http/auth-middleware.ts and apps/server/src/auth/auth-service.ts.
* Microsoft: access tokens are for the resource server to validate; clients should treat them as opaque. Source: [Access tokens in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).

### 4. External ID likely requires explicit token-version and issuer-shape planning

The repo currently treats `ENTRA_ISSUER` and `ENTRA_JWKS_URL` as simple strings. For External ID, the plan should explicitly pin the API to one token version and one metadata authority shape, rather than treating all Entra authorities as interchangeable.

Planning impact:

* E1 config work should define whether the game API accepts only v2.0 access tokens.
* If v2.0 is required, issuer and metadata should be based on the v2.0 authority and matching discovery document.
* The API audience should be the app ID URI or resource ID for the game API registration, not a shell client ID.

Evidence:

* Repo: .env.example already uses `/v2.0` issuer and `/discovery/v2.0/keys` JWKS endpoints.
* Microsoft: validation rules differ for v1.0 vs v2.0 tokens and must use the matching metadata document. Source: [Access tokens in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).

### 5. The current validator is missing some explicit planning points for External ID token acceptance

The current validator checks signature, `iss`, `aud`, `alg`, and tenant lists, but the E1 plan should explicitly call out additional acceptance rules so implementation does not stop at today's generic validator shape.

Planning impact:

* Require a specific accepted token version.
* Require exact issuer match against tenant-specific metadata for single-tenant External ID usage.
* Treat subject identity as tenant-scoped, not just `sub` alone.
* Decide whether the API requires specific claims beyond `sub`, `iss`, `aud`, `exp`, and `tid` for player bootstrap normalization.
* Plan whether the server should reject tokens lacking `tid` or with a mismatched tenant/issuer pair.

Evidence:

* Repo: packages/shared-auth/src/index.ts returns only `sub`, `iss`, `aud`, `tid`, and `exp`, and does not expose token version or any claim-level normalization policy.
* Microsoft: token validation guidance requires exact issuer validation, tenant scoping, and matching token version metadata. Source: [Access tokens in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).

### 6. E1 verification should no longer depend only on manually provisioned static bearer tokens

The current verification contract uses `VERIFY_BEARER_TOKEN` and `NONPROD_LOAD_BEARER_TOKEN`. That is workable for a baseline smoke path, but it does not verify that External ID app registration, user flow configuration, consent, or token acquisition still works.

Planning impact:

* Keep one static-token smoke path for fast API validation.
* Add a second auth-path verification that exercises token acquisition or at least documents how verification tokens are minted from the External ID tenant.
* CI and ops documentation should state which app registration minted the token, which scopes were granted, and which user flow or authority produced it.

Evidence:

* Repo: docs/cicd-harness.md and .github/workflows/verify-release.yml currently assume a raw bearer token secret.
* External ID introduces configuration surfaces outside the API itself, so planning should capture them explicitly.

### 7. External ID changes the definition of "playable shell <5s p50"

The current E1 metric is ambiguous under External ID because first interactive sign-in, consent, MFA, Conditional Access, or user-flow redirects can dominate latency. The plan should separate "cold interactive sign-in" from "authenticated returning-player bootstrap".

Planning impact:

* E1 should measure p50 from "shell has a usable API access token" to "bootstrap success and playable shell ready".
* If the product also wants first-sign-in timing, that should be a separate metric, not the same E1 gate.

Evidence:

* Repo: current planning identifies the p50 goal but not its start event.
* Microsoft: access token lifetime and silent renewal behavior are variable and browser-dependent, especially for SPAs and third-party-cookie restrictions. Source: [OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Acquire a token to call a web API (single-page apps)](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token).

### 8. Security and abuse controls should expand beyond issuer/audience checks

The backlog already calls out issuer/audience validation and bootstrap rate limiting. Under External ID, the plan should also make explicit the customer-identity-specific abuse and misuse controls around interactive auth, refresh churn, replay, and diagnostic leakage.

Planning impact:

* Keep bootstrap and join-token rate limiting.
* Add token-refresh storm protection and bounded retry rules for silent acquisition failures.
* Ensure bootstrap and join-token APIs log only safe reason classes, plus trace/correlation IDs when available.
* Call out Conditional Access and MFA as auth outcomes the shell must handle, not API bugs.
* Keep room join tokens separate from upstream External ID access tokens so the room layer never reuses the long-lived API bearer token as the room credential.

Evidence:

* Repo: docs/layer1-backlog.md:55 and docs/layer1-backlog.md:70 already establish rate-limit and replay expectations at the E1 level.
* Microsoft: External ID supports Conditional Access and MFA in external tenants. Source: [External Tenant Overview](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam).

## Direct Answers To Research Questions

### 1. External ID specific assumptions that should replace current generic Entra JWT assumptions

* Replace "player already has a valid bearer token" with "the game shell acquires a game-API access token from a dedicated Entra External ID tenant using OAuth/OIDC before bootstrap".
* Replace "generic Entra tenant" with "dedicated customer-facing External ID tenant with explicit user flows and customer accounts".
* Replace "single Entra app assumption" with "at least two registrations matter to E1: public shell client and protected game API".
* Replace "server validates generic JWT" with "server accepts only External ID-issued access tokens for the game API resource from the approved External ID authority and token version".

### 2. OAuth/OIDC flow expectations for the game shell bootstrap path

* Plan for authorization code flow with PKCE for the browser shell.
* Attempt silent token acquisition first.
* On silent acquisition failure due to interaction requirements, use interactive popup or redirect.
* Do not call bootstrap until a valid API access token exists.
* On `401` from bootstrap, perform one bounded token reacquisition attempt, then require interactive auth if the problem persists.
* Treat token acquisition failures and bootstrap failures as separate telemetry classes.

### 3. Server configuration, validation rules, and issuer/audience handling to plan explicitly

* External ID tenant authority and discovery metadata must be treated as first-class configuration, not incidental secrets.
* Explicitly pin accepted token version, preferably matching the existing `/v2.0` repo shape.
* Explicitly define API audience as the game API resource/app ID URI.
* Keep exact issuer validation for the approved External ID tenant.
* Treat subject identity as tenant-scoped.
* Decide whether the current `tenantMode` abstraction remains useful if the requirement is one dedicated External ID tenant for players.
* Plan for app-registration-specific config on the client side even if the current server env file does not yet model it.

### 4. Testing and CI implications

* Add a shell-auth planning note for how non-interactive or pre-provisioned test users obtain valid API tokens from the External ID tenant.
* Keep API-only smoke tests with a verification bearer token, but annotate its provenance and minting path.
* Add at least one integration path that verifies issuer/audience/version mismatches are rejected using External ID-shaped tokens.
* Add negative tests for expired or interaction-required bootstrap recovery behavior at the shell contract level.
* Split p50 measurement into "token already available" bootstrap timing versus first interactive sign-in timing.
* Update CI secret inventory to include, at minimum, a maintainable process for provisioning verification tokens from the External ID tenant.

### 5. Security and abuse controls to make explicit

* Bounded retry behavior for silent token acquisition and bootstrap to avoid auth loops and refresh storms.
* Explicit classification of auth failures into safe error buckets such as unauthorized, interaction-required, transient-idp, and token-expired.
* Per-IP and per-session throttling on bootstrap and join-token issuance.
* Join-token replay protection remains required and should remain separate from upstream access-token semantics.
* Logging guidance should capture correlation identifiers when available, without logging raw bearer tokens.
* Plan for MFA and Conditional Access outcomes as expected auth branches.

## Recommended Plan Adjustments By E1 Phase And Story

### E1-S1 Session Bootstrap

* Change the story assumption from "valid bearer token exists" to "shell acquires a game API access token from External ID, then calls bootstrap".
* Add explicit shell auth-state planning:
  * signed-out
  * acquiring-token-silently
  * interaction-required
  * token-ready
  * bootstrap-in-flight
  * bootstrap-failed
* Add acceptance criteria for retry behavior:
  * silent acquisition is attempted before bootstrap
  * interactive auth is used when silent acquisition returns interaction-required
  * bootstrap `401` triggers one reacquisition attempt, not an infinite loop
* Refine the p50 metric start point to "token-ready" rather than "initial page open".

### E1-S2 Join Token Issuance And Room Admission

* Keep the server-issued short-lived room join token design.
* Make explicit that the upstream External ID access token is only for protected HTTP API calls and is not the room credential.
* Add planning text that join-token issuance depends on a valid External ID-backed API session.
* Add failure taxonomy for join-token issuance when upstream access token validation fails because of issuer, audience, expiry, or tenant mismatch.

### E1-S3 Session Heartbeat And Presence Hygiene

* Keep Colyseus lifecycle as the membership authority.
* Add planning text that auth-driven session churn can be caused by silent renewal expiry, MFA prompts, or browser privacy restrictions, and telemetry should distinguish those from room transport failures.
* If heartbeat exists, include auth-state-aware telemetry so presence cleanup can be correlated with upstream auth renewal failures instead of being treated only as network churn.

### E1-S4 Verification Gate

* Keep the protected-route smoke test using a verification bearer token.
* Add explicit provenance requirements for that token:
  * which External ID tenant issued it
  * which app registration requested it
  * which scopes or audience it targets
  * whether it represents a test player account
* Add one planning item for an auth-path validation check that covers token acquisition or token mint provenance, not only API acceptance of a pasted token.
* Update non-prod load planning so load tokens are issued for the same game API audience and External ID tenant contract as production.

### Cross-Phase Config And Infra Story

* Add explicit planning work for shell client registration details, even though the current server env schema does not contain them.
* Reassess whether `TENANT_MODE=single|multi|both` is still the right abstraction for player auth if the product requirement is one dedicated External ID tenant for players.
* Keep `ENTRA_ISSUER`, `ENTRA_AUDIENCE`, and `ENTRA_JWKS_URL`, but document them as External ID authority values tied to the game API registration and token version.

## Evidence Summary

### Repository Evidence

* apps/server/src/auth/auth-service.ts:8-16 shows a generic server-side validator contract.
* apps/server/src/config/env.ts:7-15 and 43-59 show current runtime auth config is issuer, audience, JWKS, tenant mode, and tenant lists.
* packages/shared-auth/src/index.ts:25-104 shows JWT validation is currently generic and claim-light.
* docs/layer1-backlog.md:47-55 shows E1-S1 starts from a valid bearer token and lacks External ID acquisition detail.
* docs/cicd-harness.md:42-45 and 92 and 141 show CI assumes static tokens and current Entra secret names.
* .env.example:4-8 shows the repo already leans toward a CIAM-style `ciamlogin.com` authority and single-tenant mode.

### Microsoft Documentation Evidence

* External ID uses a dedicated external tenant with customer accounts, app registrations, user flows, and Conditional Access/MFA support.
  * [External Tenant Overview](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam)
* Browser apps should use authorization code flow with PKCE, and SPAs should use silent acquisition first with interactive fallback when required.
  * [OAuth 2.0 authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
  * [Acquire a token to call a web API (single-page apps)](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token)
* Access tokens belong to the resource server, should be treated as opaque by the client, and must be validated using matching token-version metadata and exact issuer/audience rules.
  * [Access tokens in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)

## Open Questions

* Is the intended web client a true SPA using MSAL in-browser, or a server-rendered shell that would hold the OAuth session server-side?
* Should player auth be restricted to local/social identities in the External ID tenant, or should enterprise federation also be supported in E1 planning?
* Does the product want first interactive sign-in latency included in the E1 p50 gate, or only returning-player bootstrap after token acquisition?
* Does the team want to keep the generic `tenantMode` abstraction for future non-player use cases, or simplify player auth to a strict dedicated External ID tenant contract?
