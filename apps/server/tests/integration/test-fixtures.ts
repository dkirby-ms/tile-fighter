import { RegionDiffRequest } from "@game/shared-types";

export const REGION_DIFF_TEST_LIMITS = {
  defaultMaxTiles: 2,
  maxTilesPerRequest: 3,
  maxViewportArea: 25
} as const;

function sanitizeCommandSeed(seed: string): string {
  return seed.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function buildValidCommandId(seed: string): string {
  const base = `cmd_${sanitizeCommandSeed(seed)}`;

  if (base.length >= 16) {
    return base.slice(0, 128);
  }

  return base.padEnd(16, "x");
}

export function makeRegionDiffRequest(
  overrides: Partial<RegionDiffRequest> = {}
): RegionDiffRequest {
  const viewport = {
    minCellX: 0,
    maxCellX: 4,
    minCellY: 0,
    maxCellY: 4,
    ...(overrides.viewport ?? {})
  };

  return {
    regionId: overrides.regionId ?? "region-diff-a",
    sinceVersion: overrides.sinceVersion ?? 0,
    viewport,
    maxTiles: overrides.maxTiles
  };
}
