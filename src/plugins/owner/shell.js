import { exec } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(exec);

const MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const MAX_REPLY_LENGTH = 3500;

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

    if (!command) return m.reply("where is the command?");

    let output;
    let fileName = "shell-output.txt";

    try {
      const { stdout, stderr } = await run(command, {
        windowsHide: true,
        maxBuffer: MAX_BUFFER_BYTES,
      });

      output = (stdout || stderr || "done.").trim();
    } catch (err) {
      output = `${err.stdout || ""}${err.stderr || err.message}`.trim();
      fileName = "shell-error.txt";
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
