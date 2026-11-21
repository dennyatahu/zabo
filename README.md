# zabo

Fast, lightweight WhatsApp bot built with [zapo-js](https://www.npmjs.com/package/zapo-js). Plugin-based, ESM-only, persistent SQLite session.

## Quick start

Requires Node.js 20.19+ and a WhatsApp account.

```bash
git clone https://github.com/dennyatahu/zabo.git
cd zabo
npm install
cp .env.example .env
# edit .env, then:
npm start
```

`npm run dev` watches files but has no restart command.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_METHOD` | `pair` | `pair` (pairing code) or `qr` |
| `BOT_PN` | — | Bot number, digits only with country code. Required for `pair`. |
| `OWNER` | — | Owner number(s), comma-separated. No prefix needed for owner commands. |
| `BOT_NAME` | `zabo` | Name used by `lock` / `unlock`. |
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`. |

`TITLE_MENU` / `DESC_MENU` set the menu link preview (`zabo` / `by dennyatahu` by default).

## Linking WhatsApp

Only needed on the first run; the session is saved in `data/session.sqlite`.

- **pair** — start the bot, then WhatsApp → Linked devices → Link a device → Link with phone number instead, and enter the code shown in the terminal.
- **qr** — set `AUTH_METHOD=qr` and scan the terminal QR code.

To switch methods, delete `data/session.sqlite` and link again.

## Owner commands

No prefix needed. Add `-h` to any command for its full guide.

| Command | What it does |
| --- | --- |
| `prefix list` / `add <p>` / `del <p\|no>` / `on` / `off` / `reset` | Prefix management |
| `plugin list` / `add [name]` / `del <cmd>` / `get <cmd> [-t]` | Plugin files; `-t` sends the code as text |
| `selective list` / `on` / `off [all]` / `only [del] <cmds>` / `to [del] <cmds> @user` | Selective replies |
| `menu set` / `get` / `del thumb\|fav\|url\|title\|desc` | Menu images and link preview |
| `menu save thumb\|fav [url] [name]` / `menu saved [thumb\|fav]` | Saved image library |
| `lock @bot` / `unlock @bot` | Lock or unlock the bot |
| `self on` / `off` | Owner-only mode |
| `res` / `r` | Restart the process / hot-reload plugins |

## Plugins

Drop a `.js` file in `src/plugins/<category>/`:

```js
export default {
  name: "hello",
  commands: ["hello"],
  categories: ["info"],
  fn: async ({ m, text }) => m.reply(`Hello ${text || "world"}!`),
};
```

`ownerOnly` and `options: { bypassPrefix: true }` are optional. Runtime settings live in `data/database.sqlite`.

## License

[MIT](LICENSE)
