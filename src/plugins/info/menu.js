import { isOwner } from "../../lib/owner.js";
import { buildError, buildGuide, isHelp } from "../../utils/guide.js";
import { fail, ok } from "../../utils/result.js";
import { splitString } from "../../utils/split-string.js";

const IMAGE_CONTENT = "imageMessage";
const OWNER_ONLY = "*Owner Only*\n▸ Only the owner can use this option.";
const SUCCESS = "✅";
const FAILURE = "❌";

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
        ["menu thumb", "Export the current thumbnail data."],
        ["menu thumb <url>", "Set the thumbnail from a link."],
        ["menu thumb (reply or attach an image)", "Set the thumbnail from that image."],
        ["menu thumb <name | number>", "Use a saved thumbnail."],
        ["menu thumb save [url] [name]", "Save a link or an image to the library."],
        ["menu thumb list", "List the saved thumbnails."],
        ["menu thumb - <name | number>", "Delete a saved thumbnail."],
        ["menu fav ...", "Same options for the favicon."],
      ],
    },
    {
      heading: "Owner Only: Text",
      rows: [
        ["menu url | title | desc", "Show the current value."],
        ["menu url | title | desc <value>", "Set the value."],
        ["menu url | title | desc -", "Clear the value."],
      ],
    },
  ],
  examples: [
    "menu info",
    "menu thumb https://example.com/image.jpg",
    "menu thumb save beach",
    "menu thumb beach",
    "menu title My Bot",
  ],
  notes: [
    "thumb and fav are short for thumbnail and favicon.",
    "Saved names can't be a number, save, list, or a link.",
  ],
};

const react = (m, emoji) => Promise.resolve(m.react(emoji)).catch(() => undefined);

const silent = (result) => ({ ...result, silent: true });

const isUrl = (value) => /^https?:\/\//i.test(value);

const isIndex = (value) => /^\d+$/.test(value);

const attachedImage = ({ m }) => {
  const target = [m, m.q].find((item) => item?.content === IMAGE_CONTENT);

  return target?.download("buffer");
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

const saveMedia = async (kind, value, context) => {
  const { url, name } = parseSource(value);
  const source = url ?? (await attachedImage(context));

  return context.menuManager.saveMedia(kind, { source, name: name?.trim() || undefined });
};

const useMedia = async (kind, target, context) => {
  const { client, menuManager } = context;

  if (target) {
    const options = isUrl(target)
      ? { source: target }
      : isIndex(target)
        ? { index: target }
        : { name: target };

    return silent(await menuManager.setMedia(client, kind, options));
  }

  const source = await attachedImage(context);

  if (source) return silent(await menuManager.setMedia(client, kind, { source }));

  return exportMedia(kind, context);
};

const mediaCommand = (kind) => async (value, context) => {
  const { first, rest } = splitString(value);
  const head = first?.toLowerCase();

  if (head === "list") return ok(context.menuManager.formatSaved([kind]));
  if (head === "save") return saveMedia(kind, rest, context);
  if (head === "-") return silent(context.menuManager.removeMedia(kind, rest?.trim()));

  return useMedia(kind, value?.trim(), context);
};

const textCommand = (field) => (value, { menuManager }) => {
  const target = value?.trim();

  if (!target) return menuManager.getText(field);
  if (target === "-") return silent(menuManager.clearText(field));

  return silent(menuManager.setText(field, target));
};

const OWNER_COMMANDS = Object.freeze({
  thumb: mediaCommand("thumbnail"),
  thumbnail: mediaCommand("thumbnail"),
  fav: mediaCommand("favicon"),
  favicon: mediaCommand("favicon"),
  url: textCommand("url"),
  title: textCommand("title"),
  desc: textCommand("description"),
  description: textCommand("description"),
});

const runOwnerCommand = async (handler, value, context) => {
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

    if (key && Object.hasOwn(OWNER_COMMANDS, key)) {
      return runOwnerCommand(OWNER_COMMANDS[key], rest, { client, jid, m, menuManager });
    }

    const { data, error } = browse(menuManager, text.trim(), label);

    if (error) return m.reply(error);

    return client.message.send(jid, await menuManager.compose(data, client), { quote: m });
  },
};
