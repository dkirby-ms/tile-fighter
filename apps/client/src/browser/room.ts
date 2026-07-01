import type { BrowserRuntimeEnv } from "./env.js";
import { Client } from "@colyseus/sdk";
import {
  createRealtimeDeltaHandler,
  type RealtimeDeltaPayload
} from "../session/realtime-delta-handler.js";

export interface RoomConnection {
  readonly connected: boolean;
}

export interface BrowserJoinedPayload {
  roomId: string;
}

export interface BrowserRoomSession {
  readonly roomId: string;
  readonly sessionId: string;
  leave: () => Promise<void>;
}

type ColyseusRoomLike = {
  roomId: string;
  sessionId: string;
  onMessage: (type: string, callback: (message: unknown) => void) => void;
  onLeave: (callback: (code: number) => void) => void;
  leave: () => Promise<void>;
  on: (event: string, handler: (data: unknown) => void) => void;
  send: (event: string, data: unknown) => void;
};

export async function connectRoom(_env: BrowserRuntimeEnv): Promise<RoomConnection> {
  void _env;

  return {
    connected: false
  };
}

export async function joinArenaRoom(
  env: BrowserRuntimeEnv,
  joinToken: string,
  handlers: {
    onJoined: (payload: BrowserJoinedPayload) => void;
    onDelta: (payload: RealtimeDeltaPayload) => void;
    onRoomLeave: (code: number) => void;
  }
): Promise<BrowserRoomSession> {
  const client = new Client(env.roomWsUrl);
  const room = (await client.joinOrCreate(env.roomId, {
    joinToken
  })) as unknown as ColyseusRoomLike;

  room.onMessage("joined", (message) => {
    const payload = message as BrowserJoinedPayload;
    handlers.onJoined(payload);
  });

  createRealtimeDeltaHandler(room, async (delta) => {
    handlers.onDelta(delta);
  });

  room.onLeave((code) => {
    handlers.onRoomLeave(code);
  });

  return {
    roomId: room.roomId,
    sessionId: room.sessionId,
    leave: async () => room.leave()
  };
}
