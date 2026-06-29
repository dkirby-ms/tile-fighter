const DEFAULT_TEST_DB_URL = "postgresql://postgres:postgres@localhost:5432/tile_fighter_test";

export type IntegrationTestDbGuard = {
  testsCanRun: boolean;
  testDbConnectionString: string;
  skipReason: string | null;
};

export function createIntegrationTestDbGuard(suiteName: string): IntegrationTestDbGuard {
  const testDbConnectionString = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DB_URL;

  if (process.env.CI === "true" && !process.env.TEST_DATABASE_URL) {
    return {
      testsCanRun: false,
      testDbConnectionString,
      skipReason: `[${suiteName}] CI requires TEST_DATABASE_URL for DB-backed integration tests`
    };
  }

  return {
    testsCanRun: true,
    testDbConnectionString,
    skipReason: null
  };
}
