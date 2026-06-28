---
title: CI/CD Harness
description: Deployment harness contract for secrets, policy gates, and release promotion for Tile Fighter.
author: GitHub Copilot
ms.date: 2026-06-27
ms.topic: how-to
keywords:
  - ci/cd
  - github actions
  - azure container apps
  - security
estimated_reading_time: 8
---

## Harness Scope

The deployment harness uses GitHub Actions workflows in [.github/workflows/ci.yml](.github/workflows/ci.yml), [.github/workflows/release-dev.yml](.github/workflows/release-dev.yml), and [.github/workflows/release-prod.yml](.github/workflows/release-prod.yml).

## Secret Source of Truth

The selected model is GitHub Environments secrets as the single source of truth for deployment-time secrets.

Rationale:

- It keeps secret ownership explicit per environment.
- It works with the existing release workflow structure without adding a second secret backend dependency.
- It supports runtime injection into secure Bicep parameters at deployment time.

Alternate model:

- Azure Key Vault-backed retrieval can be introduced later if governance requires centralized secret custody.

## Secret Naming Contract

Dev and prod release workflows both require this exact naming contract in GitHub environment secrets:

- `AZURE_CREDENTIALS`
- `AZURE_RESOURCE_GROUP`
- `ACR_LOGIN_SERVER`
- `ACR_NAME`
- `DATABASE_URL`
- `ENTRA_ISSUER`
- `ENTRA_AUDIENCE`
- `ENTRA_JWKS_URL`
- `ENTRA_TENANT_ID`

Secrets are injected only at deploy time through `az deployment group create --parameters ...` overrides.

## Bicep Parameter Contract

The template in [apps/server/infra/containerapps/bicep/main.bicep](apps/server/infra/containerapps/bicep/main.bicep) uses secure parameters for all secret values and a non-secret `tenantMode` parameter.

The parameter files [apps/server/infra/containerapps/bicep/main.dev.bicepparam](apps/server/infra/containerapps/bicep/main.dev.bicepparam) and [apps/server/infra/containerapps/bicep/main.prod.bicepparam](apps/server/infra/containerapps/bicep/main.prod.bicepparam) contain only non-secret defaults.

## Security and Policy Gates

The harness enforces two blocking thresholds:

- Dependency policy gate: `npm audit --audit-level=high` fails CI on vulnerabilities at high or critical severity.
- Container policy gate: Trivy scan (`aquasec/trivy:0.67.2`) fails release when HIGH or CRITICAL findings are detected.

Exception handling path:

1. Open a security exception issue with the vulnerability details, package/image reference, and remediation ETA.
2. Land remediation in code or dependency updates.
3. Re-run CI/release without bypassing gate thresholds.

## Tenant Mode and Deployment Settings

`tenantMode` is set in environment-specific `.bicepparam` files and passed during deployment by each release workflow. Allowed values are:

- `single`
- `multi`
- `both`

Release workflows still deploy immutable images by commit SHA and override `imageName` at deploy time.

## Post-Deploy Verification Gate

The verification workflow in [.github/workflows/verify-release.yml](.github/workflows/verify-release.yml) runs after successful release workflows and can also be run manually.

Verification checks:

- `GET /healthz` returns a successful response.
- `GET /readyz` returns a successful response.
- `GET /api/protected/profile` succeeds with a valid bearer token.
- Authenticated room-join smoke succeeds through the existing `npm run -w @game/server test:load` harness.

Required environment secrets for verification:

- `APP_BASE_URL`
- `VERIFY_BEARER_TOKEN`

## Rollback Procedure

Use Azure Container Apps revision rollback when post-deploy verification fails.

1. Identify the failed deployment revision and the last known healthy revision.
2. Activate the last known healthy revision.
3. Deactivate the failed revision after rollback health checks pass.
4. Re-run verification checks against the rolled-back endpoint.

Example command path:

```bash
az containerapp revision list \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME" \
  --query "[].{name:name,active:properties.active,created:properties.createdTime}" \
  -o table

az containerapp revision activate \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME" \
  --revision "$LAST_KNOWN_GOOD_REVISION"

az containerapp revision deactivate \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$CONTAINER_APP_NAME" \
  --revision "$FAILED_REVISION"
```

## Operations and Incident Triage

Use this checklist when verification or load checks fail:

1. Confirm release job status and capture the deployment logs.
2. Check `/healthz` and `/readyz` directly from the deployed ingress URL.
3. Confirm protected route auth by validating the verification token source and claims.
4. Run the room-join smoke test with reduced `LOAD_JOIN_COUNT` to isolate auth or transport failures.
5. Decide rollback based on readiness and authenticated smoke outcome, not only liveness.
6. Open an incident issue with timeline, affected revision, and mitigation status.

## Scheduled Non-Prod Load Checks

The non-production load workflow in [.github/workflows/nonprod-load.yml](.github/workflows/nonprod-load.yml) runs on a schedule and by manual dispatch to continuously validate room-join behavior outside PR validation.

Required environment secrets for non-prod load:

- `NONPROD_WS_ENDPOINT`
- `NONPROD_LOAD_BEARER_TOKEN`
