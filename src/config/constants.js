// Application-wide constants, grouped by topic.
// Import from here instead of magic numbers scattered across the codebase.

import { WA_DISCONNECT_REASONS } from "zapo-js";

// --- Restart / supervisor protocol ---
// Exit code 75 tells the launcher (src/launcher.js) to restart the child process.
// Env ZABO_SUPERVISED=1 is set by the launcher so the bot knows it is supervised.
export const RESTART_EXIT_CODE = 75;
export const RESTART_NOTICE_TTL_MS = 5 * 60_000; // restart notice expires after 5 min
export const SUPERVISED_ENV = "ZABO_SUPERVISED";

// --- Reconnect backoff ---
export const RECONNECT_BASE_MS = 2_000;
export const RECONNECT_MAX_MS = 60_000;
export const RECONNECT_FRESH_MS = 1_000; // fresh reconnect after logout/unlink

// --- Fatal disconnect reasons: do not reconnect, shut down instead ---
export const FATAL_REASONS = new Set([
  WA_DISCONNECT_REASONS.FAILURE_BANNED,
  WA_DISCONNECT_REASONS.FAILURE_BAD_USER_AGENT,
  WA_DISCONNECT_REASONS.STREAM_ERROR_REPLACED,
]);

// --- Media limits (menu images) ---
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_NAME_LENGTH = 32;

// --- Menu image processing sizes ---
export const THUMBNAIL_SIZE = 640; // jpeg thumbnail max edge
export const PREVIEW_SIZE = 50; // link-preview thumbnail max edge
export const JPEG_QUALITY = 80;
export const FAVICON_SIZE = 48; // favicon is square PNG

// --- Default menu link ---
export const DEFAULT_MEDIA_URLS = Object.freeze({
  thumbnail: "https://cloud.yardansh.com/kFK7uN.jpg",
  favicon: "https://cloud.yardansh.com/Kbmh9u.png",
});

export const DEFAULT_MENU_URL = "https://github.com/dennyatahu/zabo";

// --- Shell plugin limits ---
export const SHELL_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
export const SHELL_MAX_REPLY_LENGTH = 3500;
export const SHELL_TIMEOUT_MS = 60_000;

// --- Plugin file scanning ---
export const PLUGIN_EXTENSION = ".js";

// --- Database ---
export const DB_USER_VERSION = 2; // current schema version (PRAGMA user_version)
