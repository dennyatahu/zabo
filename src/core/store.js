import { createSqliteStore } from "@zapo-js/store-sqlite";
import { createStore } from "zapo-js";

import { config } from "../config.js";

const BACKEND = "sqlite";

const MINUTE = 60_000;

const sqlite = createSqliteStore({
  path: config.paths.session,
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

const domains = [
  "auth",
  "signal",
  "preKey",
  "session",
  "identity",
  "senderKey",
  "appState",
  "privacyToken",
  "messages",
  "threads",
  "contacts",
];

const cacheTtlMinutes = {
  retry: 1,
  groupMetadata: 5,
  chatMetadata: 30,
  deviceList: 5,
  messageSecret: 30,
};

const cachedDomains = {
  session: { ttlMinutes: 5, limit: 2_000 },
  identity: { ttlMinutes: 10, limit: 5_000 },
  senderKey: { ttlMinutes: 10, limit: 2_000 },
  privacyToken: { ttlMinutes: 30, limit: 5_000 },
};

const toTtlKey = (name) => `${name}Ms`;

const providers = Object.fromEntries(domains.map((domain) => [domain, BACKEND]));

const cacheProviders = Object.fromEntries(
  Object.keys(cacheTtlMinutes).map((name) => [name, BACKEND]),
);

const cacheLayer = {
  ...Object.fromEntries(Object.keys(cachedDomains).map((name) => [name, true])),
  ttlMs: Object.fromEntries(
    Object.entries(cachedDomains).map(([name, { ttlMinutes }]) => [
      toTtlKey(name),
      ttlMinutes * MINUTE,
    ]),
  ),
  limits: Object.fromEntries(
    Object.entries(cachedDomains).map(([name, { limit }]) => [name, limit]),
  ),
};

const cacheTtlMs = Object.fromEntries(
  Object.entries(cacheTtlMinutes).map(([name, minutes]) => [toTtlKey(name), minutes * MINUTE]),
);

export const store = createStore({
  backends: { sqlite },
  providers,
  cacheProviders,
  cacheLayer,
  memory: { cacheTtlMs },
});
