---
title: CI Baseline Research
description: Deep analysis of existing CI-relevant capabilities in the Tile Fighter monorepo, including scripts, testing, lint/typecheck/build orchestration, docs, and workflow presence.
author: GitHub Copilot
ms.date: 2026-06-27
ms.topic: reference
keywords:
  - ci
  - monorepo
  - vitest
  - lint
  - build
estimated_reading_time: 12
---

## Scope and status

* Status: Complete
* Workspace analyzed: /home/saitcho/tile-fighter
* Research focus:
  * Root and package-level package.json scripts
  * Test frameworks and config (unit/integration/load)
  * Lint, typecheck, build commands and monorepo orchestration
  * Existing docs for run/deploy/test
  * Existing CI workflow files

## 1) Root and package-level scripts baseline

### Root workspace scripts

Evidence:
* package.json:6-9 defines npm workspaces for apps/* and packages/*
* package.json:10-14 defines root scripts
  * build = tsc -b
  * lint = npm run --workspaces lint
  * test = npm run --workspaces test

Interpretation:
* Root lint and test are workspace fan-out wrappers.
* Root build uses TypeScript project references, not npm workspace fan-out.

CI implications:
* A minimal CI baseline can run from root with three commands: npm ci, npm run lint, npm run test, then npm run build.
* Because root build is reference-based, build ordering is centralized in tsconfig references rather than npm workspace script ordering.

### Package scripts inventory

Evidence:
* apps/server/package.json:8-16
  * dev, build, lint, test, test:load, migrate:up, migrate:down
* apps/tools/package.json:8-12
  * build, lint, test (vitest run --passWithNoTests)
* packages/shared-auth/package.json:8-12
  * build, lint, test (vitest run --passWithNoTests)
* packages/shared-persistence/package.json:8-12
  * build, lint, test (vitest run --passWithNoTests)
* packages/shared-types/package.json:8-12
  * build, lint, test (vitest run --passWithNoTests)

Interpretation:
* All workspaces implement the script triad (build/lint/test), enabling consistent orchestration.
* Only apps/server has meaningful test coverage and operational scripts (load test and DB migrations).
* passWithNoTests means some workspace test steps are always green even if no tests exist.

CI implications:
* Current baseline is broad but shallow outside apps/server. CI can pass while many workspaces have zero test files.
* Add a stricter CI stage for coverage or minimum test-file presence if non-server packages must reach a quality gate.

## 2) Test frameworks and test configs

### Framework and runner

Evidence:
* Root devDependency on vitest at package.json:23
* Server test command uses vitest run at apps/server/package.json:12
* Non-server packages use vitest run --passWithNoTests at:
  * apps/tools/package.json:11
  * packages/shared-auth/package.json:11
  * packages/shared-persistence/package.json:11
  * packages/shared-types/package.json:11

Interpretation:
* Vitest is the unified test runner across the monorepo.
* The test contract is permissive for most packages.

### Vitest server config

Evidence:
* apps/server/vitest.config.ts:6-20 configures node test environment and tests directory
* apps/server/vitest.config.ts:8-14 aliases @game/shared-* imports to package source files

Interpretation:
* Server tests resolve shared package imports directly to source, reducing dependence on prior package build artifacts.

CI implications:
* CI test stage for apps/server can run without first building shared packages, as long as path aliases remain valid.
* Alias coupling introduces risk when shared package file paths change; tests can fail from path drift.

### Test suite shape: unit and integration

Evidence:
* Unit tests:
  * apps/server/tests/unit/domain-transition.test.ts:1-18
  * apps/server/tests/unit/jwt-validation.test.ts:1-103
  * apps/server/tests/unit/room-auth.test.ts:1-17
* Integration test:
  * apps/server/tests/integration/http-auth.integration.test.ts:1-57

Interpretation:
* Unit coverage includes deterministic simulation, JWT validation behaviors, and room auth.
* Integration test uses supertest against createHttpApp and mocked auth service, not live external identity systems.

CI implications:
* Current integration tests are fast and deterministic; they are suitable for required PR checks.
* There is no true DB-backed integration test gate visible in current test files.

### Load test script

Evidence:
* apps/server/package.json:13 defines test:load
* apps/server/tests/load/room-join-load.ts:4-6 requires LOAD_ENDPOINT, LOAD_JOIN_COUNT, LOAD_BEARER_TOKEN with fallback defaults
* apps/server/tests/load/room-join-load.ts:12-18 performs concurrent joinOrCreate calls
* apps/server/tests/load/room-join-load.ts:36-39 exits non-zero on failure

Interpretation:
* Load test is executable as a script and fails process on error, but it expects a reachable running server endpoint and valid token.

CI implications:
* test:load should not run in the default unit/integration CI job without provisioning a server runtime and credentials.
* Consider a separate performance/load workflow with explicit environment setup, secrets, and optional schedule/manual trigger.

## 3) Lint, typecheck, build, and monorepo orchestration

### Lint baseline

Evidence:
* Root fan-out lint: package.json:12
* Package lint commands:
  * apps/server/package.json:11 lints src and tests
  * all other package manifests lint src only (apps/tools/package.json:10, packages/shared-auth/package.json:10, packages/shared-persistence/package.json:10, packages/shared-types/package.json:10)
* ESLint config: eslint.config.mjs:6-30
  * ignores dist, node_modules, and all *.js files (eslint.config.mjs:8)
  * applies @typescript-eslint recommended rules for *.ts

Interpretation:
* Lint coverage is TypeScript-focused and intentionally ignores JavaScript outputs and JS sources.

CI implications:
* A lint job is straightforward and low-dependency.
* If JavaScript files are added intentionally, they will be ignored unless config changes.

### Typecheck and build baseline

Evidence:
* Root build uses tsc -b at package.json:11
* Root references graph: tsconfig.json:3-18
  * packages/shared-types
  * packages/shared-auth
  * packages/shared-persistence
  * apps/tools
  * apps/server
* Shared strict compiler options in tsconfig.base.json:2-19
* Server tsconfig includes vitest types but include only src/**/*.ts at apps/server/tsconfig.json:7-10 and 23-25

Interpretation:
* Typecheck is currently implied by build; there is no separate root typecheck script.
* Project references provide deterministic topological build order.
* Server tests are not part of tsc include for apps/server.

CI implications:
* If CI needs type safety for test code, a separate command is needed (for example, adding a test tsconfig or using a test-aware typecheck command).
* A practical baseline can keep build and test as separate jobs; build validates production TS graph, vitest validates behavior.

## 4) Existing docs for run, deploy, and test

### Root README coverage

Evidence:
* README.md:33-47 documents root/server command usage and dev startup
* README.md:49-54 describes local prerequisites (DB and Entra env vars)
* README.md:56-61 documents migration commands including migrate:generate
* README.md:63-68 documents test and load test commands
* README.md:70-75 documents Docker build/run
* README.md:77-91 documents Azure Container Apps asset location and secret boundary expectations

Interpretation:
* Root README provides enough baseline command documentation for CI pipeline design.
* It assumes .env.example exists and local env bootstrap from it.

Actionable gap found:
* README.md references migrate:generate (README.md:60), but apps/server/package.json has migrate:up and migrate:down only (apps/server/package.json:14-15).

CI implications:
* Documentation drift can cause pipeline implementation confusion if jobs copy README commands verbatim.
* Align docs/scripts before codifying migration steps in CI.

### Server README coverage

Evidence:
* apps/server/README.md:18-24 lists script commands including migrate:generate
* apps/server/README.md:26-37 lists required environment variables
* apps/server/README.md:39-43 lists health/readiness endpoints
* apps/server/README.md:44-49 describes auth expectations
* apps/server/README.md:52 states migration stack uses drizzle-kit and drizzle-orm

Actionable gaps found:
* migrate:generate is documented but missing from apps/server/package.json scripts.
* Migration stack documented as drizzle, while scripts/dependencies indicate node-pg-migrate:
  * node-pg-migrate scripts at apps/server/package.json:14-15
  * node-pg-migrate dependency at apps/server/package.json:36

CI implications:
* Migration tooling identity is ambiguous in docs vs code. CI migration job should follow package scripts and dependencies, not README narrative, until docs are reconciled.

### Environment example

Evidence:
* .env.example:1-11 defines baseline runtime and auth-related environment variables.

CI implications:
* CI integration/e2e stages can use this as the canonical variable template for secret naming and pipeline validation.

## 5) Existing CI workflow files

Evidence:
* File search for .github/workflows/* returned no files.
* .github currently contains prompts only:
  * .github/prompts/colyseus-azure-scaffold.prompt.md
  * .github/prompts/create-game-design-document.prompt.md

Interpretation:
* There is no existing GitHub Actions workflow baseline committed in this repository.

CI implications:
* CI must be bootstrapped from scratch.
* No existing branch protection-oriented checks are discoverable from repository files.

## Proposed baseline CI shape from current capabilities

### Recommended required PR checks

* Install: npm ci
* Lint: npm run lint
* Test: npm run test
* Build/typecheck: npm run build

Rationale from evidence:
* Root scripts already orchestrate all workspaces (package.json:10-14).
* Test command runs vitest in all packages and is already green in current workspace state.
* Build validates project-reference graph (tsconfig.json:3-18).

### Recommended non-required or separate workflows

* Load test workflow (manual/scheduled)
  * Run npm run -w @game/server test:load only when runtime endpoint and bearer token are provisioned
* Migration validation workflow
  * Run migrate up/down against ephemeral Postgres only after docs/scripts mismatch is fixed
* Deploy workflow
  * Use Docker + Bicep assets referenced in README when deployment requirements are finalized

## Unresolved questions and gaps

* Which quality standard is expected for packages currently using --passWithNoTests?
* Should test TypeScript files be included in compile-time typecheck gates?
* Is node-pg-migrate the intended long-term migration tool, or is migration ownership moving to drizzle?
* Should load testing be part of pre-merge policy, post-merge nightly, or manual release gate only?
* What CI provider is primary (GitHub Actions, Azure DevOps, both) for this repository?

## Follow-on research recommendations

* Define target CI platform and required protected-branch checks.
* Reconcile docs/scripts for migration commands and tooling before pipeline implementation.
* Inventory secrets and environment provisioning model for integration, load, and deploy workflows.
* Determine whether to enforce no-empty-tests policy for selected packages.
* Evaluate whether to add a separate test-code typecheck step.
