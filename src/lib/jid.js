// JID (Jabber ID) helpers: extract user from JID, determine sender JIDs,
// check owner/self/lock-target. Reads owner list and bot name from config.

import { toUserJid } from "zapo-js";

import { config } from "../config/env.js";

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

// Computed lazily so importing this module does not require loadEnv() first.
export const lockTargetError = () =>
  `Specify the bot by name (\`${config?.botName ?? "zabo"}\`) or mention it.`;

export const isLockTarget = (m, args) => {
  const botName = config.botName.toLowerCase();
  const named = args.some((arg) => arg.toLowerCase().replace(/^@/, "") === botName);
  const mentioned = (m.mentions ?? []).some((jid) => isSelf(m.client, jid));

  return named || mentioned;
};
