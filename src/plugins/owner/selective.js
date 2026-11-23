import { userOf } from "../../lib/jid.js";
import { findPushNames } from "../../lib/push-name.js";
import { buildError, buildGuide, isHelp, splitString } from "../../utils.js";

const SEPARATOR = /[\s,]+/;
const USER_TOKEN = /^(?:[@+]\d+|\d{5,})$/;

const GUIDE = {
  title: "Selective",
  summary: "Make bot replies visible only to the command sender, or to chosen users.",
  groups: [
    {
      rows: [
        ["selective list", "Show the status and the selective lists."],
        ["selective on | off", "Turn selective mode on or off in this group."],
        ["selective on | off all", "Turn selective mode on or off in every group."],
        ["selective only <cmd, cmd>", "Always reply selectively to these commands."],
        ["selective only del <cmd, cmd>", "Remove commands from the selective list."],
        ["selective to <cmd, cmd> <@user | number>", "Also send those replies to the given users."],
        ["selective to del <cmd, cmd> <@user | number>", "Remove those users from the commands."],
      ],
    },
  ],
  examples: [
    "selective on",
    "selective only ping, uptime",
    "selective to ping @mention",
    "selective only del ping",
  ],
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

const list = async ({ m, jid, selectiveManager }) => {
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

const tokensOf = (value) => (value ?? "").split(SEPARATOR).filter(Boolean);

const resolveCommands = (tokens, pluginManager) => {
  if (!tokens.length) return { error: "Specify at least one command." };

  const names = new Set();
  const missing = [];

  for (const token of tokens) {
    const plugin = pluginManager.get(token.toLowerCase());

    if (plugin) names.add(plugin.name);
    else missing.push(token);
  }

  return missing.length
    ? { error: `Command not found: ${missing.join(", ")}.` }
    : { names: [...names] };
};

const resolveIds = (tokens, q) => {
  const ids = new Set(tokens.map((token) => userOf(token.replace(/^[@+]/, ""))));
  const replied = q?.key?.fromMe ? undefined : userOf(q?.key?.participant);

  if (replied) ids.add(replied);

  return [...ids];
};

const splitDelete = (value) => {
  const { first, rest } = splitString(value);

  return first?.toLowerCase() === "del"
    ? { isDelete: true, value: rest }
    : { isDelete: false, value };
};

const only = ({ m, value, selectiveManager, pluginManager }) => {
  const { isDelete, value: body } = splitDelete(value);
  const { names, error } = resolveCommands(tokensOf(body), pluginManager);

  if (error) return m.reply(usageError(error));

  const result = isDelete ? selectiveManager.deleteOnly(names) : selectiveManager.setOnly(names);

  return m.reply(result.data ?? usageError(result.error));
};

const to = ({ m, q, value, selectiveManager, pluginManager }) => {
  const { isDelete, value: body } = splitDelete(value);
  const tokens = tokensOf(body);
  const users = tokens.filter((token) => USER_TOKEN.test(token));
  const { names, error } = resolveCommands(
    tokens.filter((token) => !USER_TOKEN.test(token)),
    pluginManager,
  );

  if (error) return m.reply(usageError(error));

  const ids = resolveIds(users, q);

  if (!ids.length) return m.reply(usageError("Specify at least one user: @mention, number, or reply."));

  const result = isDelete
    ? selectiveManager.deleteTargets(names, ids)
    : selectiveManager.setTargets(names, ids);

  return m.reply(result.data ?? usageError(result.error));
};

const ACTIONS = Object.freeze({
  list,
  on: toggle(
    (manager, jid) => manager.enable(jid),
    (manager) => manager.enableAll(),
  ),
  off: toggle(
    (manager, jid) => manager.disable(jid),
    (manager) => manager.disableAll(),
  ),
  only,
  to,
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

    if (!text || isHelp(text)) return m.reply(buildGuide(GUIDE));

    const { first, rest } = splitString(text);
    const key = first.toLowerCase();

    if (!Object.hasOwn(ACTIONS, key)) {
      return m.reply(usageError(`Unknown option \`${first}\`.`));
    }

    return ACTIONS[key]({ ...context, value: rest });
  },
};
