import qrcode from "qrcode-terminal";

import { RECONNECT_BASE_MS, RECONNECT_MAX_MS } from "./constants.js";

export const ok = (data) => ({ data });

export const fail = (error) => ({ error });

export const splitString = (input) => {
  if (typeof input !== "string" || !input) {
    return { first: undefined, rest: undefined };
  }

  const index = input.search(/\s/);

  return {
    first: index === -1 ? input : input.slice(0, index),
    rest: index === -1 ? undefined : input.slice(index).trimStart(),
  };
};

export const formatPairingCode = (code) => code.match(/.{1,4}/g)?.join("-") ?? code;

const BYTE_UNITS = Object.freeze(["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]);
const BYTE_BASE = 1024;

export const formatBytes = (bytes, decimals = 2) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";

  const exponent = Math.floor(Math.log(bytes) / Math.log(BYTE_BASE));
  const index = Math.min(Math.max(exponent, 0), BYTE_UNITS.length - 1);
  const value = (bytes / BYTE_BASE ** index).toFixed(Math.max(0, decimals));

  return `${Number.parseFloat(value)} ${BYTE_UNITS[index]}`;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

const UPTIME_UNITS = Object.freeze([
  ["mo", MONTH],
  ["d", DAY],
  ["h", HOUR],
  ["m", MINUTE],
  ["s", SECOND],
  ["ms", 1],
]);

export const formatUptime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0ms";

  let remaining = Math.round(seconds * SECOND);
  const parts = [];

  for (const [label, size] of UPTIME_UNITS) {
    const value = Math.floor(remaining / size);

    remaining -= value * size;

    if (value > 0) parts.push(`${value}${label}`);
  }

  return parts.length ? parts.join(" ") : "0ms";
};

export const backoff = (attempts) => {
  const exponential = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);

  return exponential + Math.floor(Math.random() * 1_000);
};

const isCommand = (value) => typeof value === "string" && value.length > 0 && !/\s/.test(value);

export const isValidPlugin = (plugin) =>
  typeof plugin === "object" &&
  plugin !== null &&
  typeof plugin.name === "string" &&
  plugin.name.length > 0 &&
  Array.isArray(plugin.commands) &&
  plugin.commands.length > 0 &&
  plugin.commands.every(isCommand) &&
  typeof plugin.fn === "function";

export const renderQr = (qr) =>
  new Promise((resolve) => {
    qrcode.generate(qr, { small: true }, resolve);
  });

const HELP_FLAG = /(?:^|\s)(?:-h|--help)\s*$/i;

const code = (value) => `\`${value}\``;

const section = (heading, lines) => [`*${heading}*`, ...lines].join("\n");

export const isHelp = (text) => typeof text === "string" && HELP_FLAG.test(text);

export const buildGuide = ({ title, summary, groups, examples = [], notes = [], prefix = "" }) => {
  const blocks = [[`*${title}*`, summary].filter(Boolean).join("\n")];

  for (const { heading = "Usage", rows } of groups) {
    const lines = rows.map(
      ([syntax, description]) => `▸ ${code(prefix + syntax)}\n  ${description}`,
    );

    blocks.push(section(heading, lines));
  }

  if (examples.length) {
    blocks.push(section("Examples", examples.map((example) => `▸ ${code(prefix + example)}`)));
  }

  if (notes.length) blocks.push(section("Notes", notes.map((note) => `▸ ${note}`)));

  return blocks.join("\n\n");
};

export const buildError = (message, command) =>
  [
    "*Error*",
    `▸ ${message}`,
    ...(command ? [`▸ Send ${code(`${command} -h`)} for help.`] : []),
  ].join("\n");
