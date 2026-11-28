// Pure formatting helpers: bytes, uptime, and reconnect backoff.
// No side effects, no dependencies on config or database.

// --- Bytes ---

const BYTE_UNITS = Object.freeze(["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]);
const BYTE_BASE = 1024;

export const formatBytes = (bytes, decimals = 2) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";

  const exponent = Math.floor(Math.log(bytes) / Math.log(BYTE_BASE));
  const index = Math.min(Math.max(exponent, 0), BYTE_UNITS.length - 1);
  const value = (bytes / BYTE_BASE ** index).toFixed(Math.max(0, decimals));

  return `${Number.parseFloat(value)} ${BYTE_UNITS[index]}`;
};

// --- Uptime ---

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

const UPTIME_UNITS = Object.freeze([
  ["mo", MONTH],
  ["d", DAY],
  ["h", HOUR],
  ["m", MINUTE],
  ["s", SECOND],
  ["ms", 1],
]);

export const formatUptime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0ms";

  let remaining = Math.round(seconds * SECOND);
  const parts = [];

  for (const [label, size] of UPTIME_UNITS) {
    const value = Math.floor(remaining / size);
    remaining -= value * size;
    if (value > 0) parts.push(`${value}${label}`);
  }

  return parts.length ? parts.join(" ") : "0ms";
};

// --- Reconnect backoff ---

// Reads backoff constants at call time so tests can override via module mocking
// if needed. Values come from config/constants.js.
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS } from "../config/constants.js";

export const backoff = (attempts) => {
  const exponential = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);
  return exponential + Math.floor(Math.random() * 1_000);
};
