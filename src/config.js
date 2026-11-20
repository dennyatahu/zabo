import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_METHODS = Object.freeze(["pair", "qr"]);

const getEnv = (name) => process.env[name]?.trim();

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

const dataDir = resolve(import.meta.dirname, "../data");

mkdirSync(dataDir, { recursive: true });

export const config = Object.freeze({
  authMethod,
  botPn,
  sessionId: "default",
  owners: Object.freeze(
    (getEnv("OWNER") ?? "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter(Boolean),
  ),
  paths: Object.freeze({
    root: resolve(import.meta.dirname, ".."),
    src: import.meta.dirname,
    data: dataDir,
    plugins: resolve(import.meta.dirname, "plugins"),
    session: resolve(dataDir, "session.sqlite"),
    database: resolve(dataDir, "database.sqlite"),
  }),
});
