"use client";

/**
 * Saving and converting a cover.
 *
 * The plain save writes the bytes exactly as the provider sent them — no
 * decode, no re-encode, no quality lost. Converting is a separate, explicit
 * step, because turning a JPEG into a WebP means encoding a lossy image a
 * second time and that should be a choice rather than a side effect.
 */

export type ImageFormat = "original" | "png" | "webp" | "jpeg";

export const FORMAT_LABEL: Record<Exclude<ImageFormat, "original">, string> = {
  png: "PNG",
  webp: "WebP",
  jpeg: "JPG",
};

const MIME: Record<Exclude<ImageFormat, "original">, string> = {
  png: "image/png",
  webp: "image/webp",
  jpeg: "image/jpeg",
};

export function extensionFor(format: ImageFormat, blob: Blob): string {
  if (format === "original") return blob.type === "image/webp" ? "webp" : "jpg";
  return format === "jpeg" ? "jpg" : format;
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

async function draw(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob).catch(() => {
    throw new Error("This browser could not decode that image.");
  });

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("This browser blocked canvas rendering, so the image cannot be converted.");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvas;
}

/**
 * Re-encodes a cover into another format.
 *
 * `original` is handled by the caller and never reaches here, because the
 * whole point of that option is that nothing touches the bytes.
 */
export async function convert(
  blob: Blob,
  format: Exclude<ImageFormat, "original">,
  quality = 0.92,
): Promise<Blob> {
  const canvas = await draw(blob);
  const type = MIME[format];

  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, format === "png" ? undefined : quality),
  );
  if (!out) throw new Error(`This browser cannot write ${FORMAT_LABEL[format]} files.`);

  // Safari quietly falls back to PNG when asked for a format it cannot write.
  if (out.type !== type) {
    throw new Error(`This browser cannot write ${FORMAT_LABEL[format]} files — try PNG.`);
  }
  return out;
}

/** Puts the picture on the clipboard. Only PNG is reliably accepted. */
export async function copyImage(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("This browser cannot copy images to the clipboard. Download it instead.");
  }
  const png = blob.type === "image/png" ? blob : await convert(blob, "png");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 1280×720 reads as 16:9, which is more use than the raw numbers alone. */
export function aspectLabel(width: number, height: number): string {
  if (!width || !height) return "";
  const ratio = width / height;
  const known: [number, string][] = [
    [16 / 9, "16:9"],
    [4 / 3, "4:3"],
    [1, "square"],
    [9 / 16, "9:16"],
    [3 / 2, "3:2"],
  ];
  const match = known.find(([value]) => Math.abs(ratio - value) < 0.02);
  return match ? match[1] : "";
}
