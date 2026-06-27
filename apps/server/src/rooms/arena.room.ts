import { Client, Room } from "colyseus";
import { CombatSimulationService } from "../domain/combat-simulation.service.js";
import { ArenaState } from "./arena.state.js";
import { AuthService } from "../auth/auth-service.js";

type ArenaRoomOptions = {
  authService: AuthService;
};

type JoinOptions = {
  token?: string;
};

export class ArenaRoom extends Room<{ state: ArenaState }> {
  private simulation = new CombatSimulationService();
  private authService!: AuthService;

  override onCreate(options: ArenaRoomOptions): void {
    this.authService = options.authService;
    this.setState(new ArenaState());
    this.setSimulationInterval(() => {
      this.simulation.step(this.state);
    }, 100);
  }

  override async onAuth(_client: Client, options: JoinOptions): Promise<boolean> {
    await this.authService.verifyAccessToken(options.token ?? "");
    return true;
  }

  override onJoin(client: Client): void {
    client.send("joined", { roomId: this.roomId });
  }
}