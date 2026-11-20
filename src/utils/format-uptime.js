const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

const UNITS = Object.freeze([
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

  for (const [label, size] of UNITS) {
    const value = Math.floor(remaining / size);

    remaining -= value * size;

    if (value > 0) parts.push(`${value}${label}`);
  }

  return parts.length ? parts.join(" ") : "0ms";
};
