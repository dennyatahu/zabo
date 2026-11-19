import { WaClient } from "zapo-js";

import { store } from "./store.js";

export const createClient = (logger) => {
  return new WaClient(
    {
      store,
      sessionId: "default",
      deviceBrowser: "chrome",
      iqTimeoutMs: 15000,
      keepAliveIntervalMs: 15000,
      deadSocketTimeoutMs: 20000,
      mediaTimeoutMs: 30000,
      messageAckTimeoutMs: 10000,
      messageMaxAttempts: 3,
      messageRetryDelayMs: 750,
      markOnlineOnConnect: true,
      recoverFromClientTooOld: true,
      history: {
        enabled: true,
        requireFullSync: true,
      },
      addons: {
        autoDecrypt: true,
        persistAllSecrets: true,
      },
    },
    logger,
  );
};
