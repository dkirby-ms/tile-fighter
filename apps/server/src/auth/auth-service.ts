import { JwtValidationConfig, JwtValidator } from "@game/shared-auth";
import { AuthenticatedPrincipal } from "@game/shared-types";
import { RuntimeConfig } from "../config/env.js";

export class AuthService {
  private readonly validator: JwtValidator;

  constructor(config: RuntimeConfig) {
    const validatorConfig: JwtValidationConfig = {
      jwksUri: config.entraJwksUrl,
      issuer: config.entraIssuer,
      audience: config.entraAudience,
      algorithms: ["RS256"],
      tenantMode: config.tenantMode,
      ...(config.entraTenantId ? { singleTenantId: config.entraTenantId } : {}),
      allowedTenantIds: config.allowedTenantIds,
      deniedTenantIds: config.deniedTenantIds,
      allowedIssuers: config.allowedIssuers
    };

    this.validator = new JwtValidator(validatorConfig);
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    if (!token) {
      throw new Error("Bearer token is required");
    }
    return await this.validator.validate(token);
  }
}