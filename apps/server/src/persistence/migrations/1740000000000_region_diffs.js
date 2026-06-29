/* eslint-disable camelcase */

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable("region_versions", {
    region_id: {
      type: "text",
      primaryKey: true
    },
    current_version: {
      type: "bigint",
      notNull: true,
      default: 0
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.createTable("tile_deltas", {
    id: {
      type: "bigserial",
      primaryKey: true
    },
    region_id: {
      type: "text",
      notNull: true
    },
    version: {
      type: "bigint",
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
    operation: {
      type: "text",
      notNull: true
    },
    offset_x: {
      type: "double precision"
    },
    offset_y: {
      type: "double precision"
    },
    shape: {
      type: "text"
    },
    color: {
      type: "text"
    },
    style_payload: {
      type: "jsonb"
    },
    owner_id: {
      type: "text"
    },
    changed_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.createIndex("tile_deltas", ["region_id", "version"], {
    name: "tile_deltas_region_version_idx"
  });

  pgm.createIndex("tile_deltas", ["region_id", "cell_x", "cell_y", "version"], {
    name: "tile_deltas_region_coordinate_version_idx"
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable("tile_deltas");
  pgm.dropTable("region_versions");
};
