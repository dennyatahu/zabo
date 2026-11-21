<div align="center">

<img src="https://cloud.yardansh.com/Kbmh9u.png" alt="zabo logo" width="160" />

# zabo

**A fast, lightweight WhatsApp bot powered by [zapo-js](https://www.npmjs.com/package/zapo-js).**

Plugin-based · ESM-only · Persistent SQLite session

[![Node.js](https://img.shields.io/badge/node-%E2%89%A520.19-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![zapo-js](https://img.shields.io/badge/powered%20by-zapo--js-25D366)](https://www.npmjs.com/package/zapo-js)

[Highlights](#highlights) · [Quick Start](#quick-start) · [Linking](#linking-whatsapp) · [Owner Commands](#owner-commands) · [Plugins](#writing-a-plugin) · [Structure](#project-structure)

</div>

---

## Highlights

- **Two login methods** — pairing code or QR code, selected with one environment variable.
- **Drop-in plugins** — add a `.js` file under `src/plugins/`, restart, and it is loaded automatically.
- **Reliable reconnects** — exponential backoff with jitter, fresh re-login after unlinking, and a clean stop on fatal disconnects.
- **Chat-side controls** — manage prefixes, self mode, selective replies, and lock the bot without editing files.
- **Restart & reload** — `res` restarts the whole process, `r` hot-reloads plugins and lists changed files.
- **Dynamic menu** — generated from plugin categories, with a customizable link preview.
- **Persistent state** — the WhatsApp session and runtime settings survive restarts.

## Quick Start

**Requirements:** Node.js **20.19+** and a WhatsApp account.

```bash
git clone https://github.com/dennyatahu/zabo.git
cd zabo
npm install
cp .env.example .env
```

Configure `.env`:

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_METHOD` | `pair` | Login method: `pair` (pairing code) or `qr` (QR code). |
| `BOT_PN` | — | Bot phone number, digits only with country code. Required for `pair`. |
| `OWNER` | — | Owner number(s), comma-separated. Owner commands work without a prefix. |
| `BOT_NAME` | `zabo` | Name used by the `lock` and `unlock` commands. |
| `LOG_LEVEL` | `info` | Log verbosity: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`. |

`TITLE_MENU` and `DESC_MENU` set the menu link preview (`zabo` / `by dennyatahu` by default).

Run the bot:

```bash
npm start      # start the bot
npm run dev    # start with file watching (runs without the launcher, so `res` is unavailable)
```

The bot exits with a clear message if `AUTH_METHOD` is invalid or `BOT_PN` is missing in `pair` mode.

## Linking WhatsApp

Linking is only needed on the first run. Credentials are stored in `data/session.sqlite`, so later starts reconnect automatically.

**Pairing code** — set `BOT_PN`, start the bot, then open WhatsApp → **Linked devices** → **Link a device** → **Link with phone number instead** and enter the code shown in the terminal.

**QR code** — set `AUTH_METHOD=qr`, start the bot, then open WhatsApp → **Linked devices** → **Link a device** and scan the terminal QR code.

> [!NOTE]
> To switch methods on an already-linked account, stop the bot, delete `data/session.sqlite`, change `AUTH_METHOD`, and start again. If the device is unlinked from the phone, the bot re-links using the configured method.

## Persistent Data

Bot settings (prefixes, self mode, selective mode, lock mode, and menu media) are stored in `data/database.sqlite` using `node:sqlite`. Tables and indexes are created automatically on first run. Delete that file to reset every setting to its default.

## Owner Commands

Owner commands work without a prefix. Add `-h` at the end of any of them to show its guide.

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

Examples: `prefix add #`, `plugin get ping -t`, `selective to ping @628123456789`, `menu save thumb beach`, `selective -h`.

## Writing a Plugin

Create any `.js` file under `src/plugins/<category>/` and restart the bot:

```js
export default {
  name: "hello",
  commands: ["hello", "hi"],
  categories: ["info"],
  ownerOnly: false,
  options: { bypassPrefix: false },

  fn: async ({ m, text, client, jid }) => {
    return m.reply(`Hello ${text || "world"}!`);
  },
};
```

`ownerOnly` and `options.bypassPrefix` are optional. Set the latter to make a command work even when prefix mode is on.

The handler context also provides `args`, `q` (quoted message), `store`, `command`, `prefix`, and the managers: `pluginManager`, `prefixManager`, `selfManager`, `selectiveManager`, `menuManager`, `lockManager`, `reloadManager`, and `restartManager`. Commands are case-insensitive and cannot contain spaces.

## Project Structure

```text
src/
├── index.js        # launcher (restarts the bot process)
├── main.js         # bootstrap
├── config.js       # environment + paths
├── core/           # client, session, dispatcher, store, logger
├── events/         # auth, connection, and message handlers
├── managers/       # plugin, prefix, self, selective, menu, lock, reload, restart
├── plugins/        # commands grouped by category
├── lib/            # serialization, owner check, image pipeline, selective send
├── utils/          # shared helpers
└── constants/      # reconnect, restart, and image settings

data/               # runtime state (auto-created, git-ignored)
```

## License

[MIT](LICENSE)
