// Image processing for menu media (thumbnail, favicon).
// Uses sharp (native addon) for resize/encode. Falls back gracefully: sharp
// errors surface as UserError("That file is not a valid image.").
// All buffers are Uint8Array-compatible; sharp accepts and returns Buffer.

import sharp from "sharp";

import { MAX_IMAGE_BYTES, FETCH_TIMEOUT_MS, THUMBNAIL_SIZE, PREVIEW_SIZE, FAVICON_SIZE, JPEG_QUALITY } from "../../config/constants.js";

const WHITE = "#ffffff";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const THUMBNAIL_MEDIA_TYPES = ["thumbnail-link", "image"];

const readImage = async (buffer) => {
  const image = sharp(buffer);
  try {
    await image.metadata();
  } catch {
    const err = new Error("invalid image");
    err.code = "INVALID_IMAGE";
    throw err;
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

const encodePng = (source, size) =>
  source
    .clone()
    .resize(size, size, {
      fit: "contain",
      background: TRANSPARENT,
      kernel: "linear",
    })
    .png()
    .toBuffer();

// Per-kind processing tasks.
export const TASKS = Object.freeze({
  thumbnail: async (image) => ({ data: await encodeJpeg(image, THUMBNAIL_SIZE) }),
  favicon: async (image) => ({
    data: await encodePng(image, FAVICON_SIZE),
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

export const processImage = async (task, buffer) => {
  const image = await readImage(buffer);
  return TASKS[task](image);
};

export const isHttpUrl = (value) => /^https?:\/\//i.test(value) && URL.canParse(value);

export const fetchImage = async (value) => {
  const url = value.trim();

  if (!isHttpUrl(url)) {
    throw new Error("That URL is not valid. It must start with http:// or https://.");
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`Failed to download the image (HTTP ${response.status}).`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (!Number.isNaN(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new Error("The image is too large (max 10 MB).");
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("The image is too large (max 10 MB).");
  }

  return new Uint8Array(bytes);
};

export const toBuffer = async (input) => {
  if (typeof input === "string") return await fetchImage(input);
  if (input instanceof Uint8Array) return input;
  throw new Error("The image source must be a URL or a buffer.");
};

export const runTask = async (task, buffer) => {
  try {
    return await processImage(task, buffer);
  } catch (err) {
    if (err.code === "INVALID_IMAGE") throw new Error("That file is not a valid image.");
    throw err;
  }
};

export const toMediaFields = (media, width, height) => ({
  thumbnailDirectPath: media.directPath,
  thumbnailEncSha256: media.fileEncSha256,
  thumbnailSha256: media.fileSha256,
  mediaKey: media.mediaKey,
  mediaKeyTimestamp: media.mediaKeyTimestamp,
  thumbnailWidth: width,
  thumbnailHeight: height,
});

export const buildThumbnail = async (client, image) => {
  const { width, height, data } = await runTask("preview", image);
  const media = await client.message.upload(image, {
    type: "thumbnail-link",
    mimetype: "image/jpeg",
  });
  return {
    ...toMediaFields(media, width, height),
    jpegThumbnail: new Uint8Array(data),
  };
};

export const buildFavicon = async (client, image) => {
  const media = await client.message.upload(image, {
    type: "thumbnail-link",
    mimetype: "image/png",
  });
  return toMediaFields(media, FAVICON_SIZE, FAVICON_SIZE);
};

export const KINDS = Object.freeze({
  thumbnail: {
    label: "Thumbnail",
    plural: "thumbnails",
    build: buildThumbnail,
  },
  favicon: {
    label: "Favicon",
    plural: "favicons",
    build: buildFavicon,
  },
});

export const normalizeImage = async (kind, input) => {
  const { data } = await runTask(kind, await toBuffer(input));
  return new Uint8Array(data);
};
