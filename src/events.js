import { WA_DISCONNECT_REASONS } from "zapo-js";

import { config } from "./config.js";
import { FATAL_REASONS } from "./constants.js";
import { dispatch } from "./core/dispatcher.js";
import { logger } from "./core/logger.js";
import { rememberPushName } from "./lib/push-name.js";
import { smsg } from "./lib/serialize-message.js";
import { restartManager } from "./managers/restart-manager.js";
import { formatPairingCode, renderQr } from "./utils.js";

const requestPairingCode = async (session, target) => {
  try {
    const code = await target.auth.requestPairingCode(config.botPn, true);

    if (session.isCurrent(target)) {
      logger.info(`pairing code for ${config.botPn}: ${formatPairingCode(code)}`);
    }

    return true;
  } catch (error) {
    logger.error({ err: error }, "failed to request pairing code");
    return false;
  }
};

const bindPairMethod = (session, target) => {
  let requested = false;

  const pair = async () => {
    if (requested) return;

    requested = true;
    requested = await requestPairingCode(session, target);
  };

  session.listen(target, "auth_qr", () => {
    void pair();
  });

  session.listen(target, "auth_pairing_required", ({ forceManual }) => {
    if (!forceManual) return;

    logger.info("pairing code expired, requesting a new one");
    requested = false;
    void pair();
  });
};

const bindQrMethod = (session, target) => {
  session.listen(target, "auth_qr", async ({ qr, ttlMs }) => {
    const output = await renderQr(qr);

    if (!session.isCurrent(target)) return;

    logger.info(`scan this QR code within ${Math.round(ttlMs / 1000)}s`);
    process.stdout.write(`${output}\n`);
  });
};

const bindAuthEvents = (session, target) => {
  if (config.authMethod === "qr") {
    bindQrMethod(session, target);
  } else {
    bindPairMethod(session, target);
  }

  session.listen(target, "auth_paired", ({ credentials }) => {
    logger.info(`paired as ${credentials.meJid}`);
  });

  session.listen(target, "auth_passkey_required", ({ hasSigner }) => {
    logger.warn(`passkey required (signer configured: ${hasSigner})`);
  });
};

const bindConnectionEvents = (session, target) => {
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

const bindMessageEvents = (session, target) => {
  session.listen(target, "message", (event) => {
    rememberPushName(event);

    return dispatch(smsg(event, target));
  });
};

export const bindEvents = (session, target) => {
  bindAuthEvents(session, target);
  bindConnectionEvents(session, target);
  bindMessageEvents(session, target);
};
