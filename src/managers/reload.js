// Reload manager: snapshots file hashes across src/, diffs against baseline,
// reloads plugins via pluginManager, and reports what changed.
// Plugin files are hashed with Bun.CryptoHasher. The ?v= cache-busting import
// pattern means old module instances are never GC'd (slow memory leak on
// repeated reloads); no better alternative exists in Bun docs, so we document
// the trade-off here and keep the pattern.

import { PATHS } from "../config/paths.js";
import { pluginManager } from "./plugin.js";

const toRelative = (path) =>
  path.startsWith(PATHS.root) ? path.slice(PATHS.root.length + 1) : path;

const PLUGINS_PREFIX = `plugins/`;

const isPluginFile = (path) => path.startsWith(PLUGINS_PREFIX);

const hashFile = async (path) => {
  try {
    const hasher = new Bun.CryptoHasher("sha1");
    hasher.update(await Bun.file(path).arrayBuffer());
    return hasher.digest("hex");
  } catch {
    return null;
  }
};

const snapshot = async () => {
  const files = Array.from(new Bun.Glob("**/*.js").scanSync({ cwd: PATHS.src }));

  const hashes = await Promise.all(files.map(hashFile));

  return new Map(
    files.flatMap((file, index) =>
      hashes[index] ? [[toRelative(file), hashes[index]]] : [],
    ),
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

export class ReloadManager {
  #baseline = new Map();

  async init() {
    this.#baseline = await snapshot();
  }

  async reload() {
    const started = performance.now();
    const current = await snapshot();
    const changes = diff(this.#baseline, current);
    const plugins = await pluginManager.load();

    // Keep non-plugin file hashes in the baseline; replace plugin file hashes
    // with the current snapshot so the next diff is against this reload.
    this.#baseline = this.#commit(current);

    return {
      changes: changes.map((change) => ({
        ...change,
        applied: isPluginFile(change.path),
      })),
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
