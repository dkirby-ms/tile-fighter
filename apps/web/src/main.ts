import { Client } from "@colyseus/sdk";

type BootstrapResponse = {
  tenantScopedSubject: string;
};

type JoinTokenResponse = {
  roomId: string;
  joinToken: string;
};

type RegionTile = {
  cellX: number;
  cellY: number;
  operation: "upsert" | "delete";
  color: string | null;
};

type RegionDiffResponse = {
  ok: true;
  tiles: RegionTile[];
};

type TilePlaceResponse =
  | {
      ok: true;
      tileId: number;
    }
  | {
      ok: false;
      reason: string;
    };

type ArenaRoom = {
  roomId: string;
  onMessage: (type: string, callback: (payload: unknown) => void) => void;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:3000";
const WS_BASE = (import.meta.env.VITE_WS_BASE as string | undefined) ?? "ws://localhost:3000";
const REGION_ID = "arena";
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;

const startButton = requireElement<HTMLButtonElement>("btn-start");
const joinButton = requireElement<HTMLButtonElement>("btn-join");
const syncButton = requireElement<HTMLButtonElement>("btn-sync");
const statusElement = requireElement<HTMLDivElement>("status");
const gridElement = requireElement<HTMLDivElement>("grid");
const logElement = requireElement<HTMLUListElement>("log");

let accessToken = "";
let subject = "";
let joinedRoom: ArenaRoom | null = null;
const occupiedCells = new Map<string, string>();

buildGrid();

startButton.addEventListener("click", () => {
  void startSession();
});

joinButton.addEventListener("click", () => {
  void joinArena();
});

syncButton.addEventListener("click", () => {
  void syncViewport();
});

async function startSession(): Promise<void> {
  try {
    setStatus("starting session");
    accessToken = await fetchDevAccessToken();

    const bootstrap = await apiGet<BootstrapResponse>("/api/session/bootstrap");
    subject = bootstrap.tenantScopedSubject;

    joinButton.disabled = false;
    syncButton.disabled = false;

    setStatus(`session ready for ${subject}`);
    log(`Session bootstrap succeeded for ${subject}`);
  } catch (error) {
    setStatus("session bootstrap failed");
    log(`Session start failed: ${(error as Error).message}`);
  }
}

async function joinArena(): Promise<void> {
  try {
    setStatus("joining arena room");

    const joinTokenResponse = await apiPost<JoinTokenResponse>("/api/session/join-token", {
      roomId: REGION_ID
    });

    const client = new Client(WS_BASE);
    const room = (await client.joinOrCreate(joinTokenResponse.roomId, {
      joinToken: joinTokenResponse.joinToken
    })) as unknown as ArenaRoom;

    room.onMessage("joined", (payload) => {
      const roomId = (payload as { roomId?: string }).roomId ?? "unknown";
      log(`Joined room ${roomId}`);
    });

    room.onMessage("delta", (payload) => {
      const delta = payload as {
        cellX: number;
        cellY: number;
        color: string;
      };
      paintCell(delta.cellX, delta.cellY, delta.color);
      log(`Realtime update at (${delta.cellX}, ${delta.cellY})`);
    });

    joinedRoom = room;

    setStatus("joined arena room");
    log("Room join completed");
  } catch (error) {
    setStatus("room join failed");
    log(`Room join failed: ${(error as Error).message}`);
  }
}

async function syncViewport(): Promise<void> {
  try {
    const response = await apiPost<RegionDiffResponse>("/api/regions/diff", {
      regionId: REGION_ID,
      sinceVersion: 0,
      viewport: {
        minCellX: 0,
        maxCellX: GRID_WIDTH - 1,
        minCellY: 0,
        maxCellY: GRID_HEIGHT - 1
      },
      maxTiles: 400
    });

    if (!response.ok) {
      throw new Error("Region diff returned non-ok response");
    }

    occupiedCells.clear();
    for (const tile of response.tiles) {
      const key = toKey(tile.cellX, tile.cellY);
      if (tile.operation === "delete" || !tile.color) {
        occupiedCells.delete(key);
        continue;
      }
      occupiedCells.set(key, tile.color);
    }

    repaintGrid();
    setStatus(`viewport synced: ${response.tiles.length} tile events`);
    log(`Viewport sync returned ${response.tiles.length} events`);
  } catch (error) {
    setStatus("viewport sync failed");
    log(`Viewport sync failed: ${(error as Error).message}`);
  }
}

async function placeTile(cellX: number, cellY: number): Promise<void> {
  if (!accessToken) {
    log("Start session before placing a tile");
    return;
  }

  const color = randomColor();
  const payload = {
    commandId: createCommandId(),
    regionId: REGION_ID,
    cellX,
    cellY,
    offsetX: 0,
    offsetY: 0,
    shape: "square",
    color,
    stylePayload: {
      source: "web-shell"
    }
  };

  try {
    const response = await apiPost<TilePlaceResponse>("/api/tiles/place", payload);
    if (!response.ok) {
      log(`Placement rejected at (${cellX}, ${cellY}) with reason=${response.reason}`);
      return;
    }

    paintCell(cellX, cellY, color);
    log(`Placed tile ${response.tileId} at (${cellX}, ${cellY})`);
  } catch (error) {
    log(`Placement failed at (${cellX}, ${cellY}): ${(error as Error).message}`);
  }
}

async function fetchDevAccessToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/dev/access-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject: `dev-player-${Math.floor(Math.random() * 10000)}`
    })
  });

  if (!response.ok) {
    throw new Error(`Unable to acquire dev access token (${response.status})`);
  }

  const body = (await response.json()) as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error("Dev access token response missing accessToken");
  }

  return body.accessToken;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: withAuthHeaders()
  });

  if (!response.ok) {
    throw new Error(`${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function withAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function buildGrid(): void {
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const button = document.createElement("button");
      button.className = "cell";
      button.type = "button";
      button.dataset.x = String(x);
      button.dataset.y = String(y);
      button.dataset.occupied = "false";
      button.addEventListener("click", () => {
        void placeTile(x, y);
      });
      gridElement.appendChild(button);
    }
  }
}

function repaintGrid(): void {
  const cells = gridElement.querySelectorAll<HTMLButtonElement>(".cell");
  cells.forEach((cell) => {
    const x = Number(cell.dataset.x ?? "0");
    const y = Number(cell.dataset.y ?? "0");
    const key = toKey(x, y);
    const color = occupiedCells.get(key) ?? "#f0f4f8";
    cell.style.background = color;
    cell.dataset.occupied = occupiedCells.has(key) ? "true" : "false";
  });
}

function paintCell(cellX: number, cellY: number, color: string): void {
  occupiedCells.set(toKey(cellX, cellY), color);
  const selector = `.cell[data-x="${cellX}"][data-y="${cellY}"]`;
  const cell = gridElement.querySelector<HTMLButtonElement>(selector);
  if (!cell) {
    return;
  }

  cell.style.background = color;
  cell.dataset.occupied = "true";
}

function toKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}

function createCommandId(): string {
  const seed = `${Date.now()}-${Math.random().toString(16).slice(2, 14)}`;
  return `web-${seed}`;
}

function randomColor(): string {
  const palette = ["#f59e0b", "#2563eb", "#16a34a", "#dc2626", "#9333ea", "#0891b2"];
  return palette[Math.floor(Math.random() * palette.length)] ?? "#2563eb";
}

function setStatus(message: string): void {
  statusElement.textContent = `Status: ${message}`;
}

function log(message: string): void {
  const item = document.createElement("li");
  item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logElement.prepend(item);

  while (logElement.children.length > 40) {
    logElement.removeChild(logElement.lastElementChild as Node);
  }
}

function requireElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }

  return element as TElement;
}

void joinedRoom;
