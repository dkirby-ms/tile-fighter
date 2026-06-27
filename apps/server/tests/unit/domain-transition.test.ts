import { describe, expect, it } from "vitest";
import { CombatSimulationService } from "../../src/domain/combat-simulation.service.js";
import { ArenaState } from "../../src/rooms/arena.state.js";

describe("CombatSimulationService", () => {
  it("applies deterministic authoritative state transitions", () => {
    const service = new CombatSimulationService();
    const state = new ArenaState();

    for (let i = 0; i < 35; i += 1) {
      service.step(state);
    }

    expect(state.tick).toBe(35);
    expect(state.playerAHealth).toBe(93);
    expect(state.playerBHealth).toBe(95);
  });
});