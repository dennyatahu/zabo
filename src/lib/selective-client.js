import { isLidJid, proto, toUserJid } from "zapo-js";

import { userOf } from "../utils/user-of.js";
import { isSelf } from "./is-self.js";

const SELECTIVE = Symbol("selective");
const EDIT_ATTR = "1";
const EDIT_TYPE = proto.Message.ProtocolMessage.Type.MESSAGE_EDIT;
const UNSUPPORTED = "Selective mode can't send this kind of message.";

const delegate = (target, overrides) =>
  new Proxy(target, {
    get: (object, prop) => {
      if (Object.hasOwn(overrides, prop)) return overrides[prop];

      const value = Reflect.get(object, prop, object);

      return typeof value === "function" ? value.bind(object) : value;
    },
  });

const resolveSender = (client, key) => {
  const sender = key.participant ?? (key.fromMe ? client.getCredentials()?.meJid : undefined);

  if (!sender) throw new Error("selective: sender jid is unknown");

  return sender;
};

const buildContextInfo = ({ quote, mentions }) => {
  const contextInfo = {};

  if (quote?.key?.id) {
    contextInfo.stanzaId = quote.key.id;
    contextInfo.participant = quote.key.participant ?? quote.key.remoteJid;

    if (quote.message) contextInfo.quotedMessage = quote.message;
  }

  if (mentions?.length) contextInfo.mentionedJid = [...mentions];

  return Object.keys(contextInfo).length ? contextInfo : undefined;
};

const buildText = (text, contextInfo) =>
  contextInfo
    ? { extendedTextMessage: { text, contextInfo } }
    : { conversation: text };

const buildReaction = (groupJid, { target, emoji }) => {
  const key = target?.key ?? target;

  return {
    reactionMessage: {
      key: {
        remoteJid: groupJid,
        fromMe: Boolean(key?.fromMe),
        id: key?.id,
        ...(key?.participant ? { participant: key.participant } : {}),
      },
      text: emoji,
      senderTimestampMs: Date.now(),
    },
  };
};

const applyContext = (message, contextInfo) => {
  if (!contextInfo) return message;

  const next = { ...message };

  if (typeof next.conversation === "string" && !next.extendedTextMessage) {
    next.extendedTextMessage = { text: next.conversation };
    delete next.conversation;
  }

  const field = Object.keys(next).find(
    (name) => name !== "messageContextInfo" && next[name] && typeof next[name] === "object",
  );

  if (!field) return message;

  next[field] = { ...next[field], contextInfo: { ...next[field].contextInfo, ...contextInfo } };

  return next;
};

const buildMessage = (groupJid, content, contextInfo) => {
  if (typeof content === "string") return buildText(content, contextInfo);

  if (content?.type === "text" && typeof content.text === "string") {
    return buildText(
      content.text,
      content.mentions?.length
        ? { ...contextInfo, mentionedJid: [...content.mentions] }
        : contextInfo,
    );
  }

  if (content?.type === "reaction") return buildReaction(groupJid, content);

  if (content && typeof content === "object" && !("type" in content)) {
    return applyContext(content, contextInfo);
  }

  return buildText(UNSUPPORTED, contextInfo);
};

const buildEdit = (groupJid, message, editKey) => ({
  protocolMessage: {
    type: EDIT_TYPE,
    key: {
      remoteJid: groupJid,
      fromMe: true,
      id: editKey.id,
      ...(editKey.participant ? { participant: editKey.participant } : {}),
    },
    editedMessage: message,
    timestampMs: editKey.timestampMs ?? Date.now(),
  },
});

const resolveTargets = async (client, groupJid, ids) => {
  const { participants } = await client.group.queryGroupMetadata(groupJid);
  const found = new Set();

  for (const id of ids) {
    const match = participants.find((participant) =>
      [participant.jid, participant.lid, participant.phoneNumber].some((jid) => userOf(jid) === id),
    );

    if (match) found.add(toUserJid(match.jid));
  }

  if (!found.size) throw new Error("selective: target is not in this group");

  return [...found];
};

const createSender = (client, groupJid, sender, fromMe, targetIds) => {
  const addressingMode = isLidJid(sender) ? "lid" : "pn";
  const contexts = new Map();
  let audience;

  const resolveAudience = async () => {
    if (!targetIds?.length) return { recipientJids: [toUserJid(sender)], includeOwnDevices: fromMe };

    const recipientJids = await resolveTargets(client, groupJid, targetIds);

    return { recipientJids, includeOwnDevices: recipientJids.some((jid) => isSelf(client, jid)) };
  };

  return async (content, options = {}) => {
    const { editKey } = options;
    const contextInfo =
      buildContextInfo(options) ?? (editKey ? contexts.get(editKey.id) : undefined);
    const built = buildMessage(groupJid, content, contextInfo);

    audience ??= await resolveAudience();

    const result = await client.selective.send({
      groupJid,
      ...audience,
      addressingMode,
      message: editKey ? buildEdit(groupJid, built, editKey) : built,
      ...(editKey ? { edit: EDIT_ATTR } : {}),
    });

    if (!editKey && contextInfo) contexts.set(result.id, contextInfo);

    return result;
  };
};

export const isSelectiveClient = (client) => client?.[SELECTIVE] === true;

export const createSelectiveClient = (client, key, targetIds) => {
  const groupJid = key.remoteJid;
  const selectiveSend = createSender(
    client,
    groupJid,
    resolveSender(client, key),
    Boolean(key.fromMe),
    targetIds,
  );

  const send = (to, content, options) =>
    to === groupJid ? selectiveSend(content, options) : client.message.send(to, content, options);

  return delegate(client, {
    [SELECTIVE]: true,
    message: delegate(client.message, { send }),
  });
};
