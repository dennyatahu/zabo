import { Readable } from "node:stream";
import { getContentType, unwrapMessage, WaMediaTransferClient } from "zapo-js";

import { isSelf } from "./is-self.js";

const THUMBNAIL_MEDIA_TYPES = ["thumbnail-link", "image"];
const MAC_MISMATCH = "media MAC mismatch";
const NO_MEDIA = "message has no downloadable media";

const mediaTransfer = new WaMediaTransferClient();

const toOutput = (bytes, type) => {
  switch (type) {
    case "bytes":
      return bytes;
    case "buffer":
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    default:
      return Readable.from([bytes], { objectMode: false });
  }
};

const parse = (raw) => {
  const message = raw && unwrapMessage(raw);
  const content = getContentType(message);
  const body = content ? message[content] : undefined;

  return {
    content,
    text: body?.text ?? message?.conversation ?? body?.caption,
    contextInfo: body?.contextInfo,
  };
};

const downloadThumbnail = async ({
  mediaKey,
  thumbnailDirectPath: directPath,
  thumbnailEncSha256: fileEncSha256,
  thumbnailSha256: fileSha256,
  jpegThumbnail,
}) => {
  if (!mediaKey || !directPath) {
    if (!jpegThumbnail) throw new Error(NO_MEDIA);

    return Uint8Array.from(jpegThumbnail);
  }

  let failure;

  for (const mediaType of THUMBNAIL_MEDIA_TYPES) {
    try {
      return await mediaTransfer.downloadAndDecrypt({
        mediaType,
        mediaKey,
        directPath,
        fileEncSha256,
        fileSha256,
      });
    } catch (error) {
      if (error?.message !== MAC_MISMATCH) throw error;

      failure = error;
    }
  }

  throw failure;
};

const download = async (m, type) => {
  if (!m.message) throw new Error(NO_MEDIA);

  const { extendedTextMessage: extended } = unwrapMessage(m.message);

  if (extended?.mediaKey || extended?.jpegThumbnail) {
    return toOutput(await downloadThumbnail(extended), type);
  }

  const { message } = m.client;

  return type === "buffer" || type === "bytes"
    ? toOutput(await message.downloadBytes(m.message), type)
    : message.download(m.message);
};

const reply = (m, text, options) =>
  m.client.message.send(m.key.remoteJid, text, { ...options, quote: m });

const react = (m, emoji) =>
  m.client.message.send(m.key.remoteJid, { type: "reaction", target: m.key, emoji });

const bind = (target, client) =>
  Object.defineProperty(
    Object.assign(target, {
      reply: (text, options) => reply(target, text, options),
      react: (emoji) => react(target, emoji),
      download: (type) => download(target, type),
    }),
    "client",
    { value: client, writable: true, configurable: true },
  );

export const smsg = (event, client) => {
  const { contextInfo, ...fields } = parse(event?.message);
  const m = bind(
    { ...event, ...fields, mentions: [...(contextInfo?.mentionedJids ?? [])] },
    client,
  );
  const quoted = contextInfo?.quotedMessage;

  if (!quoted) return m;

  const { content, text } = parse(quoted);
  m.q = bind(
    {
      key: {
        remoteJid: m.key.remoteJid,
        participant: contextInfo.participant,
        id: contextInfo.stanzaId,
        fromMe: isSelf(client, contextInfo.participant),
      },
      message: quoted,
      content,
      text,
    },
    client,
  );

  return m;
};
