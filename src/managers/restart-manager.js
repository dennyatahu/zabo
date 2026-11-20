import { delay } from "zapo-js";

import { RESTART_EXIT_CODE, RESTART_NOTICE_TTL_MS, SUPERVISED_ENV } from "../constants/restart.js";
import { db } from "../core/database.js";
import { logger } from "../core/logger.js";

const SEND_ATTEMPTS = 3;
const SEND_RETRY_MS = 1000;

class RestartManager {
  #session = null;

  bind(session) {
    this.#session = session;
  }

  get isSupported() {
    return process.env[SUPERVISED_ENV] === "1" && this.#session !== null;
  }

  request(jid) {
    db.prepare(
      `INSERT INTO restart_request (id, jid, requested_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET jid = excluded.jid, requested_at = excluded.requested_at`,
    ).run(jid, Date.now());

    return this.#session.shutdown(RESTART_EXIT_CODE);
  }

  async announce(client) {
    const pending = db.prepare("SELECT jid, requested_at FROM restart_request WHERE id = 1").get();

    if (!pending) return;

    db.prepare("DELETE FROM restart_request WHERE id = 1").run();

    const elapsed = Date.now() - pending.requested_at;

    if (elapsed > RESTART_NOTICE_TTL_MS) return;

    const text = `*Restart*\n▸ Restarted in ${(elapsed / 1000).toFixed(2)} seconds`;

    for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt += 1) {
      try {
        await client.message.send(pending.jid, text);

        return;
      } catch (err) {
        logger.warn({ err, attempt }, "restart notice failed");

        await delay(SEND_RETRY_MS);
      }
    }
  }
}

export const restartManager = new RestartManager();
