/* eslint-disable camelcase */

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable("session_checkpoints", {
    checkpoint_id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    player_identity: {
      type: "text",
      notNull: true
    },
    region_id: {
      type: "text",
      notNull: true
    },
    session_id: {
      type: "uuid",
      notNull: true,
      unique: true
    },
    room_id: {
      type: "text",
      notNull: true
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    },
    last_confirmed_version: {
      type: "bigint",
      notNull: true,
      default: 0
    },
    client_checksum: {
      type: "text"
    },
    server_checksum: {
      type: "text"
    },
    stale: {
      type: "boolean",
      notNull: true,
      default: false
    },
    stale_since_at: {
      type: "timestamptz"
    },
    grace_expires_at: {
      type: "timestamptz"
    },
    archived_at: {
      type: "timestamptz"
    }
  });

  pgm.addConstraint(
    "session_checkpoints",
    "session_checkpoints_unique_active_per_player_region",
    {
      unique: ["player_identity", "region_id"],
      where: "archived_at IS NULL"
    }
  );

  pgm.createIndex("session_checkpoints", ["player_identity", "region_id"], {
    name: "session_checkpoints_player_region_active_idx",
    where: "archived_at IS NULL"
  });

  pgm.createIndex("session_checkpoints", ["session_id"], {
    name: "session_checkpoints_session_idx"
  });

  pgm.createIndex("session_checkpoints", ["grace_expires_at"], {
    name: "session_checkpoints_grace_expires_idx",
    where: "stale = true AND archived_at IS NULL"
  });

  pgm.createIndex("session_checkpoints", ["archived_at"], {
    name: "session_checkpoints_archived_idx",
    where: "archived_at IS NOT NULL"
  });

  pgm.addColumn("tile_deltas", {
    ttl_expires_at: {
      type: "timestamptz",
      default: pgm.func("(now() + interval '24 hours')")
    }
  });

  pgm.createIndex("tile_deltas", ["ttl_expires_at"], {
    name: "tile_deltas_ttl_expires_idx"
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable("session_checkpoints");
  pgm.dropColumn("tile_deltas", "ttl_expires_at");
};
