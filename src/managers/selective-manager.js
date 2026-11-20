import { join } from "node:path";

import { config } from "../config.js";
import { createJsonSaver, readJson } from "../utils/json-file.js";
import { fail, ok } from "../utils/result.js";

const MESSAGES = Object.freeze({
  ENABLED: "Selective mode is on for this group. Bot messages are only visible to the command sender.",
  DISABLED: "Selective mode is off for this group. Bot messages are sent normally.",
  ALREADY_ENABLED: "Selective mode is already on for this group.",
  ALREADY_DISABLED: "Selective mode is already off for this group.",
  ENABLED_ALL: "Selective mode is on for all groups.",
  DISABLED_ALL: "Selective mode is off for all groups.",
  NOT_GROUP: "Use this command in a group, or add --all for all groups.",
});

const FILE_PATH = join(config.paths.data, "selective.json");

const save = createJsonSaver(FILE_PATH, "selective");

const isId = (value) => typeof value === "string" && /^\d+$/.test(value);

class SelectiveManager {
  #global = false;
  #groups = new Map();
  #only = new Set();
  #targets = new Map();

  async init() {
    const data = await readJson(FILE_PATH);

    this.#global = data?.isSelectiveActive === true;
    this.#groups = new Map(
      Object.entries(data?.groups ?? {}).filter(([, value]) => typeof value === "boolean"),
    );

    this.#only = new Set(
      Array.isArray(data?.only) ? data.only.filter((name) => typeof name === "string") : [],
    );

    this.#targets = new Map(
      Object.entries(data?.targets ?? {})
        .map(([name, ids]) => [name, new Set(Array.isArray(ids) ? ids.filter(isId) : [])])
        .filter(([, ids]) => ids.size),
    );
  }

  get isGlobalActive() {
    return this.#global;
  }

  isActive = (jid) => this.#groups.get(jid) ?? this.#global;

  shouldUse = (jid, name) =>
    this.#only.has(name) || this.#targets.has(name) || (this.#groups.get(jid) ?? this.#global);

  targetsOf = (name) => [...(this.#targets.get(name) ?? [])];

  get targetList() {
    return [...this.#targets].map(([name, ids]) => [name, [...ids]]);
  }

  setTargets = (names, ids) => {
    for (const name of names) {
      const current = this.#targets.get(name) ?? new Set();

      ids.forEach((id) => current.add(id));
      this.#targets.set(name, current);
    }

    this.#save();

    return ok(
      `Selective targets added: ${names.join(", ")} -> ${ids.map((id) => `@${id}`).join(", ")}.`,
    );
  };

  deleteTargets = (names, ids) => {
    let removed = 0;

    for (const name of names) {
      const current = this.#targets.get(name);

      if (!current) continue;

      for (const id of ids) if (current.delete(id)) removed += 1;

      if (!current.size) this.#targets.delete(name);
    }

    if (!removed) return fail("No matching selective targets found.");

    this.#save();

    return ok(`Selective targets removed: ${removed}.`);
  };

  get onlyList() {
    return [...this.#only];
  }

  setOnly = (names) => {
    const added = names.filter((name) => !this.#only.has(name));

    names.forEach((name) => this.#only.add(name));
    this.#save();

    return added.length
      ? ok(`Selective only added: ${added.join(", ")}.`)
      : fail("Those commands are already in the selective only list.");
  };

  deleteOnly = (names) => {
    const removed = names.filter((name) => this.#only.delete(name));

    if (!removed.length) return fail("None of those commands are in the selective only list.");

    this.#save();

    return ok(`Selective only removed: ${removed.join(", ")}.`);
  };

  enable = (jid) => this.#setGroup(jid, true);

  disable = (jid) => this.#setGroup(jid, false);

  enableAll = () => this.#setAll(true);

  disableAll = () => this.#setAll(false);

  #setGroup(jid, active) {
    if (!jid?.endsWith("@g.us")) return fail(MESSAGES.NOT_GROUP);

    if (this.isActive(jid) === active) {
      return fail(active ? MESSAGES.ALREADY_ENABLED : MESSAGES.ALREADY_DISABLED);
    }

    this.#groups.set(jid, active);
    this.#save();

    return ok(active ? MESSAGES.ENABLED : MESSAGES.DISABLED);
  }

  #setAll(active) {
    this.#global = active;
    this.#groups.clear();
    this.#save();

    return ok(active ? MESSAGES.ENABLED_ALL : MESSAGES.DISABLED_ALL);
  }

  #save() {
    return save({
      isSelectiveActive: this.#global,
      groups: Object.fromEntries(this.#groups),
      only: [...this.#only],
      targets: Object.fromEntries([...this.#targets].map(([name, ids]) => [name, [...ids]])),
    });
  }
}

export const selectiveManager = new SelectiveManager();
