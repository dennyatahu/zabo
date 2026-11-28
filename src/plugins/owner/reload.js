// Reload plugin: snapshot file hashes, diff against baseline, reload plugins,
// and show a live-updating report. Owner-only, bypassPrefix.
// The ?v= cache-busting import pattern means old module instances are never
// GC'd (slow memory leak on repeated reloads); documented trade-off, no better
// alternative in Bun docs.

import { delay } from "zapo-js";

import { logger } from "../../core/logger.js";

const EDIT_DELAY_MS = 95;
const MAX_CHANGES = 40;

const formatChange = ({ status, path, applied }) =>
  `▸ ${status} ${path}${applied ? "" : " (needs restart)"}`;

const formatFailure = ({ path, message }) => `▸ ! ${path}: ${message}`;

const buildLines = ({ changes, failures, plugins, elapsed }) => {
  const shown = changes.slice(0, MAX_CHANGES).map(formatChange);
  const hidden = changes.length - shown.length;
  const failed = failures.length ? `, ${failures.length} failed` : "";

  return [
    "*Reload*",
    ...(changes.length ? shown : ["▸ No file changes"]),
    ...(hidden > 0 ? [`▸ +${hidden} more`] : []),
    ...failures.map(formatFailure),
    `\n▸ Plugins: ${plugins} loaded${failed} in ${elapsed} ms`,
  ];
};

export default {
  name: "reload",
  commands: ["r"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async ({ m, client, jid, reloadManager }) => {
    const { id } = await m.reply("*Reload*");
    const edit = (text) => client.message.send(jid, text, { editKey: { id } });

    let report;

    try {
      report = await reloadManager.reload();
    } catch (err) {
      logger.error({ err }, "reload failed");
      return edit(`*Reload*\n▸ Failed: ${err.message}`);
    }

    const lines = buildLines(report);

    for (let count = 2; count <= lines.length; count += 1) {
      await delay(EDIT_DELAY_MS);
      await edit(lines.slice(0, count).join("\n"));
    }
  },
};
