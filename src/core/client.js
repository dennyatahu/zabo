import { createMediaProcessor } from "@zapo-js/media-utils";
import { Agent } from "node:https";
import { WaClient } from "zapo-js";

import { config } from "../config.js";
import { selectiveGroupSend } from "../lib/selective-group-send.js";
import { store } from "./store.js";

const mediaProcessor = createMediaProcessor();

export const createClient = (logger) =>
  new WaClient(
    {
      store,
      sessionId: config.sessionId,
      proxy: {
        ws: new Agent(),
      },
      deviceBrowser: "chrome",
      iqTimeoutMs: 15000,
      keepAliveIntervalMs: 15000,
      deadSocketTimeoutMs: 20000,
      mediaTimeoutMs: 30000,
      messageAckTimeoutMs: 10000,
      messageMaxAttempts: 3,
      messageRetryDelayMs: 750,
      plugins: [selectiveGroupSend],
      media: { processor: mediaProcessor },
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
