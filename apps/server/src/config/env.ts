import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  ENTRA_ISSUER: z.string().url(),
  ENTRA_AUDIENCE: z.string().min(1),
  ENTRA_JWKS_URL: z.string().url(),
  TENANT_MODE: z.enum(["single", "multi", "both"]).default("single"),
  ENTRA_TENANT_ID: z.string().optional(),
  ALLOWED_TENANT_IDS: z.string().optional(),
  DENIED_TENANT_IDS: z.string().optional(),
  ALLOWED_ISSUERS: z.string().optional()
});

export type RuntimeConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  entraIssuer: string;
  entraAudience: string;
  entraJwksUrl: string;
  tenantMode: "single" | "multi" | "both";
  entraTenantId?: string;
  allowedTenantIds: string[];
  deniedTenantIds: string[];
  allowedIssuers: string[];
};

function splitCsv(input?: string): string[] {
  return (input ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function readRuntimeConfig(): RuntimeConfig {
  const parsed = envSchema.parse(process.env);

  if (parsed.TENANT_MODE === "single" && !parsed.ENTRA_TENANT_ID) {
    throw new Error("ENTRA_TENANT_ID is required when TENANT_MODE is single");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    entraIssuer: parsed.ENTRA_ISSUER,
    entraAudience: parsed.ENTRA_AUDIENCE,
    entraJwksUrl: parsed.ENTRA_JWKS_URL,
    tenantMode: parsed.TENANT_MODE,
    ...(parsed.ENTRA_TENANT_ID ? { entraTenantId: parsed.ENTRA_TENANT_ID } : {}),
    allowedTenantIds: splitCsv(parsed.ALLOWED_TENANT_IDS),
    deniedTenantIds: splitCsv(parsed.DENIED_TENANT_IDS),
    allowedIssuers: splitCsv(parsed.ALLOWED_ISSUERS)
  };
}