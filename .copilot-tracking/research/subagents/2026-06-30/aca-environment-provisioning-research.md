# Research: Decoupled ACA Managed Environment Provisioning Layer

**Date:** 2026-06-30  
**Status:** Complete  
**Scope:** What is needed to add a fully decoupled Azure Container Apps environment provisioning layer to tile-fighter.

---

## Research Questions

1. What do existing infra and workflow files establish (naming, resource group strategy, secret naming)?
2. What Azure resources must exist before `Microsoft.App/managedEnvironments` can be created?
3. Does ACR provisioning belong in the environment layer?
4. What RBAC roles are needed for provisioning?
5. What is the right file and workflow structure for decoupling environment provisioning from app deployment?
6. What new secrets does the provisioning workflow need vs. existing release workflows?
7. What in `docs/cicd-harness.md` needs updating?
8. Are there environment provisioning notes in `docs/layer1-backlog.md` or `docs/game-design-document.md`?

---

## 1. Existing Infra and Workflow Inventory

### Bicep files

**`apps/server/infra/containerapps/bicep/main.bicep`**

- `targetScope = 'resourceGroup'`
- Accepts `managedEnvironmentName` as a plain (non-secret) parameter.
- References the managed environment as **existing**: `resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing`
- Deploys `Microsoft.App/containerApps@2024-03-01` into that existing environment.
- Five secure parameters injected at deploy time: `databaseUrlSecret`, `entraIssuerSecret`, `entraAudienceSecret`, `entraJwksUrlSecret`, `entraTenantIdSecret`.
- `workloadProfileName = 'Consumption'` — Consumption-tier workload profile.
- **No Log Analytics workspace or managed environment resource is declared anywhere in the existing Bicep.**

**`apps/server/infra/containerapps/bicep/main.dev.bicepparam`**
- `managedEnvironmentName = 'aca-env-dev'`
- `containerAppName = 'tile-fighter-server-dev'`
- `imageName = 'ghcr.io/example/tile-fighter-server:dev'`
- `tenantMode = 'single'`

**`apps/server/infra/containerapps/bicep/main.prod.bicepparam`**
- `managedEnvironmentName = 'aca-env-prod'`
- `containerAppName = 'tile-fighter-server-prod'`
- `imageName = 'ghcr.io/example/tile-fighter-server:prod'`
- `tenantMode = 'single'`

### Env files

Both `apps/server/infra/containerapps/env/dev.env` and `prod.env` contain only runtime env var references (placeholder values for `DATABASE_URL`, `ENTRA_*`). No infrastructure naming is carried here.

### Release workflows

**`release-dev.yml`** (trigger: `push` to `main` + `workflow_dispatch`, environment: `dev`)  
**`release-prod.yml`** (trigger: `workflow_dispatch` only, environment: `prod`)

Both workflows follow identical structure:

1. Validate required secrets (fail-fast check).
2. Azure login via OIDC (`azure/login@v2`).
3. `az acr login` + `docker build` + `docker push` using ACR.
4. Trivy vulnerability scan.
5. **Precheck managed environment** — `az containerapp env show --resource-group $AZURE_RESOURCE_GROUP --name <name-from-bicepparam>`. Fails the workflow if the environment does not exist. No provisioning is attempted.
6. `az deployment group create` with `main.bicep` and env-specific `.bicepparam`.

### Secret naming contract (from `docs/cicd-harness.md`)

Secrets that exist per environment in GitHub Environments:

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | OIDC federated identity |
| `AZURE_TENANT_ID` | OIDC federated identity |
| `AZURE_SUBSCRIPTION_ID` | Subscription scope |
| `AZURE_RESOURCE_GROUP` | Single resource group for all resources |
| `ACR_LOGIN_SERVER` | ACR hostname |
| `ACR_NAME` | ACR resource name |
| `DATABASE_URL` | App secret |
| `ENTRA_ISSUER` | App secret |
| `ENTRA_AUDIENCE` | App secret |
| `ENTRA_JWKS_URL` | App secret |
| `ENTRA_TENANT_ID` | App secret |
| `ENTRA_TOKEN_VERSION` | App secret |
| `TELEMETRY_SINK_MODE` | App secret |
| `TELEMETRY_SINK_URL` | App secret |
| `TELEMETRY_SINK_NAME` | App secret |

**Key observation:** A single `AZURE_RESOURCE_GROUP` secret is shared — both the managed environment and the container app are assumed to live in the same resource group per environment. No separate "infra" resource group is referenced anywhere.

### OIDC configuration

Federated credential subjects:
- `repo:dkirby-ms/tile-fighter:environment:dev`
- `repo:dkirby-ms/tile-fighter:environment:prod`

Minimum RBAC documented: `AcrPush` on ACR + `Contributor` on the deployment resource group.

---

## 2. Required Azure Resources for an ACA Managed Environment

### Mandatory dependency: Log Analytics Workspace

`Microsoft.App/managedEnvironments` requires a Log Analytics workspace for diagnostics. The workspace customer ID (`customerId`) and shared key (`sharedKey`) must be passed to the managed environment's `appLogsConfiguration.logAnalyticsConfiguration` block.

The Log Analytics workspace is typically a `Microsoft.OperationalInsights/workspaces` resource provisioned in the same resource group.

### Managed environment resource

`Microsoft.App/managedEnvironments` with:
- `location`
- `properties.appLogsConfiguration` → Log Analytics workspace reference
- `properties.workloadProfiles` → at minimum a Consumption profile entry for `workloadProfileName: 'Consumption'` (required to match `main.bicep`'s `workloadProfileName = 'Consumption'` property on the container app)

### ACR — not part of the environment layer

The release workflows already use ACR (`ACR_NAME`, `ACR_LOGIN_SERVER` secrets exist). ACR is a pre-existing resource provisioned outside this repo's IaC. ACR provisioning does **not** belong in the environment layer — it is orthogonal infrastructure managed by the operator.

### RBAC considerations

The existing `Contributor` grant on the resource group is sufficient to create a Log Analytics workspace and managed environment. No additional RBAC roles are needed purely for provisioning. If least-privilege scope is later applied, the provisioning principal needs:

- `Microsoft.OperationalInsights/workspaces/write` (Log Analytics)
- `Microsoft.App/managedEnvironments/write` (ACA environment)
- `Microsoft.OperationalInsights/workspaces/sharedKeys/action` (to read the key for the environment bicep output)

---

## 3. Decoupling Strategy: File and Workflow Structure

### Recommended Bicep file structure

Place new files alongside the existing app Bicep in the same `bicep/` directory to maintain path consistency:

```
apps/server/infra/containerapps/bicep/
  environment.bicep                  ← new: provisions Log Analytics + managedEnvironment
  environment.dev.bicepparam         ← new: dev parameter defaults
  environment.prod.bicepparam        ← new: prod parameter defaults
  main.bicep                         ← existing: deploys container app (unchanged)
  main.dev.bicepparam                ← existing (unchanged)
  main.prod.bicepparam               ← existing (unchanged)
```

**`environment.bicep` parameter contract (recommended)**

Non-secret parameters only (no app secrets needed for env provisioning):

| Parameter | Example value | Notes |
|---|---|---|
| `location` | `resourceGroup().location` | Default from RG |
| `managedEnvironmentName` | `aca-env-dev` | Matches `main.*.bicepparam` value |
| `logAnalyticsWorkspaceName` | `log-tile-fighter-dev` | Consistent naming convention |
| `logAnalyticsRetentionDays` | `30` | Operational default |

**Output**: The managed environment resource ID can be output as a non-sensitive value for documentation purposes, but the app deployment does not read it (it resolves by name via `existing`).

**Naming convention alignment**

Existing naming: `aca-env-dev` / `aca-env-prod` (kebab-case, service prefix + role + environment).  
Log Analytics workspace convention: `log-tile-fighter-dev` / `log-tile-fighter-prod`.

### Recommended workflow structure

Two separate environment-scoped provision workflows (matching the existing dev/prod split):

```
.github/workflows/
  provision-env-dev.yml    ← new
  provision-env-prod.yml   ← new
  release-dev.yml          ← existing (unchanged)
  release-prod.yml         ← existing (unchanged)
```

**Trigger strategy**: `workflow_dispatch` only for both. Environment provisioning is a rare one-time or exceptional operation. Automating on file path changes (`paths:`) risks accidental re-provisioning and is inconsistent with the existing prod workflow pattern (prod is `workflow_dispatch` only). A path-change trigger can be added to `provision-env-dev.yml` as an optional secondary trigger if the team prefers automated drift correction for dev, but prod must remain manual.

**Workflow structure (both)**

```yaml
on:
  workflow_dispatch:

permissions:
  contents: read
  id-token: write    # OIDC only — no packages:write needed (no image push)

jobs:
  provision-env:
    environment: dev   # or prod
    steps:
      - checkout
      - validate required inputs (subset: AZURE_CLIENT_ID, AZURE_TENANT_ID,
                                   AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP)
      - azure/login@v2
      - az deployment group create
            --template-file apps/server/infra/containerapps/bicep/environment.bicep
            --parameters @apps/server/infra/containerapps/bicep/environment.dev.bicepparam
```

---

## 4. Secrets: New vs. Existing

### Provisioning workflow secrets required

| Secret | Status | Notes |
|---|---|---|
| `AZURE_CLIENT_ID` | **Existing** | OIDC auth |
| `AZURE_TENANT_ID` | **Existing** | OIDC auth |
| `AZURE_SUBSCRIPTION_ID` | **Existing** | OIDC auth |
| `AZURE_RESOURCE_GROUP` | **Existing** | Deployment scope |

**No new secrets are needed.** The provisioning workflow only creates infrastructure resources and does not inject any app-level secrets. Log Analytics workspace keys are retrieved at Bicep deployment time internally (using `listKeys()` within the template) — they are never passed in as workflow secrets.

**Key difference from release workflows**: `packages: write` permission is not needed (no image push), and `ACR_LOGIN_SERVER`, `ACR_NAME`, and all `DATABASE_URL`/`ENTRA_*` secrets are not used.

---

## 5. cicd-harness.md — Required Updates

The document currently has no section covering environment provisioning. The following additions are needed:

1. **New "Environment Provisioning" section** documenting:
   - The two new Bicep files (`environment.bicep`, env-specific `.bicepparam` files).
   - The two new workflows (`provision-env-dev.yml`, `provision-env-prod.yml`).
   - The `workflow_dispatch`-only trigger rationale.
   - The fact that provisioning is a prerequisite to the first release and is otherwise infrequently run.
   - The dependency on Log Analytics workspace (created as part of `environment.bicep`).

2. **Update the "Precheck managed environment" step description** (implicitly referenced via the harness): note that the precheck in release workflows remains but is now a signal that provisioning was previously completed — it is no longer the only safeguard.

3. **Update "Minimum Azure RBAC for Release Jobs"** to distinguish between:
   - Release job RBAC (existing: `AcrPush` + `Contributor` on RG).
   - Provisioning job RBAC: same `Contributor` on RG (or scoped to `Microsoft.OperationalInsights/workspaces` + `Microsoft.App/managedEnvironments`).

4. **Update "Bicep Parameter Contract"** to document `environment.bicep` alongside `main.bicep`.

---

## 6. Layer1 Backlog and Game Design Document — Infrastructure Scope Notes

### `docs/layer1-backlog.md`

- **E8-S2** ("env-safe deploy") is the closest existing story. It mentions "immutable artifacts, env-safe deploy" but does not include environment provisioning as a task.
- No existing E8 story covers environment provisioning.
- The backlog gap: **there is no story for "as an operator, I can provision the ACA managed environment declaratively via IaC"**. This is a prerequisite story for E8-S2.
- Suggest adding a new story (e.g., `E8-S0` or a pre-E8-S1 chore) scoped to: "As an operator, I can provision the ACA managed environment and its Log Analytics workspace via Bicep IaC so release workflows can succeed without manual Azure Portal setup."

### `docs/game-design-document.md`

- No infrastructure provisioning details. GDD is purely gameplay and product design scope.
- Cost target noted: "infrastructure cost <$100/month" — relevant context for choosing Log Analytics retention defaults and Consumption tier (no dedicated workload profile needed).

---

## 7. Key Findings Summary

### Required new Azure resources (to be created by `environment.bicep`)

| Resource type | Name (dev) | Name (prod) |
|---|---|---|
| `Microsoft.OperationalInsights/workspaces` | `log-tile-fighter-dev` | `log-tile-fighter-prod` |
| `Microsoft.App/managedEnvironments` | `aca-env-dev` | `aca-env-prod` |

### Recommended file additions

```
apps/server/infra/containerapps/bicep/environment.bicep
apps/server/infra/containerapps/bicep/environment.dev.bicepparam
apps/server/infra/containerapps/bicep/environment.prod.bicepparam
.github/workflows/provision-env-dev.yml
.github/workflows/provision-env-prod.yml
```

### Recommended doc updates

```
docs/cicd-harness.md  (add environment provisioning section + RBAC + Bicep contract updates)
docs/layer1-backlog.md  (add provisioning prerequisite story to E8 block)
```

### New secrets required: none

The provisioning workflows reuse the four existing OIDC secrets.

### Workflow trigger strategy

| Workflow | Trigger |
|---|---|
| `provision-env-dev.yml` | `workflow_dispatch` (optionally also `paths: [apps/server/infra/containerapps/bicep/environment.bicep, apps/server/infra/containerapps/bicep/environment.dev.bicepparam]` on `push` to `main`) |
| `provision-env-prod.yml` | `workflow_dispatch` only (matches prod release pattern) |

### Important constraints from existing code

- `main.bicep` uses `workloadProfileName = 'Consumption'` — the managed environment `environment.bicep` must declare a Consumption workload profile entry so the container app deployment does not fail with a profile-not-found error.
- The `AZURE_RESOURCE_GROUP` secret is a single value per GitHub environment — env provisioning and app deployment share the same resource group. The environment bicep should use `targetScope = 'resourceGroup'` to match `main.bicep`.
- ACR is out of scope for the environment layer. It is pre-existing infrastructure.

---

## 8. Clarifying Questions

1. **Log Analytics retention and SKU**: Should `environment.bicep` parameterize the Log Analytics SKU (`PerGB2018`) and retention days, or hard-code the free-tier-friendly defaults? The GDD cost target (<$100/month) suggests keeping retention short (30 days) and using `PerGB2018`. Confirm if there is a compliance or observability requirement for longer retention.

2. **Workload profiles in the managed environment**: The current `main.bicep` uses `workloadProfileName = 'Consumption'`. ACA Consumption-only environments do not require an explicit workload profile list — the Consumption profile is implicit. But if the team wants dedicated profiles in the future, the environment resource declaration differs (requires `workloadProfiles` array). Confirm whether Consumption-only is the intent for both dev and prod.

3. **Single resource group vs. separate infra resource group**: Currently everything (`aca-env-*`, `tile-fighter-server-*`, and implicitly ACR) appears to share a single resource group per environment. Should the environment provisioning layer target the same `AZURE_RESOURCE_GROUP` or a separate infra resource group (e.g., `rg-tile-fighter-infra-dev`)? The existing secret contract suggests a single RG — changing this would require a new secret (`AZURE_INFRA_RESOURCE_GROUP`) and a new federated credential scope.

4. **Should ACR provisioning ever be added to the env layer?** Current workflows reference `ACR_NAME` and `ACR_LOGIN_SERVER` as pre-existing secrets, implying ACR was manually created. If the team wants to bring ACR under IaC, it would be a third Bicep template (`acr.bicep`) or a separate repo. Out of scope for this issue but worth confirming.

5. **`provision-env-dev.yml` path trigger**: Is automated drift correction on dev (provisioning the environment when `environment.bicep` changes on `main`) desired, or should provisioning always be explicitly operator-initiated?
