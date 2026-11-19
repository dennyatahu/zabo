const USAGE = [
  "Usage:",
  "prefix add <prefix>",
  "prefix del <prefix | number>",
  "prefix list",
  "prefix on | off",
  "prefix reset",
].join("\n");

const formatList = ({ isActive, prefixList }) => {
  const items = prefixList.map((item, index) => `  ${index + 1}: [ ${item} ],`).join("\n");

  return [
    "*Prefix List*",
    `Status: ${isActive ? "on" : "off"}`,
    `\`\`\`prefix: {\n${items}\n}\`\`\``,
  ].join("\n");
};

const ACTIONS = Object.freeze({
  add: (manager, args) => manager.addPrefix(args[1]),
  del: (manager, args) => manager.deletePrefix(args[1]),
  list: (manager) => ({ data: formatList(manager.getConfig()) }),
  on: (manager) => manager.enablePrefix(),
  off: (manager) => manager.disablePrefix(),
  reset: (manager) => manager.resetPrefix(),
});

export default {
  name: "prefix",
  commands: ["prefix"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true
  },

  fn: async ({ m, args, prefixManager }) => {
    const action = ACTIONS[args[0]?.toLowerCase()];

    if (!action) return m.reply(USAGE);

    const { data, error } = action(prefixManager, args);

    return m.reply(data ?? error);
  },
};
