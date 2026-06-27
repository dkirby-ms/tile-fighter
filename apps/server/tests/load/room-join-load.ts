import { Client } from "@colyseus/sdk";

async function runLoadScenario(): Promise<void> {
  const endpoint = process.env.LOAD_ENDPOINT ?? "ws://localhost:3000";
  const joinCount = Number.parseInt(process.env.LOAD_JOIN_COUNT ?? "25", 10);
  const token = process.env.LOAD_BEARER_TOKEN ?? "replace-me";

  const clients: Client[] = [];
  const rooms = [];
  const start = Date.now();

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
}

runLoadScenario().catch((error) => {
  process.stderr.write(`Load scenario failed: ${(error as Error).message}\n`);
  process.exit(1);
});