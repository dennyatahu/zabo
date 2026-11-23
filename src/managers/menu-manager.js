import { Worker } from "node:worker_threads";

import { proto } from "zapo-js";

import { config } from "../config.js";
import { DEFAULT_MEDIA_URLS, FAVICON_SIZE } from "../constants.js";
import { db, transaction } from "../core/database.js";
import { logger } from "../core/logger.js";
import { fail, ok } from "../utils.js";
import { pluginManager } from "./plugin-manager.js";

const WORKER_URL = new URL("../lib/image-worker.js", import.meta.url);

const processImage = (task, buffer) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { workerData: { task, buffer } });

    worker.once("message", ({ result, error }) => {
      worker.terminate();

      if (error) return reject(Object.assign(new Error(error.message), { code: error.code }));

      return resolve(result);
    });

    worker.once("error", reject);

    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`image worker exited with code ${code}`));
    });
  });

const DEFAULTS = Object.freeze({
  url: "https://github.com/dennyatahu/zabo",
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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_NAME_LENGTH = 32;

const MESSAGES = Object.freeze({
  INVALID_URL: "That URL is not valid. It must start with http:// or https://.",
  INVALID_IMAGE: "That file is not a valid image.",
  INVALID_SOURCE: "The image source must be a URL or a buffer.",
  INVALID_INDEX: "Invalid index. Start from 1.",
  IMAGE_TOO_LARGE: "The image is too large (max 10 MB).",
  NO_SOURCE: "Provide an image link, a saved name or number, or reply to an image.",
  SOURCE_CONFLICT: "Use either an image source or a saved name / number, not both.",
  REF_CONFLICT: "Use either a name or a number, not both.",
  LINK_NAME: "The name can't be a link.",
  EMPTY_NAME: "The name can't be empty.",
  NUMERIC_NAME: "The name can't be a number only.",
  NO_CATEGORIES: "The menu is empty.",
});

class UserError extends Error {}

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

const encodeMessage = (message) => Buffer.from(proto.Message.encode(message).finish());

const decodeMessage = (value) => proto.Message.decode(value);

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
    build: buildThumbnail,
  },
  favicon: {
    label: "Favicon",
    plural: "favicons",
    build: buildFavicon,
  },
});

const normalizeImage = async (kind, input) =>
  Buffer.from((await runTask(kind, await toBuffer(input))).data);

const categoryHeader = (category) => `▸ *${category}*`;

const categoryText = ({ category, rows }) =>
  `${categoryHeader(category)}\n${[...rows].sort(byLocale).join("\n")}`;

const readText = (value, fallback) => (typeof value === "string" ? value : fallback);

const readActive = (value) => {
  if (!value?.image || !value?.message) return undefined;

  try {
    return { image: Buffer.from(value.image), message: decodeMessage(value.message) };
  } catch (err) {
    logger.warn({ err }, "invalid menu media config");

    return undefined;
  }
};

const readSaved = (value) =>
  Array.isArray(value)
    ? value
        .filter((entry) => typeof entry?.name === "string" && entry?.image != null)
        .map(({ name, image }) => ({ name, image: Buffer.from(image) }))
    : [];

const parseStored = (stored) => ({
  url: readText(stored?.url, DEFAULTS.url),
  title: readText(stored?.title, config.titleMenu),
  description: readText(stored?.description, config.descMenu),
  thumbnail: readActive(stored?.thumbnail),
  favicon: readActive(stored?.favicon),
  thumbnails: readSaved(stored?.thumbnails),
  favicons: readSaved(stored?.favicons),
});

class MenuManager {
  #data = parseStored(undefined);
  #defaults = new Map();
  #defaultsReady = false;

  async ensureDefaults(client) {
    if (this.#defaultsReady || !client) return;
    this.#defaultsReady = true;

    await Promise.all(
      ["thumbnail", "favicon"].map(async (kind) => {
        if (this.#defaults.has(kind)) return;

        try {
          const image = await fetchImage(DEFAULT_MEDIA_URLS[kind]);
          const message = await KINDS[kind].build(client, image);
          const entry = { image, message };

          this.#defaults.set(kind, entry);
          this.#saveDefault(kind, entry);
        } catch (err) {
          logger.warn({ err, kind }, "default menu media unavailable");
        }
      }),
    );
  }

  init() {
    const profile = db.prepare("SELECT url, title, description FROM menu_profile WHERE id = 1").get();
    const active = db.prepare("SELECT kind, image, message FROM menu_active_media").all();
    const defaults = db.prepare("SELECT kind, image, message FROM menu_default_media").all();
    const saved = db.prepare("SELECT kind, name, image FROM menu_saved_media ORDER BY id").all();

    for (const { kind, image, message } of defaults) {
      const entry = readActive({ image, message });

      if (entry) this.#defaults.set(kind, entry);
    }

    this.#defaultsReady = this.#defaults.size === Object.keys(DEFAULT_MEDIA_URLS).length;

    const activeMedia = Object.fromEntries(
      active.map(({ kind, image, message }) => [kind, { image, message }]),
    );

    const stored = profile
      ? {
          ...profile,
          thumbnail: activeMedia.thumbnail,
          favicon: activeMedia.favicon,
          thumbnails: saved.filter(({ kind }) => kind === "thumbnail"),
          favicons: saved.filter(({ kind }) => kind === "favicon"),
        }
      : undefined;

    this.#data = parseStored(stored);

    if (!profile) this.#saveProfile();
  }

  getMainMenu(prefix = "") {
    const groups = this.#groups(prefix);

    if (!groups.size) return fail(MESSAGES.NO_CATEGORIES);

    return ok(
      [
        "*Menu*",
        `▸ Categories: ${groups.size}`,
        "",
        ...[...groups.values()].map(({ category }) => categoryHeader(category)),
      ].join("\n"),
    );
  }

  getAllMenu(prefix = "") {
    const groups = this.#groups(prefix);

    if (!groups.size) return fail(MESSAGES.NO_CATEGORIES);

    return ok([...groups.values()].map(categoryText).join("\n\n"));
  }

  getCategoryMenu(input, prefix = "") {
    const key = typeof input === "string" ? input.trim().toLowerCase() : "";

    if (!key) return fail("The category can't be empty.");

    const group = this.#groups(prefix).get(key);

    return group ? ok(categoryText(group)) : fail(`Category \`${input.trim()}\` not found.`);
  }

  async compose(text, client) {
    const { url, title, description, thumbnail, favicon } = this.#data;

    if (!url) return text;

    await this.ensureDefaults(client);

    const activeThumbnail = thumbnail ?? this.#defaults.get("thumbnail");
    const activeFavicon = favicon ?? this.#defaults.get("favicon");
    const thumbnailFields = pick(activeThumbnail?.message.extendedTextMessage, THUMBNAIL_FIELDS);
    const faviconFields = pick(activeFavicon?.message.extendedTextMessage, FAVICON_FIELDS);

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

    if (!text) return fail(`${label} can't be empty. Use "del" to clear it.`);

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

  getMedia(kind) {
    const { label } = KINDS[kind];
    const media = this.#data[kind] ?? this.#defaults.get(kind);

    return media ? ok(media.image.toString("base64")) : fail(`No ${label.toLowerCase()} is available.`);
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
        throw new UserError(`Specify the saved ${label.toLowerCase()} name or number. Use \`saved\` to see them.`);
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
          : "  -";

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
        `Index ${position} is out of range. The list has ${list.length} ${label.toLowerCase()}${list.length === 1 ? "" : "s"}.`,
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
    if (/^https?:\/\//i.test(name)) throw new UserError(MESSAGES.LINK_NAME);
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

  #commit(patch) {
    const keys = Object.keys(patch);

    Object.assign(this.#data, patch);

    transaction(() => {
      if (keys.some((key) => Object.hasOwn(TEXT_FIELDS, key))) {
        this.#saveProfile();
      }

      for (const kind of ["thumbnail", "favicon"]) {
        if (keys.includes(kind)) this.#saveActive(kind, patch[kind]);
      }

      if (keys.includes("thumbnails")) this.#saveSaved("thumbnail", this.#data.thumbnails);
      if (keys.includes("favicons")) this.#saveSaved("favicon", this.#data.favicons);
    });
  }

  #saveProfile() {
    db.prepare(
      `INSERT INTO menu_profile (id, url, title, description) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET url = excluded.url, title = excluded.title,
       description = excluded.description,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).run(this.#data.url, this.#data.title, this.#data.description);
  }

  #saveActive(kind, entry) {
    this.#writeMedia("menu_active_media", kind, entry);
  }

  #saveDefault(kind, entry) {
    this.#writeMedia("menu_default_media", kind, entry);
  }

  #writeMedia(table, kind, entry) {
    if (!entry) {
      db.prepare(`DELETE FROM ${table} WHERE kind = ?`).run(kind);

      return;
    }

    db.prepare(
      `INSERT INTO ${table} (kind, image, message) VALUES (?, ?, ?)
       ON CONFLICT(kind) DO UPDATE SET image = excluded.image, message = excluded.message,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).run(kind, entry.image, encodeMessage(entry.message));
  }

  #saveSaved(kind, list) {
    db.prepare("DELETE FROM menu_saved_media WHERE kind = ?").run(kind);

    const insert = db.prepare(
      "INSERT INTO menu_saved_media (kind, name, image) VALUES (?, ?, ?)",
    );

    for (const { name, image } of list) insert.run(kind, name, image);
  }
}

export const menuManager = new MenuManager();
