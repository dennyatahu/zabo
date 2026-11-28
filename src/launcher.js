import { resolve } from "node:path";

import { RESTART_EXIT_CODE, SUPERVISED_ENV } from "./constants.js";

const entry = resolve(import.meta.dir, "main.js");
const execArgv = process.execArgv.filter((arg) => !arg.startsWith("--watch"));

let child = null;
let stopping = false;

const start = () => {
  child = Bun.spawn([process.execPath, ...execArgv, entry], {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env, [SUPERVISED_ENV]: "1" },
  });

  child.exited
    .then((code) => {
      child = null;

      if (!stopping && code === RESTART_EXIT_CODE) {
        start();
        return;
      }

      process.exit(code ?? (stopping ? 0 : 1));
    })
    .catch((error) => {
      console.error(`[launcher] failed to start: ${error.message}`);
      process.exit(1);
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