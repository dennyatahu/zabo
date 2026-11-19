import { store } from "./store.js";
import { logger } from "./logger.js";
import { isOwner } from "../lib/owner.js";
import { pluginManager } from "../managers/plugin-manager.js";
import { prefixManager } from "../managers/prefix-manager.js";
import { selfManager } from "../managers/self-manager.js";
import { splitString } from "../utils/split-string.js";

const managers = {
  pluginManager,
  prefixManager,
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
  if (!plugin.ownerOnly && !selfManager.isActive) return true;

  return isOwner(m);
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

export const dispatch = async (m) => {
  if (typeof m.text !== "string" || !m.text) return;
  if (m.key.isNewsletter || m.key.isBroadcast) return;

  const found = match(m.text);
  if (!found) return;

  if (!isAllowed(m, found.plugin)) return;

  try {
    await found.plugin.fn(createContext(m, found));
  } catch (error) {
    logger.error({ err: error, plugin: found.plugin.name, command: found.command }, "plugin failed");
  }
};
