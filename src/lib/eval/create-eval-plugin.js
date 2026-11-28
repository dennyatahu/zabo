// Creates an eval plugin (! / !!). Owner-only, bypassPrefix. Evaluates arbitrary
// JavaScript in the bot process — equivalent to full process access.
// The destructured variables below are injected into the eval scope so the
// evaluated code can use them directly (client, jid, m, text, store, ...).
// WARNING: eval/shell commands are owner-only and grant full access to the
// process. Do not expose to untrusted users.

import { logger } from "../../core/logger.js";

const stringify = (value) => (typeof value === "string" ? value : Bun.inspect(value));

// Scope exposed to eval code. Keys are the variable names available inside eval.
export const EVAL_SCOPE_KEYS = Object.freeze([
  "client",
  "jid",
  "m",
  "q",
  "text",
  "store",
  "command",
  "prefix",
  "lockManager",
  "menuManager",
  "pluginManager",
  "prefixManager",
  "reloadManager",
  "restartManager",
  "selectiveManager",
  "selfManager",
]);

export const createEvalPlugin = ({ name, trigger, wrap = (code) => code }) => ({
  name,
  commands: [trigger],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async (ctx) => {
    // Destructure into local variables so eval code can reference them by name.
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
