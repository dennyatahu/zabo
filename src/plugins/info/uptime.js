// Uptime plugin: shows how long the bot process has been running.
// Uses process.uptime() (Bun-compatible global) and formatBytes/formatUptime helpers.

import { formatUptime } from "../../lib/format.js";

export default {
  name: "uptime",
  commands: ["ut", "uptime"],
  categories: ["info"],

  fn: async ({ m }) => m.reply(`*Uptime*\n▸ Running for: ${formatUptime(process.uptime())}`),
};
