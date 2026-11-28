// Plugin manager: scans src/plugins/**/*.js, imports each with cache-busting
// (?v=timestamp), validates the plugin shape, and indexes commands.
// Uses Bun.Glob instead of node:fs readdir(recursive) for directory scanning.
// Reload creates fresh module instances; old instances are never garbage
// collected (documented trade-off: memory grows slightly on each reload).

import { PATHS } from "../config/paths.js";
import { logger } from "../core/logger.js";
import { isValidPlugin } from "../lib/plugin-schema.js";

const glob = new Bun.Glob("**/*.js");

class PluginManager {
  #commands = new Map();
  #plugins = [];
  #failures = [];
  #queue = Promise.resolve();

  get array() {
    return this.#plugins;
  }

  get failures() {
    return this.#failures;
  }

  get(command) {
    return this.#commands.get(command);
  }

  // Queue loads so concurrent reload() calls serialize.
  load() {
    const task = this.#queue.then(() => this.#loadAll());

    this.#queue = task.catch((err) => {
      logger.error({ err }, "plugins reload failed");
    });

    return task;
  }

  async #scan() {
    const files = Array.from(glob.scanSync({ cwd: PATHS.plugins })).sort();

    return files.map((file) => new URL(file, `file://${PATHS.plugins}/`).pathname);
  }

  async #import(path, stamp) {
    try {
      // Bun.pathToFileURL converts an absolute path to a file:// URL.
      // The ?v= stamp busts the ESM module cache so the file is re-read.
      const { default: plugin } = await import(
        `${Bun.pathToFileURL(path).href}?v=${stamp}`
      );

      if (!isValidPlugin(plugin)) throw new Error("invalid plugin shape");

      plugin.path = path;

      return plugin;
    } catch (err) {
      logger.error({ err, path }, "plugin load failed");
      this.#failures.push({ path, message: err.message });
      return null;
    }
  }

  #index(plugins) {
    const commands = new Map();

    for (const plugin of plugins) {
      for (const name of plugin.commands) {
        const command = name.toLowerCase();
        const existing = commands.get(command);

        if (existing) {
          logger.warn(
            { command, path: plugin.path, overridden: existing.path },
            "plugin command overridden",
          );
        }

        commands.set(command, plugin);
      }
    }

    return commands;
  }

  async #loadAll() {
    const stamp = Date.now();

    this.#failures = [];

    const paths = await this.#scan();
    const results = await Promise.all(paths.map((path) => this.#import(path, stamp)));
    const plugins = results.filter(Boolean);
    const commands = this.#index(plugins);

    this.#plugins = plugins;
    this.#commands = commands;

    logger.info({ plugins: plugins.length, commands: commands.size }, "plugins loaded");

    return plugins;
  }
}

export const pluginManager = new PluginManager();
