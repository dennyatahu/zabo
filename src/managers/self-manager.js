import { join } from "node:path";

import { config } from "../config.js";
import { createJsonSaver, readJson } from "../utils/json-file.js";
import { fail, ok } from "../utils/result.js";

const MESSAGES = Object.freeze({
  ENABLED: "Self mode is on. Only the owner can use the bot.",
  DISABLED: "Self mode is off. Everyone can use the bot.",
  ALREADY_ENABLED: "Self mode is already on.",
  ALREADY_DISABLED: "Self mode is already off.",
});

const FILE_PATH = join(config.paths.data, "self.json");

const save = createJsonSaver(FILE_PATH, "self");

class SelfManager {
  #active = false;

  async init() {
    const data = await readJson(FILE_PATH);

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
    save({ isSelfActive: active });

    return ok(active ? MESSAGES.ENABLED : MESSAGES.DISABLED);
  }
}

export const selfManager = new SelfManager();
