import { toUserJid } from "zapo-js";

// Canonicalize hosted JIDs (`@hosted` / `@hosted.lid`) the same way zapo-js
// does for account identity, so LID, PN and hosted mentions all compare equal.
const CANONICAL = Object.freeze({ canonicalizeSignalServer: true });

export const isSelf = (client, jid) => {
  if (!jid) return false;

  const { meJid, meLid } = client.getCredentials() ?? {};
  const user = toUserJid(jid, CANONICAL);

  return [meJid, meLid].some((me) => me && toUserJid(me, CANONICAL) === user);
};
