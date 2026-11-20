import pino from "pino";

const LEVELS = new Set(["trace", "debug", "info", "warn", "error", "fatal", "silent"]);
const requestedLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
const level = LEVELS.has(requestedLevel) ? requestedLevel : "info";

const target = pino({
  name: "zabo",
  level,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname,service",
      colorize: Boolean(process.stdout.isTTY),
      errorLikeObjectKeys: ["err", "error"],
    },
  },
});

const hasKeys = (value) =>
  value !== null &&
  typeof value === "object" &&
  !(value instanceof Error) &&
  Object.keys(value).length > 0;

// zabo uses pino's `(context, message)` order, while zapo-js uses
// `(message, context)`. Support both so context and errors are never dropped.
const emit = (stream, method, first, second) => {
  if (typeof first === "string") {
    if (hasKeys(second)) {
      stream[method](second, first);
      return;
    }

    stream[method](first);
    return;
  }

  if (typeof second === "string") {
    stream[method](first, second);
    return;
  }

  stream[method](first);
};

class Logger {
  #stream;

  constructor(stream) {
    this.#stream = stream;
  }

  get level() {
    return this.#stream.level;
  }

  trace(message, context) {
    emit(this.#stream, "trace", message, context);
  }

  debug(message, context) {
    emit(this.#stream, "debug", message, context);
  }

  info(message, context) {
    emit(this.#stream, "info", message, context);
  }

  warn(message, context) {
    emit(this.#stream, "warn", message, context);
  }

  error(message, context) {
    emit(this.#stream, "error", message, context);
  }

  fatal(message, context) {
    emit(this.#stream, "fatal", message, context);
  }

  child(bindings, options) {
    return new Logger(this.#stream.child(bindings, options));
  }

  flush(callback) {
    this.#stream.flush(callback);
  }
}

export const logger = new Logger(target);

export const flushLogger = () =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);

    try {
      logger.flush(() => {
        clearTimeout(timer);
        resolve();
      });
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
