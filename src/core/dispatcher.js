// Matches an incoming WhatsApp message to a plugin and runs it.
// Handles prefix resolution, owner/self/lock gating, and selective reply mode.
// All managers are injected into the plugin context (contract preserved).

import { isOwner } from "../lib/jid.js";
import { createSelectiveClient, isSelectiveClient } from "../lib/selective/client.js";
import { menuManager } from "../managers/menu/index.js";
import { pluginManager } from "../managers/plugin.js";
import { prefixManager } from "../managers/prefix.js";
import { reloadManager } from "../managers/reload.js";
import { restartManager } from "../managers/restart.js";
import { selectiveManager } from "../managers/selective.js";
import { lockManager, selfManager } from "../managers/toggle.js";
import { splitString } from "../lib/split-string.js";
import { logger } from "./logger.js";
import { store } from "./store.js";

const managers = Object.freeze({
  lockManager,
  menuManager,
  pluginManager,
  prefixManager,
  reloadManager,
  restartManager,
  selectiveManager,
  selfManager,
});

// Parse "command rest" from text. Returns { plugin, command, rest } or undefined.
const findPlugin = (input) => {
  const { first, rest } = splitString(input);
  const command = first?.toLowerCase();
  const plugin = command ? pluginManager.get(command) : undefined;
  return plugin ? { plugin, command, rest } : undefined;
};

// Resolve whether text matches a plugin command, considering prefix and bypassPrefix.
const match = (text) => {
  const resolved = prefixManager.resolve(text);

  if (resolved.ok) {
    const found = resolved.string ? findPlugin(resolved.string) : undefined;
    return found && { ...found, prefix: resolved.prefix };
  }

  const found = findPlugin(text);
  return found?.plugin.options?.bypassPrefix ? { ...found, prefix: undefined } : undefined;
};

// Gate: lock mode restricts to lockBypass plugins + owner; self mode restricts to owner.
// Non-owner, non-locked, non-self: allowed.
const isAllowed = (m, plugin) => {
  if (lockManager.isActive) return Boolean(plugin.options?.lockBypass) && isOwner(m);

  if (!plugin.ownerOnly && !selfManager.isActive) return true;

  return isOwner(m);
};

// Replace m.client with a selective client so replies go only to chosen targets.
const useSelective = (m, targets) => {
  if (!m.key.isGroup || isSelectiveClient(m.client)) return;

  const client = createSelectiveClient(m.client, m.key, targets);

  m.client = client;
  if (m.q) m.q.client = client;
};

// Build the plugin context object (contract: m, q, text, args, client, jid, store,
// prefix, command, plus every manager).
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

// Run a plugin's fn, catching errors so one bad plugin does not kill the session.
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
