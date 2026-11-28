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

    if (!command) return m.reply("*Usage*\n▸ $ <command>");

    let output;
    let fileName = "shell-output.txt";

    try {
      const proc = Bun.spawn(["sh", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      const code = await proc.exited;

      if (code !== 0) throw Object.assign(new Error(stderr || stdout), { stdout, stderr, code });

      output = (stdout || stderr || "Done.").trim();
    } catch (err) {
      output = `${err.stdout || ""}${err.stderr || err.message}`.trim();
      fileName = "shell-error.txt";
    }

    if (output.length > MAX_BUFFER_BYTES) output = output.slice(0, MAX_BUFFER_BYTES);

    if (output.length <= MAX_REPLY_LENGTH) return m.reply(output);

    return client.message.send(jid, {
      type: "document",
      media: Buffer.from(output),
      fileName,
      mimetype: "text/plain",
    });
  },
};
