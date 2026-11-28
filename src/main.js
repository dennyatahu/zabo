// Application entry point. Bootstrap runs in a strict, documented order:
//   1. Load & validate env (config/env.js) — throws on invalid config
//   2. Initialize structured logger (core/logger.js)
//   3. Open database & run migrations (database/*) — idempotent, data-safe
//   4. Initialize managers (prefix, toggle, selective, menu, plugin, reload)
//   5. Bind process signal handlers (SIGINT/SIGTERM → graceful shutdown)
//   6. Bind restart manager to session
//   7. Start the WhatsApp session (connect / reconnect loop)
//
// Managers are initialized before session.start() so their in-memory state is
// ready when the first message arrives. reloadManager.init() snapshots file
// hashes before pluginManager.load() so the baseline reflects the loaded state.

import { loadEnv } from "./config/env.js";
import { initLogger, getLogger } from "./core/logger.js";
import { openDatabase, getDatabase } from "./database/connection.js";
import { SCHEMA } from "./database/schema.js";
import { runMigrations } from "./database/migrations.js";
import { Session, registerProcessHandlers } from "./core/session.js";
import { restartManager } from "./managers/restart.js";
import { prefixManager } from "./managers/prefix.js";
import { lockManager, selfManager } from "./managers/toggle.js";
import { selectiveManager } from "./managers/selective.js";
import { menuManager, configureMenu } from "./managers/menu/index.js";
import { reloadManager } from "./managers/reload.js";
import { pluginManager } from "./managers/plugin.js";

// 1. Load & validate env. Any error aborts startup before anything else opens.
try {
  loadEnv();
} catch (error) {
  console.error(`[config] ${error.message}`);
  process.exit(1);
}

// 2. Initialize logger (async: loads pino + pino-pretty).
await initLogger();
const logger = getLogger();
logger.info("zabo starting");

// 3. Open database and run migrations (idempotent, does not drop user data).
openDatabase();
const db = getDatabase();
db.exec(SCHEMA);
runMigrations(db);
logger.info("database ready");

// 4. Initialize managers (order: toggles first, then prefix/selective/menu,
// then plugin/reload so plugin registry is ready for reload snapshots).
lockManager.init();
selfManager.init();
prefixManager.init();
selectiveManager.init();
configureMenu();
menuManager.init();

await reloadManager.init();
await pluginManager.load();

// 5. Create session and bind process handlers.
const session = new Session();

registerProcessHandlers(session);
restartManager.bind(session);

// 6. Start WhatsApp session.
await session.start();
