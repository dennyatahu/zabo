import { isOwner } from "../lib/jid.js";
import { createSelectiveClient, isSelectiveClient } from "../lib/selective-client.js";
import { menuManager } from "../managers/menu-manager.js";
import { pluginManager } from "../managers/plugin-manager.js";
import { prefixManager } from "../managers/prefix-manager.js";
import { reloadManager } from "../managers/reload-manager.js";
import { restartManager } from "../managers/restart-manager.js";
import { selectiveManager } from "../managers/selective-manager.js";
import { lockManager, selfManager } from "../managers/toggle-manager.js";
import { splitString } from "../utils.js";
import { logger } from "./logger.js";
import { store } from "./store.js";

const managers = {
  lockManager,
  menuManager,
  pluginManager,
  prefixManager,
  reloadManager,
  restartManager,
  selectiveManager,
  selfManager,
};

const findPlugin = (input) => {
  const { first, rest } = splitString(input);
  const command = first?.toLowerCase();
  const plugin = command ? pluginManager.get(command) : undefined;

  return plugin ? { plugin, command, rest } : undefined;
};

const match = (text) => {
  const resolved = prefixManager.resolve(text);

  if (resolved.ok) {
    const found = resolved.string ? findPlugin(resolved.string) : undefined;
    return found && { ...found, prefix: resolved.prefix };
  }

  const found = findPlugin(text);
  return found?.plugin.options?.bypassPrefix ? { ...found, prefix: undefined } : undefined;
};

const isAllowed = (m, plugin) => {
  if (lockManager.isActive) return Boolean(plugin.options?.lockBypass) && isOwner(m);

  if (!plugin.ownerOnly && !selfManager.isActive) return true;

  return isOwner(m);
};

const useSelective = (m, targets) => {
  if (!m.key.isGroup || isSelectiveClient(m.client)) return;

  const client = createSelectiveClient(m.client, m.key, targets);

  m.client = client;

  if (m.q) m.q.client = client;
};

const createContext = (m, { plugin, command, prefix, rest }) => {
  const jid = m.key.remoteJid;

  return {
    ...managers,
    client: m.client,
    m,
    q: m.q,
    jid,
    store,
    command,
    prefix,
    text: rest ?? "",
    args: rest ? rest.split(/\s+/) : [],
  };
};

const run = async (m, found, { selective, targets }) => {
  try {
    if (selective) useSelective(m, targets);

    await found.plugin.fn(createContext(m, found));
  } catch (error) {
    logger.error({ err: error, plugin: found.plugin.name, command: found.command }, "plugin failed");
  }
};

export const dispatch = async (m) => {
  if (typeof m.text !== "string" || !m.text) return;
  if (m.key.isNewsletter || m.key.isBroadcast) return;

  const found = match(m.text);
  if (!found) return;

  if (!isAllowed(m, found.plugin)) return;

  await run(m, found, {
    selective: selectiveManager.shouldUse(m.key.remoteJid, found.plugin.name),
    targets: selectiveManager.targetsOf(found.plugin.name),
  });
};
