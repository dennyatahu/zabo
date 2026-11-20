import { isOwner } from "../../lib/owner.js";
import { parseFlags } from "../../utils/parse-flags.js";
import { fail, ok } from "../../utils/result.js";

const ACTIONS = Object.freeze(["set", "get", "del", "save"]);
const MEDIA_KINDS = Object.freeze(["thumbnail", "favicon"]);
const IMAGE_CONTENT = "imageMessage";
const THUMBNAIL_FILE = "thumbnail-buffer.json";
const OWNER_ONLY = "*Owner Only*\n▸ Only the owner can use this option.";
const SUCCESS = "✅";
const FAILURE = "❌";
const SILENT_ACTIONS = new Set(["set", "del"]);

const TEXT_FLAGS = Object.freeze({
  url: "url",
  title: "title",
  desc: "description",
  description: "description",
});

const react = (m, emoji) => Promise.resolve(m.react(emoji)).catch(() => undefined);

const buildHelp = (prefix) => {
  const row = (command) => `▸ ${prefix}${command}`;

  return [
    "*Menu Guide*",
    row("menu"),
    row("menu <category>"),
    row("menu all"),
    "",
    "*Owner Only*",
    row("menu --set --thumbnail <url>"),
    row("menu --set --thumbnail (reply to an image, or send it with this caption)"),
    row("menu --set --thumbnail --name <text>"),
    row("menu --set --thumbnail --index <number>"),
    row("menu --set --favicon <url>"),
    row("menu --set --favicon --name <text> | --index <number>"),
    row("menu --set --url <url>"),
    row("menu --set --title <text>"),
    row("menu --set --desc <text>"),
    "",
    row("menu --get --thumbnail"),
    row("menu --get --url"),
    row("menu --get --title"),
    row("menu --get --desc"),
    "",
    row("menu --del --url"),
    row("menu --del --title"),
    row("menu --del --desc"),
    row("menu --del --thumbnail <index | name>"),
    row("menu --del --favicon <index | name>"),
    "",
    row("menu --save --thumbnail <url> --name <text>"),
    row("menu --save --thumbnail --name <text> (reply to an image, or use it as the caption)"),
    row("menu --save --favicon <url> --name <text>"),
    row("menu --save --list [--thumbnail | --favicon]"),
  ].join("\n");
};

const findKind = (flags) => MEDIA_KINDS.find((kind) => flags.has(kind));

const findText = (flags) => {
  const flag = Object.keys(TEXT_FLAGS).find((key) => flags.has(key));

  return flag ? { field: TEXT_FLAGS[flag], value: flags.get(flag) } : undefined;
};

const readSource = async (kind, { flags, m }, allowImplicit) => {
  const value = flags.get(kind);

  if (value) return value;
  if (kind !== "thumbnail" || !allowImplicit) return undefined;

  const target = [m, m.q].find((item) => item?.content === IMAGE_CONTENT);

  return target?.download("buffer");
};

const unknownOption = ({ prefix }) => fail(`Unknown option. Send \`${prefix}menu --help\`.`);

const handleSet = async (context) => {
  const { client, flags, menuManager } = context;
  const kind = findKind(flags);

  if (kind) {
    const hasRef = flags.has("name") || flags.has("index");
    const source = await readSource(kind, context, !hasRef);

    return menuManager.setMedia(client, kind, {
      source,
      name: flags.get("name"),
      index: flags.get("index"),
    });
  }

  const text = findText(flags);

  return text ? menuManager.setText(text.field, text.value) : unknownOption(context);
};

const handleGet = async (context) => {
  const { client, jid, m, flags, menuManager } = context;

  if (flags.has("thumbnail")) {
    const { data, error } = menuManager.getThumbnail();

    if (error) return fail(error);

    await client.message.send(
      jid,
      {
        type: "document",
        media: Buffer.from(JSON.stringify({ "thumbnail-buffer": data }, null, 2)),
        mimetype: "application/json",
        fileName: THUMBNAIL_FILE,
      },
      { quote: m },
    );

    return undefined;
  }

  const text = findText(flags);

  return text ? menuManager.getText(text.field) : unknownOption(context);
};

const handleDel = async (context) => {
  const { flags, menuManager } = context;
  const kind = findKind(flags);

  if (kind) return menuManager.removeMedia(kind, flags.get(kind));

  const text = findText(flags);

  return text ? menuManager.clearText(text.field) : unknownOption(context);
};

const handleSave = async (context) => {
  const { flags, menuManager } = context;
  const kind = findKind(flags);

  if (flags.has("list")) return ok(menuManager.formatSaved(kind ? [kind] : undefined));

  if (!kind) return unknownOption(context);

  const source = await readSource(kind, context, true);

  return menuManager.saveMedia(kind, { source, name: flags.get("name") });
};

const HANDLERS = Object.freeze({
  set: handleSet,
  get: handleGet,
  del: handleDel,
  save: handleSave,
});

const runOwnerAction = async (action, context) => {
  const { m } = context;

  if (!isOwner(m)) {
    await react(m, FAILURE);

    return m.reply(OWNER_ONLY);
  }

  let result;

  try {
    result = await HANDLERS[action](context);
  } catch (err) {
    await react(m, FAILURE);

    return m.reply(`*Error*\n▸ ${err.message}`);
  }

  if (result?.error) {
    await react(m, FAILURE);

    return m.reply(result.error);
  }

  await react(m, SUCCESS);

  return result && !SILENT_ACTIONS.has(action) ? m.reply(result.data) : undefined;
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
    const { positional, flags } = parseFlags(text);

    if (flags.has("help") || flags.has("h")) return m.reply(buildHelp(label));

    const action = ACTIONS.find((name) => flags.has(name));

    if (action) {
      return runOwnerAction(action, { client, jid, m, flags, prefix: label, menuManager });
    }

    if (flags.size) return m.reply(buildHelp(label));

    const { data, error } = browse(menuManager, positional, label);

    if (error) return m.reply(error);

    return client.message.send(jid, menuManager.compose(data), { quote: m });
  },
};
