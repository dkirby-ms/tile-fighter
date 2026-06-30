import crypto from "node:crypto";
import { ReconnectFailureReason } from "../session/session-lifecycle.types.js";

export type ReconnectTokenPayload = {
  checkpointId: string;
  sessionId: string;
  playerIdentity: string;
  roomId: string;
  regionId: string;
  lastConfirmedVersion: number;
  exp: number;
  jti: string;
};

export type ReconnectTokenServiceOptions = {
  signingSecret: string;
  ttlSeconds: number;
  now?: () => number;
};

export class ReconnectTokenError extends Error {
  constructor(public readonly reason: ReconnectFailureReason, message: string) {
    super(message);
    this.name = "ReconnectTokenError";
  }
}

export class ReconnectTokenService {
  private readonly signingSecret: string;
  private readonly ttlSeconds: number;
  private readonly now: () => number;
  private readonly consumedReconnectTokenIds = new Map<string, number>();

  constructor(options: ReconnectTokenServiceOptions) {
    this.signingSecret = options.signingSecret;
    this.ttlSeconds = options.ttlSeconds;
    this.now = options.now ?? (() => Date.now());
  }

  issue(payload: Omit<ReconnectTokenPayload, "exp" | "jti">): string {
    this.pruneExpiredReplayEntries();

    const issuedAtSeconds = Math.floor(this.now() / 1000);
    const tokenPayload: ReconnectTokenPayload = {
      ...payload,
      jti: crypto.randomUUID(),
      exp: issuedAtSeconds + this.ttlSeconds
    };

    return this.sign(tokenPayload);
  }

  verify(token: string): ReconnectTokenPayload {
    this.pruneExpiredReplayEntries();

    if (!token) {
      throw new ReconnectTokenError("invalid_signature", "Reconnect token is required");
    }

    const payload = this.verifySignature(token);

    if (payload.exp <= Math.floor(this.now() / 1000)) {
      throw new ReconnectTokenError("token_expired", "Reconnect token expired");
    }

    if (this.consumedReconnectTokenIds.has(payload.jti)) {
      throw new ReconnectTokenError("token_replay_detected", "Reconnect token replay detected");
    }

    this.consumedReconnectTokenIds.set(payload.jti, payload.exp);
    return payload;
  }

  private pruneExpiredReplayEntries(): void {
    const nowSeconds = Math.floor(this.now() / 1000);

    for (const [jti, expiresAt] of this.consumedReconnectTokenIds.entries()) {
      if (expiresAt <= nowSeconds) {
        this.consumedReconnectTokenIds.delete(jti);
      }
    }
  }

  private sign(payload: ReconnectTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", this.signingSecret).update(encodedPayload).digest("base64url");
    return `${encodedPayload}.${signature}`;
  }

  private verifySignature(token: string): ReconnectTokenPayload {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new ReconnectTokenError("invalid_signature", "Malformed reconnect token");
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.signingSecret)
      .update(encodedPayload)
      .digest("base64url");

    if (signature !== expectedSignature) {
      throw new ReconnectTokenError("invalid_signature", "Malformed reconnect token");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    } catch {
      throw new ReconnectTokenError("invalid_signature", "Malformed reconnect token");
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      typeof (payload as { checkpointId?: unknown }).checkpointId !== "string" ||
      typeof (payload as { sessionId?: unknown }).sessionId !== "string" ||
      typeof (payload as { playerIdentity?: unknown }).playerIdentity !== "string" ||
      typeof (payload as { roomId?: unknown }).roomId !== "string" ||
      typeof (payload as { regionId?: unknown }).regionId !== "string" ||
      typeof (payload as { lastConfirmedVersion?: unknown }).lastConfirmedVersion !== "number" ||
      typeof (payload as { exp?: unknown }).exp !== "number" ||
      typeof (payload as { jti?: unknown }).jti !== "string"
    ) {
      throw new ReconnectTokenError("invalid_signature", "Malformed reconnect token");
    }

    return payload as ReconnectTokenPayload;
  }
}
