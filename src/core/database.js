import { Database } from "bun:sqlite";

import { config } from "../config.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  self_mode INTEGER NOT NULL DEFAULT 0 CHECK (self_mode IN (0, 1)),
  prefix_mode INTEGER NOT NULL DEFAULT 0 CHECK (prefix_mode IN (0, 1)),
  selective_mode INTEGER NOT NULL DEFAULT 0 CHECK (selective_mode IN (0, 1)),
  lock_mode INTEGER NOT NULL DEFAULT 0 CHECK (lock_mode IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS prefixes (
  position INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS selective_groups (
  jid TEXT PRIMARY KEY,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS selective_commands (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS selective_targets (
  command TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (command, user_id)
);

CREATE INDEX IF NOT EXISTS idx_selective_targets_command ON selective_targets (command);

CREATE TABLE IF NOT EXISTS menu_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS menu_active_media (
  kind TEXT PRIMARY KEY CHECK (kind IN ('thumbnail', 'favicon')),
  image BLOB NOT NULL,
  message BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS menu_default_media (
  kind TEXT PRIMARY KEY CHECK (kind IN ('thumbnail', 'favicon')),
  image BLOB NOT NULL,
  message BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS menu_saved_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('thumbnail', 'favicon')),
  name TEXT NOT NULL,
  image BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kind, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_saved_media_kind ON menu_saved_media (kind, id);

CREATE TABLE IF NOT EXISTS restart_request (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  jid TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  message_id TEXT
);
`;

export const db = new Database(config.paths.database);

db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec(SCHEMA);

const restartColumns = db.prepare("PRAGMA table_info(restart_request)").all();

if (!restartColumns.some(({ name }) => name === "message_id")) {
  db.exec("ALTER TABLE restart_request ADD COLUMN message_id TEXT");
}

const settingColumns = db.prepare("PRAGMA table_info(app_settings)").all();

if (!settingColumns.some(({ name }) => name === "lock_mode")) {
  db.exec("ALTER TABLE app_settings ADD COLUMN lock_mode INTEGER NOT NULL DEFAULT 0");
}

export const closeDatabase = () => {
  try {
    db.close();
  } catch {
  }
};

export const transaction = (task) => {
  db.exec("BEGIN IMMEDIATE");

  try {
    const result = task();
    db.exec("COMMIT");

    return result;
  } catch (err) {
    db.exec("ROLLBACK");

    throw err;
  }
};

const SETTING_COLUMNS = new Set(["self_mode", "prefix_mode", "selective_mode", "lock_mode"]);

export const setSetting = (column, value) => {
  if (!SETTING_COLUMNS.has(column)) throw new Error(`Unknown setting: ${column}`);

  return db
    .prepare(
      `INSERT INTO app_settings (id, ${column}) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET ${column} = excluded.${column},
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .run(Number(value));
};

export const getSetting = (column) => {
  if (!SETTING_COLUMNS.has(column)) throw new Error(`Unknown setting: ${column}`);

  return db.prepare(`SELECT ${column} FROM app_settings WHERE id = 1`).get()?.[column] === 1;
};
