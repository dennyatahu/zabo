// Toggle manager: base class for boolean settings persisted in the database.
// Used by lock mode (lock_manager) and self mode (self_manager).
// Each instance owns one setting column and its user-facing messages.

import { getSetting, setSetting } from "../database/settings.js";
import { ok, fail } from "../lib/plugin-schema.js";

export class ToggleManager {
  #active = false;
  #setting;
  #messages;

  constructor(setting, messages) {
    this.#setting = setting;
    this.#messages = messages;
  }

  init() {
    this.#active = getSetting(this.#setting);
  }

  get isActive() {
    return this.#active;
  }

  enable = () => this.#setActive(true);

  disable = () => this.#setActive(false);

  #setActive(active) {
    if (this.#active === active) {
      return fail(active ? this.#messages.ALREADY_ENABLED : this.#messages.ALREADY_DISABLED);
    }

    this.#active = active;
    setSetting(this.#setting, active);

    return ok(active ? this.#messages.ENABLED : this.#messages.DISABLED);
  }
}

const LOCK_MESSAGES = Object.freeze({
  ENABLED: "Bot is locked. Nobody can use it until it is unlocked.",
  DISABLED: "Bot is unlocked. Commands work again.",
  ALREADY_ENABLED: "Bot is already locked.",
  ALREADY_DISABLED: "Bot is already unlocked.",
});

const SELF_MESSAGES = Object.freeze({
  ENABLED: "Self mode is on. Only the owner can use the bot.",
  DISABLED: "Self mode is off. Everyone can use the bot.",
  ALREADY_ENABLED: "Self mode is already on.",
  ALREADY_DISABLED: "Self mode is already off.",
});

export const lockManager = new ToggleManager("lock_mode", LOCK_MESSAGES);
export const selfManager = new ToggleManager("self_mode", SELF_MESSAGES);
