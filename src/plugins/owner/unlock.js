import { isLockTarget } from "../../lib/lock-target.js";
import { buildGuide } from "../../utils/guide.js";

const GUIDE = {
  title: "Unlock",
  summary: "Unlock the bot after it was locked.",
  groups: [
    {
      rows: [
        ["unlock @bot", "Unlock the mentioned bot."],
        ["unlock zabo", "Unlock the bot by its name."],
      ],
    },
  ],
  notes: ["Only the owner can use this command."],
};

export default {
  name: "unlock",
  commands: ["unlock"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
    lockBypass: true,
  },

  fn: async ({ m, args, lockManager }) => {
    if (!args.length && !m.mentions?.length) return m.reply(buildGuide(GUIDE));

    if (!isLockTarget(m, args)) return;

    const { data, error } = lockManager.disable();

    return m.reply(data ?? error);
  },
};
