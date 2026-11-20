import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { config } from "../config.js";
import { pluginManager } from "./plugin-manager.js";

const toRelative = (path) => relative(config.paths.root, path).split(sep).join("/");

const PLUGINS_PREFIX = `${toRelative(config.paths.plugins)}/`;

const isPluginFile = (path) => path.startsWith(PLUGINS_PREFIX);

const hashFile = async (path) => {
  try {
    return createHash("sha1")
      .update(await readFile(path))
      .digest("hex");
  } catch {
    return null;
  }
};

const snapshot = async () => {
  const entries = await readdir(config.paths.src, { recursive: true, withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => join(entry.parentPath, entry.name));

  const hashes = await Promise.all(files.map(hashFile));

  return new Map(
    files.flatMap((file, index) => (hashes[index] ? [[toRelative(file), hashes[index]]] : [])),
  );
};

const diff = (before, after) => {
  const changes = [];

  for (const [path, hash] of after) {
    if (!before.has(path)) changes.push({ status: "A", path });
    else if (before.get(path) !== hash) changes.push({ status: "M", path });
  }

  for (const path of before.keys()) {
    if (!after.has(path)) changes.push({ status: "D", path });
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path));
};

class ReloadManager {
  #baseline = new Map();

  async init() {
    this.#baseline = await snapshot();
  }

  async reload() {
    const started = performance.now();
    const current = await snapshot();
    const changes = diff(this.#baseline, current);
    const plugins = await pluginManager.load();

    this.#baseline = this.#commit(current);

    return {
      changes: changes.map((change) => ({ ...change, applied: isPluginFile(change.path) })),
      failures: pluginManager.failures.map(({ path, message }) => ({
        path: toRelative(path),
        message: message.split("\n")[0],
      })),
      plugins: plugins.length,
      elapsed: Math.round(performance.now() - started),
    };
  }

  #commit(current) {
    const next = new Map();

    for (const [path, hash] of this.#baseline) {
      if (!isPluginFile(path)) next.set(path, hash);
    }

    for (const [path, hash] of current) {
      if (isPluginFile(path)) next.set(path, hash);
    }

    return next;
  }
}

export const reloadManager = new ReloadManager();
