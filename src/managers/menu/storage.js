// Database storage for menu data: profile (url/title/description), active
// media (thumbnail/favicon image+message), default media, and saved media.
// Reads/writes BLOBs in the menu_* tables. All SQL uses parameterized queries.

import { db, transaction } from "../../database/connection.js";
import { proto } from "zapo-js";

// Read a single row as a plain object, or undefined when absent.
const getRow = (sql, params = []) => {
  const row = db.prepare(sql).get(...params);
  return row ?? undefined;
};

// Read all rows for a query.
const getAll = (sql, params = []) => db.prepare(sql).all(...params);

// --- Profile (url, title, description) ---

export const readProfile = () =>
  getRow("SELECT url, title, description FROM menu_profile WHERE id = 1");

export const saveProfile = ({ url, title, description }) => {
  db.prepare(
    `INSERT INTO menu_profile (id, url, title, description) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET url = excluded.url, title = excluded.title,
     description = excluded.description,
     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run(url, title, description);
};

// --- Active / default media (kind -> { image, message }) ---

export const readActiveMedia = () => {
  const rows = getAll("SELECT kind, image, message FROM menu_active_media");
  return Object.fromEntries(
    rows.map(({ kind, image, message }) => [kind, { image, message }]),
  );
};

export const readDefaultMedia = () => {
  const rows = getAll("SELECT kind, image, message FROM menu_default_media");
  return Object.fromEntries(
    rows.map(({ kind, image, message }) => [kind, { image, message }]),
  );
};

// Save active media entry for a kind. When entry is null, delete the row.
export const saveActiveMedia = (kind, entry) => {
  writeMedia("menu_active_media", kind, entry);
};

// Save default media entry for a kind.
export const saveDefaultMedia = (kind, entry) => {
  writeMedia("menu_default_media", kind, entry);
};

const writeMedia = (table, kind, entry) => {
  if (!entry) {
    db.prepare(`DELETE FROM ${table} WHERE kind = ?`).run(kind);
    return;
  }

  db.prepare(
    `INSERT INTO ${table} (kind, image, message) VALUES (?, ?, ?)
     ON CONFLICT(kind) DO UPDATE SET image = excluded.image, message = excluded.message,
     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run(kind, entry.image, encodeMessage(entry.message));
};

// --- Saved media (library of named images) ---

export const readSavedMedia = (kind) =>
  getAll(
    "SELECT kind, name, image FROM menu_saved_media WHERE kind = ? ORDER BY id",
    [kind],
  ).map(({ name, image }) => ({ name, image }));

export const saveSavedMedia = (kind, list) => {
  transaction(() => {
    db.prepare("DELETE FROM menu_saved_media WHERE kind = ?").run(kind);

    const insert = db.prepare(
      "INSERT INTO menu_saved_media (kind, name, image) VALUES (?, ?, ?)",
    );
    for (const { name, image } of list) insert.run(kind, name, image);
  });
};

// --- Proto message encode/decode for stored message blobs ---

export const encodeMessage = (message) =>
  new Uint8Array(proto.Message.encode(message).finish());

export const decodeMessage = (value) => proto.Message.decode(value);
