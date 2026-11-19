import { join } from "node:path";

import { proto } from "zapo-js";

import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { processImage } from "../lib/image-processor.js";
import { readJson, writeJson } from "../utils/json-file.js";
import { pluginManager } from "./plugin-manager.js";

const DEFAULTS = Object.freeze({
  url: "https://github.com/dennyatahu/zabo",
  title: "zabo",
  description: "by dennyatahu",
});

const TEXT_FIELDS = Object.freeze({
  url: "URL",
  title: "Title",
  description: "Description",
});

const THUMBNAIL_FIELDS = Object.freeze([
  "jpegThumbnail",
  "thumbnailDirectPath",
  "thumbnailSha256",
  "thumbnailEncSha256",
  "mediaKey",
  "mediaKeyTimestamp",
  "thumbnailWidth",
  "thumbnailHeight",
]);

const FAVICON_FIELDS = Object.freeze(THUMBNAIL_FIELDS.filter((field) => field !== "jpegThumbnail"));

const FAVICON_SIZE = 48;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_NAME_LENGTH = 32;

const MESSAGES = Object.freeze({
  INVALID_URL: "That URL is not valid. It must start with http:// or https://.",
  INVALID_IMAGE: "That file is not a valid image.",
  INVALID_SOURCE: "The image source must be a URL or a buffer.",
  INVALID_INDEX: "Invalid index. Start from 1.",
  IMAGE_TOO_LARGE: "The image is too large (max 10 MB).",
  NO_SOURCE: "Provide an image (URL, reply, or caption) or use --name / --index.",
  SOURCE_CONFLICT: "Use either an image source or --name / --index, not both.",
  REF_CONFLICT: "Use either --name or --index, not both.",
  EMPTY_NAME: "The name can't be empty.",
  NUMERIC_NAME: "The name can't be a number only.",
  NO_CATEGORIES: "The menu is empty.",
  NO_THUMBNAIL: "No custom thumbnail is set.",
});

class UserError extends Error {}

const ok = (data) => ({ data });
const fail = (error) => ({ error });

const byLocale = (a, b) => a.localeCompare(b);

const isHttpUrl = (value) => /^https?:\/\//i.test(value) && URL.canParse(value);

const isIndex = (value) => typeof value === "string" && /^\d+$/.test(value.trim());

const pick = (source, fields) =>
  Object.fromEntries(fields.filter((field) => source?.[field] != null).map((f) => [f, source[f]]));

const guard = (task) => {
  try {
    return ok(task());
  } catch (err) {
    if (err instanceof UserError) return fail(err.message);

    throw err;
  }
};

const attempt = async (label, task) => {
  try {
    return ok(await task());
  } catch (err) {
    if (err instanceof UserError) return fail(err.message);

    logger.error({ err }, `${label} failed`);

    return fail(err.message);
  }
};

const encodeMessage = (message) =>
  Buffer.from(proto.Message.encode(message).finish()).toString("base64url");

const decodeMessage = (value) => proto.Message.decode(Buffer.from(value, "base64url"));

const createMessage = (extendedTextMessage) =>
  proto.Message.decode(proto.Message.encode(new proto.Message({ extendedTextMessage })).finish());

const fetchImage = async (value) => {
  const url = value.trim();

  if (!isHttpUrl(url)) throw new UserError(MESSAGES.INVALID_URL);

  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) throw new UserError(`Failed to download the image (HTTP ${response.status}).`);

  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    throw new UserError(MESSAGES.IMAGE_TOO_LARGE);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > MAX_IMAGE_BYTES) throw new UserError(MESSAGES.IMAGE_TOO_LARGE);

  return buffer;
};

const toBuffer = async (input) => {
  if (typeof input === "string") return fetchImage(input);
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);

  throw new UserError(MESSAGES.INVALID_SOURCE);
};

const runTask = async (task, buffer) => {
  try {
    return await processImage(task, buffer);
  } catch (err) {
    if (err.code === "INVALID_IMAGE") throw new UserError(MESSAGES.INVALID_IMAGE);

    throw err;
  }
};

const prepareThumbnail = async (buffer) => Buffer.from((await runTask("thumbnail", buffer)).data);

const prepareFavicon = async (buffer) => Buffer.from((await runTask("favicon", buffer)).data);

const toMediaFields = (media, width, height) => ({
  thumbnailDirectPath: media.directPath,
  thumbnailEncSha256: media.fileEncSha256,
  thumbnailSha256: media.fileSha256,
  mediaKey: media.mediaKey,
  mediaKeyTimestamp: media.mediaKeyTimestamp,
  thumbnailWidth: width,
  thumbnailHeight: height,
});

const buildThumbnail = async (client, image) => {
  const { width, height, data } = await runTask("preview", image);

  const media = await client.message.upload(image, {
    type: "thumbnail-link",
    mimetype: "image/jpeg",
  });

  return createMessage({
    ...toMediaFields(media, width, height),
    jpegThumbnail: Buffer.from(data),
  });
};

const buildFavicon = async (client, image) => {
  const media = await client.message.upload(image, {
    type: "thumbnail-link",
    mimetype: "image/png",
  });

  return createMessage(toMediaFields(media, FAVICON_SIZE, FAVICON_SIZE));
};

const KINDS = Object.freeze({
  thumbnail: {
    label: "Thumbnail",
    plural: "thumbnails",
    prepare: prepareThumbnail,
    build: buildThumbnail,
  },
  favicon: {
    label: "Favicon",
    plural: "favicons",
    prepare: prepareFavicon,
    build: buildFavicon,
  },
});

const normalizeImage = async (kind, input) => KINDS[kind].prepare(await toBuffer(input));

const readText = (value, fallback) => (typeof value === "string" ? value : fallback);

const readActive = (value) => {
  if (typeof value?.image !== "string" || typeof value?.message !== "string") return undefined;

  try {
    return { image: Buffer.from(value.image, "base64"), message: decodeMessage(value.message) };
  } catch (err) {
    logger.warn({ err }, "invalid menu media config");

    return undefined;
  }
};

const readSaved = (value) =>
  Array.isArray(value)
    ? value
        .filter((entry) => typeof entry?.name === "string" && typeof entry?.image === "string")
        .map(({ name, image }) => ({ name, image: Buffer.from(image, "base64") }))
    : [];

const parseStored = (stored) => ({
  url: readText(stored?.url, DEFAULTS.url),
  title: readText(stored?.title, DEFAULTS.title),
  description: readText(stored?.description, DEFAULTS.description),
  thumbnail: readActive(stored?.thumbnail),
  favicon: readActive(stored?.favicon),
  thumbnails: readSaved(stored?.thumbnails),
  favicons: readSaved(stored?.favicons),
});

const serializeActive = (entry) =>
  entry ? { image: entry.image.toString("base64"), message: encodeMessage(entry.message) } : null;

const serializeSaved = (list) =>
  list.map(({ name, image }) => ({ name, image: image.toString("base64") }));

const serialize = (data) => ({
  url: data.url,
  title: data.title,
  description: data.description,
  thumbnail: serializeActive(data.thumbnail),
  favicon: serializeActive(data.favicon),
  thumbnails: serializeSaved(data.thumbnails),
  favicons: serializeSaved(data.favicons),
});

class MenuManager {
  #filePath = undefined;
  #data = parseStored(undefined);
  #queue = Promise.resolve();

  async init() {
    this.#filePath = join(config.paths.data, "menu.json");

    const stored = await readJson(this.#filePath);

    this.#data = parseStored(stored);

    if (!stored) {
      this.#save();
      await this.#queue;
    }
  }

  getConfig() {
    const { url, title, description, thumbnail, favicon, thumbnails, favicons } = this.#data;

    return {
      url,
      title,
      description,
      hasThumbnail: Boolean(thumbnail),
      hasFavicon: Boolean(favicon),
      savedThumbnails: thumbnails.length,
      savedFavicons: favicons.length,
    };
  }

  getMainMenu(prefix = "") {
    const groups = this.#groups(prefix);

    if (!groups.size) return fail(MESSAGES.NO_CATEGORIES);

    return ok(
      [
        "menu categories list",
        ...[...groups.values()].map(({ category }) => this.#categoryHeader(category)),
      ].join("\n"),
    );
  }

  getAllMenu(prefix = "") {
    const groups = this.#groups(prefix);

    if (!groups.size) return fail(MESSAGES.NO_CATEGORIES);

    return ok([...groups.values()].map((group) => this.#categoryText(group)).join("\n\n"));
  }

  getCategoryMenu(input, prefix = "") {
    const key = typeof input === "string" ? input.trim().toLowerCase() : "";

    if (!key) return fail("The category can't be empty.");

    const group = this.#groups(prefix).get(key);

    return group ? ok(this.#categoryText(group)) : fail(`Category \`${input.trim()}\` not found.`);
  }

  compose(text) {
    const { url, title, description, thumbnail, favicon } = this.#data;

    if (!url) return text;

    const thumbnailFields = pick(thumbnail?.message.extendedTextMessage, THUMBNAIL_FIELDS);
    const faviconFields = pick(favicon?.message.extendedTextMessage, FAVICON_FIELDS);

    return {
      extendedTextMessage: {
        text: `${url}\n\n${text}`,
        matchedText: url,
        title: title || undefined,
        description: description || undefined,
        ...thumbnailFields,
        ...(Object.keys(faviconFields).length ? { faviconMmsMetadata: faviconFields } : {}),
      },
    };
  }

  setText(field, value) {
    const label = TEXT_FIELDS[field];

    if (!label) return fail(`Unknown field \`${field}\`.`);

    const text = typeof value === "string" ? value.trim() : "";

    if (!text) return fail(`${label} can't be empty. Use --del to clear it.`);

    if (field === "url" && !isHttpUrl(text)) return fail(MESSAGES.INVALID_URL);

    this.#commit({ [field]: text });

    return ok(`${label} updated.`);
  }

  clearText(field) {
    const label = TEXT_FIELDS[field];

    if (!label) return fail(`Unknown field \`${field}\`.`);
    if (!this.#data[field]) return fail(`${label} is already empty.`);

    this.#commit({ [field]: "" });

    return ok(`${label} cleared.`);
  }

  getText(field) {
    const label = TEXT_FIELDS[field];

    if (!label) return fail(`Unknown field \`${field}\`.`);

    return this.#data[field] ? ok(this.#data[field]) : fail(`${label} is empty.`);
  }

  getThumbnail() {
    const { thumbnail } = this.#data;

    return thumbnail ? ok(thumbnail.image.toString("base64")) : fail(MESSAGES.NO_THUMBNAIL);
  }

  setMedia(client, kind, { source, name, index } = {}) {
    return attempt(`menu ${kind} set`, async () => {
      const { label, build } = KINDS[kind];
      const hasRef = name !== undefined || index !== undefined;

      if (source !== undefined && hasRef) throw new UserError(MESSAGES.SOURCE_CONFLICT);
      if (source === undefined && !hasRef) throw new UserError(MESSAGES.NO_SOURCE);

      const image =
        source !== undefined
          ? await normalizeImage(kind, source)
          : this.#findSaved(kind, { name, index }).image;

      const message = await build(client, image);

      this.#commit({ [kind]: { image, message } });

      return `${label} updated.`;
    });
  }

  saveMedia(kind, { source, name } = {}) {
    return attempt(`menu ${kind} save`, async () => {
      const { label, plural } = KINDS[kind];

      if (source === undefined) throw new UserError(MESSAGES.NO_SOURCE);

      const image = await normalizeImage(kind, source);
      const entryName = this.#resolveName(kind, name);

      this.#commit({ [plural]: [...this.#data[plural], { name: entryName, image }] });

      return `${label} saved as [${entryName}] (#${this.#data[plural].length}).`;
    });
  }

  removeMedia(kind, ref) {
    return guard(() => {
      const { label, plural } = KINDS[kind];
      const value = typeof ref === "string" ? ref.trim() : "";

      if (!value) {
        throw new UserError(`Specify the ${label.toLowerCase()} index or name (see --save --list).`);
      }

      const entry = isIndex(value)
        ? this.#findSaved(kind, { index: value })
        : this.#findSaved(kind, { name: value });

      this.#commit({ [plural]: this.#data[plural].filter((item) => item !== entry) });

      return `${label} [${entry.name}] deleted.`;
    });
  }

  formatSaved(kinds = Object.keys(KINDS)) {
    return kinds
      .map((kind) => {
        const { label, plural } = KINDS[kind];
        const list = this.#data[plural];
        const rows = list.length
          ? list.map(({ name }, position) => `  ${position + 1}. ${name}`).join("\n")
          : "  (empty)";

        return `*Saved ${label}s*\n${rows}`;
      })
      .join("\n\n");
  }

  #findSaved(kind, { name, index }) {
    const { label, plural } = KINDS[kind];
    const list = this.#data[plural];

    if (name !== undefined && index !== undefined) throw new UserError(MESSAGES.REF_CONFLICT);

    if (name !== undefined) {
      const key = name.trim().toLowerCase();
      const entry = list.find((item) => item.name.toLowerCase() === key);

      if (!entry) throw new UserError(`No saved ${label.toLowerCase()} named [${name.trim()}].`);

      return entry;
    }

    if (!isIndex(index) || Number(index) < 1) throw new UserError(MESSAGES.INVALID_INDEX);

    const position = Number(index);

    if (position > list.length) {
      throw new UserError(
        `Index ${position} is out of range. The list has ${list.length} ${label.toLowerCase()}(s).`,
      );
    }

    return list[position - 1];
  }

  #resolveName(kind, value) {
    const list = this.#data[KINDS[kind].plural];
    const exists = (name) => list.some((item) => item.name.toLowerCase() === name.toLowerCase());

    if (value === undefined) {
      let number = list.length + 1;

      while (exists(`${kind}-${number}`)) number += 1;

      return `${kind}-${number}`;
    }

    const name = value.trim();

    if (!name) throw new UserError(MESSAGES.EMPTY_NAME);
    if (isIndex(name)) throw new UserError(MESSAGES.NUMERIC_NAME);

    if (name.length > MAX_NAME_LENGTH) {
      throw new UserError(`The name is too long (max ${MAX_NAME_LENGTH} characters).`);
    }

    if (exists(name)) throw new UserError(`The name [${name}] is already used.`);

    return name;
  }

  #groups(prefix) {
    const grouped = new Map();

    for (const { name = "", commands, categories } of pluginManager.array) {
      const labels = [...(commands ?? [])].sort(byLocale);

      if (!labels.length) continue;

      const row = `  ▸  ${labels.map((label) => `${prefix}${label}`).join(", ")} [${name}]`;

      for (const category of categories ?? []) {
        const key = category.toLowerCase();
        const group = grouped.get(key) ?? { category, rows: [] };

        group.rows.push(row);
        grouped.set(key, group);
      }
    }

    return new Map([...grouped].sort(([a], [b]) => byLocale(a, b)));
  }

  #categoryHeader(category) {
    return `▨  *${category}*`;
  }

  #categoryText({ category, rows }) {
    return `${this.#categoryHeader(category)}\n${[...rows].sort(byLocale).join("\n")}`;
  }

  #commit(patch) {
    Object.assign(this.#data, patch);
    this.#save();
  }

  #save() {
    const filePath = this.#filePath;
    const payload = JSON.stringify(serialize(this.#data), null, 2);

    this.#queue = this.#queue
      .then(() => writeJson(filePath, payload))
      .catch((err) => logger.error({ err, path: filePath }, "menu save failed"));
  }
}

export const menuManager = new MenuManager();
