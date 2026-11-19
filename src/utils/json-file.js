import { readFile, rename, writeFile } from "node:fs/promises";

import { logger } from "../core/logger.js";

export const readJson = async (filePath) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      logger.warn({ err, path: filePath }, "failed to read json");
    }
    return undefined;
  }
};

export const writeJson = async (filePath, payload) => {
  const tempPath = `${filePath}.tmp`;

  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, filePath);
};
