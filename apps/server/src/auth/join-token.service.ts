import crypto from "node:crypto";

export type JoinTokenPayload = {
  sub: string;
  roomId: string;
  jti: string;
  exp: number;
};

export type JoinTokenServiceOptions = {
  signingSecret: string;
  ttlSeconds: number;
  now?: () => number;
};

export class JoinTokenService {
  private readonly signingSecret: string;
  private readonly ttlSeconds: number;
  private readonly now: () => number;
  private readonly consumedJoinTokenIds = new Map<string, number>();

  constructor(options: JoinTokenServiceOptions) {
    this.signingSecret = options.signingSecret;
    this.ttlSeconds = options.ttlSeconds;
    this.now = options.now ?? (() => Date.now());
  }

  issue(subject: string, roomId: string): string {
    this.pruneExpiredReplayEntries();

    const issuedAtSeconds = Math.floor(this.now() / 1000);
    const payload: JoinTokenPayload = {
      sub: subject,
      roomId,
      jti: crypto.randomUUID(),
      exp: issuedAtSeconds + this.ttlSeconds
    };

    return this.sign(payload);
  }

  verify(token: string, expectedRoomId: string): JoinTokenPayload {
    this.pruneExpiredReplayEntries();

    if (!token) {
      throw new Error("Join token is required");
    }

    const payload = this.verifySignature(token);

    if (payload.exp <= Math.floor(this.now() / 1000)) {
      throw new Error("Join token expired");
    }

    if (payload.roomId !== expectedRoomId) {
      throw new Error("Join token room mismatch");
    }

    if (this.consumedJoinTokenIds.has(payload.jti)) {
      throw new Error("Join token replay detected");
    }

    this.consumedJoinTokenIds.set(payload.jti, payload.exp);
    return payload;
  }

  private pruneExpiredReplayEntries(): void {
    const nowSeconds = Math.floor(this.now() / 1000);

    for (const [jti, expiresAt] of this.consumedJoinTokenIds.entries()) {
      if (expiresAt <= nowSeconds) {
        this.consumedJoinTokenIds.delete(jti);
      }
    }
  }

  private sign(payload: JoinTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", this.signingSecret).update(encodedPayload).digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  private verifySignature(token: string): JoinTokenPayload {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new Error("Malformed join token");
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.signingSecret)
      .update(encodedPayload)
      .digest("base64url");

    if (signature !== expectedSignature) {
      throw new Error("Malformed join token");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    } catch {
      throw new Error("Malformed join token");
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      typeof (payload as { sub?: unknown }).sub !== "string" ||
      typeof (payload as { roomId?: unknown }).roomId !== "string" ||
      typeof (payload as { jti?: unknown }).jti !== "string" ||
      typeof (payload as { exp?: unknown }).exp !== "number"
    ) {
      throw new Error("Malformed join token");
    }

    return payload as JoinTokenPayload;
  }
}