import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { formatPairingCode } from "../utils/format-pairing-code.js";

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

export const bindAuthEvents = (session, target) => {
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

  session.listen(target, "auth_paired", ({ credentials }) => {
    logger.info(`paired as ${credentials.meJid}`);
  });

  session.listen(target, "auth_passkey_required", ({ hasSigner }) => {
    logger.warn(`passkey required (signer configured: ${hasSigner})`);
  });

  session.listen(target, "mutation", (event) => logger.info(event));
};
