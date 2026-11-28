// Launcher / supervisor. Spawns src/main.js as a child process and restarts it
// when it exits with code 75 (RESTART_EXIT_CODE). The child runs with
// ZABO_SUPERVISED=1 so it knows it is supervised.
// Protocol (unchanged): exit code 75 = request restart; env ZABO_SUPERVISED=1.

import { PATHS } from "./config/paths.js";
import { RESTART_EXIT_CODE, SUPERVISED_ENV } from "./config/constants.js";

const entry = `${PATHS.src}main.js`;
const execArgv = process.execArgv.filter((arg) => !arg.startsWith("--watch"));

let child = null;
let stopping = false;

const start = () => {
  child = Bun.spawn(["bun", entry], {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env, [SUPERVISED_ENV]: "1" },
    cwd: PATHS.root,
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
