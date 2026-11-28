// WhatsApp session lifecycle: connect, reconnect with exponential backoff,
// and graceful shutdown. Manages a single WaClient instance at a time.
// Uses zapo-js `delay` for backoff sleep. Signal handlers are registered by
// the caller (src/main.js) so responsibility is not split across files.

import { delay } from "zapo-js";

import { RECONNECT_FRESH_MS } from "../config/constants.js";
import { bindEvents } from "./events/index.js";
import { backoff } from "../lib/format.js";
import { closeDatabase } from "../database/connection.js";
import { flushLogger, getLogger } from "./logger.js";
import { store } from "./store.js";
import { createClient } from "./client.js";

export class Session {
  #client = null;
  #attempts = 0;
  #waiting = false;
  #connecting = false;
  #stopped = false;

  get stopped() {
    return this.#stopped;
  }

  // True only while the given client is the current one. Stale event handlers
  // from a replaced client silently ignore their events.
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

  // Start (or restart) the connection. When fresh=true or the previous client
  // is already connected, dispose it first. Emits "connecting" log and awaits
  // client.connect(). On failure, schedules a reconnect.
  async start({ fresh = false } = {}) {
    if (this.#stopped || this.#connecting) return;
    this.#connecting = true;

    try {
      const previous = this.#client;

      if (previous && (fresh || previous.getState().connected)) {
        this.#client = null;
        await this.#dispose(previous);
      }

      if (!this.#client) {
        this.#client = createClient(getLogger());
        bindEvents(this, this.#client);
      }

      getLogger().info("connecting");
      await this.#client.connect();
      this.#attempts = 0;
    } catch (error) {
      getLogger().error({ err: error }, "connect failed");

      const failed = this.#client;
      this.#client = null;
      await this.#dispose(failed);

      this.#connecting = false;
      await this.reconnect("connect_error");
    } finally {
      // Guard against reconnect being called from catch AND finally.
      if (!this.#waiting) this.#connecting = false;
    }
  }

  // Wait backoff ms then start again. Not re-entrant (#waiting guard).
  async reconnect(reason, { fresh = false } = {}) {
    if (this.#stopped || this.#waiting) return;
    this.#waiting = true;

    const ms = fresh ? RECONNECT_FRESH_MS : backoff(this.#attempts);
    this.#attempts += 1;

    getLogger().warn(
      `reconnecting in ${ms}ms (attempt ${this.#attempts}, reason: ${reason})`,
    );

    await delay(ms);
    this.#waiting = false;

    await this.start({ fresh });
  }

  // Graceful shutdown: disconnect client, destroy store, close database,
  // flush logger, then exit with the given code.
  async shutdown(code = 0) {
    if (this.#stopped) return;
    this.#stopped = true;

    getLogger().info("shutting down");

    const current = this.#client;
    this.#client = null;
    await this.#dispose(current);

    try {
      await store.destroy();
    } catch (error) {
      getLogger().error({ err: error }, "store destroy failed");
    }

    try {
      closeDatabase();
    } catch (error) {
      getLogger().error({ err: error }, "database close failed");
    }

    await flushLogger();

    process.exit(code);
  }

  async #dispose(target) {
    if (!target) return;
    try {
      await target.disconnect();
    } catch (error) {
      getLogger().debug({ err: error }, "disconnect failed");
    }
  }
}

// Registers process-level signal and error handlers. SIGINT/SIGTERM trigger a
// graceful shutdown; unhandled errors are logged (and fatal ones shut down).
export const registerProcessHandlers = (session) => {
  process.on("SIGINT", () => void session.shutdown(0));
  process.on("SIGTERM", () => void session.shutdown(0));

  process.on("unhandledRejection", (error) => {
    getLogger().error({ err: error }, "unhandled rejection");
  });

  process.on("uncaughtException", (error) => {
    getLogger().fatal({ err: error }, "uncaught exception");
    void session.shutdown(1);
  });
};


