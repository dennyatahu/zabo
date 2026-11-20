export default {
  name: "ping",
  commands: ["p", "ping"],
  categories: ["info"],
  options: {
    bypassPrefix: true,
  },

  fn: async ({ client, jid, m }) => {
    const start = performance.now();
    const { id } = await m.reply("*Pong!*");
    const latency = Math.round(performance.now() - start);

    return client.message.send(jid, `*Pong!*\n▸ Latency: ${latency} ms`, { editKey: { id } });
  },
};
