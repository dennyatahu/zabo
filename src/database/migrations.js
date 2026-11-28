// Versioned database migrations driven by PRAGMA user_version.
// Each migration is idempotent: it checks whether its change already exists
// before applying, so running it on an already-migrated database is a no-op.
// Data already in the database is never deleted.

import { SCHEMA } from "./schema.js";
import { DB_USER_VERSION } from "../config/constants.js";

// Migration entries: [version, description, sql function]
// Versions are applied in ascending order starting from the current user_version.
const MIGRATIONS = [
  {
    version: 1,
    description: "Add message_id column to restart_request table",
    run: (db) => {
      const hasColumn = db
        .prepare("PRAGMA table_info(restart_request)")
        .all()
        .some(({ name }) => name === "message_id");
      if (!hasColumn) {
        db.exec("ALTER TABLE restart_request ADD COLUMN message_id TEXT");
      }
    },
  },
  {
    version: 2,
    description: "Add lock_mode column to app_settings table",
    run: (db) => {
      const hasColumn = db
        .prepare("PRAGMA table_info(app_settings)")
        .all()
        .some(({ name }) => name === "lock_mode");
      if (!hasColumn) {
        db.exec(
          "ALTER TABLE app_settings ADD COLUMN lock_mode INTEGER NOT NULL DEFAULT 0",
        );
      }
    },
  },
];

export const runMigrations = (db) => {
  // Create all tables first (idempotent).
  db.exec(SCHEMA);

  // Read current schema version.
  const row = db.prepare("PRAGMA user_version").get();
  const currentVersion = row ? Number(row.user_version) : 0;

  // Apply pending migrations in order.
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      migration.run(db);
      // PRAGMA does not support parameter binding; version comes from our own
      // hardcoded migration list, so interpolation is safe.
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }
  }

  // Ensure the version is at least the target (catches up databases that were
  // manually migrated by older ad-hoc code but still report user_version 0).
  if (currentVersion < DB_USER_VERSION) {
    db.exec(`PRAGMA user_version = ${DB_USER_VERSION}`);
  }

  return DB_USER_VERSION;
};
