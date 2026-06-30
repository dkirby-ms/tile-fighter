<!-- markdownlint-disable-file -->
# Task Research: Issue 88 Bicep Dev and Prod Environments

Research what is needed to implement GitHub issue #88: "chore: create bicep templates for dev and prod environments" in the tile-fighter repository.

## Task Implementation Requests

* Determine infrastructure files and patterns that should be created or modified for dev and prod Bicep deployments
* Identify required parameters, environment-specific differences, and deployment workflow changes
* Recommend a single implementation approach with alternatives considered

## Scope and Success Criteria

* Scope: Infrastructure-as-code research for apps/server/infra/containerapps and related CI/CD touchpoints
* Assumptions: Existing infrastructure follows Azure Container Apps patterns and needs environment-specific templates
* Success Criteria:
  * Produces a concrete file-level implementation plan for dev and prod Bicep templates
  * Identifies required variables, secrets, and naming conventions
  * Documents one recommended template structure with rationale and alternatives

## Outline

1. Inspect current infra structure and any existing Bicep or env artifacts
2. Identify build/deploy pipeline touchpoints and parameter handoff patterns
3. Evaluate template design options for dev/prod separation
4. Select approach and provide actionable next steps

## Potential Next Research

* Decide whether location and scale controls must differ between dev and prod
  * Reasoning: current template hardcodes workload and scale
  * Reference: apps/server/infra/containerapps/bicep/main.bicep

* Decide if env/dev.env and env/prod.env should become deployment-driving inputs
  * Reasoning: currently docs-style templates only, not consumed by workflows
  * Reference: apps/server/infra/containerapps/env and .github/workflows/release-*.yml

## Research Executed

### File Analysis

* apps/server/infra/containerapps/bicep/main.bicep
  * Shared template already exists with environment-facing parameters such as managedEnvironmentName, containerAppName, imageName, tenantMode, and secure secret parameters.
  * Hardcoded values remain for workload profile, CPU/memory, and min/max replicas.

* apps/server/infra/containerapps/bicep/main.dev.bicepparam
  * Dev environment parameter file exists and sets managed environment/app/image defaults.

* apps/server/infra/containerapps/bicep/main.prod.bicepparam
  * Prod environment parameter file exists and sets managed environment/app/image defaults.

* apps/server/src/config/env.ts
  * Runtime requires JOIN_TOKEN_SIGNING_SECRET and supports ENTRA_TOKEN_VERSION and telemetry controls.
  * Current Bicep-injected env set does not include JOIN_TOKEN_SIGNING_SECRET.

* .github/workflows/release-dev.yml and .github/workflows/release-prod.yml
  * Workflows deploy with az deployment group create, pass bicepparam plus runtime secret overrides.
  * Required secret checks currently include DB/Entra values but not JOIN_TOKEN_SIGNING_SECRET.

* docs/cicd-harness.md
  * Secret naming contract includes more entries than workflows currently validate/pass (for example ENTRA_TOKEN_VERSION and telemetry values), indicating drift.

### Code Search Results

* Search term: main.dev.bicepparam / main.prod.bicepparam
  * Found in release workflows for managed environment precheck and deployment parameters.

* Search term: JOIN_TOKEN_SIGNING_SECRET
  * Required by runtime env schema and config mapping.
  * Not found in container app template env injection or release deployment parameter overrides.

### External Research

* No external sources needed. Repository evidence is sufficient to answer issue scope.

### Project Conventions

* Standards referenced: Markdown instructions and writing style instructions
* Instructions followed: Task Researcher mode constraints and research document template

## Key Discoveries

### Project Structure

* The repository already contains a dev/prod Bicep layout under apps/server/infra/containerapps:
  * bicep/main.bicep
  * bicep/main.dev.bicepparam
  * bicep/main.prod.bicepparam
  * env/dev.env
  * env/prod.env

* Deployment orchestration is workflow-driven, not script-driven:
  * .github/workflows/release-dev.yml
  * .github/workflows/release-prod.yml
  * package.json and apps/server/package.json do not define deploy scripts.

### Implementation Patterns

* Current pattern is shared-template plus per-environment parameter files.
* Release workflows enforce secret presence, build immutable SHA-tagged images, then override Bicep secure parameters on deploy.
* Managed container app environment is expected to already exist and is prechecked before deployment.

### Complete Examples

```text
apps/server/infra/containerapps/bicep/main.bicep
  param managedEnvironmentName string
  param containerAppName string
  param imageName string
  @secure() param databaseUrlSecret string
  @secure() param entraIssuerSecret string
  ...

apps/server/infra/containerapps/bicep/main.dev.bicepparam
  using './main.bicep'
  param managedEnvironmentName = 'aca-env-dev'
  param containerAppName = 'tile-fighter-server-dev'

.github/workflows/release-dev.yml
  az deployment group create \
    --template-file apps/server/infra/containerapps/bicep/main.bicep \
    --parameters @apps/server/infra/containerapps/bicep/main.dev.bicepparam \
    --parameters databaseUrlSecret="$DATABASE_URL" \
    ...
```

### API and Schema Documentation

* Runtime schema for environment variables is defined in apps/server/src/config/env.ts.
* Deployment contract for CI/CD and secrets is documented in docs/cicd-harness.md.

### Configuration Examples

```text
Required deployment secrets currently validated in release workflows:
- AZURE_CLIENT_ID
- AZURE_TENANT_ID
- AZURE_SUBSCRIPTION_ID
- AZURE_RESOURCE_GROUP
- ACR_LOGIN_SERVER
- ACR_NAME
- DATABASE_URL
- ENTRA_ISSUER
- ENTRA_AUDIENCE
- ENTRA_JWKS_URL
- ENTRA_TENANT_ID

Runtime-required but missing from current deployment injection:
- JOIN_TOKEN_SIGNING_SECRET
```

## Technical Scenarios

### Single Shared Module with Environment Parameterization

Use one reusable template for resource topology and two bicepparam files for environment defaults, then keep workflow-level secure parameter injection.

**Requirements:**

* Environment-specific values for dev/prod
* Minimal duplication while retaining clear separation
* Full runtime env parity for required secrets and auth config
* Workflow contract that fails fast when required secrets are missing

**Preferred Approach:**

* Keep apps/server/infra/containerapps/bicep/main.bicep as shared source of truth.
* Extend secure/non-secure parameters to cover runtime requirements and environment policy knobs.
* Keep main.dev.bicepparam and main.prod.bicepparam for non-secret defaults.
* Update release workflows to validate and pass any newly required secure parameters.
* Update docs/cicd-harness.md to remove contract drift.

```text
apps/server/infra/containerapps/bicep/main.bicep                        (modify)
apps/server/infra/containerapps/bicep/main.dev.bicepparam               (modify)
apps/server/infra/containerapps/bicep/main.prod.bicepparam              (modify)
.github/workflows/release-dev.yml                                       (modify)
.github/workflows/release-prod.yml                                      (modify)
docs/cicd-harness.md                                                    (modify)
README.md                                                               (optional modify)
```

**Implementation Details:**

1. Add secure parameter in main.bicep for joinTokenSigningSecret and inject env var JOIN_TOKEN_SIGNING_SECRET.
2. Add non-secret parameters where needed for entraTokenVersion and telemetry controls if these should be deploy-time configurable.
3. Optionally parameterize location, workload profile, scale, and container resources if dev/prod divergence is required.
4. Extend release-dev.yml and release-prod.yml required secret checks to include new secure values.
5. Extend deployment command overrides in release workflows to pass those values into Bicep secure parameters.
6. Keep bicepparam files non-secret and set environment defaults only.
7. Reconcile docs/cicd-harness.md with actual workflow validation and deployment behavior.
8. Validate both environments with Bicep compilation and release verification workflow.

```text
Current blocking gap for issue intent completion:
- Runtime requires JOIN_TOKEN_SIGNING_SECRET (apps/server/src/config/env.ts)
- Bicep/workflows currently do not provide this value
```

#### Considered Alternatives

* Alternative A: Split into main.dev.bicep and main.prod.bicep.
  * Rejected because duplication and drift risk are high while current architecture already supports environment parameterization.

* Alternative B: Generate Bicep parameters from env/dev.env and env/prod.env before deployment.
  * Rejected because it adds tooling complexity and no current workflow depends on env files.

* Alternative C: Keep shared main.bicep and extend parameters/workflows/docs.
  * Selected because it is the lowest-risk completion path aligned with current repo architecture.
