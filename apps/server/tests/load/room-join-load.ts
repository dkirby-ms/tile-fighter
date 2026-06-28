import { Client } from "@colyseus/sdk";
import { spawn } from "node:child_process";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const REQUIRED_SERVER_ENV = [
  "DATABASE_URL",
  "ENTRA_ISSUER",
  "ENTRA_AUDIENCE",
  "ENTRA_JWKS_URL",
  "TENANT_MODE"
] as const;

type LocalServerHandle = {
  stop: () => Promise<void>;
};

function toHttpUrl(endpoint: string): URL {
  const parsed = new URL(endpoint);
  if (parsed.protocol === "wss:") {
    parsed.protocol = "https:";
  } else if (parsed.protocol === "ws:") {
    parsed.protocol = "http:";
  }
  return parsed;
}

function shouldAutoStartServer(endpoint: string): boolean {
  if (process.env.LOAD_AUTOSTART_SERVER === "false") {
    return false;
  }

  const parsed = toHttpUrl(endpoint);
  return LOCAL_HOSTS.has(parsed.hostname);
}

function getMissingServerEnv(): string[] {
  return REQUIRED_SERVER_ENV.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });
}

async function waitForHealth(healthUrl: string, timeoutMs = 30000): Promise<void> {
  const startedAt = Date.now();
  let lastError = "unknown error";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }

      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = (error as Error).message;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for local server health at ${healthUrl}: ${lastError}`);
}

function tailLines(lines: string[], max = 20): string {
  return lines.slice(-max).join("\n");
}

async function startLocalServer(endpoint: string): Promise<LocalServerHandle> {
  const missingEnv = getMissingServerEnv();
  if (missingEnv.length > 0) {
    throw new Error(
      `Cannot auto-start local server. Missing required env vars: ${missingEnv.join(", ")}`
    );
  }

  const parsed = toHttpUrl(endpoint);
  const port = parsed.port || "3000";
  const healthUrl = `${parsed.origin}/healthz`;
  const output: string[] = [];

  const serverProcess = spawn("npm", ["run", "-w", "@game/server", "dev"], {
    env: {
      ...process.env,
      PORT: port
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  serverProcess.stdout?.on("data", (chunk: Buffer) => {
    output.push(chunk.toString());
  });
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    output.push(chunk.toString());
  });

  try {
    await waitForHealth(healthUrl);
  } catch (error) {
    if (serverProcess.exitCode === null) {
      serverProcess.kill("SIGTERM");
    }

    const logs = tailLines(output);
    throw new Error(`${(error as Error).message}\nServer logs:\n${logs}`);
  }

  return {
    stop: async () => {
      if (serverProcess.exitCode !== null) {
        return;
      }

      serverProcess.kill("SIGTERM");

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (serverProcess.exitCode === null) {
            serverProcess.kill("SIGKILL");
          }
          resolve();
        }, 10000);

        serverProcess.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };
}

async function runLoadScenario(): Promise<void> {
  const endpoint = process.env.LOAD_ENDPOINT ?? "ws://localhost:3000";
  const joinCount = Number.parseInt(process.env.LOAD_JOIN_COUNT ?? "25", 10);
  const token = process.env.LOAD_BEARER_TOKEN ?? "replace-me";
  let localServer: LocalServerHandle | undefined;

  if (shouldAutoStartServer(endpoint)) {
    process.stdout.write(`Auto-starting local server for load test at ${endpoint}\n`);
    localServer = await startLocalServer(endpoint);
  }

  const clients: Client[] = [];
  const rooms = [];
  const start = Date.now();

  try {
    for (let i = 0; i < joinCount; i += 1) {
      const client = new Client(endpoint);
      clients.push(client);
      rooms.push(client.joinOrCreate("arena", { token }));
    }

    const joinedRooms = await Promise.all(rooms);

    for (const room of joinedRooms) {
      room.send("ping", { at: Date.now() });
    }

    const elapsedMs = Date.now() - start;
    process.stdout.write(
      `Load scenario finished: joined ${joinedRooms.length} rooms in ${elapsedMs}ms at ${endpoint}\n`
    );

    await Promise.all(
      joinedRooms.map(async (room) => {
        await room.leave();
      })
    );
  } finally {
    await localServer?.stop();
  }
}

runLoadScenario().catch((error) => {
  process.stderr.write(`Load scenario failed: ${(error as Error).message}\n`);
  process.exit(1);
});