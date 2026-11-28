// Structured logger for the application.
// Uses zapo-js's createPinoLogger (official PinoLogger adapter) with
// pino-pretty pretty-printing on the main thread — no worker thread needed.
// This satisfies the zapo-js Logger interface:
//   { level, trace(message, context?), debug, info, warn, error, child(bindings, options) }
// Initialized asynchronously in src/main.js bootstrap (not at import time).

import { createPinoLogger } from "zapo-js";

let loggerInstance = null;

const LEVELS = Object.freeze([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
]);

const resolveLevel = () => {
  const level = Bun.env.LOG_LEVEL?.trim().toLowerCase();
  return LEVELS.includes(level) ? level : "info";
};

// Create the real pino-based logger. Async because createPinoLogger
// dynamically loads pino (+ pino-pretty when pretty: true).
export const initLogger = async () => {
  if (loggerInstance) return loggerInstance;

  const level = resolveLevel();

  loggerInstance = await createPinoLogger({
    name: "zabo",
    level,
    pretty: true,
    prettyOptions: {
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname,service",
      colorize: Boolean(process.stdout.isTTY),
      errorLikeObjectKeys: ["err", "error"],
    },
  });

  return loggerInstance;
};

export const getLogger = () => loggerInstance;

// Stable `logger` binding that always forwards to the current instance.
// Modules import { logger } and call logger.info/error/etc. at runtime,
// after initLogger() has populated loggerInstance in main.js.
export const logger = new Proxy({}, {
  get(_target, prop) {
    const instance = loggerInstance ?? noopLogger;
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// Minimal noop logger used only if initLogger has not completed yet.
export const noopLogger = {
  get level() {
    return "info";
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
  child() {
    return this;
  },
};

// Flush pending log records before shutdown. pino's flush is callback-based.
// Resolves when flushed or after a 1s fallback timeout.
export const flushLogger = () =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);

    if (!loggerInstance || typeof loggerInstance.flush !== "function") {
      clearTimeout(timer);
      resolve();
      return;
    }

    loggerInstance.flush(() => {
      clearTimeout(timer);
      resolve();
    });
  });
