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
      return m.reply("*Restart*\n▸ Unavailable. Start the bot with npm start.");
    }

    await m.reply("*Restart*\n▸ Restarting the bot...");

    return restartManager.request(jid);
  },
};
