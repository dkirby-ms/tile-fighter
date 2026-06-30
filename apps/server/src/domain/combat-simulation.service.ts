import { ArenaState } from "../rooms/arena.state.js";
import { createHash } from "node:crypto";

export type PlacementCommandHashInput = {
  regionId: string;
  actorId: string;
  commandId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
};

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJsonStringify(entryValue)}`)
    .join(",")}}`;
}

export function hashPlacementCommandPayload(input: PlacementCommandHashInput): string {
  const canonicalPayload = {
    regionId: input.regionId,
    actorId: input.actorId,
    commandId: input.commandId,
    cellX: input.cellX,
    cellY: input.cellY,
    offsetX: input.offsetX,
    offsetY: input.offsetY,
    shape: input.shape,
    color: input.color,
    stylePayload: input.stylePayload
  };

  return createHash("sha256").update(stableJsonStringify(canonicalPayload)).digest("hex");
}

export class CombatSimulationService {
  step(state: ArenaState): void {
    state.tick += 1;

    if (state.tick % 5 === 0) {
      state.playerAHealth = Math.max(0, state.playerAHealth - 1);
    }

    if (state.tick % 7 === 0) {
      state.playerBHealth = Math.max(0, state.playerBHealth - 1);
    }
  }
}