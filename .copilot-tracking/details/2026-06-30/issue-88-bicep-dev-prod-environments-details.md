<!-- markdownlint-disable-file -->
# Implementation Details: Issue 88 - Bicep Dev and Prod Environments

## Context Reference

Sources: `.copilot-tracking/research/2026-06-30/issue-88-bicep-dev-prod-environments-research.md`, direct file reads of `apps/server/infra/containerapps/bicep/main.bicep`, `.github/workflows/release-dev.yml`, `.github/workflows/release-prod.yml`, `apps/server/src/config/env.ts`, and `docs/cicd-harness.md`.

## Implementation Phase 1: Extend Bicep template with joinTokenSigningSecret

<!-- parallelizable: false -->

### Step 1.1: Add secure parameter declaration in main.bicep

Add the `joinTokenSigningSecret` parameter after the existing `entraTenantIdSecret` parameter (currently the last `@secure()` param, ending around line 52).

Files:
* `apps/server/infra/containerapps/bicep/main.bicep` - Add param block after `entraTenantIdSecret`

Insert after the closing line of `entraTenantIdSecret`:

```bicep
@description('Join token signing secret value.')
@secure()
param joinTokenSigningSecret string
```

Success criteria:
* Parameter appears in the file after `entraTenantIdSecret` with correct decorators
* `az bicep build --file apps/server/infra/containerapps/bicep/main.bicep` exits 0

Context references:
* `apps/server/infra/containerapps/bicep/main.bicep` (Lines 52-54) - existing `entraTenantIdSecret` parameter block
* `apps/server/src/config/env.ts` (Line 29) - `JOIN_TOKEN_SIGNING_SECRET: z.string().min(32)` required field

Dependencies:
* None; this is the first change in the file

### Step 1.2: Add join-token-signing-secret to the secrets array in main.bicep

The secrets array in `configuration.secrets` currently ends with the `entra-tenant-id` entry. Add a new entry after it.

Files:
* `apps/server/infra/containerapps/bicep/main.bicep` - Append to the secrets array (currently closes around line 92-95)

Insert after the `entra-tenant-id` secret object (closing `}` of that object, before the closing `]` of the secrets array):

```bicep
        {
          name: 'join-token-signing-secret'
          value: joinTokenSigningSecret
        }
```

Success criteria:
* `join-token-signing-secret` entry appears in the secrets array
* `az bicep build` still exits 0

Context references:
* `apps/server/infra/containerapps/bicep/main.bicep` (Lines 72-95) - secrets array with five existing entries

Dependencies:
* Step 1.1 completion (parameter must exist before it can be referenced)

### Step 1.3: Add JOIN_TOKEN_SIGNING_SECRET env var injection in the container env array

The container env array currently ends with `ENTRA_TENANT_ID` referencing `secretRef: 'entra-tenant-id'`. Add a new entry after it.

Files:
* `apps/server/infra/containerapps/bicep/main.bicep` - Append to the env array (currently closes around line 140-145)

Insert after the `ENTRA_TENANT_ID` env object (before the closing `]` of the env array):

```bicep
            {
              name: 'JOIN_TOKEN_SIGNING_SECRET'
              secretRef: 'join-token-signing-secret'
            }
```

Success criteria:
* `JOIN_TOKEN_SIGNING_SECRET` env entry appears in the env array with correct `secretRef`
* `az bicep build --file apps/server/infra/containerapps/bicep/main.bicep` exits 0 (final phase-level check)

Context references:
* `apps/server/infra/containerapps/bicep/main.bicep` (Lines 108-145) - env array with five existing entries ending with ENTRA_TENANT_ID

Dependencies:
* Step 1.2 completion (secret must be declared before it can be referenced via secretRef)

### Step 1.4: Validate phase changes

Run Bicep compilation for the shared template only (param files reference no new params).

Validation commands:
* `az bicep build --file apps/server/infra/containerapps/bicep/main.bicep` - confirms template compiles cleanly

## Implementation Phase 2: Extend release-dev.yml for JOIN_TOKEN_SIGNING_SECRET

<!-- parallelizable: true -->

### Step 2.1: Add JOIN_TOKEN_SIGNING_SECRET to Validate step in release-dev.yml

The `Validate required deployment inputs` step has an `env:` block and a `required=()` array. Both must include the new secret.

Files:
* `.github/workflows/release-dev.yml` - Validate step env block (around lines 34-42) and required array (around lines 44-56)

In the `env:` block of the `Validate required deployment inputs` step, add after `ENTRA_TENANT_ID: ${{ secrets.ENTRA_TENANT_ID }}`:

```yaml
          JOIN_TOKEN_SIGNING_SECRET: ${{ secrets.JOIN_TOKEN_SIGNING_SECRET }}
```

In the `required=()` array, add after `ENTRA_TENANT_ID`:

```bash
            JOIN_TOKEN_SIGNING_SECRET
```

Success criteria:
* `JOIN_TOKEN_SIGNING_SECRET` appears in both the `env:` block and `required=()` array of the validate step
* YAML is syntactically valid

Context references:
* `.github/workflows/release-dev.yml` (Lines 29-55) - validate step with env block (starts line 29) and required array (opens line 43)

Dependencies:
* Phase 1 completion; the Bicep parameter must exist before workflows referencing it are useful

### Step 2.2: Add JOIN_TOKEN_SIGNING_SECRET to Deploy step in release-dev.yml

The `Deploy to Azure Container Apps` step has an `env:` block and an `az deployment group create` command. Both must include the new secret.

Files:
* `.github/workflows/release-dev.yml` - Deploy step env block (around lines 100-106) and az deployment command (around lines 113-124)

In the `env:` block of the `Deploy to Azure Container Apps` step, add after `ENTRA_TENANT_ID: ${{ secrets.ENTRA_TENANT_ID }}`:

```yaml
          JOIN_TOKEN_SIGNING_SECRET: ${{ secrets.JOIN_TOKEN_SIGNING_SECRET }}
```

In the `az deployment group create` command, the current final line is:

```bash
            --parameters entraTenantIdSecret="$ENTRA_TENANT_ID"
```

This line has **no trailing backslash** — it is currently the shell command terminator. To append a new parameter, first add a backslash continuation to that line, then add the new line after it:

```bash
            --parameters entraTenantIdSecret="$ENTRA_TENANT_ID" \
            --parameters joinTokenSigningSecret="$JOIN_TOKEN_SIGNING_SECRET"
```

Success criteria:
* `JOIN_TOKEN_SIGNING_SECRET` appears in the deploy step `env:` and is passed as a Bicep parameter
* YAML is syntactically valid

Context references:
* `.github/workflows/release-dev.yml` (Lines 100-124) - deploy step with env block and az deployment command

Dependencies:
* Step 2.1 completion

## Implementation Phase 3: Extend release-prod.yml for JOIN_TOKEN_SIGNING_SECRET

<!-- parallelizable: true -->

### Step 3.1: Add JOIN_TOKEN_SIGNING_SECRET to Validate step in release-prod.yml

Identical structural change to Step 2.1, applied to `release-prod.yml`.

Files:
* `.github/workflows/release-prod.yml` - Validate step env block (around lines 34-42) and required array (around lines 44-56)

Same insertions as Step 2.1: add `JOIN_TOKEN_SIGNING_SECRET: ${{ secrets.JOIN_TOKEN_SIGNING_SECRET }}` to the env block and `JOIN_TOKEN_SIGNING_SECRET` to the required array.

Success criteria:
* `JOIN_TOKEN_SIGNING_SECRET` appears in both validate step sections
* YAML is syntactically valid

Context references:
* `.github/workflows/release-prod.yml` (Lines 29-55) - validate step with env block (starts line 29) and required array (opens line 43)

Dependencies:
* Phase 1 completion

### Step 3.2: Add JOIN_TOKEN_SIGNING_SECRET to Deploy step in release-prod.yml

Identical structural change to Step 2.2, applied to `release-prod.yml`.

Files:
* `.github/workflows/release-prod.yml` - Deploy step env block (around lines 100-106) and az deployment command (around lines 112-122)

Same insertions as Step 2.2: add `JOIN_TOKEN_SIGNING_SECRET` to the deploy env block, add a backslash continuation to the existing final `--parameters entraTenantIdSecret="$ENTRA_TENANT_ID"` line, then append `            --parameters joinTokenSigningSecret="$JOIN_TOKEN_SIGNING_SECRET"` on the next line without a trailing backslash.

Success criteria:
* `JOIN_TOKEN_SIGNING_SECRET` appears in the deploy step env and is passed as a Bicep parameter
* YAML is syntactically valid

Context references:
* `.github/workflows/release-prod.yml` (Lines 100-122) - deploy step

Dependencies:
* Step 3.1 completion

## Implementation Phase 4: Reconcile docs/cicd-harness.md Secret Naming Contract

<!-- parallelizable: true -->

### Step 4.1: Update the Secret Naming Contract list in cicd-harness.md

The current Secret Naming Contract section (lines 82-98) lists 15 secrets. Four of those (`ENTRA_TOKEN_VERSION`, `TELEMETRY_SINK_MODE`, `TELEMETRY_SINK_URL`, `TELEMETRY_SINK_NAME`) are never validated or passed in either release workflow; they are runtime defaults from `env.ts` not deployment secrets. `JOIN_TOKEN_SIGNING_SECRET` is required but absent.

Files:
* `docs/cicd-harness.md` - Secret Naming Contract list (lines 82-98)

Replace the current list:

```markdown
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `ACR_LOGIN_SERVER`
- `ACR_NAME`
- `DATABASE_URL`
- `ENTRA_ISSUER`
- `ENTRA_AUDIENCE`
- `ENTRA_JWKS_URL`
- `ENTRA_TENANT_ID`
- `ENTRA_TOKEN_VERSION`
- `TELEMETRY_SINK_MODE`
- `TELEMETRY_SINK_URL`
- `TELEMETRY_SINK_NAME`
```

With:

```markdown
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `ACR_LOGIN_SERVER`
- `ACR_NAME`
- `DATABASE_URL`
- `ENTRA_ISSUER`
- `ENTRA_AUDIENCE`
- `ENTRA_JWKS_URL`
- `ENTRA_TENANT_ID`
- `JOIN_TOKEN_SIGNING_SECRET`
```

Also update the Bicep Parameter Contract section (around line 130) to mention `joinTokenSigningSecret` has been added to the template alongside the existing secure parameters.

Success criteria:
* Secret Naming Contract list exactly matches the required array in both release workflows
* `JOIN_TOKEN_SIGNING_SECRET` is present; `ENTRA_TOKEN_VERSION`, `TELEMETRY_SINK_MODE`, `TELEMETRY_SINK_URL`, `TELEMETRY_SINK_NAME` are absent

Context references:
* `docs/cicd-harness.md` (Lines 76-100) - Secret Naming Contract section

Dependencies:
* No code dependencies; can run in parallel with Phases 2 and 3

## Implementation Phase 5: Create environment.bicep and bicepparam files

<!-- parallelizable: false -->

### Step 5.1: Create apps/server/infra/containerapps/bicep/environment.bicep

Create a new shared Bicep template that provisions:
- A `Microsoft.OperationalInsights/workspaces` (Log Analytics workspace) — required dependency for the managed environment
- A `Microsoft.App/managedEnvironments` — uses the workspace `customerId` and `listKeys()` for log ingestion; declares an explicit `Consumption` workload profile to match the `workloadProfileName = 'Consumption'` in `main.bicep`

Files:
* `apps/server/infra/containerapps/bicep/environment.bicep` — **create new**

Full content:

```bicep
metadata name = 'tile-fighter-aca-environment'
metadata description = 'Provisions Log Analytics workspace and Azure Container Apps managed environment.'

targetScope = 'resourceGroup'

@description('Azure region for resources.')
param location string = resourceGroup().location

@description('Log Analytics workspace name.')
param logAnalyticsWorkspaceName string

@description('Container Apps managed environment name.')
param managedEnvironmentName string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

output managedEnvironmentId string = managedEnvironment.id
output managedEnvironmentName string = managedEnvironment.name
```

Success criteria:
* File exists at the correct path
* `az bicep build --file apps/server/infra/containerapps/bicep/environment.bicep` exits 0

Context references:
* `.copilot-tracking/research/subagents/2026-06-30/aca-environment-provisioning-research.md` — required resources and naming conventions
* `apps/server/infra/containerapps/bicep/main.bicep` (Line 64) — `workloadProfileName: 'Consumption'` must match

Dependencies:
* None

### Step 5.2: Create apps/server/infra/containerapps/bicep/environment.dev.bicepparam

Files:
* `apps/server/infra/containerapps/bicep/environment.dev.bicepparam` — **create new**

Full content:

```bicep
using './environment.bicep'

param logAnalyticsWorkspaceName = 'log-tile-fighter-dev'
param managedEnvironmentName = 'aca-env-dev'
```

`managedEnvironmentName` matches the value in `main.dev.bicepparam` so the precheck in `release-dev.yml` resolves to the same resource.

Success criteria:
* File exists and references `aca-env-dev` consistent with `main.dev.bicepparam`
* `az bicep build-params --file apps/server/infra/containerapps/bicep/environment.dev.bicepparam` exits 0

Context references:
* `apps/server/infra/containerapps/bicep/main.dev.bicepparam` (Line 3) — `managedEnvironmentName = 'aca-env-dev'`

Dependencies:
* Step 5.1 completion

### Step 5.3: Create apps/server/infra/containerapps/bicep/environment.prod.bicepparam

Files:
* `apps/server/infra/containerapps/bicep/environment.prod.bicepparam` — **create new**

Full content:

```bicep
using './environment.bicep'

param logAnalyticsWorkspaceName = 'log-tile-fighter-prod'
param managedEnvironmentName = 'aca-env-prod'
```

Success criteria:
* File exists and references `aca-env-prod` consistent with `main.prod.bicepparam`
* `az bicep build-params --file apps/server/infra/containerapps/bicep/environment.prod.bicepparam` exits 0

Context references:
* `apps/server/infra/containerapps/bicep/main.prod.bicepparam` (Line 3) — `managedEnvironmentName = 'aca-env-prod'`

Dependencies:
* Step 5.1 completion

### Step 5.4: Validate phase changes

```bash
az bicep build --file apps/server/infra/containerapps/bicep/environment.bicep
az bicep build-params --file apps/server/infra/containerapps/bicep/environment.dev.bicepparam
az bicep build-params --file apps/server/infra/containerapps/bicep/environment.prod.bicepparam
```

## Implementation Phase 6: Create provision-env-dev.yml workflow

<!-- parallelizable: true -->

### Step 6.1: Create .github/workflows/provision-env-dev.yml

The provisioning workflow is intentionally simpler than the release workflows: no image build, no vulnerability scan, no immutable artifact. It only authenticates to Azure and deploys the environment Bicep.

Files:
* `.github/workflows/provision-env-dev.yml` — **create new**

Full content:

```yaml
name: Provision Environment Dev

on:
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  provision-env-dev:
    name: Provision dev managed environment
    runs-on: ubuntu-latest
    environment: dev

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Validate required provisioning inputs
        env:
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          AZURE_RESOURCE_GROUP: ${{ secrets.AZURE_RESOURCE_GROUP }}
        run: |
          set -euo pipefail
          required=(
            AZURE_CLIENT_ID
            AZURE_TENANT_ID
            AZURE_SUBSCRIPTION_ID
            AZURE_RESOURCE_GROUP
          )
          for key in "${required[@]}"; do
            if [[ -z "${!key:-}" ]]; then
              echo "Missing required secret: $key" >&2
              exit 1
            fi
          done

      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy environment infrastructure
        env:
          AZURE_RESOURCE_GROUP: ${{ secrets.AZURE_RESOURCE_GROUP }}
        run: |
          set -euo pipefail
          az deployment group create \
            --resource-group "$AZURE_RESOURCE_GROUP" \
            --template-file apps/server/infra/containerapps/bicep/environment.bicep \
            --parameters @apps/server/infra/containerapps/bicep/environment.dev.bicepparam
```

Success criteria:
* File exists with `workflow_dispatch` as the only trigger
* Workflow uses only the four OIDC secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`)
* YAML is syntactically valid

Context references:
* `.github/workflows/release-dev.yml` (Lines 1-65) — authentication and validate-step pattern to mirror
* `.copilot-tracking/research/subagents/2026-06-30/aca-environment-provisioning-research.md` — workflow trigger strategy

Dependencies:
* Phase 5 completion (Bicep files must exist before they can be referenced)

## Implementation Phase 7: Create provision-env-prod.yml workflow

<!-- parallelizable: true -->

### Step 7.1: Create .github/workflows/provision-env-prod.yml

Structurally identical to Phase 6 but targets the `prod` GitHub environment and `environment.prod.bicepparam`.

Files:
* `.github/workflows/provision-env-prod.yml` — **create new**

Full content:

```yaml
name: Provision Environment Prod

on:
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  provision-env-prod:
    name: Provision prod managed environment
    runs-on: ubuntu-latest
    environment: prod

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Validate required provisioning inputs
        env:
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          AZURE_RESOURCE_GROUP: ${{ secrets.AZURE_RESOURCE_GROUP }}
        run: |
          set -euo pipefail
          required=(
            AZURE_CLIENT_ID
            AZURE_TENANT_ID
            AZURE_SUBSCRIPTION_ID
            AZURE_RESOURCE_GROUP
          )
          for key in "${required[@]}"; do
            if [[ -z "${!key:-}" ]]; then
              echo "Missing required secret: $key" >&2
              exit 1
            fi
          done

      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy environment infrastructure
        env:
          AZURE_RESOURCE_GROUP: ${{ secrets.AZURE_RESOURCE_GROUP }}
        run: |
          set -euo pipefail
          az deployment group create \
            --resource-group "$AZURE_RESOURCE_GROUP" \
            --template-file apps/server/infra/containerapps/bicep/environment.bicep \
            --parameters @apps/server/infra/containerapps/bicep/environment.prod.bicepparam
```

Success criteria:
* File exists with `workflow_dispatch` as the only trigger
* Workflow targets `environment: prod` and uses `environment.prod.bicepparam`
* YAML is syntactically valid

Context references:
* `.github/workflows/release-prod.yml` (Lines 1-40) — `workflow_dispatch`-only trigger pattern

Dependencies:
* Phase 5 completion

## Implementation Phase 8: Add Environment Provisioning section to docs/cicd-harness.md

<!-- parallelizable: true -->

### Step 8.1: Add Environment Provisioning section to cicd-harness.md

Append a new "Environment Provisioning" section after the existing "Bicep Parameter Contract" section. The section must explain the decoupling rationale, list the new files, document the `workflow_dispatch`-only trigger, and note RBAC requirements.

Files:
* `docs/cicd-harness.md` — add new section after "Bicep Parameter Contract" section (currently around line 130)

Content to add:

```markdown
## Environment Provisioning

The managed environment layer is decoupled from the container app deployment layer. Run it once per environment before the first release workflow execution, or to repair environment drift.

### Files

- Template: `apps/server/infra/containerapps/bicep/environment.bicep`
- Dev parameters: `apps/server/infra/containerapps/bicep/environment.dev.bicepparam`
- Prod parameters: `apps/server/infra/containerapps/bicep/environment.prod.bicepparam`

### Provisioned Resources

| Resource | Dev | Prod |
| --- | --- | --- |
| Log Analytics workspace | `log-tile-fighter-dev` | `log-tile-fighter-prod` |
| Container Apps managed environment | `aca-env-dev` | `aca-env-prod` |

The managed environment declares an explicit `Consumption` workload profile to match the `workloadProfileName = 'Consumption'` expected by `main.bicep`.

### Provisioning Workflows

- `provision-env-dev.yml` — `workflow_dispatch` only; targets the `dev` GitHub environment
- `provision-env-prod.yml` — `workflow_dispatch` only; targets the `prod` GitHub environment

Both workflows reuse only the four OIDC secrets required for Azure login (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`). Log Analytics keys are never passed as workflow secrets; they are read internally by Bicep via `listKeys()`.

### RBAC Requirements

The OIDC service principal requires `Contributor` on the deployment resource group — the same scope already granted for container app releases. No additional role assignments are needed.

### Decoupling Rationale

- Environment provisioning is a low-frequency, operator-initiated action; it should not run on every push.
- The container app deployment layer (`main.bicep`, `release-dev.yml`, `release-prod.yml`) depends on the managed environment existing but does not own its lifecycle.
- Keeping the layers separate prevents an accidental environment deletion if the app deployment Bicep is updated.
- The "Precheck managed environment" step in both release workflows confirms the environment exists before deploying the container app; it assumes the provisioning workflow has already been run for the target environment.
```

Success criteria:
* Section exists in `docs/cicd-harness.md` after "Bicep Parameter Contract"
* All new file paths are correct relative to workspace root

Context references:
* `docs/cicd-harness.md` (Lines 125-135) — Bicep Parameter Contract section (insertion point)

Dependencies:
* No code dependencies; can run in parallel with Phases 6 and 7

## Implementation Phase 9: Validation

<!-- parallelizable: false -->

### Step 9.1: Run full Bicep compilation for all six Bicep files

```bash
az bicep build --file apps/server/infra/containerapps/bicep/main.bicep
az bicep build --file apps/server/infra/containerapps/bicep/environment.bicep
az bicep build-params --file apps/server/infra/containerapps/bicep/main.dev.bicepparam
az bicep build-params --file apps/server/infra/containerapps/bicep/main.prod.bicepparam
az bicep build-params --file apps/server/infra/containerapps/bicep/environment.dev.bicepparam
az bicep build-params --file apps/server/infra/containerapps/bicep/environment.prod.bicepparam
```

### Step 9.2: Cross-check release workflows against Bicep

Verify every `@secure()` parameter in `main.bicep` has a `--parameters <name>="$SECRET"` line in both `release-dev.yml` and `release-prod.yml`.

### Step 9.3: Cross-check docs against workflows

Verify the Secret Naming Contract list in `docs/cicd-harness.md` matches the `required=()` array in both release workflows entry for entry.

### Step 9.4: Verify provisioning workflows

Confirm provisioning workflows use `workflow_dispatch` only, reference only the four OIDC secrets, and pass the correct `bicepparam` file.

### Step 9.5: Fix minor validation issues

Apply any lint or formatting corrections inline.

### Step 9.6: Report blocking issues

Document any failures requiring additional research and provide next steps without attempting large-scale inline fixes.

## Dependencies

* Azure CLI with Bicep extension for compilation validation

## Success Criteria

* All six Bicep files compile without error
* Both release workflows fail fast on missing `JOIN_TOKEN_SIGNING_SECRET`
* `docs/cicd-harness.md` Secret Naming Contract is in sync with actual workflow required arrays
* Provisioning workflows exist, are `workflow_dispatch`-only, and correctly reference environment Bicep files

