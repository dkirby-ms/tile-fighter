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
  ENTRA_TOKEN_VERSION: z.enum(["1.0", "2.0"]).default("2.0"),
  TENANT_MODE: z.enum(["single", "multi", "both"]).default("single"),
  ENTRA_TENANT_ID: z.string().optional(),
  ALLOWED_TENANT_IDS: z.string().optional(),
  DENIED_TENANT_IDS: z.string().optional(),
  ALLOWED_ISSUERS: z.string().optional(),
  TELEMETRY_SINK_MODE: z.enum(["off", "optional", "required"]).default("optional"),
  TELEMETRY_SINK_URL: z.string().url().optional(),
  TELEMETRY_SINK_NAME: z.string().optional(),
  JOIN_TOKEN_SIGNING_SECRET: z.string().min(32),
  JOIN_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(120).default(120),
  SESSION_HEARTBEAT_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  SESSION_CLEANUP_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10)
});

export type RuntimeConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  entraIssuer: string;
  entraAudience: string;
  entraJwksUrl: string;
  entraTokenVersion: "1.0" | "2.0";
  tenantMode: "single" | "multi" | "both";
  entraTenantId?: string;
  allowedTenantIds: string[];
  deniedTenantIds: string[];
  allowedIssuers: string[];
  telemetrySinkMode: "off" | "optional" | "required";
  telemetrySinkUrl?: string;
  telemetrySinkName?: string;
  joinTokenSigningSecret: string;
  joinTokenTtlSeconds: number;
  sessionHeartbeatTtlSeconds: number;
  sessionCleanupIntervalSeconds: number;
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

  if (parsed.TELEMETRY_SINK_MODE === "required" && !parsed.TELEMETRY_SINK_URL) {
    throw new Error("TELEMETRY_SINK_URL is required when TELEMETRY_SINK_MODE is required");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    entraIssuer: parsed.ENTRA_ISSUER,
    entraAudience: parsed.ENTRA_AUDIENCE,
    entraJwksUrl: parsed.ENTRA_JWKS_URL,
    entraTokenVersion: parsed.ENTRA_TOKEN_VERSION,
    tenantMode: parsed.TENANT_MODE,
    ...(parsed.ENTRA_TENANT_ID ? { entraTenantId: parsed.ENTRA_TENANT_ID } : {}),
    allowedTenantIds: splitCsv(parsed.ALLOWED_TENANT_IDS),
    deniedTenantIds: splitCsv(parsed.DENIED_TENANT_IDS),
    allowedIssuers: splitCsv(parsed.ALLOWED_ISSUERS),
    telemetrySinkMode: parsed.TELEMETRY_SINK_MODE,
    ...(parsed.TELEMETRY_SINK_URL ? { telemetrySinkUrl: parsed.TELEMETRY_SINK_URL } : {}),
    ...(parsed.TELEMETRY_SINK_NAME ? { telemetrySinkName: parsed.TELEMETRY_SINK_NAME } : {}),
    joinTokenSigningSecret: parsed.JOIN_TOKEN_SIGNING_SECRET,
    joinTokenTtlSeconds: parsed.JOIN_TOKEN_TTL_SECONDS,
    sessionHeartbeatTtlSeconds: parsed.SESSION_HEARTBEAT_TTL_SECONDS,
    sessionCleanupIntervalSeconds: parsed.SESSION_CLEANUP_INTERVAL_SECONDS
  };
}