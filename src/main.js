import { Session, registerProcessHandlers } from "./core/session.js";
import { menuManager } from "./managers/menu-manager.js";
import { pluginManager } from "./managers/plugin-manager.js";
import { prefixManager } from "./managers/prefix-manager.js";
import { reloadManager } from "./managers/reload-manager.js";
import { restartManager } from "./managers/restart-manager.js";
import { selectiveManager } from "./managers/selective-manager.js";
import { lockManager, selfManager } from "./managers/toggle-manager.js";

const session = new Session();

registerProcessHandlers(session);
restartManager.bind(session);

prefixManager.init();
selfManager.init();
lockManager.init();
selectiveManager.init();
menuManager.init();
await reloadManager.init();
await pluginManager.load();
await session.start();
