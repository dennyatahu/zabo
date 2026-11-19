import { logger } from "./logger.js";

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
