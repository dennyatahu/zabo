import { formatUptime } from "../../utils/format-uptime.js";

export default {
  name: "uptime",
  commands: ["ut", "uptime"],
  categories: ["info"],

  fn: async ({ m }) => m.reply(`*Uptime*\n▸ Running for: ${formatUptime(process.uptime())}`),
};
