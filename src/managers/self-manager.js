import { join } from "node:path";

import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { readJson, writeJson } from "../utils/json-file.js";

const MESSAGES = Object.freeze({
  ENABLED: "Self mode is on. Only the owner can use the bot.",
  DISABLED: "Self mode is off. Everyone can use the bot.",
  ALREADY_ENABLED: "Self mode is already on.",
  ALREADY_DISABLED: "Self mode is already off.",
});

const ok = (data) => ({ data });
const fail = (error) => ({ error });

class SelfManager {
  #active = false;
  #filePath = undefined;
  #queue = Promise.resolve();

  async init() {
    this.#filePath = join(config.paths.data, "self.json");

    const data = await readJson(this.#filePath);
    this.#active = data?.isSelfActive === true;
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
    this.#save();

    return ok(active ? MESSAGES.ENABLED : MESSAGES.DISABLED);
  }

  #save() {
    const filePath = this.#filePath;
    const payload = JSON.stringify({ isSelfActive: this.#active }, null, 2);

    this.#queue = this.#queue
      .then(() => writeJson(filePath, payload))
      .catch((err) => logger.error({ err, path: filePath }, "self save failed"));
  }
}

export const selfManager = new SelfManager();
