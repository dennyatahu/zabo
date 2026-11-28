import { logger } from "../core/logger.js";

const stringify = (value) => (typeof value === "string" ? value : Bun.inspect(value));

export const createEvalPlugin = ({ name, trigger, wrap = (code) => code }) => ({
  name,
  commands: [trigger],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async (ctx) => {
    const {
      client,
      jid,
      m,
      q,
      text,
      store,
      command,
      prefix,
      lockManager,
      menuManager,
      pluginManager,
      prefixManager,
      reloadManager,
      restartManager,
      selectiveManager,
      selfManager,
    } = ctx;

    const code = text?.trimStart();

    if (!code) return m.reply(`*Usage*\n▸ ${trigger} <code>`);

    try {
      const result = await eval(wrap(code));

      return await (q ?? m).reply(stringify(result));
    } catch (err) {
      logger.error({ err, command: trigger }, "eval failed");

      return await m.reply(`*Error*\n▸ ${err.message}`);
    }
  },
});
