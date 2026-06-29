import { config as loadDotEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@colyseus/sdk";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const runtimeEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env");
loadDotEnv({ path: runtimeEnvPath });

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
  const joinTokenPath = process.env.LOAD_JOIN_TOKEN_PATH ?? "/api/session/join-token";
  const bootstrapPath = process.env.LOAD_BOOTSTRAP_PATH ?? "/api/session/bootstrap";
  const roomKey = process.env.LOAD_ROOM_KEY ?? "arena";
  const evidencePath = process.env.LOAD_EVIDENCE_PATH;
  let localServer: LocalServerHandle | undefined;

  if (shouldAutoStartServer(endpoint)) {
    process.stdout.write(`Auto-starting local server for load test at ${endpoint}\n`);
    localServer = await startLocalServer(endpoint);
  }

  const httpUrl = toHttpUrl(endpoint);
  const joinDurationsMs: number[] = [];
  const joinedRooms = [];

  try {
    for (let i = 0; i < joinCount; i += 1) {
      const bootstrapStartedAt = Date.now();
      const bootstrapResponse = await fetch(`${httpUrl.origin}${bootstrapPath}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!bootstrapResponse.ok) {
        throw new Error(`Bootstrap request failed with status ${bootstrapResponse.status}`);
      }

      const joinTokenResponse = await fetch(`${httpUrl.origin}${joinTokenPath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ roomId: roomKey })
      });
      if (!joinTokenResponse.ok) {
        throw new Error(`Join-token request failed with status ${joinTokenResponse.status}`);
      }
      const joinTokenPayload = (await joinTokenResponse.json()) as {
        joinToken?: string;
      };
      if (!joinTokenPayload.joinToken) {
        throw new Error("Join-token response missing joinToken");
      }

      const client = new Client(endpoint);
      const room = await client.joinOrCreate(roomKey, { joinToken: joinTokenPayload.joinToken });
      joinedRooms.push(room);
      joinDurationsMs.push(Date.now() - bootstrapStartedAt);
    }

    for (const room of joinedRooms) {
      room.send("ping", { at: Date.now() });
    }

    const sortedDurations = [...joinDurationsMs].sort((a, b) => a - b);
    const p50Index = Math.max(0, Math.floor((sortedDurations.length - 1) * 0.5));
    const p50Ms = sortedDurations[p50Index] ?? 0;
    const elapsedMs = sortedDurations.reduce((acc, value) => acc + value, 0);

    const evidence = {
      endpoint,
      roomKey,
      samples: joinDurationsMs.length,
      startBoundary: "token-ready",
      endBoundary: "bootstrap-success-plus-room-join",
      p50Ms,
      averageMs: joinDurationsMs.length > 0 ? Math.round(elapsedMs / joinDurationsMs.length) : 0,
      durationsMs: joinDurationsMs
    };

    process.stdout.write(
      `Load scenario finished: joined ${joinedRooms.length} rooms at ${endpoint}; p50=${p50Ms}ms from token-ready to playable shell\n`
    );

    if (evidencePath) {
      const slashIndex = evidencePath.lastIndexOf("/");
      if (slashIndex > 0) {
        await mkdir(evidencePath.slice(0, slashIndex), { recursive: true });
      }
      await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
      process.stdout.write(`Wrote load evidence artifact to ${evidencePath}\n`);
    }

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