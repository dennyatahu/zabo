import { RECONNECT_BASE_MS, RECONNECT_MAX_MS } from "../constants/reconnect.js";

export const backoff = (attempts) => {
  const exponential = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);
  return exponential + Math.floor(Math.random() * 1_000);
};
