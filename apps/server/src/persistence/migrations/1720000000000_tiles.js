/* eslint-disable camelcase */

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable("tiles", {
    id: {
      type: "bigserial",
      primaryKey: true
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
      notNull: true,
      default: 0
    },
    offset_y: {
      type: "double precision",
      notNull: true,
      default: 0
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
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  // Unique constraint on region coordinate
  pgm.addConstraint("tiles", "tiles_region_coordinate_unique", {
    unique: ["region_id", "cell_x", "cell_y"]
  });

  // Check constraints for offset ranges
  pgm.addConstraint("tiles", "tiles_offset_x_range", {
    check: "offset_x >= -0.49 AND offset_x <= 0.49"
  });

  pgm.addConstraint("tiles", "tiles_offset_y_range", {
    check: "offset_y >= -0.49 AND offset_y <= 0.49"
  });

  // Indexes for lookups
  pgm.createIndex("tiles", ["region_id"], { name: "tiles_region_lookup_idx" });
  pgm.createIndex("tiles", ["region_id", "cell_x", "cell_y"], { name: "tiles_coordinate_lookup_idx" });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable("tiles");
};
