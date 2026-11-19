import { Session } from "./core/session.js";
import { registerProcessHandlers } from "./core/process.js";
import { pluginManager } from "./managers/plugin-manager.js";
import { prefixManager } from "./managers/prefix-manager.js";
import { selfManager } from "./managers/self-manager.js";

const session = new Session();

registerProcessHandlers(session);

await prefixManager.init();
await selfManager.init();
await pluginManager.load();
await session.start();
