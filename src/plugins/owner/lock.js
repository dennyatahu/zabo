import { isLockTarget } from "../../lib/lock-target.js";
import { buildGuide } from "../../utils/guide.js";

const GUIDE = {
  title: "Lock",
  summary: "Lock the bot completely so nobody can use it.",
  groups: [
    {
      rows: [
        ["lock @bot", "Lock the mentioned bot."],
        ["lock zabo", "Lock the bot by its name."],
        ["unlock @bot | zabo", "Unlock the bot again."],
      ],
    },
  ],
  notes: [
    "While locked, every command is ignored except unlock.",
    "Only the owner can unlock the bot.",
  ],
};

export default {
  name: "lock",
  commands: ["lock"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async ({ m, args, lockManager }) => {
    if (!args.length && !m.mentions?.length) return m.reply(buildGuide(GUIDE));

    if (!isLockTarget(m, args)) return;

    const { data, error } = lockManager.enable();

    return m.reply(data ?? error);
  },
};
