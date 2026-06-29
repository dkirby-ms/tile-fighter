import { describe, expect, it, vi } from "vitest";
import { Kysely } from "kysely";
import {
  RegionSnapshotHashMismatchError,
  RegionSnapshotNotFoundError,
  RegionSnapshotService
} from "../../src/domain/region-snapshot.service.js";
import { computeRegionHash } from "../../src/domain/region-hash.js";
import { ServerDatabase } from "../../src/persistence/db.js";

function buildTileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    region_id: "region-a",
    cell_x: 1,
    cell_y: 2,
    offset_x: 0,
    offset_y: 0,
    shape: "square",
    color: "blue",
    style_payload: { border: "thin", variant: 1 },
    owner_id: "owner-1",
    created_at: new Date("2026-06-29T12:00:00Z"),
    ...overrides
  };
}

describe("RegionSnapshotService", () => {
  it("creates snapshot with deterministic hash and emits snapshot_created telemetry", async () => {
    const tiles = [buildTileRow(), buildTileRow({ id: 2, cell_x: 2, owner_id: "owner-2" })];

    const db = {
      selectFrom: vi.fn(() => ({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValue(tiles)
                })
              })
            })
          })
        })
      }))
    } as unknown as Kysely<ServerDatabase>;

    const repository = {
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      getLatestSnapshotForRegion: vi.fn(),
      restoreRegionFromSnapshot: vi.fn()
    };

    const telemetrySink = {
      emitSnapshotCreated: vi.fn().mockResolvedValue(undefined),
      emitSnapshotRestoreStarted: vi.fn(),
      emitSnapshotRestoreCompleted: vi.fn()
    };

    const service = new RegionSnapshotService({
      db,
      repository: repository as never,
      telemetrySink: telemetrySink as never
    });

    const result = await service.createSnapshot({
      regionId: "region-a",
      actorId: "operator-1"
    });

    expect(result.snapshotId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(result.expectedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.tileCount).toBe(2);
    expect(repository.createSnapshot).toHaveBeenCalledWith(db, {
      snapshotId: result.snapshotId,
      regionId: "region-a",
      createdBy: "operator-1",
      expectedHash: result.expectedHash,
      tiles: [
        {
          regionId: "region-a",
          cellX: 1,
          cellY: 2,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "blue",
          stylePayload: { border: "thin", variant: 1 },
          ownerId: "owner-1"
        },
        {
          regionId: "region-a",
          cellX: 2,
          cellY: 2,
          offsetX: 0,
          offsetY: 0,
          shape: "square",
          color: "blue",
          stylePayload: { border: "thin", variant: 1 },
          ownerId: "owner-2"
        }
      ]
    });
    expect(telemetrySink.emitSnapshotCreated).toHaveBeenCalledWith(
      "region-a",
      result.snapshotId,
      2,
      result.expectedHash
    );
  });

  it("restores latest snapshot, verifies hash, and emits start/completion telemetry", async () => {
    const restoredTiles = [
      buildTileRow({
        id: 42,
        region_id: "region-r",
        cell_x: 5,
        cell_y: 8,
        shape: "triangle",
        color: "green",
        style_payload: { glow: true },
        owner_id: "owner-r"
      })
    ];

    const db = {} as Kysely<ServerDatabase>;

    const expectedHash = computeRegionHash([
      {
        regionId: "region-r",
        cellX: 5,
        cellY: 8,
        offsetX: 0,
        offsetY: 0,
        shape: "triangle",
        color: "green",
        stylePayload: { glow: true },
        ownerId: "owner-r"
      }
    ]);

    const repository = {
      createSnapshot: vi.fn(),
      getLatestSnapshotForRegion: vi.fn().mockResolvedValue({
        snapshot: {
          snapshot_id: "snap-r1",
          region_id: "region-r",
          created_by: "operator-1",
          tile_count: 1,
          expected_hash: expectedHash,
          created_at: new Date("2026-06-29T12:10:00Z")
        },
        tiles: []
      }),
      restoreRegionFromSnapshot: vi.fn().mockResolvedValue(restoredTiles)
    };

    const telemetrySink = {
      emitSnapshotCreated: vi.fn(),
      emitSnapshotRestoreStarted: vi.fn().mockResolvedValue(undefined),
      emitSnapshotRestoreCompleted: vi.fn().mockResolvedValue(undefined)
    };

    let nowMs = 1_700_000_000_000;
    const service = new RegionSnapshotService({
      db,
      repository: repository as never,
      telemetrySink: telemetrySink as never,
      now: () => {
        nowMs += 5;
        return nowMs;
      }
    });

    const result = await service.restoreLatest({
      regionId: "region-r",
      actorId: "operator-1"
    });

    expect(result).toEqual({
      snapshotId: "snap-r1",
      expectedHash,
      actualHash: expectedHash,
      restoredTileCount: 1
    });
    expect(telemetrySink.emitSnapshotRestoreStarted).toHaveBeenCalledWith(
      "region-r",
      "snap-r1",
      1,
      expectedHash
    );
    expect(telemetrySink.emitSnapshotRestoreCompleted).toHaveBeenCalledWith(
      "region-r",
      "snap-r1",
      1,
      expectedHash,
      expectedHash,
      5
    );
  });

  it("throws not found when no snapshot exists for region", async () => {
    const service = new RegionSnapshotService({
      db: {} as Kysely<ServerDatabase>,
      repository: {
        createSnapshot: vi.fn(),
        getLatestSnapshotForRegion: vi.fn().mockResolvedValue(null),
        restoreRegionFromSnapshot: vi.fn()
      } as never,
      telemetrySink: {
        emitSnapshotCreated: vi.fn(),
        emitSnapshotRestoreStarted: vi.fn(),
        emitSnapshotRestoreCompleted: vi.fn()
      } as never
    });

    await expect(
      service.restoreLatest({
        regionId: "region-missing",
        actorId: "operator-1"
      })
    ).rejects.toBeInstanceOf(RegionSnapshotNotFoundError);
  });

  it("throws hash mismatch when restored tiles do not match expected hash", async () => {
    const repository = {
      createSnapshot: vi.fn(),
      getLatestSnapshotForRegion: vi.fn().mockResolvedValue({
        snapshot: {
          snapshot_id: "snap-bad",
          region_id: "region-bad",
          created_by: "operator-1",
          tile_count: 1,
          expected_hash:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          created_at: new Date("2026-06-29T12:10:00Z")
        },
        tiles: []
      }),
      restoreRegionFromSnapshot: vi.fn().mockResolvedValue([
        buildTileRow({
          region_id: "region-bad",
          shape: "hex",
          color: "red"
        })
      ])
    };

    const telemetrySink = {
      emitSnapshotCreated: vi.fn(),
      emitSnapshotRestoreStarted: vi.fn().mockResolvedValue(undefined),
      emitSnapshotRestoreCompleted: vi.fn().mockResolvedValue(undefined)
    };

    const service = new RegionSnapshotService({
      db: {} as Kysely<ServerDatabase>,
      repository: repository as never,
      telemetrySink: telemetrySink as never,
      now: (() => {
        let now = 100;
        return () => {
          now += 7;
          return now;
        };
      })()
    });

    await expect(
      service.restoreLatest({
        regionId: "region-bad",
        actorId: "operator-1"
      })
    ).rejects.toBeInstanceOf(RegionSnapshotHashMismatchError);

    expect(telemetrySink.emitSnapshotRestoreCompleted).toHaveBeenCalledTimes(1);
    expect(telemetrySink.emitSnapshotRestoreCompleted.mock.calls[0]?.[4]).toMatch(/^[a-f0-9]{64}$/);
    expect(telemetrySink.emitSnapshotRestoreCompleted.mock.calls[0]?.[5]).toBe(7);
  });
});
