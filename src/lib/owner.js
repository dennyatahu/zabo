import { config } from "../config.js";
import { userOf } from "../utils/user-of.js";
import { senderJids } from "./sender.js";

export const isOwner = ({ key }) =>
  key.fromMe ||
  senderJids(key).some((jid) => {
    const user = userOf(jid);

    return Boolean(user) && config.owners.includes(user);
  });
