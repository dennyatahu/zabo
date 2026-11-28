// Menu module entry point: creates and exports the shared MenuManager instance.
// configureMenu() applies config fallbacks (env TITLE_MENU/DESC_MENU) and must
// be called from bootstrap after loadEnv() has populated config.

import { MenuManager } from "./command.js";
import { config } from "../../config/env.js";

export const menuManager = new MenuManager();

export const configureMenu = () => {
  menuManager.configure(config.titleMenu, config.descMenu);
};
