import { Client, Room } from "@colyseus/core";
import { CombatSimulationService } from "../domain/combat-simulation.service.js";
import { ArenaState } from "./arena.state.js";
import { AuthService } from "../auth/auth-service.js";
import { SessionLifecycleService } from "../session/session-lifecycle.service.js";
import { DeltaAckPayload, DeltaFanoutCoordinator, type DeltaFanoutConfig, type RealtimeDeltaPayload } from "../domain/delta-fanout.service.js";
import { TelemetrySink } from "../telemetry/telemetry-sink.js";
import { getDeltaFanoutRegistryKey, type DeltaFanoutRegistry } from "../http/app.js";

type ArenaRoomOptions = {
  authService: AuthService;
  lifecycleService: SessionLifecycleService;
  deltaFanoutRegistry?: DeltaFanoutRegistry;
  telemetrySink?: TelemetrySink;
  deltaFanoutConfig?: DeltaFanoutConfig;
};

type JoinOptions = {
  joinToken?: string;
};

type AuthedClient = Client & {
  auth?: {
    tenantScopedSubject?: string;
  };
  sessionId?: string;
};

/**
 * Realtime message names for delta fanout and ack coordination
 */
export const REALTIME_MESSAGES = {
  DELTA: "delta",
  DELTA_ACK: "delta_ack"
} as const;

export class ArenaRoom extends Room<{ state: ArenaState }> {
  public static readonly ROOM_KEY = "arena";
  private simulation = new CombatSimulationService();
  private authService!: AuthService;
  private lifecycleService!: SessionLifecycleService;
  private deltaFanoutCoordinator?: DeltaFanoutCoordinator;
  private deltaFanoutRegistry: DeltaFanoutRegistry | undefined;
  private telemetrySink: TelemetrySink | undefined;

  public static fanoutRegistryKey(): string {
    return getDeltaFanoutRegistryKey(ArenaRoom.ROOM_KEY);
  }

  override onCreate(options: ArenaRoomOptions): void {
    this.authService = options.authService;
    this.lifecycleService = options.lifecycleService;
    this.deltaFanoutRegistry = options.deltaFanoutRegistry;
    this.telemetrySink = options.telemetrySink;

    // Initialize delta fanout coordinator if registry and config provided
    if (options.deltaFanoutRegistry && options.deltaFanoutConfig && this.telemetrySink) {
      this.deltaFanoutCoordinator = new DeltaFanoutCoordinator(
        options.deltaFanoutConfig,
        this.handleRetransmit.bind(this),
        this.handleAckCallback.bind(this)
      );

      options.deltaFanoutRegistry.set(ArenaRoom.fanoutRegistryKey(), {
        coordinator: this.deltaFanoutCoordinator,
        getSubscriberIds: () => new Set(this.clients.map((client) => client.sessionId)),
        sendToSubscriber: async (subscriberId, payload) => {
          const targetClient = this.clients.find((client) => client.sessionId === subscriberId);
          if (!targetClient) {
            return;
          }
          targetClient.send(REALTIME_MESSAGES.DELTA, payload);
        }
      });
    }

    this.setState(new ArenaState());
    this.setSimulationInterval(() => {
      this.simulation.step(this.state);
    }, 100);

    // Register message handler for delta ack
    this.onMessage(REALTIME_MESSAGES.DELTA_ACK, (client: Client, payload: DeltaAckPayload) => {
      this.handleDeltaAck(client, payload);
    });
  }

  override async onAuth(client: Client, options: JoinOptions): Promise<boolean> {
    const payload = this.authService.verifyJoinToken(options.joinToken ?? "", ArenaRoom.ROOM_KEY);
    (client as AuthedClient).auth = {
      tenantScopedSubject: payload.sub
    };
    return true;
  }

  override async onJoin(client: Client): Promise<void> {
    const authedClient = client as AuthedClient;
    const tenantScopedSubject = authedClient.auth?.tenantScopedSubject;
    if (tenantScopedSubject) {
      await this.lifecycleService.noteRoomJoin(tenantScopedSubject, this.roomId);
    }
    // Store session ID for delta ack handling
    authedClient.sessionId = client.sessionId;
    client.send("joined", { roomId: this.roomId });

    // Register subscriber with coordinator on join
    if (this.deltaFanoutCoordinator) {
      this.deltaFanoutCoordinator.registerSubscriber(client.sessionId);
    }
  }

  override async onLeave(client: Client): Promise<void> {
    const tenantScopedSubject = (client as AuthedClient).auth?.tenantScopedSubject;
    if (tenantScopedSubject) {
      await this.lifecycleService.noteRoomLeave(tenantScopedSubject, this.roomId);
    }

    // Unregister subscriber from coordinator on leave
    if (this.deltaFanoutCoordinator) {
      this.deltaFanoutCoordinator.unregisterSubscriber(client.sessionId);
    }
  }

  override onDispose(): void {
    if (this.deltaFanoutRegistry) {
      this.deltaFanoutRegistry.delete(ArenaRoom.fanoutRegistryKey());
    }

    if (this.deltaFanoutCoordinator) {
      this.deltaFanoutCoordinator.destroy();
    }
  }

  /**
   * Handle delta ack message from client
   * Notifies coordinator of successful receipt and clears pending ack entry
   */
  private async handleDeltaAck(client: Client, payload: DeltaAckPayload): Promise<void> {
    if (this.deltaFanoutCoordinator) {
      await this.deltaFanoutCoordinator.handleAck(client.sessionId, payload.sequenceId);
    }
  }

  /**
   * Callback invoked when a delta is retransmitted due to ack timeout
   * Sends the retransmitted delta to the specific client
   */
  private async handleRetransmit(payload: RealtimeDeltaPayload): Promise<void> {
    // Send to all clients - the coordinator manages which specific subscribers need it
    this.clients.forEach((client) => {
      client.send(REALTIME_MESSAGES.DELTA, payload);
    });

    // Emit retransmit telemetry if sink available
    if (this.telemetrySink) {
      await this.telemetrySink.emitDeltaRetransmitted(
        this.roomId,
        "", // sessionId not directly available here - would need to track in coordinator
        payload.sequenceId,
        payload.regionId,
        payload.retransmitAttempt,
        0 // timeoutReasonMs would need to come from coordinator config
      );
    }
  }

  /**
   * Callback invoked when an ack is received for a delta
   * Tracks telemetry of successful ack
   */
  private async handleAckCallback(subscriberId: string, sequenceId: string): Promise<void> {
    if (this.telemetrySink) {
      // Find the region from the sequence context - note: this is a simplified approach
      // In a full implementation, the coordinator would track region metadata
      await this.telemetrySink.emitDeltaAcked(
        this.roomId,
        subscriberId,
        sequenceId,
        "" // regionId not directly available - would need coordinator enhancement
      );
    }
  }
}