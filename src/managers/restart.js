// Restart manager: records a restart request in the database and triggers
// Session.shutdown(RESTART_EXIT_CODE). The launcher (src/launcher.js) watches
// for exit code 75 and re-spawns the child process.
// Is supported only when ZABO_SUPERVISED=1 and a session is bound.

import { delay } from "zapo-js";

import { RESTART_EXIT_CODE, RESTART_NOTICE_TTL_MS, SUPERVISED_ENV } from "../config/constants.js";
import { db } from "../database/connection.js";
import { logger } from "../core/logger.js";

const SEND_ATTEMPTS = 3;
const SEND_RETRY_MS = 1000;

export class RestartManager {
  #session = null;

  bind(session) {
    this.#session = session;
  }

  get isSupported() {
    return Bun.env[SUPERVISED_ENV] === "1" && this.#session !== null;
  }

  request(jid, messageId) {
    db.prepare(
      `INSERT INTO restart_request (id, jid, requested_at, message_id) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET jid = excluded.jid, requested_at = excluded.requested_at,
       message_id = excluded.message_id`,
    ).run(jid, Date.now(), messageId ?? null);

    return this.#session.shutdown(RESTART_EXIT_CODE);
  }

  async announce(client) {
    const pending = db
      .prepare("SELECT jid, requested_at, message_id FROM restart_request WHERE id = 1")
      .get();

    if (!pending) return;

    db.prepare("DELETE FROM restart_request WHERE id = 1").run();

    const elapsed = Date.now() - pending.requested_at;

    if (elapsed > RESTART_NOTICE_TTL_MS) return;

    const text = `*Restart*\n▸ Restarted in ${(elapsed / 1000).toFixed(2)} seconds`;
    const send = pending.message_id
      ? () =>
          client.message.send(pending.jid, text, {
            editKey: { id: pending.message_id },
          })
      : () => client.message.send(pending.jid, text);

    for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt += 1) {
      try {
        await send();
        return;
      } catch (err) {
        logger.warn({ err, attempt }, "restart notice failed");
        await delay(SEND_RETRY_MS);
      }
    }
  }
}

export const restartManager = new RestartManager();
