import { toUserJid } from "zapo-js";

import { config } from "../config.js";

export const userOf = (jid) => jid?.split("@")[0].split(":")[0];

export const senderJids = ({ isGroup, participant, participantAlt, remoteJid, remoteJidAlt }) =>
  isGroup ? [participant, participantAlt] : [remoteJid, remoteJidAlt];

export const isOwner = ({ key }) =>
  key.fromMe ||
  senderJids(key).some((jid) => {
    const user = userOf(jid);

    return Boolean(user) && config.owners.includes(user);
  });

const CANONICAL = Object.freeze({ canonicalizeSignalServer: true });

export const isSelf = (client, jid) => {
  if (!jid) return false;

  const { meJid, meLid } = client.getCredentials() ?? {};
  const user = toUserJid(jid, CANONICAL);

  return [meJid, meLid].some((me) => me && toUserJid(me, CANONICAL) === user);
};

export const LOCK_TARGET_ERROR = `Specify the bot by name (\`${config.botName}\`) or mention it.`;

export const isLockTarget = (m, args) => {
  const botName = config.botName.toLowerCase();
  const named = args.some((arg) => arg.toLowerCase().replace(/^@/, "") === botName);
  const mentioned = (m.mentions ?? []).some((jid) => isSelf(m.client, jid));

  return named || mentioned;
};
