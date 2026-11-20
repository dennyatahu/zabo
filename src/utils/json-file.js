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

const writeJson = async (filePath, payload) => {
  const tempPath = `${filePath}.tmp`;

  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, filePath);
};

export const createJsonSaver = (filePath, label) => {
  let queue = Promise.resolve();

  return (data) => {
    const payload = JSON.stringify(data, null, 2);

    queue = queue
      .then(() => writeJson(filePath, payload))
      .catch((err) => logger.error({ err, path: filePath }, `${label} save failed`));

    return queue;
  };
};
