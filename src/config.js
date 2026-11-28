import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_METHODS = Object.freeze(["pair", "qr"]);

const getEnv = (name) => Bun.env[name]?.trim();

const fail = (message) => {
  console.error(`[config] ${message}`);
  process.exit(1);
};

const authMethod = (getEnv("AUTH_METHOD") || "pair").toLowerCase();

if (!AUTH_METHODS.includes(authMethod)) {
  fail(`AUTH_METHOD must be one of: ${AUTH_METHODS.join(", ")} (got "${authMethod}")`);
}

const botPn = getEnv("BOT_PN")?.replace(/\D/g, "") || undefined;

if (authMethod === "pair" && !botPn) {
  fail("BOT_PN is required when AUTH_METHOD=pair (digits only, with country code)");
}

const botName = getEnv("BOT_NAME") || "zabo";
const titleMenu = getEnv("TITLE_MENU") ?? "zabo";
const descMenu = getEnv("DESC_MENU") ?? "by dennyatahu";

const dataDir = resolve(import.meta.dir, "../data");

mkdirSync(dataDir, { recursive: true });

export const config = Object.freeze({
  authMethod,
  botPn,
  botName,
  titleMenu,
  descMenu,
  sessionId: "default",
  owners: Object.freeze(
    (getEnv("OWNER") ?? "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter(Boolean),
  ),
  paths: Object.freeze({
    root: resolve(import.meta.dir, ".."),
    src: import.meta.dir,
    data: dataDir,
    plugins: resolve(import.meta.dir, "plugins"),
    session: resolve(dataDir, "session.sqlite"),
    database: resolve(dataDir, "database.sqlite"),
  }),
});
