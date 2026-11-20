import { db, getSetting, setSetting, transaction } from "../core/database.js";
import { fail, ok } from "../utils/result.js";
import { pluginManager } from "./plugin-manager.js";

const DEFAULT_PREFIXES = Object.freeze(["."]);

const MESSAGES = Object.freeze({
  ENABLED: "Prefix is on.",
  DISABLED: "Prefix is off.",
  ALREADY_ENABLED: "Prefix is already on.",
  ALREADY_DISABLED: "Prefix is already off.",
  EMPTY: "Prefix can't be empty.",
  EXISTS: "Prefix already exists.",
  NOT_FOUND: "Prefix not found.",
  LAST_PREFIX: "You can't delete the last prefix.",
  INVALID_INDEX: "Invalid number. Start from 1.",
  RESET: "Prefix list was reset.",
});

const isValidPrefix = (value) => typeof value === "string" && value.length > 0;

class PrefixManager {
  #prefixes = [...DEFAULT_PREFIXES];
  #active = false;

  init() {
    const rows = db.prepare("SELECT value FROM prefixes ORDER BY position").all();
    const prefixes = rows.map(({ value }) => value).filter(isValidPrefix);

    this.#active = getSetting("prefix_mode");
    this.#prefixes = prefixes.length ? prefixes : [...DEFAULT_PREFIXES];

    if (!prefixes.length) this.#persist();
  }

  getConfig = () => ({
    isActive: this.#active,
    prefixList: [...this.#prefixes],
  });

  resolve = (input) => {
    if (!isValidPrefix(input)) {
      return { ok: false, prefix: undefined, string: undefined };
    }

    if (!this.#active) {
      return { ok: true, prefix: undefined, string: input };
    }

    const prefix = this.#prefixes
      .filter((item) => input.startsWith(item))
      .reduce(
        (longest, item) => (item.length > (longest?.length ?? 0) ? item : longest),
        undefined,
      );

    if (!prefix) {
      return { ok: false, prefix: undefined, string: input };
    }

    return { ok: true, prefix, string: input.slice(prefix.length) || undefined };
  };

  enablePrefix = () => this.#setActive(true);

  disablePrefix = () => this.#setActive(false);

  addPrefix = (value) => {
    const { prefix, error } = this.#normalize(value);
    if (error) return fail(error);

    const plugin = pluginManager.get(prefix);
    if (plugin?.options?.bypassPrefix) {
      return fail(
        `Prefix \`${prefix}\` is already used by the \`${plugin.name}\` plugin (bypassPrefix).`,
      );
    }

    if (this.#prefixes.includes(prefix)) return fail(MESSAGES.EXISTS);

    this.#prefixes.push(prefix);
    this.#persist();

    return ok(`Prefix \`${prefix}\` added.`);
  };

  deletePrefix = (value) => {
    const { prefix, error } = this.#normalize(value);
    if (error) return fail(error);

    if (this.#prefixes.length <= 1) return fail(MESSAGES.LAST_PREFIX);

    const { index, error: indexError } = this.#findIndex(prefix);
    if (indexError) return fail(indexError);

    const [removed] = this.#prefixes.splice(index, 1);
    this.#persist();

    return ok(`Prefix \`${removed}\` deleted.`);
  };

  resetPrefix = () => {
    this.#prefixes = [...DEFAULT_PREFIXES];
    this.#persist();

    return ok(MESSAGES.RESET);
  };

  #setActive(active) {
    if (this.#active === active) {
      return fail(active ? MESSAGES.ALREADY_ENABLED : MESSAGES.ALREADY_DISABLED);
    }

    this.#active = active;
    setSetting("prefix_mode", active);

    return ok(active ? MESSAGES.ENABLED : MESSAGES.DISABLED);
  }

  #normalize(value) {
    if (typeof value !== "string") {
      return fail(`Prefix must be a string, received \`${typeof value}\`.`);
    }

    const prefix = value.trim();
    return prefix ? { prefix } : fail(MESSAGES.EMPTY);
  }

  #findIndex(value) {
    const index = this.#prefixes.indexOf(value);
    if (index !== -1) return { index };

    if (!/^\d+$/.test(value)) return fail(MESSAGES.NOT_FOUND);

    const position = Number(value);
    if (position < 1) return fail(MESSAGES.INVALID_INDEX);

    if (position > this.#prefixes.length) {
      const count = this.#prefixes.length;

      return fail(
        `Index ${position} is out of range. The list has ${count} ${count === 1 ? "prefix" : "prefixes"}.`,
      );
    }

    return { index: position - 1 };
  }

  #persist() {
    transaction(() => {
      db.prepare("DELETE FROM prefixes").run();

      const insert = db.prepare("INSERT INTO prefixes (position, value) VALUES (?, ?)");

      this.#prefixes.forEach((value, position) => insert.run(position, value));
    });
  }
}

export const prefixManager = new PrefixManager();
