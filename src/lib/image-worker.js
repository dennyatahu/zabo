import { parentPort, workerData } from "node:worker_threads";

import { Jimp, JimpMime, ResizeStrategy } from "jimp";

const THUMBNAIL_SIZE = 640;
const PREVIEW_SIZE = 50;
const FAVICON_SIZE = 48;
const JPEG_QUALITY = 80;

const read = async (buffer) => {
  try {
    return await Jimp.read(buffer);
  } catch {
    throw Object.assign(new Error("invalid image"), { code: "INVALID_IMAGE" });
  }
};

const encodeJpeg = (source, size) => {
  const image = source.clone();

  if (Math.max(image.bitmap.width, image.bitmap.height) > size) {
    image.scaleToFit({ w: size, h: size, mode: ResizeStrategy.BILINEAR });
  }

  const { width, height } = image.bitmap;

  return new Jimp({ width, height, color: 0xffffffff })
    .composite(image)
    .getBuffer(JimpMime.jpeg, { quality: JPEG_QUALITY });
};

const TASKS = Object.freeze({
  thumbnail: async (image) => ({ data: await encodeJpeg(image, THUMBNAIL_SIZE) }),

  favicon: async (image) => ({
    data: await image
      .clone()
      .contain({ w: FAVICON_SIZE, h: FAVICON_SIZE, mode: ResizeStrategy.BILINEAR })
      .getBuffer(JimpMime.png),
  }),

  preview: async (image) => ({
    width: image.bitmap.width,
    height: image.bitmap.height,
    data: await encodeJpeg(image, PREVIEW_SIZE),
  }),
});

try {
  const image = await read(Buffer.from(workerData.buffer));

  parentPort.postMessage({ result: await TASKS[workerData.task](image) });
} catch (err) {
  parentPort.postMessage({ error: { code: err.code, message: err.message } });
}
