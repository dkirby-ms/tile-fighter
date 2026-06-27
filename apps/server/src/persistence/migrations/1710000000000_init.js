/* eslint-disable camelcase */

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable("match_events", {
    id: {
      type: "bigserial",
      primaryKey: true
    },
    room_id: {
      type: "text",
      notNull: true
    },
    tick: {
      type: "integer",
      notNull: true
    },
    payload: {
      type: "jsonb",
      notNull: true
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.createIndex("match_events", ["room_id", "tick"]);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable("match_events");
};