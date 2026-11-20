# zabo

Fast & modern WhatsApp bot built with [zapo-js](https://www.npmjs.com/package/zapo-js). Lightweight, plugin-based, and ESM-only.

## Features

- **Two login methods** – pairing code (phone number) or QR code, chosen with one env variable
- **Plugin system** – drop a `.js` file into `src/plugins/` and it is picked up automatically
- **Smart reconnect** – exponential backoff with jitter, fresh re-login after logout, and a clean stop on fatal errors (ban, replaced session)
- **Runtime prefix control** – add, remove, enable, or disable prefixes from chat
- **Self mode** – restrict the bot to the owner with one command
- **Dynamic menu** – auto-generated from plugin categories, with a customizable link preview (url, title, description, thumbnail, favicon)
- **Persistent SQLite session** – credentials and state survive restarts
- **Graceful shutdown** – handles `SIGINT` / `SIGTERM` and uncaught errors

## Requirements

- Node.js **>= 20.19**
- A WhatsApp account to link the bot to

## Getting Started

```bash
git clone https://github.com/dennyatahu/zabo.git
cd zabo
npm install
cp .env.example .env
```

Edit `.env`:

| Variable      | Required            | Description                                                                 | Example        |
| ------------- | ------------------- | --------------------------------------------------------------------------- | -------------- |
| `AUTH_METHOD` | No (default `pair`) | Login method: `pair` (pairing code) or `qr` (QR code)                       | `qr`           |
| `BOT_PN`      | Only if `pair`      | Bot phone number, digits only, with country code. Ignored when using `qr`   | `628123456789` |
| `OWNER`       | No                  | Owner number(s), comma-separated                                            | `628111111111,62822` |

The value is exposed as `config.authMethod` in `src/config.js`. The bot exits at startup with a clear message if `AUTH_METHOD` is invalid, or if it is `pair` and `BOT_PN` is empty.

Start the bot:

```bash
npm start
```

## Login Methods

Login only happens on the first run. The session is saved to `data/session.sqlite`, so later starts reconnect automatically.

**Pairing code** (`AUTH_METHOD=pair`)

1. Set `BOT_PN` to the bot's number.
2. Start the bot and copy the code shown in the terminal.
3. In WhatsApp, open **Linked devices → Link a device → Link with phone number instead** and enter the code.

**QR code** (`AUTH_METHOD=qr`)

1. Start the bot; a QR code is printed in the terminal and refreshed automatically.
2. In WhatsApp, open **Linked devices → Link a device** and scan it.

To switch methods on an account that is already linked, stop the bot, delete `data/session.sqlite`, change `AUTH_METHOD`, and start again. If the device is unlinked from the phone, the bot logs in again with the configured method.

## Commands

Owner-only commands work without a prefix. Everyone can use the public ones unless self mode is on.

| Command           | Access | Description                                                  |
| ----------------- | ------ | ------------------------------------------------------------ |
| `ping`, `p`       | Public | Replies with `pong!` and the measured latency                |
| `mem`             | Public | Shows Node.js memory usage                                   |
| `self on \| off`  | Owner  | Toggle self mode (only the owner can use the bot)            |
| `prefix <flag>`   | Owner  | `--add <p>`, `--del <p \| number>`, `--list`, `--on`, `--off`, `--reset` |
| `selective <flag>` | Owner | `--on`, `--off` (this group), `--on --all`, `--off --all` (all groups), `--only --set <cmd, cmd>`, `--only --del <cmd, cmd>`, `--only --list` |
| `! <code>`        | Owner  | Evaluate JavaScript                                          |
| `!! <code>`       | Owner  | Evaluate async JavaScript (wrapped in an async function)     |
| `$ <command>`     | Owner  | Run a shell command; long output is sent as a file           |

`selective --only --list` shows each target's WhatsApp display name (pushName) next to the number. A name is known after that user has sent a message the bot received; until then only `@number` is shown.

> **Security:** `!`, `!!`, and `$` give full control of the host machine. Only put numbers you fully trust in `OWNER`.

## Writing a Plugin

Create a file in `src/plugins/<category>/`. It is loaded at startup:

```js
export default {
  name: "hello",
  commands: ["hello", "hi"],
  categories: ["info"],
  ownerOnly: false,
  options: { bypassPrefix: false },

  fn: async ({ m, args, text, client, jid }) => {
    return m.reply(`Hello ${text || "world"}!`);
  },
};
```

`ownerOnly` and `options.bypassPrefix` are optional (the latter makes the command work even when prefix mode is on). The handler context also exposes `q` (quoted message), `store`, `command`, `prefix`, and the managers (`pluginManager`, `prefixManager`, `selfManager`, `selectiveManager`, `menuManager`). Commands are case-insensitive and must not contain spaces.

## Menu

The menu is generated from each plugin's `categories` and `commands`, so new plugins show up automatically. Settings live in `data/menu.json`.

| Command | Access | Description |
| --- | --- | --- |
| `menu` | everyone | Main menu (category list) |
| `menu <category>` | everyone | Commands in one category |
| `menu all` | everyone | All categories |
| `menu --help` / `-h` | everyone | Usage guide |
| `menu --set --thumbnail <url>` | owner | Set the thumbnail (or reply to / caption an image) |
| `menu --set --thumbnail --name <text>` / `--index <n>` | owner | Set the thumbnail from a saved one |
| `menu --set --favicon <url>` | owner | Set the favicon (also `--name` / `--index`) |
| `menu --set --url <url>` / `--title <text>` / `--desc <text>` | owner | Update the link preview text |
| `menu --get --thumbnail` | owner | Receive `thumbnail-buffer.json` with the base64 image |
| `menu --get --url` / `--title` / `--desc` | owner | Show the current value |
| `menu --del --url` / `--title` / `--desc` | owner | Clear the value |
| `menu --save --thumbnail <url> --name <text>` | owner | Save a thumbnail (or reply to / caption an image) |
| `menu --save --favicon <url> --name <text>` | owner | Save a favicon |
| `menu --save --list [--thumbnail \| --favicon]` | owner | List saved items (index starts at 1) |
| `menu --del --thumbnail <index \| name>` / `--favicon <index \| name>` | owner | Delete a saved item |

## Project Structure

```
src/
├── index.js          # entry point
├── config.js         # env (authMethod, botPn, owners) + paths
├── core/             # client, session, dispatcher, store, logger
├── events/           # auth (pair / qr), connection, message handlers
├── managers/         # plugin, prefix, self, selective, menu state
├── plugins/          # commands (info, owner, ...)
├── lib/              # owner check, message serializer, selective group send, push name store
├── utils/            # small helpers (pairing code, QR render, ...)
└── constants/        # reconnect settings
data/                 # runtime data (git-ignored): session, prefix, self mode, selective mode, menu
```

## Notes

- Never commit `data/` or `.env`. `data/session.sqlite` holds your WhatsApp credentials.
- Prefix mode is **off** by default, so commands work without a prefix until you run `prefix --on`.

## License

[MIT](LICENSE)
