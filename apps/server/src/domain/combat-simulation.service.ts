import { ArenaState } from "../rooms/arena.state.js";

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