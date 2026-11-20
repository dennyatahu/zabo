const ACTIONS = Object.freeze({
  on: (self) => self.enable(),
  off: (self) => self.disable(),
});

export default {
  name: "self",
  commands: ["self"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async ({ m, args, selfManager }) => {
    const action = ACTIONS[args[0]?.toLowerCase()];

    if (!action) {
      const status = selfManager.isActive ? "on" : "off";

      return m.reply(
        [
          "*Self Mode*",
          `▸ Status: ${status}`,
          "",
          "*Usage*",
          "▸ self on",
          "▸ self off",
        ].join("\n"),
      );
    }

    const { data, error } = action(selfManager);

    return m.reply(data ?? error);
  },
};
