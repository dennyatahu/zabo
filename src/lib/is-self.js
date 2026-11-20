import { toUserJid } from "zapo-js";

export const isSelf = (client, jid) => {
  if (!jid) return false;

  const { meJid, meLid } = client.getCredentials() ?? {};
  const user = toUserJid(jid);

  return [meJid, meLid].some((me) => me && toUserJid(me) === user);
};
