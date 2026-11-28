// Plugin plugin: add, remove, list, and export plugin files from chat.
// Reads/writes files under src/plugins/<category>/<name>.js (contract: fixed location).
// Owner-only, bypassPrefix.

import { unwrapMessage } from "zapo-js";

import { PATHS } from "../../config/paths.js";
import { buildError, buildGuide, isHelp } from "../../lib/guide.js";
import { splitString } from "../../lib/split-string.js";

const PLUGINS_DIR = PATHS.plugins;
const SAFE_NAME = /[^a-zA-Z0-9._-]/g;

const GUIDE = {
  title: "Plugin",
  summary: "Add, remove, list, and export plugin files.",
  groups: [
    {
      rows: [
        ["plugin list", "List all plugin files and their commands."],
        ["plugin add [name]", "Save a plugin from the replied code or file."],
        ["plugin del <cmd>", "Delete the plugin that owns a command."],
        ["plugin get <cmd>", "Send the plugin file."],
        ["plugin get <cmd> -t", "Send the plugin code as a message."],
      ],
    },
  ],
  examples: ["plugin add ping", "plugin del ping", "plugin get ping -t"],
  notes: [
    "Reply to a message with the code, or to a .js file, when adding.",
    "Without a name, the file name is used. The folder comes from the plugin category.",
    "A plugin marked with ! failed to load.",
  ],
};

const clean = (value) => String(value ?? "").trim().replace(SAFE_NAME, "_");

const fileName = (value) => {
  const name = clean(basename(String(value ?? "")));

  if (!name || /^\.+$/.test(name)) return undefined;

  return name.toLowerCase().endsWith(".js") ? name : `${name}.js`;
};

const basename = (path) => path.split(/[/\\]/).pop();

const listValues = (source, field) => {
  const match = source.match(new RegExp(`\\b${field}\\s*:\\s*\\[([^\\]]*)\\]`));
  return match ? [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((item) => item[1]) : [];
};

const targetDir = (source) => {
  for (const category of listValues(source, "categories")) {
    const dir = clean(category).replace(/^\.+/, "").toLowerCase();

    if (dir && !/^\.+$/.test(dir)) return dir;
  }

  return undefined;
};

const pluginFiles = async () => {
  const glob = new Bun.Glob("plugins/**/*.js");
  const files = Array.from(glob.scanSync({ cwd: PATHS.src })).sort();

  return files.map((file) => new URL(file, `file://${PATHS.src}/`).pathname);
};

const locate = async (command, pluginManager) => {
  const key = String(command ?? "").trim().toLowerCase();

  if (!key) return undefined;

  const loaded = pluginManager.get(key);

  if (loaded?.path) return { path: loaded.path, name: basename(loaded.path) };

  for (const path of await pluginFiles()) {
    const source = await Bun.file(path).text();

    if (listValues(source, "commands").some((value) => value.toLowerCase() === key)) {
      return { path, name: basename(path) };
    }
  }

  return undefined;
};

const readSource = async (q) => {
  const document = q?.message ? unwrapMessage(q.message)?.documentMessage : undefined;

  if (document) {
    return {
      source: (await q.download("buffer")).toString("utf8"),
      suggested: document.fileName,
    };
  }

  const source = q?.text?.trim();

  if (!source) throw new Error("Reply to a message containing the plugin code or a plugin file.");

  return { source, suggested: undefined };
};

const add = async ({ value, q, reloadManager }) => {
  const { source, suggested } = await readSource(q);
  const name = fileName(splitString(value).first || suggested);
  const dir = targetDir(source);

  if (!name) throw new Error("Provide a valid file name.");
  if (!dir) throw new Error("No valid category found in the plugin code.");

  // Bun.write creates parent directories automatically.
  await Bun.write(`${PLUGINS_DIR}/${dir}/${name}`, source);

  const report = await reloadManager.reload();
  const failed = report.failures.find((item) => item.path.endsWith(`/${dir}/${name}`));
  const path = `plugins/${dir}/${name}`;

  return failed ? `▸ Saved: ${path}\n▸ Load failed: ${failed.message}` : `▸ Saved: ${path}`;
};

const del = async ({ value, pluginManager, reloadManager }) => {
  const command = splitString(value).first;

  if (!command) throw new Error("Specify the command of the plugin to delete.");

  const found = await locate(command, pluginManager);

  if (!found) throw new Error(`No plugin found for command \`${command}\`.`);

  await Bun.file(found.path).delete();
  await reloadManager.reload();

  const relativePath = found.path.slice(PLUGINS_DIR.length + 1).split(/[/\\]/).join("/");

  return `▸ Deleted: ${relativePath}`;
};

const list = async ({ pluginManager }) => {
  const grouped = new Map();

  for (const path of await pluginFiles()) {
    const parts = path.slice(PLUGINS_DIR.length + 1).split(/[/\\]/);
    const dir = parts.shift();
    const name = parts.join("/");
    const source = await Bun.file(path).text();
    const loaded = pluginManager.array.find((plugin) => plugin.path === path);
    const commands = loaded?.commands ?? listValues(source, "commands");
    const entries = grouped.get(dir) ?? [];

    entries.push({ name, commands, loaded: Boolean(loaded) });
    grouped.set(dir, entries);
  }

  const lines = ["*Plugins*"];

  for (const [dir, entries] of grouped) {
    lines.push(`▸ ${dir}/`);

    entries.forEach((entry, index) => {
      const branch = index === entries.length - 1 ? "└─" : "├─";
      const commands = entry.commands.length ? ` [${entry.commands.join(", ")}]` : "";
      const marker = entry.loaded ? "" : " !";

      lines.push(`  ${branch} ${entry.name}${commands}${marker}`);
    });
  }

  return lines.join("\n");
};

const isTextFlag = (token) => token.toLowerCase() === "-t";

const get = async ({ value, pluginManager }) => {
  const tokens = String(value ?? "").split(/\s+/).filter(Boolean);
  const asText = tokens.some(isTextFlag);
  const command = tokens.find((token) => !isTextFlag(token));

  if (!command) throw new Error("Specify the command of the plugin to get.");

  const found = await locate(command, pluginManager);

  if (!found) throw new Error(`No plugin found for command \`${command}\`.`);

  const source = await Bun.file(found.path).text();

  if (asText) return source;

  return {
    type: "document",
    media: Buffer.from(source, "utf8"),
    mimetype: "text/javascript",
    fileName: found.name,
  };
};

const ACTIONS = Object.freeze({ add, del, list, get });

export default {
  name: "plugin",
  commands: ["plugin"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async (ctx) => {
    const { m, text } = ctx;

    if (!text || isHelp(text)) return m.reply(buildGuide(GUIDE));

    const { first, rest } = splitString(text);
    const key = first.toLowerCase();

    if (!Object.hasOwn(ACTIONS, key)) {
      return m.reply(buildError(`Unknown option \`${first}\`.`, "plugin"));
    }

    try {
      const result = await ACTIONS[key]({ ...ctx, value: rest });

      return result ? m.reply(result) : undefined;
    } catch (err) {
      return m.reply(buildError(err.message));
    }
  },
};
