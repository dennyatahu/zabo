import { config } from "../config.js";

const getUser = (jid) => jid?.split("@")[0].split(":")[0];

export const isOwner = ({ key }) => {
  if (key.fromMe) return true;

  const senders = key.isGroup
    ? [key.participant, key.participantAlt]
    : [key.remoteJid, key.remoteJidAlt];

  return senders.some((jid) => {
    const user = getUser(jid);
    return Boolean(user) && config.owners.includes(user);
  });
};
