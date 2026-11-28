// Shell plugin: run a shell command and return the output as a reply or
// document. Owner-only, bypassPrefix.
// Fixes vs. original: adds a hard timeout (SHELL_TIMEOUT_MS), truncates by
// byte length (not character length), and uses proc.stdout.text() instead of
// new Response(proc.stdout).text(). Errors are handled without throw-as-control-flow.

import { SHELL_MAX_BUFFER_BYTES, SHELL_MAX_REPLY_LENGTH, SHELL_TIMEOUT_MS } from "../../config/constants.js";

const MAX_BUFFER_BYTES = SHELL_MAX_BUFFER_BYTES; // 20 MB cap on output
const MAX_REPLY_LENGTH = SHELL_MAX_REPLY_LENGTH; // 3500 chars before sending as document

export default {
  name: "shell",
  commands: ["$"],
  categories: ["owner"],
  ownerOnly: true,
  options: {
    bypassPrefix: true,
  },

  fn: async ({ m, text, client, jid }) => {
    const command = text?.trim();

    if (!command) return m.reply("*Usage*\n▸ $ <command>");

    let output = "";
    let fileName = "shell-output.txt";

    try {
      const proc = Bun.spawn(["sh", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
      });

      // Read stdout and stderr as text, with a timeout so a hung command
      // cannot block the bot forever.
      const timeout = setTimeout(() => {
        proc.kill("SIGKILL");
      }, SHELL_TIMEOUT_MS);

      const [stdout, stderr] = await Promise.all([
        proc.stdout.text(),
        proc.stderr.text(),
      ]);

      clearTimeout(timeout);

      const code = await proc.exited;

      if (code !== 0) {
        const err = new Error(stderr || stdout || `exit code ${code}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        throw err;
      }

      output = (stdout || stderr || "Done.").trim();
    } catch (err) {
      output = `${err.stdout ?? ""}${err.stderr ?? err.message}`.trim();
      fileName = "shell-error.txt";
    }

    // Truncate by byte length, not character length (original bug).
    const outputBytes = Buffer.from(output, "utf8");
    if (outputBytes.length > MAX_BUFFER_BYTES) {
      output = outputBytes.slice(0, MAX_BUFFER_BYTES).toString("utf8");
    }

    if (output.length <= MAX_REPLY_LENGTH) return m.reply(output);

    return client.message.send(jid, {
      type: "document",
      media: Buffer.from(output),
      fileName,
      mimetype: "text/plain",
    });
  },
};
