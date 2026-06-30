/* eslint-disable camelcase */

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable("region_snapshots", {
    snapshot_id: {
      type: "text",
      primaryKey: true
    },
    region_id: {
      type: "text",
      notNull: true
    },
    created_by: {
      type: "text",
      notNull: true
    },
    tile_count: {
      type: "integer",
      notNull: true
    },
    expected_hash: {
      type: "text",
      notNull: true
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.createTable("region_snapshot_tiles", {
    snapshot_id: {
      type: "text",
      notNull: true,
      references: "region_snapshots(snapshot_id)",
      onDelete: "cascade"
    },
    region_id: {
      type: "text",
      notNull: true
    },
    cell_x: {
      type: "integer",
      notNull: true
    },
    cell_y: {
      type: "integer",
      notNull: true
    },
    offset_x: {
      type: "double precision",
      notNull: true
    },
    offset_y: {
      type: "double precision",
      notNull: true
    },
    shape: {
      type: "text",
      notNull: true
    },
    color: {
      type: "text",
      notNull: true
    },
    style_payload: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb")
    },
    owner_id: {
      type: "text",
      notNull: true
    }
  });

  pgm.addConstraint("region_snapshot_tiles", "region_snapshot_tiles_snapshot_coordinate_unique", {
    unique: ["snapshot_id", "cell_x", "cell_y"]
  });

  pgm.createIndex("region_snapshots", ["region_id", "created_at"], {
    name: "region_snapshots_region_created_at_idx"
  });

  pgm.createIndex("region_snapshot_tiles", ["snapshot_id"], {
    name: "region_snapshot_tiles_snapshot_id_idx"
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable("region_snapshot_tiles");
  pgm.dropTable("region_snapshots");
};
