// Opens and closes the application SQLite database (data/database.sqlite).
// Uses bun:sqlite. No side effects on import: call openDatabase() explicitly
// from src/main.js during bootstrap, and closeDatabase() during shutdown.

import { Database } from "bun:sqlite";

import { PATHS } from "../config/paths.js";
import { DB_USER_VERSION } from "../config/constants.js";

// Single application-wide database connection.
let database = null;

export const openDatabase = () => {
  if (database) return database;

  database = new Database(PATHS.database);

  // Safety and performance pragmas for the application database.
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");

  return database;
};

export const getDatabase = () => {
  if (!database) throw new Error("Database not opened. Call openDatabase() first.");
  return database;
};

// Stable `db` binding: forwards to the opened database at runtime.
// Modules import { db } and call db.prepare(...) after bootstrap.
export const db = new Proxy({}, {
  get(_target, prop) {
    const instance = getDatabase();
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// Wrap a task in a deferred SQLite transaction (BEGIN IMMEDIATE / COMMIT).
export const transaction = (task) => getDatabase().transaction(task).immediate();

export const closeDatabase = () => {
  if (!database) return;

  try {
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    // Checkpoint failure is non-fatal; proceed to close.
  }

  try {
    database.close();
  } catch {
    // Close failure is non-fatal at shutdown.
  }

  database = null;
};

export { DB_USER_VERSION };
