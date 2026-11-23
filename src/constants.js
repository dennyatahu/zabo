import { WA_DISCONNECT_REASONS } from "zapo-js";

export const FAVICON_SIZE = 48;

export const DEFAULT_MEDIA_URLS = Object.freeze({
  thumbnail: "https://cloud.yardansh.com/kFK7uN.jpg",
  favicon: "https://cloud.yardansh.com/Kbmh9u.png",
});

export const RESTART_EXIT_CODE = 75;
export const RESTART_NOTICE_TTL_MS = 5 * 60_000;
export const SUPERVISED_ENV = "ZABO_SUPERVISED";

export const RECONNECT_BASE_MS = 2_000;
export const RECONNECT_MAX_MS = 60_000;
export const RECONNECT_FRESH_MS = 1_000;

export const FATAL_REASONS = new Set([
  WA_DISCONNECT_REASONS.FAILURE_BANNED,
  WA_DISCONNECT_REASONS.FAILURE_BAD_USER_AGENT,
  WA_DISCONNECT_REASONS.STREAM_ERROR_REPLACED,
]);
