export const formatUptime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0ms";

  const total = Math.round(seconds * 1000);

  const units = [
    ["mo", Math.floor(total / 2592000000)],
    ["d", Math.floor((total % 2592000000) / 86400000)],
    ["h", Math.floor((total % 86400000) / 3600000)],
    ["m", Math.floor((total % 3600000) / 60000)],
    ["s", Math.floor((total % 60000) / 1000)],
    ["ms", total % 1000],
  ];

  const parts = units.filter(([, value]) => value > 0).map(([label, value]) => `${value}${label}`);

  return parts.length ? parts.join(" ") : "0ms";
};
