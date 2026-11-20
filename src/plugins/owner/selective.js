import { findPushNames } from "../../lib/push-name.js";
import { splitString } from "../../utils/split-string.js";
import { userOf } from "../../utils/user-of.js";

const TO_FLAG = /(?:^|\s)--(?:to|user)(?=\s|$)/i;
const SEPARATOR = /[\s,]+/;

const buildUsage = ({ isActive, isGlobalActive }, jid) =>
  [
    "Usage:",
    "selective --on | --off [--all]",
    "selective --only --set <cmd, cmd> [--to ...]",
    "selective --only --del <cmd, cmd> [--to ...]",
    "selective --only --list [--to]",
    `Current: ${isActive(jid) ? "on" : "off"} (all groups: ${isGlobalActive ? "on" : "off"})`,
  ].join("\n");

const ONLY_USAGE = [
  "Usage:",
  "selective --only --set <cmd, cmd>",
  "selective --only --set <cmd, cmd> --to <number | @mention>",
  "selective --only --set <cmd, cmd> --to (reply a user)",
  "selective --only --del <cmd, cmd> [--to ...]",
  "selective --only --list [--to]",
].join("\n");

const toggle = (single, all) => ({ m, rest, jid, selectiveManager }) => {
  const isAll = rest?.trim().toLowerCase() === "--all";
  const { data, error } = isAll ? all(selectiveManager) : single(selectiveManager, jid);

  return m.reply(data ?? error);
};

const resolveNames = (value, pluginManager) => {
  const commands = (value ?? "").split(SEPARATOR).filter(Boolean);
  const names = new Set();
  const missing = [];

  for (const command of commands) {
    const plugin = pluginManager.get(command.toLowerCase());

    if (plugin) names.add(plugin.name);
    else missing.push(command);
  }

  return { names: [...names], missing, empty: !commands.length };
};

const resolveIds = (text, m) => {
  const ids = new Set();
  const invalid = [];

  for (const token of text.split(SEPARATOR).filter(Boolean)) {
    const id = userOf(token.replace(/^[@+]/, ""));

    if (/^\d+$/.test(id)) ids.add(id);
    else invalid.push(token);
  }

  const replied = userOf(m.q?.key?.participant);

  if (replied) ids.add(replied);

  return { ids: [...ids], invalid };
};

const formatList = ({ onlyList, targetList }, onlyTo, names) => {
  const label = (id) => (names.has(id) ? `${names.get(id)} (@${id})` : `@${id}`);
  const lines = [];

  if (!onlyTo) {
    lines.push("*Selective Only*", ...(onlyList.length ? onlyList.map((n, i) => `${i + 1}. ${n}`) : ["-"]));
  }

  lines.push(
    "*Selective To*",
    ...(targetList.length ? targetList.map(([n, ids]) => `${n}: ${ids.map(label).join(", ")}`) : ["-"]),
  );

  return lines.join("\n");
};

const showList = async ({ m, selectiveManager }, value) => {
  const ids = new Set(selectiveManager.targetList.flatMap(([, targets]) => targets));
  const names = await findPushNames([...ids]);

  return m.reply(formatList(selectiveManager, TO_FLAG.test(value), names));
};

const editList = ({ m, selectiveManager, pluginManager }, isSet, value) => {
  const match = TO_FLAG.exec(value);
  const commandText = match ? value.slice(0, match.index) : value;
  const { names, missing, empty } = resolveNames(commandText, pluginManager);

  if (empty) return m.reply(ONLY_USAGE);
  if (missing.length) return m.reply(`Command not found: ${missing.join(", ")}`);

  if (!match) {
    const { data, error } = isSet
      ? selectiveManager.setOnly(names)
      : selectiveManager.deleteOnly(names);

    return m.reply(data ?? error);
  }

  const { ids, invalid } = resolveIds(value.slice(match.index + match[0].length), m);

  if (invalid.length) return m.reply(`Invalid target: ${invalid.join(", ")}`);
  if (!ids.length) return m.reply("Who? Reply to a user or add numbers / @mentions after --to.");

  const { data, error } = isSet
    ? selectiveManager.setTargets(names, ids)
    : selectiveManager.deleteTargets(names, ids);

  return m.reply(data ?? error);
};

const only = (context) => {
  const { first, rest: value = "" } = splitString(context.rest);
  const flag = first?.toLowerCase();

  if (flag === "--list") return showList(context, value);
  if (flag === "--set" || flag === "--del") return editList(context, flag === "--set", value);

  return context.m.reply(ONLY_USAGE);
};

const ACTIONS = Object.freeze({
  "--on": toggle(
    (manager, jid) => manager.enable(jid),
    (manager) => manager.enableAll(),
  ),
  "--off": toggle(
    (manager, jid) => manager.disable(jid),
    (manager) => manager.disableAll(),
  ),
  "--only": only,
});

export default {
  name: "selective",
  commands: ["selective"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async (context) => {
    const { m, text, jid, selectiveManager } = context;
    const { first, rest } = splitString(text);
    const flag = first?.toLowerCase();

    if (!flag || !Object.hasOwn(ACTIONS, flag)) return m.reply(buildUsage(selectiveManager, jid));

    return ACTIONS[flag]({ ...context, rest });
  },
};
