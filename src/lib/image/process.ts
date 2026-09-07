"use client";

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const WARN_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_DIMENSION = 12000;

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

export const FORMAT_EXT: Record<OutputFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export class ImageToolError extends Error {}

/** iPhone HEIC/HEIF files: no browser can decode these natively yet. */
export function isHeic(file: File): boolean {
  return /\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/i.test(file.type);
}

/**
 * Decodes HEIC to a PNG blob with libheif compiled to WebAssembly.
 * Loaded lazily, so the ~1.5 MB decoder only reaches people who open a HEIC.
 */
async function decodeHeic(file: File): Promise<Blob> {
  try {
    const { heicTo } = await import("heic-to");
    return await heicTo({ blob: file, type: "image/png", quality: 1 });
  } catch {
    throw new ImageToolError(
      `${file.name} could not be decoded. It may be a HEIC variant this decoder does not support — on an iPhone you can set Settings › Camera › Formats to "Most Compatible" to shoot JPG instead.`,
    );
  }
}

export async function loadImage(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith("image/") && !isHeic(file)) {
    throw new ImageToolError(`${file.name} is not an image file.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageToolError(
      `${file.name} is larger than the 25 MB limit for in-browser processing.`,
    );
  }
  try {
    const source = isHeic(file) ? await decodeHeic(file) : file;
    const bitmap = await createImageBitmap(source);
    if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
      bitmap.close?.();
      throw new ImageToolError(
        `${file.name} is ${bitmap.width}×${bitmap.height}px, which is too large to process safely in a browser tab.`,
      );
    }
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch (err) {
    if (err instanceof ImageToolError) throw err;
    throw new ImageToolError(
      `${file.name} could not be decoded. It may be corrupted or in a format this browser does not support.`,
    );
  }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export async function drawToBlob(
  bitmap: ImageBitmap,
  {
    width,
    height,
    format,
    quality,
    background,
  }: {
    width: number;
    height: number;
    format: OutputFormat;
    quality?: number;
    background?: string;
  },
): Promise<Blob> {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageToolError("This browser blocked canvas rendering.");

  if (format === "image/jpeg") {
    ctx.fillStyle = background || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, format, format === "image/png" ? undefined : quality),
  );
  if (!blob) throw new ImageToolError("The browser could not encode this image.");
  return blob;
}

export interface CompressResult {
  blob: Blob;
  quality: number;
  width: number;
  height: number;
  attempts: number;
  reachedTarget: boolean;
}

/**
 * Binary-searches the quality that lands just under `targetBytes`.
 * When no target is given it encodes once at the requested quality.
 */
export async function compressImage(
  image: LoadedImage,
  {
    format,
    quality = 0.8,
    targetBytes,
    maxWidth,
  }: {
    format: OutputFormat;
    quality?: number;
    targetBytes?: number;
    maxWidth?: number;
  },
): Promise<CompressResult> {
  const scale = maxWidth && image.width > maxWidth ? maxWidth / image.width : 1;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  if (!targetBytes) {
    const blob = await drawToBlob(image.bitmap, { width, height, format, quality });
    return { blob, quality, width, height, attempts: 1, reachedTarget: true };
  }

  let low = 0.05;
  let high = 0.95;
  let best: Blob | null = null;
  let bestQuality = low;
  let attempts = 0;

  for (let i = 0; i < 8; i++) {
    const mid = (low + high) / 2;
    const blob = await drawToBlob(image.bitmap, { width, height, format, quality: mid });
    attempts++;
    if (blob.size <= targetBytes) {
      best = blob;
      bestQuality = mid;
      low = mid;
    } else {
      high = mid;
    }
    if (high - low < 0.02) break;
  }

  if (!best) {
    // Even the lowest quality overshot: return it and report honestly.
    const blob = await drawToBlob(image.bitmap, { width, height, format, quality: 0.05 });
    attempts++;
    return {
      blob,
      quality: 0.05,
      width,
      height,
      attempts,
      reachedTarget: blob.size <= targetBytes,
    };
  }

  return { blob: best, quality: bestQuality, width, height, attempts, reachedTarget: true };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function replaceExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[^./\\]+$/, "");
  return `${base}.${ext}`;
}
