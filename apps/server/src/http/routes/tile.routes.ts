import { Router } from "express";
import {
  TILE_PLACE_COMMAND_ID_MAX_LENGTH,
  TILE_PLACE_COMMAND_ID_MIN_LENGTH,
  TILE_PLACE_COMMAND_ID_PATTERN,
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
  commandId: string;
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
  | { ok: true; tileId: number; createdAt: Date; replayed?: boolean }
  | {
      ok: false;
      reason: "occupied";
      commandId: string;
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
      replayed?: boolean;
    }
  | { ok: false; reason: "command_payload_mismatch"; commandId: string; regionId: string }
  | { ok: false; reason: "throttled"; retryAfterMs: number };

const tilePlaceCommandIdRegex = new RegExp(TILE_PLACE_COMMAND_ID_PATTERN);

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
  shouldThrottleTilePlace: (input: {
    key: string;
    nowMs: number;
    regionId: string;
    cellX: number;
    cellY: number;
    ownerId: string;
  }) => Promise<{ throttled: boolean; retryAfterMs: number }>;
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
    typeof value.commandId === "string" &&
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

function isValidTilePlaceCommandId(commandId: string): boolean {
  return (
    commandId.length >= TILE_PLACE_COMMAND_ID_MIN_LENGTH &&
    commandId.length <= TILE_PLACE_COMMAND_ID_MAX_LENGTH &&
    tilePlaceCommandIdRegex.test(commandId)
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

    if (!isValidTilePlaceCommandId(req.body.commandId)) {
      res.status(400).json({
        error: "Invalid tile placement command",
        conflictCode: "malformed_command_identity"
      });
      return;
    }

    const throttle = await dependencies.shouldThrottleTilePlace({
      key: `${principal.tenantScopedSubject}:${req.body.regionId}`,
      nowMs: Date.now(),
      regionId: req.body.regionId,
      cellX: req.body.cellX,
      cellY: req.body.cellY,
      ownerId: principal.tenantScopedSubject
    });

    if (throttle.throttled) {
      const rejected: TilePlaceResult = {
        ok: false,
        reason: "throttled",
        retryAfterMs: throttle.retryAfterMs
      };
      res.status(429).json(rejected);
      return;
    }

    const result = await dependencies.placeTile({
      commandId: req.body.commandId,
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

    // All domain-specific failures (occupied, throttled) are mapped below.
    // Unexpected errors (db, validation) are not caught here and will become 500s,
    // per TilePlaceResult error handling philosophy: route layer owns unmapped errors.
    if (!result.ok) {
      if (result.reason === "throttled") {
        const rejected: TilePlaceResult = {
          ok: false,
          reason: "throttled",
          retryAfterMs: result.retryAfterMs
        };
        res.status(429).json(rejected);
        return;
      }

      if (result.reason === "command_payload_mismatch") {
        const rejected: TilePlaceResult = {
          ok: false,
          reason: "command_payload_mismatch",
          conflictCode: "placement_command_payload_mismatch",
          commandId: result.commandId,
          regionId: result.regionId
        };
        res.status(409).json(rejected);
        return;
      }

      const rejected: TilePlaceResult = {
        ok: false,
        reason: "occupied",
        conflictCode: "placement_conflict_idempotent",
        commandId: result.commandId,
        regionId: result.regionId,
        cell: result.cell,
        winner: result.winner
      };
      res.status(409).json(rejected);
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

    // All domain-specific failures (owner/window) are mapped below.
    // Unexpected errors (db, serialization) are not caught here and will become 500s,
    // per TileEditResult error handling philosophy: route layer owns unmapped errors.
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