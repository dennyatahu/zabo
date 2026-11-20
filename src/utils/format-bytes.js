const UNITS = Object.freeze(["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]);
const BASE = 1024;

export const formatBytes = (bytes, decimals = 2) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";

  const exponent = Math.floor(Math.log(bytes) / Math.log(BASE));
  const index = Math.min(Math.max(exponent, 0), UNITS.length - 1);
  const value = (bytes / BASE ** index).toFixed(Math.max(0, decimals));

  return `${Number.parseFloat(value)} ${UNITS[index]}`;
};
