import { Router } from "express";
import {
  RegionSnapshotHashMismatchError,
  RegionSnapshotNotFoundError,
  RegionSnapshotService
} from "../../domain/region-snapshot.service.js";
import { AuthenticatedPrincipal } from "@game/shared-types";

type SnapshotPrincipal = Pick<AuthenticatedPrincipal, "tenantScopedSubject" | "authorization">;

export type SnapshotRoutesDependencies = {
  snapshotService: RegionSnapshotService;
};

type SnapshotCommandBody = {
  regionId?: unknown;
};

function asPrincipal(value: unknown): SnapshotPrincipal | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { tenantScopedSubject?: unknown }).tenantScopedSubject === "string"
  ) {
    const principal = value as {
      tenantScopedSubject: string;
      authorization?: { isOperator?: unknown };
    };

    return {
      tenantScopedSubject: principal.tenantScopedSubject,
      authorization: {
        isOperator: principal.authorization?.isOperator === true
      }
    };
  }

  return null;
}

function parseRegionId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const candidate = (body as SnapshotCommandBody).regionId;
  if (typeof candidate !== "string") {
    return null;
  }

  const regionId = candidate.trim();
  return regionId.length > 0 ? regionId : null;
}

export function createSnapshotRoutes(dependencies: SnapshotRoutesDependencies): Router {
  const router = Router();

  router.post("/api/admin/snapshots/create", async (req, res) => {
    const principal = asPrincipal(res.locals.principal);
    if (!principal) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const regionId = parseRegionId(req.body);
    if (!regionId) {
      res.status(400).json({ error: "regionId is required" });
      return;
    }

    const result = await dependencies.snapshotService.createSnapshot({
      regionId,
      actorId: principal.tenantScopedSubject
    });

    res.status(201).json(result);
  });

  router.post("/api/admin/snapshots/restore-latest", async (req, res) => {
    const principal = asPrincipal(res.locals.principal);
    if (!principal) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (principal.authorization?.isOperator !== true) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const regionId = parseRegionId(req.body);
    if (!regionId) {
      res.status(400).json({ error: "regionId is required" });
      return;
    }

    try {
      const result = await dependencies.snapshotService.restoreLatest({
        regionId,
        actorId: principal.tenantScopedSubject
      });

      res.status(200).json(result);
      return;
    } catch (error) {
      if (error instanceof RegionSnapshotNotFoundError) {
        res.status(404).json({ error: "Snapshot not found" });
        return;
      }

      if (error instanceof RegionSnapshotHashMismatchError) {
        res.status(409).json({ error: "Snapshot hash mismatch" });
        return;
      }

      throw error;
    }
  });

  return router;
}
