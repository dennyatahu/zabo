<div align="center">

<img src="https://cloud.yardansh.com/Kbmh9u.png" alt="zabo" width="120" />

# zabo

**Fast, lightweight WhatsApp bot powered by [zapo-js](https://www.npmjs.com/package/zapo-js).**

[![Bun](https://img.shields.io/badge/bun-%E2%89%A51.4-000000?logo=bun&logoColor=white)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![zapo-js](https://img.shields.io/badge/powered%20by-zapo--js-25D366)](https://www.npmjs.com/package/zapo-js)

</div>

## Features

- 🔌 **Drop-in plugins**: add a `.js` file under `src/plugins/<category>/`, restart or reload, done
- 🔐 **Pairing code or QR** login with auto-reconnect
- 🎛️ **Chat-side control**: prefix, self, lock, and selective modes
- 💾 **Persistent** session and settings in SQLite (`bun:sqlite`)

## Quick start

```bash
git clone https://github.com/dennyatahu/zabo.git
cd zabo
bun install
cp .env.example .env
bun start
```

Requires **Bun 1.4+**. Pairing code: set `BOT_PN`, then WhatsApp → *Linked devices* → *Link with phone number*. QR: set `AUTH_METHOD=qr` and scan.

## Commands

```bash
bun install          # install dependencies (clean install: rm -rf node_modules bun.lock first)
bun start            # run through the supervisor (restart on exit code 75)
bun run dev          # run main.js directly with --watch
```

## Environment

| Variable      | Default | Description                                  |
| ------------- | ------- | -------------------------------------------- |
| `AUTH_METHOD` | `pair`  | `pair` or `qr`                               |
| `BOT_PN`      | n/a     | Bot number, required for `pair`              |
| `OWNER`       | n/a     | Owner number(s), comma-separated             |
| `BOT_NAME`    | `zabo`  | Name accepted by `lock` / `unlock`           |
| `TITLE_MENU`  | `zabo`  | Default link preview title (override: `menu set title`) |
| `DESC_MENU`   | `by dennyatahu` | Default link preview description (override: `menu set desc`) |
| `LOG_LEVEL`   | `info`  | `trace` to `fatal`, or `silent`              |

## Owner commands

Work without a prefix. Add `-h` for a guide.

| Command                          | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `self on` / `off`                | Owner-only mode                          |
| `lock @bot` / `unlock @bot`      | Block everyone, owner included           |
| `prefix add \| del \| on \| off` | Manage prefixes                          |
| `selective on \| off \| only \| to` | Reply visible only to the sender      |
| `plugin add \| del \| get \| list` | Manage plugins from chat               |
| `menu set \| get \| del \| save` | Customize the menu images and link       |
| `r` / `res`                      | Reload plugins / restart process         |
| `!` / `!!`                       | Eval JavaScript (owner-only, full access) |
| `$`                              | Run shell command (owner-only, full access) |

## Project structure

```
zabo/
├─ src/
│  ├─ main.js                  bootstrap (env → logger → db → managers → session)
│  ├─ launcher.js              supervisor: exit code 75 = restart child
│  ├─ config/                  env.js, paths.js, constants.js
│  ├─ core/                    client.js, session.js, dispatcher.js, store.js,
│  │                           logger.js, events/ (auth, connection, message)
│  ├─ database/                connection.js, schema.js, migrations.js, settings.js
│  ├─ managers/                prefix.js, toggle.js, plugin.js, reload.js,
│  │                           restart.js, selective.js, menu/ (image, storage,
│  │                           command, index)
│  ├─ lib/                     jid.js, push-name.js, serialize-message.js,
│  │                           format.js, guide.js, plugin-schema.js, qr.js,
│  │                           split-string.js, selective/, eval/
│  └─ plugins/
│     ├─ owner/                self, lock, unlock, prefix, selective, plugin,
│     │                        menu, reload, restart, eval, eval-async, shell
│     └─ info/                 ping, uptime, memory, menu
├─ data/                       runtime databases (gitignored)
├─ .env.example
├─ package.json
├─ bun.lock
└─ README.md
```

No TypeScript, no `jsconfig.json`/`tsconfig.json`, no `#...` import aliases. All internal imports are relative with full `.js` extensions.

## Write a plugin

Create `src/plugins/info/hello.js` (or any category folder):

```js
export default {
  name: "hello",
  commands: ["hello", "hi"],
  categories: ["info"],
  ownerOnly: false,
  options: { bypassPrefix: false },
  fn: ({ m, text }) => m.reply(`Hello ${text || "world"}!`),
};
```

The handler receives `m`, `q`, `text`, `args`, `client`, `jid`, `store`, `prefix`, `command`, plus every manager (`prefixManager`, `menuManager`, `pluginManager`, `reloadManager`, `restartManager`, `selectiveManager`, `lockManager`, `selfManager`).

## License

[MIT](LICENSE)
