import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { DatabaseRuntime, createDatabaseRuntime, closeDatabaseRuntime } from "../../src/persistence/db.js";
import { createIntegrationTestDbGuard } from "./test-db-guard.js";

describe("Startup migration smoke test", () => {
  const dbGuard = createIntegrationTestDbGuard("startup-migration.smoke");
  const testDbConnectionString = dbGuard.testDbConnectionString;

  let runtime: DatabaseRuntime | null = null;
  let testsCanRun = dbGuard.testsCanRun;

  beforeAll(async () => {
    if (!testsCanRun) {
      if (dbGuard.skipReason) {
        console.warn(dbGuard.skipReason);
      }
      return;
    }

    try {
      runtime = createDatabaseRuntime(testDbConnectionString);
      // Test connectivity - this will skip tests if database unavailable
      await runtime.db.selectFrom("tiles").selectAll().limit(1).execute();
    } catch (error) {
      testsCanRun = false;
      console.warn("Skipping smoke tests: database or tiles table not available", error instanceof Error ? error.message : error);
    }
  });

  afterAll(async () => {
    if (runtime) {
      await closeDatabaseRuntime(runtime);
    }
  });

  it.skipIf(!testsCanRun)("should have tiles table available after migrations", async () => {
    const result = await runtime!.db.selectFrom("tiles").selectAll().limit(0).execute();
    expect(Array.isArray(result)).toBe(true);
  });

  it.skipIf(!testsCanRun)("should create tiles table with correct schema", async () => {
    // Query table information
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tiles'
      ORDER BY ordinal_position
    `.execute(runtime!.db);

      const columns = tableInfo.rows as Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>;

      expect(columns.length).toBeGreaterThanOrEqual(11);

      // Verify specific columns exist
      const columnNames = columns.map((c) => c.column_name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("region_id");
      expect(columnNames).toContain("cell_x");
      expect(columnNames).toContain("cell_y");
      expect(columnNames).toContain("offset_x");
      expect(columnNames).toContain("offset_y");
      expect(columnNames).toContain("shape");
      expect(columnNames).toContain("color");
      expect(columnNames).toContain("style_payload");
      expect(columnNames).toContain("owner_id");
      expect(columnNames).toContain("created_at");

      // Verify data types
      const idCol = columns.find((c) => c.column_name === "id");
      expect(idCol?.data_type).toMatch(/bigint|serial/);

      const regionIdCol = columns.find((c) => c.column_name === "region_id");
      expect(regionIdCol?.data_type).toBe("text");
      expect(regionIdCol?.is_nullable).toBe("NO");

      const cellXCol = columns.find((c) => c.column_name === "cell_x");
      expect(cellXCol?.data_type).toMatch(/integer|int4/);
      expect(cellXCol?.is_nullable).toBe("NO");

      const offsetXCol = columns.find((c) => c.column_name === "offset_x");
      expect(offsetXCol?.data_type).toBe("double precision");
      expect(offsetXCol?.is_nullable).toBe("NO");
  });

  it.skipIf(!testsCanRun)("should have unique constraint on region_coordinate", async () => {
    // Query constraint information
    const constraintInfo = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'tiles' AND constraint_type = 'UNIQUE'
    `.execute(runtime!.db);

      const constraints = constraintInfo.rows as Array<{
        constraint_name: string;
        constraint_type: string;
      }>;

      const uniqueConstraints = constraints.map((c) => c.constraint_name);
      expect(uniqueConstraints.some((name) => name.includes("region_coordinate") || name.includes("tiles"))).toBe(true);
  });

  it.skipIf(!testsCanRun)("should have check constraints for offset ranges", async () => {
    // Query check constraints
    const checkInfo = await sql`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name LIKE '%offset%' OR constraint_name LIKE '%tiles%'
    `.execute(runtime!.db);

      const checks = checkInfo.rows as Array<{
        constraint_name: string;
        check_clause: string;
      }>;

      // Should have constraints for offset_x and offset_y
      expect(checks.length).toBeGreaterThanOrEqual(2);

      const checkClauses = checks.map((c) => c.check_clause.toLowerCase());
      expect(checkClauses.some((clause) => clause.includes("offset_x"))).toBe(true);
      expect(checkClauses.some((clause) => clause.includes("offset_y"))).toBe(true);
  });

  it.skipIf(!testsCanRun)("should have indexes for efficient lookups", async () => {
    // Query indexes
    const indexInfo = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'tiles'
    `.execute(runtime!.db);

      const indexes = indexInfo.rows as Array<{
        indexname: string;
        indexdef: string;
      }>;

      expect(indexes.length).toBeGreaterThanOrEqual(3); // pkey + 2+ additional indexes

      // Should have region_id index
      const hasRegionIndex = indexes.some((idx) => idx.indexname.includes("region") || idx.indexdef.includes("region_id"));
      expect(hasRegionIndex).toBe(true);

      // Should have coordinate index
      const hasCoordinateIndex = indexes.some(
        (idx) =>
          idx.indexname.includes("coordinate") ||
          idx.indexdef.includes("cell_x") ||
          idx.indexdef.includes("cell_y")
      );
      expect(hasCoordinateIndex).toBe(true);
  });

  it.skipIf(!testsCanRun)("should allow server to query tiles table after migration", async () => {
    // Try a simple query on tiles table
    const result = await runtime!.db.selectFrom("tiles").selectAll().limit(1).execute();

    expect(Array.isArray(result)).toBe(true);
  });

  it.skipIf(!testsCanRun)("should have match_events table from init migration", async () => {
    // Verify match_events table exists (from init migration)
    const tableInfo = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'match_events'
    `.execute(runtime!.db);

    expect(tableInfo.rows.length).toBeGreaterThan(0);
  });

  it.skipIf(!testsCanRun)("should track migrations in pgmigrations table", async () => {
    // Verify pgmigrations table exists
    const tableInfo = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'pgmigrations'
    `.execute(runtime!.db);

    expect(tableInfo.rows.length).toBeGreaterThan(0);

    // Verify migrations are recorded
    const migrations = await sql`SELECT * FROM pgmigrations ORDER BY run_on`.execute(runtime!.db);
    expect(migrations.rows.length).toBeGreaterThan(0);
  });

  it.skipIf(!testsCanRun)("should have region snapshot tables from snapshot migration", async () => {
    const tableInfo = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('region_snapshots', 'region_snapshot_tiles')
    `.execute(runtime!.db);

    const tableNames = tableInfo.rows.map((row) => String((row as { table_name: string }).table_name));
    expect(tableNames).toContain("region_snapshots");
    expect(tableNames).toContain("region_snapshot_tiles");
  });
});
