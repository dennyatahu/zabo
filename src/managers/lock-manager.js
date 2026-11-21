import { getSetting, setSetting } from "../core/database.js";
import { fail, ok } from "../utils/result.js";

const MESSAGES = Object.freeze({
  ENABLED: "Bot is locked. Nobody can use it until it is unlocked.",
  DISABLED: "Bot is unlocked. Commands work again.",
  ALREADY_ENABLED: "Bot is already locked.",
  ALREADY_DISABLED: "Bot is already unlocked.",
});

class LockManager {
  #active = false;

  init() {
    this.#active = getSetting("lock_mode");
  }

  get isActive() {
    return this.#active;
  }

  enable = () => this.#setActive(true);

  disable = () => this.#setActive(false);

  #setActive(active) {
    if (this.#active === active) {
      return fail(active ? MESSAGES.ALREADY_ENABLED : MESSAGES.ALREADY_DISABLED);
    }

    this.#active = active;
    setSetting("lock_mode", active);

    return ok(active ? MESSAGES.ENABLED : MESSAGES.DISABLED);
  }
}

export const lockManager = new LockManager();
