import {
  DEFAULT_REGION_DIFF_POLICY,
  type RegionDiffViewport,
  type RegionDiffLimits
} from "@game/shared-types";
import { type CameraState } from "./camera-state.js";

export interface ViewportDerivationInput {
  camera: CameraState;
  viewWidthCells: number;
  viewHeightCells: number;
}

function toFiniteOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizePositiveCellDimension(value: number): number {
  return Math.max(1, Math.floor(toFiniteOrDefault(value, 1)));
}

function normalizeViewport(viewport: RegionDiffViewport): RegionDiffViewport {
  const minCellX = Math.floor(toFiniteOrDefault(viewport.minCellX, 0));
  const maxCellX = Math.floor(toFiniteOrDefault(viewport.maxCellX, minCellX));
  const minCellY = Math.floor(toFiniteOrDefault(viewport.minCellY, 0));
  const maxCellY = Math.floor(toFiniteOrDefault(viewport.maxCellY, minCellY));

  return {
    minCellX: Math.min(minCellX, maxCellX),
    maxCellX: Math.max(minCellX, maxCellX),
    minCellY: Math.min(minCellY, maxCellY),
    maxCellY: Math.max(minCellY, maxCellY)
  };
}

function viewportArea(viewport: RegionDiffViewport): number {
  return (viewport.maxCellX - viewport.minCellX + 1) * (viewport.maxCellY - viewport.minCellY + 1);
}

function clampViewportToArea(viewport: RegionDiffViewport, limits: RegionDiffLimits): RegionDiffViewport {
  const normalized = normalizeViewport(viewport);
  const maxViewportArea = Math.max(1, Math.floor(toFiniteOrDefault(limits.maxViewportArea, 1)));
  if (viewportArea(normalized) <= maxViewportArea) {
    return normalized;
  }

  const centerX = (normalized.minCellX + normalized.maxCellX) / 2;
  const centerY = (normalized.minCellY + normalized.maxCellY) / 2;
  const clampedWidth = Math.max(1, Math.floor(Math.sqrt(maxViewportArea)));
  const clampedHeight = Math.max(1, Math.floor(maxViewportArea / clampedWidth));
  const halfWidth = (clampedWidth - 1) / 2;
  const halfHeight = (clampedHeight - 1) / 2;

  return normalizeViewport({
    minCellX: Math.floor(centerX - halfWidth),
    maxCellX: Math.floor(centerX + halfWidth),
    minCellY: Math.floor(centerY - halfHeight),
    maxCellY: Math.floor(centerY + halfHeight)
  });
}

export function normalizeViewportToBounds(
  viewport: RegionDiffViewport,
  bounds: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number }
): RegionDiffViewport {
  const normalized = normalizeViewport(viewport);
  const minCellX = Math.floor(toFiniteOrDefault(bounds.minCellX, normalized.minCellX));
  const maxCellX = Math.floor(toFiniteOrDefault(bounds.maxCellX, normalized.maxCellX));
  const minCellY = Math.floor(toFiniteOrDefault(bounds.minCellY, normalized.minCellY));
  const maxCellY = Math.floor(toFiniteOrDefault(bounds.maxCellY, normalized.maxCellY));

  const normalizedBounds = {
    minCellX: Math.min(minCellX, maxCellX),
    maxCellX: Math.max(minCellX, maxCellX),
    minCellY: Math.min(minCellY, maxCellY),
    maxCellY: Math.max(minCellY, maxCellY)
  };

  const width = normalized.maxCellX - normalized.minCellX + 1;
  const height = normalized.maxCellY - normalized.minCellY + 1;
  const boundWidth = normalizedBounds.maxCellX - normalizedBounds.minCellX + 1;
  const boundHeight = normalizedBounds.maxCellY - normalizedBounds.minCellY + 1;
  const boundedWidth = Math.max(1, Math.min(width, boundWidth));
  const boundedHeight = Math.max(1, Math.min(height, boundHeight));

  let minX = normalized.minCellX;
  let minY = normalized.minCellY;

  if (minX < normalizedBounds.minCellX) {
    minX = normalizedBounds.minCellX;
  }
  if (minY < normalizedBounds.minCellY) {
    minY = normalizedBounds.minCellY;
  }

  let maxX = minX + boundedWidth - 1;
  let maxY = minY + boundedHeight - 1;

  if (maxX > normalizedBounds.maxCellX) {
    maxX = normalizedBounds.maxCellX;
    minX = maxX - boundedWidth + 1;
  }
  if (maxY > normalizedBounds.maxCellY) {
    maxY = normalizedBounds.maxCellY;
    minY = maxY - boundedHeight + 1;
  }

  return {
    minCellX: minX,
    maxCellX: maxX,
    minCellY: minY,
    maxCellY: maxY
  };
}

export function normalizeViewportToPolicy(
  viewport: RegionDiffViewport,
  bounds: { minCellX: number; maxCellX: number; minCellY: number; maxCellY: number },
  limits: RegionDiffLimits = DEFAULT_REGION_DIFF_POLICY.limits
): RegionDiffViewport {
  const bounded = normalizeViewportToBounds(viewport, bounds);
  return clampViewportToArea(bounded, limits);
}

export function deriveViewportFromCamera(
  input: ViewportDerivationInput,
  limits: RegionDiffLimits = DEFAULT_REGION_DIFF_POLICY.limits
): RegionDiffViewport {
  const viewWidthCells = normalizePositiveCellDimension(input.viewWidthCells);
  const viewHeightCells = normalizePositiveCellDimension(input.viewHeightCells);
  const zoom = Math.max(0.0001, toFiniteOrDefault(input.camera.zoom, 1));
  const scaledWidth = Math.max(1, Math.ceil(viewWidthCells / zoom));
  const scaledHeight = Math.max(1, Math.ceil(viewHeightCells / zoom));
  const halfWidth = (scaledWidth - 1) / 2;
  const halfHeight = (scaledHeight - 1) / 2;

  const rawViewport: RegionDiffViewport = {
    minCellX: Math.floor(input.camera.centerCellX - halfWidth),
    maxCellX: Math.floor(input.camera.centerCellX + halfWidth),
    minCellY: Math.floor(input.camera.centerCellY - halfHeight),
    maxCellY: Math.floor(input.camera.centerCellY + halfHeight)
  };

  return normalizeViewportToPolicy(rawViewport, input.camera.bounds, limits);
}

export function deriveViewportArea(viewport: RegionDiffViewport): number {
  return viewportArea(normalizeViewport(viewport));
}