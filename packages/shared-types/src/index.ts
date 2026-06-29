export type TenantMode = "single" | "multi" | "both";

export interface AuthenticatedPrincipal {
  subject: string;
  tenantScopedSubject: string;
  issuer: string;
  audience: string | string[];
  tenantId?: string;
  tokenVersion?: string;
  expiresAt: number;
}

export interface MatchTickSnapshot {
  tick: number;
  playerAHealth: number;
  playerBHealth: number;
}

export interface ReadinessReport {
  ok: boolean;
  checks: {
    database: "ok" | "error";
    config: "ok" | "error";
  };
}