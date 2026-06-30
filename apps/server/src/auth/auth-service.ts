import { JwtValidationConfig, JwtValidator } from "@game/shared-auth";
import { AuthenticatedPrincipal } from "@game/shared-types";
import { RuntimeConfig } from "../config/env.js";
import { JoinTokenService, JoinTokenPayload } from "./join-token.service.js";
import { ReconnectTokenPayload, ReconnectTokenService } from "./reconnect-token.service.js";

export class AuthService {
  private readonly validator: JwtValidator;
  private readonly joinTokenService: JoinTokenService;
  private readonly reconnectTokenService: ReconnectTokenService;

  constructor(config: RuntimeConfig) {
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
    return await this.validator.validate(token);
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