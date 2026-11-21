import { buildError, buildGuide, isHelp } from "../../utils/guide.js";
import { fail } from "../../utils/result.js";

const GUIDE = {
  title: "Prefix",
  summary: "Manage the characters that must start a command.",
  groups: [
    {
      rows: [
        ["prefix", "Show the status and the prefix list."],
        ["prefix + <prefix>", "Add a prefix."],
        ["prefix - <prefix | number>", "Delete a prefix by its text or list number."],
        ["prefix on", "Require a prefix for commands."],
        ["prefix off", "Allow commands without a prefix."],
        ["prefix reset", "Restore the default prefix list."],
      ],
    },
  ],
  examples: ["prefix + #", "prefix - 2", "prefix on"],
  notes: [
    "At least one prefix always stays in the list.",
    "Owner commands work with or without a prefix.",
  ],
};

const formatList = ({ isActive, prefixList }) => {
  const items = prefixList.map((item, index) => `  ${index + 1}. \`${item}\``).join("\n");

  return [
    "*Prefix List*",
    `▸ Status: ${isActive ? "on" : "off"}`,
    `▸ Total: ${prefixList.length}`,
    "",
    items,
  ].join("\n");
};

const ACTIONS = Object.freeze({
  "+": (manager, value) =>
    value ? manager.addPrefix(value) : fail("Specify the prefix to add."),
  "-": (manager, value) =>
    value ? manager.deletePrefix(value) : fail("Specify the prefix or its number."),
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
    bypassPrefix: true,
  },

  fn: async ({ m, text, args, prefixManager }) => {
    if (isHelp(text)) return m.reply(buildGuide(GUIDE));

    const [head, value] = args;

    if (head === undefined) return m.reply(formatList(prefixManager.getConfig()));

    const key = head.toLowerCase();

    if (!Object.hasOwn(ACTIONS, key)) {
      return m.reply(buildError(`Unknown option \`${head}\`.`, "prefix"));
    }

    const { data, error } = ACTIONS[key](prefixManager, value);

    return m.reply(data ?? (error && buildError(error, "prefix")));
  },
};
