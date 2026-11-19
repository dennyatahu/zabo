import { exec } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(exec);

export default {
  name: "shell",
  commands: ["$"],
  categories: ["owner"],
  ownerOnly: true,

  options: {
    bypassPrefix: true,
  },

  fn: async ({ m, text, client, jid }) => {

    if (!text?.trim()) return m.reply("where is the command?");

    let output;
    let fileName = "shell-output.txt";

    try {
      const { stdout, stderr } = await run(text.trim(), {
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      });

      output = (stdout || stderr || "done.").trim();
    } catch (err) {
      output = `${err.stdout || ""}${err.stderr || err.message}`.trim();
      fileName = "shell-error.txt";
    }

    if (output.length <= 3500) {
      return m.reply(output);
    }

    return client.message.send(jid, {
      type: "document",
      media: Buffer.from(output),
      fileName,
      mimetype: "text/plain",
    });
  },
};
