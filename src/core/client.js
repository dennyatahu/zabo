// Creates the zapo-js WaClient instance with the shared store, media
// processor, selective group-send plugin, and the structured logger.
// WaClient constructor signature: new WaClient(options, logger?).
// The logger interface is { level, trace/debug/info/warn/error(message, context?), child(bindings, options) }.

import { createMediaProcessor } from "@zapo-js/media-utils";
import { WaClient } from "zapo-js";

import { PATHS } from "../config/paths.js";
import { selectiveGroupSend } from "../lib/selective/group-send.js";
import { store } from "./store.js";

// Shared media processor across client sessions. sharp + ffmpeg/ffprobe are
// optional: the processor degrades gracefully (warn, no crash) when binaries
// are missing, so the bot still runs without thumbnails/waveforms.
const mediaProcessor = createMediaProcessor();

export const createClient = (logger) =>
  new WaClient(
    {
      store,
      sessionId: "default",
      deviceBrowser: "chrome",
      // Timeouts (ms). Tuned for unreliable mobile networks.
      iqTimeoutMs: 15000,
      keepAliveIntervalMs: 15000,
      deadSocketTimeoutMs: 20000,
      mediaTimeoutMs: 30000,
      messageAckTimeoutMs: 10000,
      messageMaxAttempts: 3,
      messageRetryDelayMs: 750,
      // selective-group-send exposes client.selective for sender-restricted replies.
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
