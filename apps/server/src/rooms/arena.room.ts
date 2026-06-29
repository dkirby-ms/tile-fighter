import { Client, Room } from "@colyseus/core";
import { CombatSimulationService } from "../domain/combat-simulation.service.js";
import { ArenaState } from "./arena.state.js";
import { AuthService } from "../auth/auth-service.js";
import { SessionLifecycleService } from "../session/session-lifecycle.service.js";

type ArenaRoomOptions = {
  authService: AuthService;
  lifecycleService: SessionLifecycleService;
};

type JoinOptions = {
  joinToken?: string;
};

type AuthedClient = Client & {
  auth?: {
    tenantScopedSubject?: string;
  };
};

export class ArenaRoom extends Room<{ state: ArenaState }> {
  public static readonly ROOM_KEY = "arena";
  private simulation = new CombatSimulationService();
  private authService!: AuthService;
  private lifecycleService!: SessionLifecycleService;

  override onCreate(options: ArenaRoomOptions): void {
    this.authService = options.authService;
    this.lifecycleService = options.lifecycleService;
    this.setState(new ArenaState());
    this.setSimulationInterval(() => {
      this.simulation.step(this.state);
    }, 100);
  }

  override async onAuth(client: Client, options: JoinOptions): Promise<boolean> {
    const payload = this.authService.verifyJoinToken(options.joinToken ?? "", ArenaRoom.ROOM_KEY);
    (client as AuthedClient).auth = {
      tenantScopedSubject: payload.sub
    };
    return true;
  }

  override onJoin(client: Client): void {
    const tenantScopedSubject = (client as AuthedClient).auth?.tenantScopedSubject;
    if (tenantScopedSubject) {
      this.lifecycleService.noteRoomJoin(tenantScopedSubject, this.roomId);
    }
    client.send("joined", { roomId: this.roomId });
  }

  override onLeave(client: Client): void {
    const tenantScopedSubject = (client as AuthedClient).auth?.tenantScopedSubject;
    if (tenantScopedSubject) {
      this.lifecycleService.noteRoomLeave(tenantScopedSubject, this.roomId);
    }
  }
}