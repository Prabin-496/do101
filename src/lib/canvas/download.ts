"use client";

/**
 * Taking the board away with you.
 *
 * The PNG is rasterised from the very SVG string the SVG download uses, so the
 * two can never disagree. Nothing is uploaded: the browser does the rendering
 * and hands back the bytes.
 */
import type { Board, Doc, Rect } from "./model";
import { boardBounds, toFile, toSvg, type SvgOptions } from "./export";

export function fileStem(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "canvas";
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

export function svgBlob(board: Board, options: SvgOptions = {}): Blob {
  return new Blob([toSvg(board, options)], { type: "image/svg+xml;charset=utf-8" });
}

export function downloadSvg(board: Board, options: SvgOptions = {}): void {
  downloadBlob(svgBlob(board, options), `${fileStem(board.name)}.svg`);
}

export function downloadJson(doc: Doc): void {
  downloadBlob(
    new Blob([toFile(doc)], { type: "application/json" }),
    `${fileStem(doc.name)}.do101.json`,
  );
}

/** Guards against a huge board at 4× asking the browser for a gigapixel canvas. */
const MAX_PIXELS = 40_000_000;

export async function renderPng(board: Board, scale = 2, options: SvgOptions = {}): Promise<Blob> {
  const box: Rect = options.area ?? boardBounds(board, options.padding ?? 48);
  const safeScale = Math.min(scale, Math.sqrt(MAX_PIXELS / Math.max(1, box.w * box.h)));
  const width = Math.max(1, Math.round(box.w * safeScale));
  const height = Math.max(1, Math.round(box.h * safeScale));

  const url = URL.createObjectURL(svgBlob(board, options));
  try {
    const image = await loadSvgImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser blocked canvas rendering.");
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The browser could not encode the PNG.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("The board could not be rendered to an image. A pasted picture may be corrupted."));
    image.src = url;
  });
}

export async function downloadPng(board: Board, scale = 2, options: SvgOptions = {}): Promise<void> {
  downloadBlob(await renderPng(board, scale, options), `${fileStem(board.name)}.png`);
}

/** Puts the PNG on the clipboard for pasting straight into a doc or chat. */
export async function copyPngToClipboard(board: Board, scale = 2): Promise<void> {
  const blob = await renderPng(board, scale);
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("This browser cannot copy images to the clipboard. Download the PNG instead.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/**
 * Every board as a numbered PNG in one zip — the usual want when a canvas has
 * been used to explain something step by step.
 */
export async function downloadAllPng(doc: Doc, scale = 2): Promise<number> {
  const { zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};

  for (const [index, board] of doc.boards.entries()) {
    if (!board.elements.length) continue;
    const blob = await renderPng(board, scale);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const stem = `${String(index + 1).padStart(2, "0")}-${fileStem(board.name)}`;
    files[`${stem}.png`] = bytes;
  }

  const count = Object.keys(files).length;
  if (!count) throw new Error("There is nothing drawn on any board yet.");

  const zipped = zipSync(files, { level: 0 });
  downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), `${fileStem(doc.name)}.zip`);
  return count;
}

/**
 * Shrinks a pasted or dropped picture before it joins the document.
 *
 * A phone photo is several thousand pixels wide; kept at full size it would
 * bloat every save and blow the browser's storage quota on the first autosave.
 */
export const MAX_IMAGE_EDGE = 1600;

export async function imageToElementSource(
  file: File,
): Promise<{ href: string; w: number; h: number }> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} could not be decoded by this browser.`);
  });

  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser blocked canvas rendering.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // PNG keeps screenshots crisp; photographs are re-encoded as JPEG, which is
  // where the size actually comes from.
  const isPhoto = /jpe?g/i.test(file.type);
  const href = canvas.toDataURL(isPhoto ? "image/jpeg" : "image/png", isPhoto ? 0.85 : undefined);
  return { href, w, h };
}
