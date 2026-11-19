import util from "node:util";
import { createRequire } from "node:module";
import * as zapo from "zapo-js";

const require = createRequire(import.meta.url);

export default {
  name: "eval",
  commands: ["!"],
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
      text,
      store,
      command,
      prefix,
      prefixManager,
      pluginManager,
      selfManager,
      q,
    } = ctx;

    const code = text?.trimStart();

    if (!code) return m.reply("where is the js code?");

    try {
      let result = await eval(code);

      if (typeof result !== "string") {
        result = util.inspect(result);
      }

      return await (q ?? m).reply(result);
    } catch (e) {
      console.error(e);
      return await m.reply(e.message);
    }
  },
};
