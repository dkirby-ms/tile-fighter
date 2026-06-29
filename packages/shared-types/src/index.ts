export type TenantMode = "single" | "multi" | "both";

export interface PrincipalAuthorization {
  isOperator: boolean;
}

export interface AuthenticatedPrincipal {
  subject: string;
  tenantScopedSubject: string;
  issuer: string;
  audience: string | string[];
  tenantId?: string;
  tokenVersion?: string;
  expiresAt: number;
  roles?: readonly string[];
  groups?: readonly string[];
  wids?: readonly string[];
  scp?: string;
  authorization?: PrincipalAuthorization;
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

export interface TilePlaceCommand {
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
}

export type TilePlaceResult =
  | {
      ok: true;
      tileId: number;
      createdAt: string;
    }
  | {
      ok: false;
      reason: "occupied";
    };

export interface TileEditCommand {
  regionId: string;
  cellX: number;
  cellY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
}

export type TileEditResult =
  | {
      ok: true;
      tileId: number;
      editedAt: string;
    }
  | {
      ok: false;
      reason: "forbidden_owner_mismatch" | "edit_window_expired";
    };