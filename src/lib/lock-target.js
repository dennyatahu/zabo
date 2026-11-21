import { config } from "../config.js";
import { isSelf } from "./is-self.js";

export const LOCK_TARGET_ERROR = `Specify the bot by name (\`${config.botName}\`) or mention it.`;

export const isLockTarget = (m, args) => {
  const botName = config.botName.toLowerCase();
  const named = args.some((arg) => arg.toLowerCase().replace(/^@/, "") === botName);
  const mentioned = (m.mentions ?? []).some((jid) => isSelf(m.client, jid));

  return named || mentioned;
};
