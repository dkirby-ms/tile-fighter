import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const DEFAULT_TEST_DB_URL = "postgresql://postgres:postgres@localhost:5432/tile_fighter_test";

const currentDir = dirname(fileURLToPath(import.meta.url));

// Load environment variables for local test runs where `.env` is not auto-sourced.
for (const envPath of [
  resolve(process.cwd(), ".env"),
  resolve(currentDir, "../../.env"),
  resolve(currentDir, "../../../../.env")
]) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

export type IntegrationTestDbGuard = {
  testsCanRun: boolean;
  testDbConnectionString: string;
  skipReason: string | null;
};

/**
 * Database guard for integration tests.
 *
 * REQUIRED: TEST_DATABASE_URL environment variable must be set for tests to run.
 * This is enforced for both local development and CI environments.
 *
 * Rationale (Option B - Fail Everywhere):
 * - Local and CI have identical requirements: no silent skips in local dev
 * - Prevents developers from accidentally running tests without proper database setup
 * - Ensures test coverage consistency across all environments
 * - If TEST_DATABASE_URL is not set, process exits with detailed error message
 *
 * Setup:
 * 1. Local: Set TEST_DATABASE_URL before running `npm test`
 *    Example: `export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tile_fighter_test"`
 * 2. CI: Ensure TEST_DATABASE_URL is configured in environment or secrets
 *    See: .github/workflows/ci.yml
 *
 * Without TEST_DATABASE_URL, the test process exits immediately with instructions.
 */
export function createIntegrationTestDbGuard(suiteName: string): IntegrationTestDbGuard {
  const runtimeDbUrl = process.env.DATABASE_URL;
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (runtimeDbUrl && testDbUrl && runtimeDbUrl !== testDbUrl) {
    const mismatchMessage = `
[${suiteName}] FATAL: DATABASE_URL and TEST_DATABASE_URL are both set but do not match.

To prevent running integration tests against an unintended database, these values must agree.

DATABASE_URL=${runtimeDbUrl}
TEST_DATABASE_URL=${testDbUrl}

Use one of these options:

1. Set only TEST_DATABASE_URL for tests.
2. Set both variables to the same database URL.
`.trim();

    console.error(mismatchMessage);
    process.exit(1);
  }

  const testDbConnectionString = testDbUrl ?? runtimeDbUrl ?? DEFAULT_TEST_DB_URL;

  // Enforce at least one explicit DB URL in both local and CI environments
  if (!testDbUrl && !runtimeDbUrl) {
    const errorMessage = `
[${suiteName}] FATAL: TEST_DATABASE_URL (or DATABASE_URL) environment variable is required for integration tests.

The test suite requires a PostgreSQL database to run. To fix this:

1. LOCAL DEVELOPMENT:
  Set TEST_DATABASE_URL (preferred) or DATABASE_URL before running tests:
   
    export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tile_fighter_test"
     npm test
   
   Or set it inline:
   
    TEST_DATABASE_URL="postgresql://..." npm test
    DATABASE_URL="postgresql://..." npm test

2. CI/CONTAINER:
   Ensure TEST_DATABASE_URL is configured in your CI/container environment.
   See .github/workflows/ci.yml and docker-compose.yml for PostgreSQL setup.

3. DOCKER COMPOSE (for local testing):
   docker-compose up -d
   Then set TEST_DATABASE_URL and run tests as above.

By requiring TEST_DATABASE_URL in all environments, we ensure consistent test coverage
and prevent accidental silent skips that could hide missing database setup.
`.trim();

    console.error(errorMessage);
    process.exit(1);
  }

  return {
    testsCanRun: true,
    testDbConnectionString,
    skipReason: null
  };
}
