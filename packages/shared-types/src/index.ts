export type TenantMode = "single" | "multi" | "both";

export interface PrincipalAuthorization {
  isOperator: boolean;
}

export type OperatorClaimSource = "roles" | "scopes" | "roles_with_scope_fallback";

export interface OperatorClaimContract {
  source: OperatorClaimSource;
  roleValues: readonly string[];
  scopeValues: readonly string[];
}

export const DEFAULT_OPERATOR_CLAIM_CONTRACT: OperatorClaimContract = {
  source: "roles_with_scope_fallback",
  roleValues: ["operator", "ops", "admin"],
  scopeValues: ["ops", "admin"]
};

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

export type TilePlaceCommandId = string;

export const TILE_PLACE_COMMAND_ID_MIN_LENGTH = 16;
export const TILE_PLACE_COMMAND_ID_MAX_LENGTH = 128;
export const TILE_PLACE_COMMAND_ID_PATTERN = "^[A-Za-z0-9_-]+$";

export interface TilePlaceCommand {
  commandId: TilePlaceCommandId;
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
}

/**
 * Discriminated union result for tile placement operations.
 *
 * **Error Handling Philosophy**:
 * Only includes domain-specific failure variants (occupied, throttled).
 * Unexpected errors (database failures, validation errors, etc.) are
 * handled at the route layer and returned as HTTP 500 errors, not
 * mapped to this union. This keeps the type contract focused on
 * recoverable domain failures that clients should handle differently.
 *
 * The route layer is responsible for catching and safely handling
 * any unmapped errors before they reach the client.
 *
 * **Serialization**:
 * createdAt is an ISO 8601 string (result of .toISOString()).
 */
export type TilePlaceResult =
  | {
      ok: true;
      tileId: number;
      createdAt: string;
    }
  | {
      ok: false;
      reason: "occupied";
      conflictCode: "placement_conflict_idempotent";
      commandId: TilePlaceCommandId;
      regionId: string;
      cell: {
        cellX: number;
        cellY: number;
      };
      winner: {
        ownerId: string;
        tileId: number;
        resolvedAt: string;
      };
    }
  | {
      ok: false;
      reason: "command_payload_mismatch";
      conflictCode: "placement_command_payload_mismatch";
      commandId: TilePlaceCommandId;
      regionId: string;
    }
  | {
      ok: false;
      reason: "throttled";
      retryAfterMs: number;
    };

export interface TileEditCommand {
  regionId: string;
  cellX: number;
  cellY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
}

/**
 * Discriminated union result for tile edit operations.
 *
 * **Error Handling Philosophy**:
 * Only includes domain-specific failure variants (forbidden_owner_mismatch, edit_window_expired).
 * Unexpected errors (database failures, serialization errors, etc.) are
 * handled at the route layer and returned as HTTP 500 errors, not
 * mapped to this union. This keeps the type contract focused on
 * recoverable domain failures that clients should handle differently.
 *
 * The route layer is responsible for catching and safely handling
 * any unmapped errors before they reach the client.
 *
 * **Serialization**:
 * editedAt is an ISO 8601 string (result of .toISOString()).
 */
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

export interface RegionDiffViewport {
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
}

export interface RegionDiffRequest {
  regionId: string;
  sinceVersion: number;
  viewport: RegionDiffViewport;
  maxTiles?: number;
}

export type RegionDiffOperation = "upsert" | "delete";

export interface RegionDiffLimits {
  maxViewportArea: number;
  maxTilesPerRequest: number;
  defaultMaxTiles: number;
}

export type RegionDiffDeleteSemantics = "explicit_delete_ops" | "upsert_only";

export interface RegionDiffPolicyMetadata {
  limits: RegionDiffLimits;
  deleteSemantics: RegionDiffDeleteSemantics;
  requiresRegionMembership: boolean;
}

export const DEFAULT_REGION_DIFF_POLICY: RegionDiffPolicyMetadata = {
  limits: {
    maxViewportArea: 10_000,
    maxTilesPerRequest: 1_000,
    defaultMaxTiles: 500
  },
  deleteSemantics: "upsert_only",
  requiresRegionMembership: true
};

export interface RegionDiffTileDelta {
  cellX: number;
  cellY: number;
  version: number;
  operation: RegionDiffOperation;
  offsetX: number | null;
  offsetY: number | null;
  shape: string | null;
  color: string | null;
  stylePayload: unknown | null;
  ownerId: string | null;
}

export interface RegionDiffResponse {
  ok: true;
  regionId: string;
  sinceVersion: number;
  currentVersion: number;
  nextSinceVersion: number;
  isEmpty: boolean;
  truncated: boolean;
  tiles: RegionDiffTileDelta[];
  metadata: {
    viewport: RegionDiffViewport;
    maxTiles: number;
    returnedTileCount: number;
    policy: RegionDiffPolicyMetadata;
  };
}

export { evaluateBondType } from "./bonding.js";
export type { BondEvaluationTile, BondType } from "./bonding.js";