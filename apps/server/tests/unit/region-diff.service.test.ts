import { describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import { RegionDiffService } from "../../src/domain/region-diff.service.js";
import { IRegionDiffRepository } from "../../src/persistence/region-diff.repository.js";
import { ServerDatabase, TileDeltasSelect } from "../../src/persistence/db.js";
import { TelemetrySink } from "../../src/telemetry/telemetry-sink.js";

function createDelta(input: {
  id: string;
  version: string;
  cellX: number;
  cellY: number;
  operation?: string;
  shape?: string | null;
  color?: string | null;
}): TileDeltasSelect {
  return {
    id: input.id,
    region_id: "arena-main",
    version: input.version,
    cell_x: input.cellX,
    cell_y: input.cellY,
    operation: input.operation ?? "upsert",
    offset_x: 0,
    offset_y: 0,
    shape: input.shape ?? "square",
    color: input.color ?? "blue",
    style_payload: { marker: input.id },
    owner_id: "tenant-a|player-1",
    changed_at: new Date("2026-06-29T12:00:00.000Z")
  };
}

describe("RegionDiffService", () => {
  function createService(options: {
    currentVersion: number;
    deltas: TileDeltasSelect[];
  }) {
    const repository: IRegionDiffRepository = {
      getCurrentRegionVersion: vi.fn(async () => options.currentVersion),
      getTileDeltasSince: vi.fn(async () => options.deltas)
    };

    const telemetrySink = {
      emitTileDiffRequested: vi.fn(async () => undefined),
      emitTileDiffReturned: vi.fn(async () => undefined)
    } as unknown as TelemetrySink;

    const service = new RegionDiffService({
      db: {} as Kysely<ServerDatabase>,
      repository,
      telemetrySink,
      now: (() => {
        let now = 100;
        return () => {
          now += 7;
          return now;
        };
      })()
    });

    return {
      service,
      repository,
      telemetrySink: telemetrySink as {
        emitTileDiffRequested: ReturnType<typeof vi.fn>;
        emitTileDiffReturned: ReturnType<typeof vi.fn>;
      }
    };
  }

  it("returns empty payload when sinceVersion is current", async () => {
    const { service, repository } = createService({
      currentVersion: 5,
      deltas: [createDelta({ id: "1", version: "6", cellX: 1, cellY: 1 })]
    });

    const result = await service.getRegionDiff({
      regionId: "arena-main",
      sinceVersion: 5,
      viewport: {
        minCellX: 0,
        maxCellX: 10,
        minCellY: 0,
        maxCellY: 10
      },
      maxTiles: 100
    });

    expect(result).toEqual({
      ok: true,
      regionId: "arena-main",
      sinceVersion: 5,
      currentVersion: 5,
      nextSinceVersion: 5,
      isEmpty: true,
      tiles: [],
      truncated: false
    });
    expect(repository.getTileDeltasSince).not.toHaveBeenCalled();
  });

  it("returns stale incremental updates when client version is behind", async () => {
    const { service } = createService({
      currentVersion: 4,
      deltas: [
        createDelta({ id: "1", version: "2", cellX: 1, cellY: 1, color: "red" }),
        createDelta({ id: "2", version: "3", cellX: 2, cellY: 2, color: "green" }),
        createDelta({ id: "3", version: "4", cellX: 3, cellY: 2, color: "orange" })
      ]
    });

    const result = await service.getRegionDiff({
      regionId: "arena-main",
      sinceVersion: 1,
      viewport: {
        minCellX: 0,
        maxCellX: 20,
        minCellY: 0,
        maxCellY: 20
      },
      maxTiles: 100
    });

    expect(result.ok).toBe(true);
    expect(result.currentVersion).toBe(4);
    expect(result.nextSinceVersion).toBe(4);
    expect(result.isEmpty).toBe(false);
    expect(result.truncated).toBe(false);
    expect(result.tiles).toHaveLength(3);
    expect(result.tiles.map((tile) => tile.version)).toEqual([2, 3, 4]);
  });

  it("applies latest-wins compaction for repeated coordinate updates", async () => {
    const { service } = createService({
      currentVersion: 5,
      deltas: [
        createDelta({ id: "1", version: "2", cellX: 4, cellY: 4, color: "red" }),
        createDelta({ id: "2", version: "3", cellX: 2, cellY: 1, color: "green" }),
        createDelta({ id: "3", version: "4", cellX: 4, cellY: 4, color: "blue" }),
        createDelta({ id: "4", version: "5", cellX: 2, cellY: 1, color: "yellow" })
      ]
    });

    const result = await service.getRegionDiff({
      regionId: "arena-main",
      sinceVersion: 1,
      viewport: {
        minCellX: 0,
        maxCellX: 20,
        minCellY: 0,
        maxCellY: 20
      },
      maxTiles: 100
    });

    expect(result.tiles).toHaveLength(2);
    expect(result.tiles).toEqual([
      expect.objectContaining({ cellX: 4, cellY: 4, version: 4, color: "blue" }),
      expect.objectContaining({ cellX: 2, cellY: 1, version: 5, color: "yellow" })
    ]);
    expect(result.nextSinceVersion).toBe(5);
  });

  it("truncates to maxTiles and advances nextSinceVersion to the last returned tile", async () => {
    const { service, telemetrySink } = createService({
      currentVersion: 8,
      deltas: [
        createDelta({ id: "1", version: "3", cellX: 1, cellY: 1 }),
        createDelta({ id: "2", version: "4", cellX: 2, cellY: 2 }),
        createDelta({ id: "3", version: "5", cellX: 3, cellY: 3 })
      ]
    });

    const result = await service.getRegionDiff({
      regionId: "arena-main",
      sinceVersion: 2,
      viewport: {
        minCellX: 0,
        maxCellX: 20,
        minCellY: 0,
        maxCellY: 20
      },
      maxTiles: 2
    });

    expect(result.truncated).toBe(true);
    expect(result.tiles).toHaveLength(2);
    expect(result.tiles.map((tile) => tile.version)).toEqual([3, 4]);
    expect(result.nextSinceVersion).toBe(4);
    expect(telemetrySink.emitTileDiffReturned).toHaveBeenCalledWith(
      "arena-main",
      2,
      8,
      441,
      2,
      true,
      7
    );
  });
});