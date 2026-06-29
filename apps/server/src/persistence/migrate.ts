import { config as loadDotEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const runtimeEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env");

loadDotEnv({ path: runtimeEnvPath });

const args = process.argv.slice(2);
const child = spawn("node-pg-migrate", args, {
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
