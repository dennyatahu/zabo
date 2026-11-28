// Restart plugin: request a supervised restart (exit code 75 → launcher re-spawns).
// Owner-only, bypassPrefix. Unavailable when not supervised (ZABO_SUPERVISED != 1).

export default {
  name: "restart",
  commands: ["res"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async ({ m, jid, restartManager }) => {
    if (!restartManager.isSupported) {
      return m.reply("*Restart*\n▸ Unavailable. Start the bot with bun start.");
    }

    const notice = await m.reply("*Restart*\n▸ Restarting the bot...");

    return restartManager.request(jid, notice?.id);
  },
};
