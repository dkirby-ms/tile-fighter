import { Router } from "express";
import {
  TileEditCommand,
  TileEditResult,
  TilePlaceCommand,
  TilePlaceResult
} from "@game/shared-types";

const SELF_EDIT_WINDOW_MS = 10 * 60 * 1000;

type TilePrincipal = {
  tenantScopedSubject: string;
};

type PlaceTileInput = {
  regionId: string;
  cellX: number;
  cellY: number;
  offsetX: number;
  offsetY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
  ownerId: string;
};

type PlaceTileOutcome =
  | { ok: true; tileId: number; createdAt: Date }
  | { ok: false; reason: "occupied" };

type EditTileInput = {
  regionId: string;
  cellX: number;
  cellY: number;
  shape: string;
  color: string;
  stylePayload: unknown;
  ownerId: string;
  now: Date;
  selfEditWindowMs: number;
};

type EditTileOutcome =
  | { ok: true; tileId: number; editedAt: Date }
  | { ok: false; reason: "forbidden_owner_mismatch" | "edit_window_expired" };

export type TileRoutesDependencies = {
  placeTile: (input: PlaceTileInput) => Promise<PlaceTileOutcome>;
  editTile: (input: EditTileInput) => Promise<EditTileOutcome>;
};

function asPrincipal(value: unknown): TilePrincipal | null {
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

function isTilePlaceCommand(body: unknown): body is TilePlaceCommand {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const value = body as Record<string, unknown>;
  return (
    typeof value.regionId === "string" &&
    Number.isInteger(value.cellX) &&
    Number.isInteger(value.cellY) &&
    typeof value.offsetX === "number" &&
    typeof value.offsetY === "number" &&
    typeof value.shape === "string" &&
    typeof value.color === "string" &&
    "stylePayload" in value
  );
}

function isTileEditCommand(body: unknown): body is TileEditCommand {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const value = body as Record<string, unknown>;
  return (
    typeof value.regionId === "string" &&
    Number.isInteger(value.cellX) &&
    Number.isInteger(value.cellY) &&
    typeof value.shape === "string" &&
    typeof value.color === "string" &&
    "stylePayload" in value
  );
}

export function createTileRoutes(dependencies: TileRoutesDependencies): Router {
  const router = Router();

  router.post("/api/tiles/place", async (req, res) => {
    const principal = asPrincipal(res.locals.principal);
    if (!principal) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!isTilePlaceCommand(req.body)) {
      res.status(400).json({ error: "Invalid tile placement command" });
      return;
    }

    const result = await dependencies.placeTile({
      regionId: req.body.regionId,
      cellX: req.body.cellX,
      cellY: req.body.cellY,
      offsetX: req.body.offsetX,
      offsetY: req.body.offsetY,
      shape: req.body.shape,
      color: req.body.color,
      stylePayload: req.body.stylePayload,
      ownerId: principal.tenantScopedSubject
    });

    if (!result.ok) {
      const occupied: TilePlaceResult = {
        ok: false,
        reason: "occupied"
      };
      res.status(409).json(occupied);
      return;
    }

    const success: TilePlaceResult = {
      ok: true,
      tileId: result.tileId,
      createdAt: result.createdAt.toISOString()
    };
    res.status(201).json(success);
  });

  router.post("/api/tiles/edit", async (req, res) => {
    const principal = asPrincipal(res.locals.principal);
    if (!principal) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!isTileEditCommand(req.body)) {
      res.status(400).json({ error: "Invalid tile edit command" });
      return;
    }

    const result = await dependencies.editTile({
      regionId: req.body.regionId,
      cellX: req.body.cellX,
      cellY: req.body.cellY,
      shape: req.body.shape,
      color: req.body.color,
      stylePayload: req.body.stylePayload,
      ownerId: principal.tenantScopedSubject,
      now: new Date(),
      selfEditWindowMs: SELF_EDIT_WINDOW_MS
    });

    if (!result.ok) {
      const rejected: TileEditResult = {
        ok: false,
        reason: result.reason
      };
      const status = result.reason === "forbidden_owner_mismatch" ? 403 : 409;
      res.status(status).json(rejected);
      return;
    }

    const success: TileEditResult = {
      ok: true,
      tileId: result.tileId,
      editedAt: result.editedAt.toISOString()
    };
    res.status(200).json(success);
  });

  return router;
}