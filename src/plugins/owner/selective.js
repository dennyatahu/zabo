import { findPushNames } from "../../lib/push-name.js";
import { buildError, buildGuide, isHelp } from "../../utils/guide.js";
import { splitString } from "../../utils/split-string.js";
import { userOf } from "../../utils/user-of.js";

const SEPARATOR = /[\s,]+/;
const USER_TOKEN = /^(?:[@+]\d+|\d{5,})$/;

const GUIDE = {
  title: "Selective",
  summary: "Make bot replies visible only to the command sender, or to chosen users.",
  groups: [
    {
      rows: [
        ["selective", "Show the status and the selective lists."],
        ["selective on | off", "Turn selective mode on or off in this group."],
        ["selective on | off all", "Turn selective mode on or off in every group."],
        ["selective + <cmd, cmd>", "Always reply selectively to these commands."],
        ["selective + <cmd, cmd> <@user | number>", "Also send those replies to the given users."],
        ["selective - <cmd, cmd>", "Remove commands from the selective list."],
        ["selective - <cmd, cmd> <@user | number>", "Remove only the given users from those commands."],
      ],
    },
  ],
  examples: ["selective on", "selective + ping, uptime", "selective + ping @mention", "selective - ping"],
  notes: [
    "Reply to a user's message to target that user.",
    "Commands and users can be separated by spaces or commas.",
    "Selective mode only works in groups.",
  ],
};

const usageError = (message) => buildError(message, "selective");

const label = (id, names) => (names.has(id) ? `${names.get(id)} (@${id})` : `@${id}`);

const formatOverview = ({ isActive, isGlobalActive, onlyList, targetList }, jid, names) => {
  const only = onlyList.length
    ? onlyList.map((name, index) => `  ${index + 1}. ${name}`).join("\n")
    : "  -";
  const targets = targetList.length
    ? targetList
        .map(([name, ids]) =>
          [`  ▸ ${name}`, ...ids.map((id) => `    • ${label(id, names)}`)].join("\n"),
        )
        .join("\n\n")
    : "  -";

  return [
    "*Selective*",
    `▸ Status: ${isActive(jid) ? "on" : "off"}`,
    `▸ All groups: ${isGlobalActive ? "on" : "off"}`,
    "",
    `*Only* (${onlyList.length})`,
    only,
    "",
    `*Targets* (${targetList.length})`,
    targets,
  ].join("\n");
};

const overview = async ({ m, jid, selectiveManager }) => {
  const ids = new Set(selectiveManager.targetList.flatMap(([, targets]) => targets));
  const names = await findPushNames([...ids]);

  return m.reply(formatOverview(selectiveManager, jid, names));
};

const toggle = (single, all) => ({ m, jid, value, selectiveManager }) => {
  const scope = splitString(value).first?.toLowerCase();

  if (scope && scope !== "all") return m.reply(usageError(`Unknown option \`${scope}\`.`));

  const { data, error } = scope ? all(selectiveManager) : single(selectiveManager, jid);

  return m.reply(data ?? usageError(error));
};

const splitTokens = (value) => {
  const commands = [];
  const users = [];

  for (const token of (value ?? "").split(SEPARATOR).filter(Boolean)) {
    (USER_TOKEN.test(token) ? users : commands).push(token);
  }

  return { commands, users };
};

const resolveNames = (commands, pluginManager) => {
  const names = new Set();
  const missing = [];

  for (const command of commands) {
    const plugin = pluginManager.get(command.toLowerCase());

    if (plugin) names.add(plugin.name);
    else missing.push(command);
  }

  return { names: [...names], missing };
};

const resolveIds = (tokens, q) => {
  const ids = new Set(tokens.map((token) => userOf(token.replace(/^[@+]/, ""))));
  const replied = q?.key?.fromMe ? undefined : userOf(q?.key?.participant);

  if (replied) ids.add(replied);

  return [...ids];
};

const edit = (isAdd) => ({ m, q, value, selectiveManager, pluginManager }) => {
  const { commands, users } = splitTokens(value);

  if (!commands.length) return m.reply(usageError("Specify at least one command."));

  const { names, missing } = resolveNames(commands, pluginManager);

  if (missing.length) return m.reply(usageError(`Command not found: ${missing.join(", ")}.`));

  const ids = resolveIds(users, q);

  const { data, error } = ids.length
    ? isAdd
      ? selectiveManager.setTargets(names, ids)
      : selectiveManager.deleteTargets(names, ids)
    : isAdd
      ? selectiveManager.setOnly(names)
      : selectiveManager.deleteOnly(names);

  return m.reply(data ?? usageError(error));
};

const ACTIONS = Object.freeze({
  on: toggle(
    (manager, jid) => manager.enable(jid),
    (manager) => manager.enableAll(),
  ),
  off: toggle(
    (manager, jid) => manager.disable(jid),
    (manager) => manager.disableAll(),
  ),
  "+": edit(true),
  "-": edit(false),
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
    const { m, text } = context;

    if (isHelp(text)) return m.reply(buildGuide(GUIDE));

    const { first, rest } = splitString(text);

    if (first === undefined) return overview(context);

    const key = first.toLowerCase();

    if (!Object.hasOwn(ACTIONS, key)) {
      return m.reply(usageError(`Unknown option \`${first}\`.`));
    }

    return ACTIONS[key]({ ...context, value: rest });
  },
};
