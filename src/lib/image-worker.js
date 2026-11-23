import { parentPort, workerData } from "node:worker_threads";

import sharp from "sharp";

import { FAVICON_SIZE } from "../constants.js";

const THUMBNAIL_SIZE = 640;
const PREVIEW_SIZE = 50;
const JPEG_QUALITY = 80;
const WHITE = "#ffffff";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const read = async (buffer) => {
  const image = sharp(buffer);

  try {
    await image.metadata();
  } catch {
    throw Object.assign(new Error("invalid image"), { code: "INVALID_IMAGE" });
  }

  return image;
};

const encodeJpeg = (source, size) =>
  source
    .clone()
    .resize(size, size, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "linear",
    })
    .flatten({ background: WHITE })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

const TASKS = Object.freeze({
  thumbnail: async (image) => ({ data: await encodeJpeg(image, THUMBNAIL_SIZE) }),

  favicon: async (image) => ({
    data: await image
      .clone()
      .resize(FAVICON_SIZE, FAVICON_SIZE, {
        fit: "contain",
        background: TRANSPARENT,
        kernel: "linear",
      })
      .png()
      .toBuffer(),
  }),

  preview: async (image) => {
    const { width, height } = await image.metadata();

    return {
      width,
      height,
      data: await encodeJpeg(image, PREVIEW_SIZE),
    };
  },
});

try {
  const image = await read(Buffer.from(workerData.buffer));

  parentPort.postMessage({ result: await TASKS[workerData.task](image) });
} catch (err) {
  parentPort.postMessage({ error: { code: err.code, message: err.message } });
}
