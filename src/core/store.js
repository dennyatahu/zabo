// zapo-js store configuration: SQLite-backed persistent store via
// @zapo-js/store-sqlite, using the bun:sqlite driver (auto-detected under Bun).
// Declared plainly so each domain and cache is visible at a glance.
// Values match the previous effective configuration exactly.

import { createSqliteStore } from "@zapo-js/store-sqlite";
import { createStore } from "zapo-js";

import { PATHS } from "../config/paths.js";

// One minute in ms, used for cache TTLs.
const MINUTE = 60_000;

// Every domain is persisted to SQLite.
const DOMAINS = Object.freeze([
  "auth",
  "signal",
  "preKey",
  "session",
  "identity",
  "senderKey",
  "appState",
  "messages",
  "threads",
  "contacts",
  "privacyToken",
]);

// Build providers map: every domain -> sqlite.
const providers = Object.fromEntries(DOMAINS.map((domain) => [domain, "sqlite"]));

// Cache TTLs (minutes -> ms) for short-lived cache domains.
const cacheTtlMinutes = {
  retry: 1,
  groupMetadata: 5,
  chatMetadata: 30,
  deviceList: 5,
  messageSecret: 30,
};

const cacheTtlMs = Object.fromEntries(
  Object.entries(cacheTtlMinutes).map(
    ([name, minutes]) => [`${name}Ms`, minutes * MINUTE],
  ),
);

// Domains with an in-memory TTL cache layer and their limits.
const cachedDomains = {
  session: { ttlMinutes: 5, limit: 2_000 },
  identity: { ttlMinutes: 10, limit: 5_000 },
  senderKey: { ttlMinutes: 10, limit: 2_000 },
  privacyToken: { ttlMinutes: 30, limit: 5_000 },
};

const cacheLayer = {
  ...Object.fromEntries(
    Object.keys(cachedDomains).map((name) => [name, true]),
  ),
  ttlMs: Object.fromEntries(
    Object.entries(cachedDomains).map(
      ([{ 0: name }, { ttlMinutes }]) => [`${name}Ms`, ttlMinutes * MINUTE],
    ),
  ),
  limits: Object.fromEntries(
    Object.entries(cachedDomains).map(([name, { limit }]) => [name, limit]),
  ),
};

// SQLite store: bun:sqlite is selected automatically by driver 'auto' under Bun.
const sqlite = createSqliteStore({
  path: PATHS.session,
  driver: "auto",
  pragmas: {
    cache_size: -32000,
    mmap_size: 268_435_456,
    wal_autocheckpoint: 1000,
    temp_store: "MEMORY",
  },
  batchSizes: {
    deviceList: 900,
    signalPreKey: 900,
    signalHasSession: 300,
  },
  slowOperationThresholdMs: 150,
});

// Cache providers: short-lived domains also backed by sqlite (with TTL eviction).
const cacheProviders = Object.fromEntries(
  Object.keys(cacheTtlMinutes).map((name) => [name, "sqlite"]),
);

export const store = createStore({
  backends: { sqlite },
  providers,
  cacheProviders,
  cacheLayer,
  memory: { cacheTtlMs },
});
