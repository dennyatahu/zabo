import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const getEnv = (name) => process.env[name]?.trim();

const dataDir = resolve(import.meta.dirname, "../data");

mkdirSync(dataDir, { recursive: true });

export const config = Object.freeze({
  botPn: getEnv("BOT_PN"),
  owners: Object.freeze(
    (getEnv("OWNER") ?? "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter(Boolean),
  ),
  paths: Object.freeze({
    data: dataDir,
    plugins: resolve(import.meta.dirname, "plugins"),
    session: resolve(dataDir, "session.sqlite"),
  }),
});
