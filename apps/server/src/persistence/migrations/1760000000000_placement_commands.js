/* eslint-disable camelcase */

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable("placement_commands", {
    id: {
      type: "bigserial",
      primaryKey: true
    },
    region_id: {
      type: "text",
      notNull: true
    },
    actor_id: {
      type: "text",
      notNull: true
    },
    command_id: {
      type: "text",
      notNull: true
    },
    request_hash: {
      type: "text",
      notNull: true
    },
    outcome: {
      type: "text",
      notNull: true
    },
    response_snapshot: {
      type: "jsonb",
      notNull: true
    },
    winner_owner_id: {
      type: "text"
    },
    winner_tile_id: {
      type: "bigint"
    },
    winner_resolved_at: {
      type: "timestamptz"
    },
    expires_at: {
      type: "timestamptz",
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
    }
  });

  pgm.addConstraint("placement_commands", "placement_commands_region_actor_command_unique", {
    unique: ["region_id", "actor_id", "command_id"]
  });

  pgm.createIndex("placement_commands", ["region_id", "actor_id", "command_id"], {
    name: "placement_commands_lookup_idx"
  });

  pgm.createIndex("placement_commands", ["expires_at"], {
    name: "placement_commands_expires_idx"
  });

  pgm.createIndex("placement_commands", ["region_id", "expires_at"], {
    name: "placement_commands_region_expires_idx"
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable("placement_commands");
};
