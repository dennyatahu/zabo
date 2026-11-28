// MenuManager: command logic for the `menu` plugin. Holds in-memory menu state
// (profile text, active/default/saved media) and coordinates image processing
// (menu/image.js) with database storage (menu/storage.js).
//
// Public API used by the menu plugin:
//   init(), ensureDefaults(client)
//   getMainMenu(prefix), getAllMenu(prefix), getCategoryMenu(input, prefix)
//   compose(text, client) -> link-preview message proto
//   setText/clearText/getText(field), getMedia(kind)
//   setMedia(client, kind, {source, name, index})
//   saveMedia(kind, {source, name}), removeMedia(kind, ref), formatSaved(kinds)

import { pluginManager } from "../plugin.js";
import {
  processImage,
  runTask,
  normalizeImage,
  KINDS,
  fetchImage,
} from "./image.js";
import {
  readProfile,
  saveProfile,
  readActiveMedia,
  readDefaultMedia,
  readSavedMedia,
  saveActiveMedia,
  saveDefaultMedia,
  saveSavedMedia,
  encodeMessage,
  decodeMessage,
} from "./storage.js";
import { transaction } from "../../database/connection.js";
import { logger } from "../../core/logger.js";
import { ok, fail } from "../../lib/plugin-schema.js";

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
  "thumbnailEncSha256",
  "thumbnailSha256",
  "mediaKey",
  "mediaKeyTimestamp",
  "thumbnailWidth",
  "thumbnailHeight",
]);

const FAVICON_FIELDS = Object.freeze(
  THUMBNAIL_FIELDS.filter((field) => field !== "jpegThumbnail"),
);

const MESSAGES = Object.freeze({
  NO_CATEGORIES: "The menu is empty.",
});

const byLocale = (a, b) => a.localeCompare(b);

const MAX_NAME_LENGTH = 32;

const readText = (value, fallback) => (typeof value === "string" ? value : fallback);

const readActive = (value) => {
  if (!value?.image || !value?.message) return undefined;
  try {
    return { image: new Uint8Array(value.image), message: decodeMessage(value.message) };
  } catch (err) {
    logger.warn({ err }, "invalid menu media config");
    return undefined;
  }
};

const readSaved = (value) =>
  Array.isArray(value)
    ? value
        .filter((entry) => typeof entry?.name === "string" && entry?.image != null)
        .map(({ name, image }) => ({ name, image: new Uint8Array(image) }))
    : [];

const parseStored = (stored) => ({
  url: readText(stored?.url, DEFAULTS.url),
  title: readText(stored?.title, undefined), // resolved from config at init
  description: readText(stored?.description, undefined), // resolved from config at init
  thumbnail: readActive(stored?.thumbnail),
  favicon: readActive(stored?.favicon),
  thumbnails: readSaved(stored?.thumbnails),
  favicons: readSaved(stored?.favicons),
});

const categoryHeader = (category) => `▸ *${category}*`;

const categoryText = ({ category, rows }) =>
  `${categoryHeader(category)}\n${[...rows].sort(byLocale).join("\n")}`;

export class MenuManager {
  #data = parseStored(undefined);
  #defaults = new Map();
  #defaultsReady = false;

  // Config defaults resolved at init (not at class definition) so config is
  // fully loaded first.
  #titleFallback = undefined;
  #descriptionFallback = undefined;

  configure(titleFallback, descriptionFallback) {
    this.#titleFallback = titleFallback;
    this.#descriptionFallback = descriptionFallback;
  }

  async ensureDefaults(client) {
    if (this.#defaultsReady || !client) return;
    this.#defaultsReady = true;

    await Promise.all(
      ["thumbnail", "favicon"].map(async (kind) => {
        if (this.#defaults.has(kind)) return;
        try {
          const image = await fetchImage(
            kind === "thumbnail"
              ? "https://cloud.yardansh.com/kFK7uN.jpg"
              : "https://cloud.yardansh.com/Kbmh9u.png",
          );
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
    const profile = readProfile();
    const activeMedia = readActiveMedia();
    const defaultMedia = readDefaultMedia();

    for (const [kind, entry] of Object.entries(defaultMedia)) {
      const decoded = readActive(entry);
      if (decoded) this.#defaults.set(kind, decoded);
    }

    // Two defaults (thumbnail, favicon) expected.
    this.#defaultsReady = this.#defaults.size === 2;

    const stored = profile
      ? {
          ...profile,
          thumbnail: activeMedia.thumbnail,
          favicon: activeMedia.favicon,
          thumbnails: readSavedMedia("thumbnail"),
          favicons: readSavedMedia("favicon"),
        }
      : undefined;

    this.#data = parseStored(stored || undefined);
    // Apply config fallbacks after parseStored.
    this.#data.title = this.#data.title ?? this.#titleFallback;
    this.#data.description = this.#data.description ?? this.#descriptionFallback;

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
    const thumbnailFields = pick(
      activeThumbnail?.message?.extendedTextMessage,
      THUMBNAIL_FIELDS,
    );
    const faviconFields = pick(
      activeFavicon?.message?.extendedTextMessage,
      FAVICON_FIELDS,
    );

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
    if (field === "url" && !/^https?:\/\//i.test(text)) {
      return fail("That URL is not valid. It must start with http:// or https://.");
    }
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
    return media
      ? ok(Buffer.from(media.image).toString("base64"))
      : fail(`No ${label.toLowerCase()} is available.`);
  }

  setMedia(client, kind, { source, name, index } = {}) {
    const { label, build } = KINDS[kind];
    const hasRef = name !== undefined || index !== undefined;

    if (source !== undefined && hasRef) {
      return fail("Use either an image source or a saved name / number, not both.");
    }
    if (source === undefined && !hasRef) {
      return fail("Provide an image link, a saved name or number, or reply to an image.");
    }

    const image =
      source !== undefined
        ? normalizeImage(kind, source)
        : this.#findSavedEntry(kind, { name, index }).image;

    const message = build(client, image);
    this.#commit({ [kind]: { image, message } });

    return `${label} updated.`;
  }

  saveMedia(kind, { source, name } = {}) {
    const { label, plural } = KINDS[kind];

    if (source === undefined) {
      return fail("Provide an image link, a saved name or number, or reply to an image.");
    }

    const image = normalizeImage(kind, source);
    const entryName = this.#resolveName(kind, name);

    this.#commit({ [plural]: [...this.#data[plural], { name: entryName, image }] });

    return `${label} saved as [${entryName}] (#${this.#data[plural].length}).`;
  }

  removeMedia(kind, ref) {
    const { label, plural } = KINDS[kind];
    const value = typeof ref === "string" ? ref.trim() : "";

    if (!value) {
      return fail(`Specify the saved ${label.toLowerCase()} name or number. Use \`saved\` to see them.`);
    }

    const entry = this.#findSavedEntry(kind, value);

    this.#commit({ [plural]: this.#data[plural].filter((item) => item !== entry) });

    return `${label} [${entry.name}] deleted.`;
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

  // Returns the saved entry object (throws via fail-return when not found;
  // callers check for {error} before using the entry).
  #findSavedEntry(kind, ref) {
    const { label, plural } = KINDS[kind];
    const list = this.#data[plural];

    const value = typeof ref === "string" ? ref.trim() : "";

    if (/^\d+$/.test(value)) {
      const position = Number(value);
      if (position < 1 || position > list.length) {
        throw new Error(
          `Index ${position} is out of range. The list has ${list.length} ${label.toLowerCase()}${list.length === 1 ? "" : "s"}.`,
        );
      }
      return list[position - 1];
    }

    const key = value.toLowerCase();
    const entry = list.find((item) => item.name.toLowerCase() === key);
    if (!entry) {
      throw new Error(`No saved ${label.toLowerCase()} named [${value}].`);
    }
    return entry;
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
    if (!name) throw new Error("The name can't be empty.");
    if (/^https?:\/\//i.test(name)) throw new Error("The name can't be a link.");
    if (/^\d+$/.test(name)) throw new Error("The name can't be a number only.");
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`The name is too long (max ${MAX_NAME_LENGTH} characters).`);
    }
    if (exists(name)) throw new Error(`The name [${name}] is already used.`);
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
    saveProfile(this.#data);
  }

  #saveActive(kind, entry) {
    saveActiveMedia(kind, entry);
  }

  #saveDefault(kind, entry) {
    saveDefaultMedia(kind, entry);
  }

  #saveSaved(kind, list) {
    saveSavedMedia(kind, list);
  }
}

// pick: select fields from source that are non-null.
const pick = (source, fields) =>
  Object.fromEntries(
    fields.filter((field) => source?.[field] != null).map((f) => [f, source[f]]),
  );

export const menuManager = new MenuManager();
