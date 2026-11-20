import { WA_DISCONNECT_REASONS } from "zapo-js";

import { logger } from "../core/logger.js";
import { FATAL_REASONS } from "../constants/reconnect.js";
import { restartManager } from "../managers/restart-manager.js";

export const bindConnectionEvents = (session, target) => {
  session.listen(target, "connection", async (event) => {
    if (session.stopped) return;

    if (event.status === "open") {
      session.resetAttempts();
      logger.info(`connection open (${event.reason}${event.isNewLogin ? ", new login" : ""})`);
      void restartManager.announce(target);
      return;
    }

    if (event.status !== "close") return;

    logger.warn(`connection closed (reason: ${event.reason}, code: ${event.code ?? "-"})`);

    if (event.reason === WA_DISCONNECT_REASONS.CLIENT_DISCONNECTED) return;

    if (event.isLogout) {
      logger.warn("device was unlinked, pairing again with a fresh client");
      session.resetAttempts();
      await session.reconnect(event.reason, { fresh: true });
      return;
    }

    if (FATAL_REASONS.has(event.reason)) {
      logger.fatal(`unrecoverable close (${event.reason}), not reconnecting`);
      await session.shutdown(1);
      return;
    }

    await session.reconnect(event.reason);
  });

  session.listen(target, "stream_failure", (event) => {
    logger.error({ event }, "stream failure");
  });
};
