// Connection events: open/close, stream_failure. On close, decides whether to
// reconnect, re-pair fresh (logout), or shut down (fatal reason). Also
// announces pending restart notices when the connection opens.

import { WA_DISCONNECT_REASONS } from "zapo-js";

import { FATAL_REASONS } from "../../config/constants.js";
import { logger } from "../logger.js";
import { restartManager } from "../../managers/restart.js";

const bindConnectionEvents = (session, target) => {
  session.listen(target, "connection", async (event) => {
    if (session.stopped) return;

    if (event.status === "open") {
      session.resetAttempts();
      logger.info(
        `connection open (${event.reason}${event.isNewLogin ? ", new login" : ""})`,
      );
      void restartManager.announce(target);
      return;
    }

    if (event.status !== "close") return;

    logger.warn(
      `connection closed (reason: ${event.reason}, code: ${event.code ?? "-"})`,
    );

    // Client-initiated disconnect: do not reconnect.
    if (event.reason === WA_DISCONNECT_REASONS.CLIENT_DISCONNECTED) return;

    // Device was unlinked: re-pair with a fresh client.
    if (event.isLogout) {
      logger.warn("device was unlinked, pairing again with a fresh client");
      session.resetAttempts();
      await session.reconnect(event.reason, { fresh: true });
      return;
    }

    // Fatal server reasons: do not reconnect.
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

export { bindConnectionEvents };
