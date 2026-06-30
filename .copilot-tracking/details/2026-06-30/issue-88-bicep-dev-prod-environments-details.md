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

## Implementation Phase 5: Validation

<!-- parallelizable: false -->

### Step 5.1: Run full Bicep compilation

```bash
az bicep build --file apps/server/infra/containerapps/bicep/main.bicep
az bicep build-params --file apps/server/infra/containerapps/bicep/main.dev.bicepparam
az bicep build-params --file apps/server/infra/containerapps/bicep/main.prod.bicepparam
```

### Step 5.2: Cross-check workflows against Bicep

Verify that every `@secure()` parameter in `main.bicep` has a corresponding `--parameters <name>="$SECRET"` line in both `release-dev.yml` and `release-prod.yml`.

### Step 5.3: Cross-check docs against workflows

Verify the Secret Naming Contract list in `docs/cicd-harness.md` matches the `required=()` array in both workflows entry for entry.

### Step 5.4: Fix minor validation issues

Apply any lint or formatting corrections inline.

### Step 5.5: Report blocking issues

Document any failures that require additional research and provide next steps without attempting large-scale inline fixes.

## Dependencies

* Azure CLI with Bicep extension for compilation validation

## Success Criteria

* All three Bicep files compile without error
* Both release workflows fail fast on missing `JOIN_TOKEN_SIGNING_SECRET`
* `docs/cicd-harness.md` Secret Naming Contract is in sync with actual workflow required arrays
