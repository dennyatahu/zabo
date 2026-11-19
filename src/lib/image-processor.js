import { Worker } from "node:worker_threads";

const WORKER_URL = new URL("./image-worker.js", import.meta.url);

export const processImage = (task, buffer) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { workerData: { task, buffer } });

    worker.once("message", ({ result, error }) => {
      worker.terminate();

      if (error) return reject(Object.assign(new Error(error.message), { code: error.code }));

      return resolve(result);
    });

    worker.once("error", reject);

    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`image worker exited with code ${code}`));
    });
  });
