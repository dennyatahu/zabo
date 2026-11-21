import { config } from "../config.js";
import { isSelf } from "./is-self.js";

export const isLockTarget = (m, args) => {
  const named = args.some((arg) => arg.toLowerCase() === config.botName.toLowerCase());
  const mentioned = (m.mentions ?? []).some((jid) => isSelf(m.client, jid));

  return named || mentioned;
};
