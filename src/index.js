import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { RESTART_EXIT_CODE, SUPERVISED_ENV } from "./constants/restart.js";

const entry = resolve(import.meta.dirname, "main.js");
const execArgv = process.execArgv.filter((arg) => !arg.startsWith("--watch"));

let child = null;
let stopping = false;

const start = () => {
  child = spawn(process.execPath, [...execArgv, entry], {
    stdio: "inherit",
    env: { ...process.env, [SUPERVISED_ENV]: "1" },
  });

  child.once("error", (error) => {
    console.error(`[launcher] failed to start: ${error.message}`);
    process.exit(1);
  });

  child.once("exit", (code) => {
    child = null;

    if (!stopping && code === RESTART_EXIT_CODE) {
      start();
      return;
    }

    process.exit(code ?? (stopping ? 0 : 1));
  });
};

const stop = (signal) => {
  stopping = true;

  if (child) child.kill(signal);
  else process.exit(0);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

start();
