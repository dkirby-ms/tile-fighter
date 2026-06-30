import { config as loadDotEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Client } from "pg";

const runtimeEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env");

loadDotEnv({ path: runtimeEnvPath });

async function purgeExpiredPlacementCommandLedger(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      DELETE FROM placement_commands
      WHERE expires_at <= NOW()
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`Placement command purge hook skipped: ${message}\n`);
  } finally {
    await client.end();
  }
}

const args = process.argv.slice(2);
const child = spawn("node-pg-migrate", args, {
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code) => {
  if ((code ?? 0) !== 0) {
    process.exit(code ?? 0);
    return;
  }

  // Migration-safe maintenance hook to bound placement command ledger growth.
  purgeExpiredPlacementCommandLedger()
    .catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      process.stderr.write(`Placement command purge hook failed: ${message}\n`);
    })
    .finally(() => {
      process.exit(code ?? 0);
    });
});
