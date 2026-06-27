import jwt, { JwtPayload } from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";
import { AuthenticatedPrincipal, TenantMode } from "@game/shared-types";

export interface JwtValidationConfig {
  jwksUri: string;
  issuer: string;
  audience: string;
  algorithms: readonly jwt.Algorithm[];
  tenantMode: TenantMode;
  singleTenantId?: string;
  allowedTenantIds: readonly string[];
  deniedTenantIds: readonly string[];
  allowedIssuers: readonly string[];
}

export interface JwtValidatorDeps {
  jwksClient?: JwksClient;
}

interface EntraJwtPayload extends JwtPayload {
  tid?: string;
}

export class JwtValidator {
  private readonly client: JwksClient;

  constructor(private readonly config: JwtValidationConfig, deps: JwtValidatorDeps = {}) {
    this.client =
      deps.jwksClient ??
      jwksClient({
        jwksUri: config.jwksUri,
        cache: true,
        cacheMaxEntries: 10,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 15
      });
  }

  async validate(token: string): Promise<AuthenticatedPrincipal> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded !== "object" || !decoded.header) {
      throw new Error("Malformed token");
    }

    if (decoded.header.alg === "none") {
      throw new Error("Unsigned tokens are forbidden");
    }

    const tokenAlgorithm = decoded.header.alg;
    if (!tokenAlgorithm || !this.config.algorithms.includes(tokenAlgorithm as jwt.Algorithm)) {
      throw new Error("Token algorithm is not allowed");
    }

    const payload = await this.verifyToken(token);
    this.enforceTenantMode(payload);

    return {
      subject: payload.sub ?? "",
      issuer: payload.iss ?? "",
      audience: payload.aud ?? "",
      ...(payload.tid ? { tenantId: payload.tid } : {}),
      expiresAt: payload.exp ?? 0
    };
  }

  private async verifyToken(token: string): Promise<EntraJwtPayload> {
    return await new Promise<EntraJwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        async (header, callback) => {
          try {
            if (!header.kid) {
              callback(new Error("Token is missing kid header"));
              return;
            }
            const signingKey = await this.client.getSigningKey(header.kid);
            callback(null, signingKey.getPublicKey());
          } catch (error) {
            callback(error as Error);
          }
        },
        {
          issuer: this.config.issuer,
          audience: this.config.audience,
          algorithms: [...this.config.algorithms]
        },
        (error: jwt.VerifyErrors | null, payload?: string | JwtPayload) => {
          if (error) {
            reject(error);
            return;
          }

          if (!payload || typeof payload === "string") {
            reject(new Error("Expected JWT payload object"));
            return;
          }

          resolve(payload as EntraJwtPayload);
        }
      );
    });
  }

  private enforceTenantMode(payload: EntraJwtPayload): void {
    if (this.config.deniedTenantIds.includes(payload.tid ?? "")) {
      throw new Error("Tenant is denied");
    }

    if (this.config.tenantMode === "single") {
      if (!this.config.singleTenantId || payload.tid !== this.config.singleTenantId) {
        throw new Error("Token tenant does not match configured single tenant");
      }
      return;
    }

    const matchesAllowedIssuer =
      this.config.allowedIssuers.length === 0 || this.config.allowedIssuers.includes(payload.iss ?? "");
    const matchesAllowedTenant =
      this.config.allowedTenantIds.length === 0 || this.config.allowedTenantIds.includes(payload.tid ?? "");

    if (this.config.tenantMode === "multi") {
      if (!matchesAllowedIssuer || !matchesAllowedTenant) {
        throw new Error("Token issuer or tenant is not allowed");
      }
      return;
    }

    const isSingleTenantMatch =
      Boolean(this.config.singleTenantId) && payload.tid === this.config.singleTenantId;
    if (!isSingleTenantMatch && (!matchesAllowedIssuer || !matchesAllowedTenant)) {
      throw new Error("Token does not satisfy single or multi tenant policy");
    }
  }
}