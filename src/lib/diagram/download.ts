"use client";

/**
 * Turning the exported SVG into a file on the visitor's disk.
 *
 * The PNG is rasterised from the very same SVG string the SVG download uses,
 * so the two can never disagree. Nothing is uploaded: the browser does the
 * rendering and hands back the bytes.
 */
import { copyImageToClipboard } from "@/lib/images/clipboard";
import { diagramBounds, type Diagram } from "./model";
import { toFile, toSvg, type SvgOptions } from "./export";

export function fileStem(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "diagram";
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

export function downloadSvg(diagram: Diagram, options: SvgOptions = {}): void {
  const svg = toSvg(diagram, options);
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${fileStem(diagram.name)}.svg`);
}

export function downloadJson(diagram: Diagram): void {
  downloadBlob(
    new Blob([toFile(diagram)], { type: "application/json" }),
    `${fileStem(diagram.name)}.do101.json`,
  );
}

/** Guards against a huge diagram at 4× asking the browser for a gigapixel canvas. */
const MAX_PIXELS = 40_000_000;

export async function renderPng(diagram: Diagram, scale = 2, options: SvgOptions = {}): Promise<Blob> {
  const box = diagramBounds(diagram, options.padding ?? 40);
  const safeScale = Math.min(scale, Math.sqrt(MAX_PIXELS / Math.max(1, box.w * box.h)));
  const width = Math.max(1, Math.round(box.w * safeScale));
  const height = Math.max(1, Math.round(box.h * safeScale));

  const svg = toSvg(diagram, options);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

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
    image.onerror = () => reject(new Error("The diagram could not be rendered to an image."));
    image.src = url;
  });
}

export async function downloadPng(diagram: Diagram, scale = 2, options: SvgOptions = {}): Promise<void> {
  const blob = await renderPng(diagram, scale, options);
  downloadBlob(blob, `${fileStem(diagram.name)}.png`);
}

/**
 * Puts the PNG on the clipboard, ready to paste into Word, Excel, Docs, Slides
 * or a chat. The routes it tries, and why there are several, are in
 * `lib/images/clipboard`.
 */
export async function copyPngToClipboard(diagram: Diagram, scale = 2): Promise<void> {
  await copyImageToClipboard(() => renderPng(diagram, scale));
}
