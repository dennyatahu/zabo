import { delay } from "zapo-js";

import { RECONNECT_FRESH_MS } from "../constants.js";
import { bindEvents } from "../events.js";
import { backoff } from "../utils.js";
import { createClient } from "./client.js";
import { closeDatabase } from "./database.js";
import { flushLogger, logger } from "./logger.js";
import { store } from "./store.js";

export class Session {
  #client = null;
  #attempts = 0;
  #waiting = false;
  #connecting = false;
  #stopped = false;

  get stopped() {
    return this.#stopped;
  }

  isCurrent(target) {
    return target === this.#client;
  }

  resetAttempts() {
    this.#attempts = 0;
  }

  listen(target, event, handler) {
    target.on(event, (...args) => {
      if (this.isCurrent(target)) return handler(...args);
    });
  }

  async start({ fresh = false } = {}) {
    if (this.#stopped || this.#connecting) return;
    this.#connecting = true;

    try {
      const previous = this.#client;

      if (previous && (fresh || previous.auth.getState().connected)) {
        this.#client = null;
        await this.#dispose(previous);
      }

      if (!this.#client) {
        this.#client = createClient(logger);
        bindEvents(this, this.#client);
      }

      logger.info("connecting");
      await this.#client.connect();
      this.#attempts = 0;
    } catch (error) {
      logger.error({ err: error }, "connect failed");

      const failed = this.#client;
      this.#client = null;
      await this.#dispose(failed);

      this.#connecting = false;
      await this.reconnect("connect_error");
    } finally {
      this.#connecting = false;
    }
  }

  async reconnect(reason, { fresh = false } = {}) {
    if (this.#stopped || this.#waiting) return;
    this.#waiting = true;

    const ms = fresh ? RECONNECT_FRESH_MS : backoff(this.#attempts);
    this.#attempts += 1;

    logger.warn(`reconnecting in ${ms}ms (attempt ${this.#attempts}, reason: ${reason})`);

    await delay(ms);
    this.#waiting = false;

    await this.start({ fresh });
  }

  async shutdown(code = 0) {
    if (this.#stopped) return;
    this.#stopped = true;

    logger.info("shutting down");

    const current = this.#client;
    this.#client = null;
    await this.#dispose(current);

    try {
      await store.destroy();
    } catch (error) {
      logger.error({ err: error }, "store destroy failed");
    }

    try {
      closeDatabase();
    } catch (error) {
      logger.error({ err: error }, "database close failed");
    }

    await flushLogger();

    process.exit(code);
  }

  async #dispose(target) {
    if (!target) return;

    try {
      await target.disconnect();
    } catch (error) {
      logger.debug({ err: error }, "disconnect failed");
    }
  }
}

export const registerProcessHandlers = (session) => {
  process.on("SIGINT", () => void session.shutdown(0));
  process.on("SIGTERM", () => void session.shutdown(0));

  process.on("unhandledRejection", (error) => {
    logger.error({ err: error }, "unhandled rejection");
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    void session.shutdown(1);
  });
};
