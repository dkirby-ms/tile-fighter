import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { JwtValidationConfig, JwtValidator } from "@game/shared-auth";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048
});

const privateKeyPem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const publicKeyPem = publicKey.export({ type: "pkcs1", format: "pem" }).toString();

const baseConfig: JwtValidationConfig = {
  jwksUri: "https://example.test/keys",
  issuer: "https://issuer.example/v2.0",
  audience: "api://tile-fighter-server",
  algorithms: ["RS256"],
  acceptedTokenVersion: "2.0",
  tenantMode: "single",
  singleTenantId: "tenant-a",
  allowedTenantIds: [],
  deniedTenantIds: [],
  allowedIssuers: []
};

function buildValidator(config: JwtValidationConfig = baseConfig): JwtValidator {
  const mockClient = {
    getSigningKey: async (kid: string) => {
      if (kid !== "kid-1") {
        throw new Error("Key not found");
      }
      return {
        getPublicKey: () => publicKeyPem
      };
    }
  };

  return new JwtValidator(config, { jwksClient: mockClient as never });
}

function createToken(overrides: Partial<jwt.SignOptions> = {}, payload: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      tid: "tenant-a",
      ver: "2.0",
      ...payload
    },
    privateKeyPem,
    {
      algorithm: "RS256",
      keyid: "kid-1",
      issuer: baseConfig.issuer,
      audience: baseConfig.audience,
      subject: "player-1",
      expiresIn: "1h",
      ...overrides
    }
  );
}

describe("JwtValidator", () => {
  it("accepts a valid token", async () => {
    const validator = buildValidator();
    const token = createToken();

    const principal = await validator.validate(token);
    expect(principal.subject).toBe("player-1");
    expect(principal.tenantScopedSubject).toBe("tenant-a|player-1");
    expect(principal.tenantId).toBe("tenant-a");
  });

  it("rejects wrong audience", async () => {
    const validator = buildValidator();
    const token = createToken({ audience: "api://wrong-audience" });
    await expect(validator.validate(token)).rejects.toThrow();
  });

  it("rejects wrong issuer", async () => {
    const validator = buildValidator();
    const token = createToken({ issuer: "https://malicious.example/v2.0" });
    await expect(validator.validate(token)).rejects.toThrow();
  });

  it("rejects expired token", async () => {
    const validator = buildValidator();
    const token = createToken({ expiresIn: "-1s" });
    await expect(validator.validate(token)).rejects.toThrow();
  });

  it("rejects token with wrong token version", async () => {
    const validator = buildValidator();
    const token = createToken({}, { ver: "1.0" });
    await expect(validator.validate(token)).rejects.toThrow("Token version is not accepted");
  });

  it("rejects alg none token", async () => {
    const validator = buildValidator();
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: baseConfig.issuer,
        aud: baseConfig.audience,
        sub: "player-1",
        exp: Math.floor(Date.now() / 1000) + 3600,
        tid: "tenant-a"
      })
    ).toString("base64url");
    const token = `${header}.${payload}.`;

    await expect(validator.validate(token)).rejects.toThrow("Unsigned tokens are forbidden");
  });
});