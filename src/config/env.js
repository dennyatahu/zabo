// Reads and validates environment variables from .env (auto-loaded by Bun).
// Call loadEnv() at startup (src/main.js) to populate the exported `config`.
// No side effects on import: no process.exit, no folder creation.
//
// Environment variable contract (kept unchanged):
//   AUTH_METHOD   "pair" | "qr"                 (default: "pair")
//   BOT_PN        digits only, with country code (required when pair)
//   BOT_NAME      default "zabo"
//   TITLE_MENU    default "zabo"
//   DESC_MENU     default "by dennyatahu"
//   OWNER         comma-separated owner numbers
//   LOG_LEVEL     trace..fatal or silent        (default: "info")

const getEnv = (name) => {
  const value = Bun.env[name];
  return typeof value === "string" ? value.trim() : undefined;
};

// Populated by loadEnv(). Modules import `config` and access it at runtime,
// after main.js has called loadEnv().
export let config = null;

const AUTH_METHODS = Object.freeze(["pair", "qr"]);

export const loadEnv = () => {
  const authMethod = (getEnv("AUTH_METHOD") || "pair").toLowerCase();

  if (!AUTH_METHODS.includes(authMethod)) {
    throw new Error(
      `AUTH_METHOD must be one of: ${AUTH_METHODS.join(", ")} (got "${authMethod}")`,
    );
  }

  const botPn =
    authMethod === "pair"
      ? (getEnv("BOT_PN")?.replace(/\D/g, "") || undefined)
      : undefined;

  if (authMethod === "pair" && !botPn) {
    throw new Error(
      "BOT_PN is required when AUTH_METHOD=pair (digits only, with country code)",
    );
  }

  const owners = Object.freeze(
    (getEnv("OWNER") ?? "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter(Boolean),
  );

  config = Object.freeze({
    authMethod,
    botPn,
    botName: getEnv("BOT_NAME") ?? "zabo",
    titleMenu: getEnv("TITLE_MENU") ?? "zabo",
    descMenu: getEnv("DESC_MENU") ?? "by dennyatahu",
    owners,
    logLevel: (() => {
      const level = (getEnv("LOG_LEVEL") || "info").toLowerCase();
      const valid = Object.freeze([
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "silent",
      ]);
      return valid.includes(level) ? level : "info";
    })(),
    sessionId: "default",
  });

  return config;
};
