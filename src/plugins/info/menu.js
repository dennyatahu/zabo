import { isOwner } from "../../lib/owner.js";
import { buildError, buildGuide, isHelp } from "../../utils/guide.js";
import { fail, ok } from "../../utils/result.js";
import { splitString } from "../../utils/split-string.js";

const IMAGE_CONTENT = "imageMessage";
const OWNER_ONLY = "*Owner Only*\n▸ Only the owner can use this option.";
const SUCCESS = "✅";
const FAILURE = "❌";
const NEED_ANY = "Specify thumb, fav, url, title, or desc.";
const NEED_MEDIA = "Specify thumb or fav.";

const GUIDE = {
  title: "Menu",
  summary: "Browse commands and customize the menu link preview.",
  groups: [
    {
      heading: "Browse",
      rows: [
        ["menu", "Show the categories."],
        ["menu <category>", "Show the commands in a category."],
        ["menu all", "Show every command."],
      ],
    },
    {
      heading: "Owner Only: Images",
      rows: [
        ["menu set thumb <url>", "Set the thumbnail from a link."],
        ["menu set thumb (reply or attach an image)", "Set the thumbnail from that image."],
        ["menu set thumb <name | number>", "Use a saved thumbnail."],
        ["menu get thumb", "Export the current thumbnail data."],
        ["menu save thumb [url] [name]", "Save a link or an image to the library."],
        ["menu saved [thumb | fav]", "List the saved images."],
        ["menu del thumb <name | number>", "Delete a saved thumbnail."],
        ["menu set | get | save | del fav", "Same options for the favicon."],
      ],
    },
    {
      heading: "Owner Only: Text",
      rows: [
        ["menu get url | title | desc", "Show the current value."],
        ["menu set url | title | desc <value>", "Set the value."],
        ["menu del url | title | desc", "Clear the value."],
      ],
    },
  ],
  examples: [
    "menu info",
    "menu set thumb https://example.com/image.jpg",
    "menu save thumb beach",
    "menu set thumb beach",
    "menu set title My Bot",
  ],
  notes: [
    "thumb and fav are short for thumbnail and favicon.",
    "Saved names can't be a number or a link.",
  ],
};

const MEDIA_KINDS = Object.freeze({
  thumb: "thumbnail",
  thumbnail: "thumbnail",
  fav: "favicon",
  favicon: "favicon",
});

const TEXT_FIELDS = Object.freeze({
  url: "url",
  title: "title",
  desc: "description",
  description: "description",
});

const react = (m, emoji) => Promise.resolve(m.react(emoji)).catch(() => undefined);

const silent = (result) => ({ ...result, silent: true });

const isUrl = (value) => /^https?:\/\//i.test(value);

const isIndex = (value) => /^\d+$/.test(value);

const attachedImage = ({ m }) => {
  const target = [m, m.q].find((item) => item?.content === IMAGE_CONTENT);

  return target?.download("buffer");
};

const parseTarget = (value) => {
  const { first, rest } = splitString(value);
  const key = first?.toLowerCase();

  if (key && Object.hasOwn(MEDIA_KINDS, key)) return { kind: MEDIA_KINDS[key], rest };
  if (key && Object.hasOwn(TEXT_FIELDS, key)) return { field: TEXT_FIELDS[key], rest };

  return { rest: value };
};

const parseSource = (value) => {
  const { first, rest } = splitString(value);

  return first && isUrl(first) ? { url: first, name: rest } : { url: undefined, name: value };
};

const exportMedia = async (kind, { client, jid, m, menuManager }) => {
  await menuManager.ensureDefaults(client);

  const { data, error } = menuManager.getMedia(kind);

  if (error) return fail(error);

  await client.message.send(
    jid,
    {
      type: "document",
      media: Buffer.from(JSON.stringify({ [`${kind}-buffer`]: data }, null, 2)),
      mimetype: "application/json",
      fileName: `${kind}-buffer.json`,
    },
    { quote: m },
  );

  return undefined;
};

const setMedia = async (kind, rest, context) => {
  const { client, menuManager } = context;
  const target = rest?.trim();

  if (!target) {
    return menuManager.setMedia(client, kind, { source: await attachedImage(context) });
  }

  if (isUrl(target)) return menuManager.setMedia(client, kind, { source: target });

  return menuManager.setMedia(client, kind, isIndex(target) ? { index: target } : { name: target });
};

const set = async (value, context) => {
  const { kind, field, rest } = parseTarget(value);

  if (kind) return silent(await setMedia(kind, rest, context));
  if (field) return silent(context.menuManager.setText(field, rest?.trim()));

  return fail(NEED_ANY);
};

const get = async (value, context) => {
  const { kind, field } = parseTarget(value);

  if (kind) return exportMedia(kind, context);
  if (field) return context.menuManager.getText(field);

  return fail(NEED_ANY);
};

const del = (value, { menuManager }) => {
  const { kind, field, rest } = parseTarget(value);

  if (kind) return silent(menuManager.removeMedia(kind, rest?.trim()));
  if (field) return silent(menuManager.clearText(field));

  return fail(NEED_ANY);
};

const save = async (value, context) => {
  const { kind, rest } = parseTarget(value);

  if (!kind) return fail(NEED_MEDIA);

  const { url, name } = parseSource(rest);
  const source = url ?? (await attachedImage(context));

  return context.menuManager.saveMedia(kind, { source, name: name?.trim() || undefined });
};

const saved = (value, { menuManager }) => {
  const { kind, field } = parseTarget(value);

  if (field) return fail(NEED_MEDIA);

  return ok(menuManager.formatSaved(kind ? [kind] : undefined));
};

const OWNER_ACTIONS = Object.freeze({ set, get, del, save, saved });

const runOwnerAction = async (handler, value, context) => {
  const { m } = context;

  if (!isOwner(m)) {
    await react(m, FAILURE);

    return m.reply(OWNER_ONLY);
  }

  let result;

  try {
    result = await handler(value, context);
  } catch (err) {
    await react(m, FAILURE);

    return m.reply(buildError(err.message));
  }

  if (result?.error) {
    await react(m, FAILURE);

    return m.reply(result.error);
  }

  await react(m, SUCCESS);

  return result?.data && !result.silent ? m.reply(result.data) : undefined;
};

const browse = (menuManager, positional, prefix) => {
  if (!positional) return menuManager.getMainMenu(prefix);
  if (positional.toLowerCase() === "all") return menuManager.getAllMenu(prefix);

  return menuManager.getCategoryMenu(positional, prefix);
};

export default {
  name: "menu",
  commands: ["menu"],
  categories: ["info"],

  fn: async ({ client, jid, m, prefix, text, menuManager }) => {
    const label = prefix ?? "";

    if (isHelp(text)) return m.reply(buildGuide({ ...GUIDE, prefix: label }));

    const { first, rest } = splitString(text);
    const key = first?.toLowerCase();

    if (key && Object.hasOwn(OWNER_ACTIONS, key)) {
      return runOwnerAction(OWNER_ACTIONS[key], rest, { client, jid, m, menuManager });
    }

    const { data, error } = browse(menuManager, text.trim(), label);

    if (error) return m.reply(error);

    return client.message.send(jid, await menuManager.compose(data, client), { quote: m });
  },
};
