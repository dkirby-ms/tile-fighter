import { JwtValidationConfig, JwtValidator } from "@game/shared-auth";
import { AuthenticatedPrincipal } from "@game/shared-types";
import { RuntimeConfig } from "../config/env.js";
import { JoinTokenService, JoinTokenPayload } from "./join-token.service.js";
import { ReconnectTokenPayload, ReconnectTokenService } from "./reconnect-token.service.js";

type DevAccessTokenPayload = {
  subject: string;
  tenantScopedSubject: string;
  tenantId: string | null;
  issuer: string;
  audience: string;
  tokenVersion: string;
  expiresAt: number;
};

export class AuthService {
  private readonly validator: JwtValidator;
  private readonly joinTokenService: JoinTokenService;
  private readonly reconnectTokenService: ReconnectTokenService;
  private readonly config: RuntimeConfig;

  constructor(config: RuntimeConfig) {
    this.config = config;
    const validatorConfig: JwtValidationConfig = {
      jwksUri: config.entraJwksUrl,
      issuer: config.entraIssuer,
      audience: config.entraAudience,
      algorithms: ["RS256"],
      acceptedTokenVersion: config.entraTokenVersion,
      tenantMode: config.tenantMode,
      ...(config.entraTenantId ? { singleTenantId: config.entraTenantId } : {}),
      allowedTenantIds: config.allowedTenantIds,
      deniedTenantIds: config.deniedTenantIds,
      allowedIssuers: config.allowedIssuers
    };

    this.validator = new JwtValidator(validatorConfig);
    this.joinTokenService = new JoinTokenService({
      signingSecret: config.joinTokenSigningSecret,
      ttlSeconds: config.joinTokenTtlSeconds
    });
    this.reconnectTokenService = new ReconnectTokenService({
      signingSecret: config.joinTokenSigningSecret,
      ttlSeconds: config.joinTokenTtlSeconds
    });
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    if (!token) {
      throw new Error("Bearer token is required");
    }

    const devPrincipal = this.tryVerifyDevAccessToken(token);
    if (devPrincipal) {
      return devPrincipal;
    }

    return await this.validator.validate(token);
  }

  issueDevAccessToken(subject: string): string {
    if (this.config.devAuthMode !== "allow") {
      throw new Error("Development auth mode is disabled");
    }

    const payload: DevAccessTokenPayload = {
      subject,
      tenantScopedSubject: subject,
      tenantId: this.config.entraTenantId ?? null,
      issuer: this.config.entraIssuer,
      audience: this.config.entraAudience,
      tokenVersion: this.config.entraTokenVersion,
      expiresAt: Date.now() + 15 * 60 * 1000
    };

    const payloadJson = JSON.stringify(payload);
    const payloadPart = Buffer.from(payloadJson, "utf8").toString("base64url");
    const secretPart = Buffer.from(this.config.devAuthSharedSecret ?? "", "utf8").toString("base64url");
    return `dev.${payloadPart}.${secretPart}`;
  }

  private tryVerifyDevAccessToken(token: string): AuthenticatedPrincipal | null {
    if (this.config.devAuthMode !== "allow") {
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "dev") {
      return null;
    }

    const expectedSecretPart = Buffer.from(this.config.devAuthSharedSecret ?? "", "utf8").toString("base64url");
    if (parts[2] !== expectedSecretPart) {
      throw new Error("Invalid development auth token signature");
    }

    const payloadPart = parts[1];
    if (!payloadPart) {
      throw new Error("Invalid development auth token payload segment");
    }

    const payloadJson = Buffer.from(payloadPart, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as DevAccessTokenPayload;
    if (!payload.subject || !payload.tenantScopedSubject || !payload.issuer || !payload.audience) {
      throw new Error("Invalid development auth token payload");
    }

    if (Date.now() >= payload.expiresAt) {
      throw new Error("Development auth token expired");
    }

    return {
      subject: payload.subject,
      tenantScopedSubject: payload.tenantScopedSubject,
      issuer: payload.issuer,
      audience: payload.audience,
      ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
      tokenVersion: payload.tokenVersion,
      expiresAt: payload.expiresAt
    };
  }

  issueJoinToken(subject: string, roomId: string): string {
    return this.joinTokenService.issue(subject, roomId);
  }

  verifyJoinToken(token: string, expectedRoomId: string): JoinTokenPayload {
    return this.joinTokenService.verify(token, expectedRoomId);
  }

  issueReconnectToken(payload: Omit<ReconnectTokenPayload, "exp" | "jti">): string {
    return this.reconnectTokenService.issue(payload);
  }

  verifyReconnectToken(token: string): ReconnectTokenPayload {
    return this.reconnectTokenService.verify(token);
  }
}