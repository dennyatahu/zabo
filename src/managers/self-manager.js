import { getSetting, setSetting } from "../core/database.js";
import { fail, ok } from "../utils/result.js";

const MESSAGES = Object.freeze({
  ENABLED: "Self mode is on. Only the owner can use the bot.",
  DISABLED: "Self mode is off. Everyone can use the bot.",
  ALREADY_ENABLED: "Self mode is already on.",
  ALREADY_DISABLED: "Self mode is already off.",
});

class SelfManager {
  #active = false;

  init() {
    this.#active = getSetting("self_mode");
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
    setSetting("self_mode", active);

    return ok(active ? MESSAGES.ENABLED : MESSAGES.DISABLED);
  }
}

export const selfManager = new SelfManager();
