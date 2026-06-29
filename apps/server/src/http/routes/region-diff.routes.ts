import { Router } from "express";
import {
  DEFAULT_REGION_DIFF_POLICY,
  RegionDiffOperation,
  RegionDiffRequest,
  RegionDiffResponse
} from "@game/shared-types";
import { RegionDiffService } from "../../domain/region-diff.service.js";

type RegionDiffPrincipal = {
  tenantScopedSubject: string;
};

export type RegionDiffRoutesDependencies = {
  regionDiffService: RegionDiffService;
  isRegionMember: (input: { tenantScopedSubject: string; regionId: string }) => boolean;
  limits: {
    defaultMaxTiles: number;
    maxTilesPerRequest: number;
    maxViewportArea: number;
  };
};

type ValidRegionDiffPayload = {
  regionId: string;
  sinceVersion: number;
  viewport: {
    minCellX: number;
    maxCellX: number;
    minCellY: number;
    maxCellY: number;
  };
  maxTiles: number;
};

function asPrincipal(value: unknown): RegionDiffPrincipal | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { tenantScopedSubject?: unknown }).tenantScopedSubject === "string"
  ) {
    return {
      tenantScopedSubject: (value as { tenantScopedSubject: string }).tenantScopedSubject
    };
  }

  return null;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isRegionDiffOperation(value: string): value is RegionDiffOperation {
  return value === "upsert" || value === "delete";
}

function parseRegionDiffRequest(
  body: unknown,
  limits: RegionDiffRoutesDependencies["limits"]
): ValidRegionDiffPayload | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const value = body as RegionDiffRequest;
  if (typeof value.regionId !== "string" || value.regionId.trim().length === 0) {
    return null;
  }

  if (!isInteger(value.sinceVersion) || value.sinceVersion < 0) {
    return null;
  }

  if (typeof value.viewport !== "object" || value.viewport === null) {
    return null;
  }

  const viewport = value.viewport;
  if (
    !isInteger(viewport.minCellX) ||
    !isInteger(viewport.maxCellX) ||
    !isInteger(viewport.minCellY) ||
    !isInteger(viewport.maxCellY)
  ) {
    return null;
  }

  if (viewport.minCellX > viewport.maxCellX || viewport.minCellY > viewport.maxCellY) {
    return null;
  }

  const viewportArea = (viewport.maxCellX - viewport.minCellX + 1) * (viewport.maxCellY - viewport.minCellY + 1);
  if (viewportArea <= 0 || viewportArea > limits.maxViewportArea) {
    return null;
  }

  const maxTilesCandidate = value.maxTiles ?? limits.defaultMaxTiles;
  if (!isInteger(maxTilesCandidate) || maxTilesCandidate <= 0 || maxTilesCandidate > limits.maxTilesPerRequest) {
    return null;
  }

  return {
    regionId: value.regionId,
    sinceVersion: value.sinceVersion,
    viewport: {
      minCellX: viewport.minCellX,
      maxCellX: viewport.maxCellX,
      minCellY: viewport.minCellY,
      maxCellY: viewport.maxCellY
    },
    maxTiles: maxTilesCandidate
  };
}

export function createRegionDiffRoutes(dependencies: RegionDiffRoutesDependencies): Router {
  const router = Router();

  router.post("/api/regions/diff", async (req, res) => {
    const principal = asPrincipal(res.locals.principal);
    if (!principal) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = parseRegionDiffRequest(req.body, dependencies.limits);
    if (!payload) {
      res.status(400).json({ error: "Invalid region diff request" });
      return;
    }

    const isRegionMember = dependencies.isRegionMember({
      tenantScopedSubject: principal.tenantScopedSubject,
      regionId: payload.regionId
    });
    if (!isRegionMember) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const result = await dependencies.regionDiffService.getRegionDiff({
      regionId: payload.regionId,
      sinceVersion: payload.sinceVersion,
      viewport: payload.viewport,
      maxTiles: payload.maxTiles
    });

    const response: RegionDiffResponse = {
      ok: true,
      regionId: result.regionId,
      sinceVersion: result.sinceVersion,
      currentVersion: result.currentVersion,
      nextSinceVersion: result.nextSinceVersion,
      isEmpty: result.isEmpty,
      truncated: result.truncated,
      tiles: result.tiles.map((tile) => ({
        cellX: tile.cellX,
        cellY: tile.cellY,
        version: tile.version,
        operation: isRegionDiffOperation(tile.operation) ? tile.operation : "upsert",
        offsetX: tile.offsetX,
        offsetY: tile.offsetY,
        shape: tile.shape,
        color: tile.color,
        stylePayload: tile.stylePayload,
        ownerId: tile.ownerId
      })),
      metadata: {
        viewport: payload.viewport,
        maxTiles: payload.maxTiles,
        returnedTileCount: result.tiles.length,
        policy: {
          ...DEFAULT_REGION_DIFF_POLICY,
          limits: {
            defaultMaxTiles: dependencies.limits.defaultMaxTiles,
            maxTilesPerRequest: dependencies.limits.maxTilesPerRequest,
            maxViewportArea: dependencies.limits.maxViewportArea
          }
        }
      }
    };

    res.status(200).json(response);
  });

  return router;
}
