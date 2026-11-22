<div align="center">

<img src="https://cloud.yardansh.com/Kbmh9u.png" alt="zabo" width="120" />

# zabo

**Fast, lightweight WhatsApp bot powered by [zapo-js](https://www.npmjs.com/package/zapo-js).**

[![Node](https://img.shields.io/badge/node-%E2%89%A522.5-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![zapo-js](https://img.shields.io/badge/powered%20by-zapo--js-25D366)](https://www.npmjs.com/package/zapo-js)

</div>

## Features

- 🔌 **Drop-in plugins**: add a `.js` file, restart, done
- 🔐 **Pairing code or QR** login with auto-reconnect
- 🎛️ **Chat-side control**: prefix, self, lock, and selective modes
- 💾 **Persistent** session and settings in SQLite

## Quick start

```bash
git clone https://github.com/dennyatahu/zabo.git
cd zabo
npm install
cp .env.example .env
npm start
```

Requires **Node.js 22.5+**. Pairing code: set `BOT_PN`, then WhatsApp → *Linked devices* → *Link with phone number*. QR: set `AUTH_METHOD=qr` and scan.

## Environment

| Variable      | Default | Description                                  |
| ------------- | ------- | -------------------------------------------- |
| `AUTH_METHOD` | `pair`  | `pair` or `qr`                               |
| `BOT_PN`      | n/a     | Bot number, required for `pair`              |
| `OWNER`       | n/a     | Owner number(s), comma-separated             |
| `BOT_NAME`    | `zabo`  | Name accepted by `lock` / `unlock`           |
| `TITLE_MENU`  | `zabo`  | Default link preview title (override: `menu set title`) |
| `DESC_MENU`   | n/a     | Default link preview description (override: `menu set desc`) |
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

## Write a plugin

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

The handler also receives `args`, `q`, `client`, `jid`, `store`, `prefix`, and every manager.

## License

[MIT](LICENSE)
