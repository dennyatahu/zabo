// Push-name tracking: remembers contacts' display names from incoming messages
// and upserts them into the store's contacts cache. Also exposes lookups by JID.

import { isLidJid, isUserJid, toUserJid, WA_DEFAULTS } from "zapo-js";

import { config } from "../config/env.js";
import { logger } from "../core/logger.js";
import { store } from "../core/store.js";
import { senderJids } from "./jid.js";

const known = new Map();

const contacts = () => store.session(config.sessionId).contacts;

export const rememberPushName = ({ key, pushName }) => {
  if (!pushName || key.fromMe) return;

  const jids = senderJids(key).filter(Boolean).map((jid) => toUserJid(jid));
  const lid = jids.find(isLidJid);
  const phone = jids.find(isUserJid);
  const jid = lid ?? phone;

  if (!jid || known.get(jid) === pushName) return;

  known.set(jid, pushName);

  contacts()
    .upsert({
      jid,
      pushName,
      phoneNumber: lid ? phone : undefined,
      lastUpdatedMs: Date.now(),
    })
    .catch((err) => {
      known.delete(jid);
      logger.warn({ err, jid }, "push name save failed");
    });
};

const findPushName = async (id) => {
  const servers = [WA_DEFAULTS.LID_SERVER, WA_DEFAULTS.HOST_DOMAIN];

  for (const server of servers) {
    const record = await contacts().getByJid(`${id}@${server}`);
    if (record?.pushName) return record.pushName;
  }

  return undefined;
};

export const findPushNames = async (ids) => {
  const entries = await Promise.all(
    ids.map(async (id) => [id, await findPushName(id)]),
  );
  return new Map(entries.filter(([, name]) => name));
};
