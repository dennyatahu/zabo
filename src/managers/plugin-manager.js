import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { isValidPlugin } from "../utils/is-valid-plugin.js";

class PluginManager {
  #commands = new Map();
  #plugins = [];
  #queue = Promise.resolve();

  get map() {
    return this.#commands;
  }

  get array() {
    return this.#plugins;
  }

  get(command) {
    return this.#commands.get(command);
  }

  load() {
    const task = this.#queue.then(() => this.#loadAll());

    this.#queue = task.catch((err) => {
      logger.error({ err }, "plugins reload failed");
    });

    return task;
  }

  async #scan() {
    const files = await readdir(config.paths.plugins, { recursive: true });

    return files
      .filter((file) => file.endsWith(".js"))
      .sort()
      .map((file) => join(config.paths.plugins, file));
  }

  async #import(path, stamp) {
    try {
      const { default: plugin } = await import(`${pathToFileURL(path).href}?v=${stamp}`);

      if (!isValidPlugin(plugin)) throw new Error("invalid plugin shape");

      plugin.path = path;

      return plugin;
    } catch (err) {
      logger.error({ err, path }, "plugin load failed");

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
