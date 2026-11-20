import { db, getSetting, setSetting, transaction } from "../core/database.js";
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

const isId = (value) => typeof value === "string" && /^\d+$/.test(value);

class SelectiveManager {
  #global = false;
  #groups = new Map();
  #only = new Set();
  #targets = new Map();

  init() {
    this.#global = getSetting("selective_mode");

    this.#groups = new Map(
      db
        .prepare("SELECT jid, active FROM selective_groups")
        .all()
        .map(({ jid, active }) => [jid, active === 1]),
    );

    this.#only = new Set(
      db
        .prepare("SELECT name FROM selective_commands")
        .all()
        .map(({ name }) => name),
    );

    this.#targets = new Map();

    for (const { command, user_id } of db
      .prepare("SELECT command, user_id FROM selective_targets")
      .all()) {
      const ids = this.#targets.get(command) ?? new Set();

      ids.add(user_id);
      this.#targets.set(command, ids);
    }
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

    transaction(() => {
      const insert = db.prepare(
        "INSERT OR IGNORE INTO selective_targets (command, user_id) VALUES (?, ?)",
      );

      for (const name of names) for (const id of ids) insert.run(name, id);
    });

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

    transaction(() => {
      const remove = db.prepare(
        "DELETE FROM selective_targets WHERE command = ? AND user_id = ?",
      );

      for (const name of names) for (const id of ids) remove.run(name, id);
    });

    return ok(`Selective targets removed: ${removed}.`);
  };

  get onlyList() {
    return [...this.#only];
  }

  setOnly = (names) => {
    const added = names.filter((name) => !this.#only.has(name));

    names.forEach((name) => this.#only.add(name));

    if (added.length) {
      transaction(() => {
        const insert = db.prepare("INSERT OR IGNORE INTO selective_commands (name) VALUES (?)");

        added.forEach((name) => insert.run(name));
      });
    }

    return added.length
      ? ok(`Selective only added: ${added.join(", ")}.`)
      : fail("Those commands are already in the selective only list.");
  };

  deleteOnly = (names) => {
    const removed = names.filter((name) => this.#only.delete(name));

    if (!removed.length) return fail("None of those commands are in the selective only list.");

    transaction(() => {
      const remove = db.prepare("DELETE FROM selective_commands WHERE name = ?");

      removed.forEach((name) => remove.run(name));
    });

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

    db.prepare(
      `INSERT INTO selective_groups (jid, active) VALUES (?, ?)
       ON CONFLICT(jid) DO UPDATE SET active = excluded.active,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).run(jid, Number(active));

    return ok(active ? MESSAGES.ENABLED : MESSAGES.DISABLED);
  }

  #setAll(active) {
    this.#global = active;
    this.#groups.clear();

    transaction(() => {
      setSetting("selective_mode", active);
      db.prepare("DELETE FROM selective_groups").run();
    });

    return ok(active ? MESSAGES.ENABLED_ALL : MESSAGES.DISABLED_ALL);
  }
}

export const selectiveManager = new SelectiveManager();
