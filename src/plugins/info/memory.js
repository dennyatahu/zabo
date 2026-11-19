import { formatBytes } from "../../utils/format-byte.js";

const LABELS = Object.freeze({
  rss: "RSS",
  heapTotal: "Heap Total",
  heapUsed: "Heap Used",
  external: "External",
  arrayBuffers: "Array Buffers",
});

export default {
  name: "memory",
  commands: ["mem"],
  categories: ["info"],

  fn: async ({ m }) => {
    const usage = process.memoryUsage();

    const rows = Object.entries(LABELS).map(
      ([key, label]) => `▸ ${label}: ${formatBytes(usage[key])}`,
    );

    return m.reply(["*Memory Usage*", ...rows].join("\n"));
  },
};
