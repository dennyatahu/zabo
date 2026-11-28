// Application settings get/set backed by the app_settings table.
// Only whitelisted columns may be set or read, preventing SQL injection
// through the column name (which is interpolated into the query).

import { getDatabase } from "./connection.js";

const SETTING_COLUMNS = Object.freeze([
  "self_mode",
  "prefix_mode",
  "selective_mode",
  "lock_mode",
]);

const isValidColumn = (column) => SETTING_COLUMNS.includes(column);

export const setSetting = (column, value) => {
  if (!isValidColumn(column)) {
    throw new Error(`Unknown setting: ${column}`);
  }

  const db = getDatabase();
  return db
    .prepare(
      `INSERT INTO app_settings (id, ${column}) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET ${column} = excluded.${column},
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .run(Number(value));
};

export const getSetting = (column) => {
  if (!isValidColumn(column)) {
    throw new Error(`Unknown setting: ${column}`);
  }

  const db = getDatabase();
  const row = db.prepare(`SELECT ${column} FROM app_settings WHERE id = 1`).get();
  return row ? row[column] === 1 : false;
};
