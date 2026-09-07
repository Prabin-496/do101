"use client";

import { invertSelection } from "./pages";

/**
 * PDF operations, all performed in the visitor's browser.
 *
 * pdf-lib is loaded lazily so the ~400 KB parser only reaches people who open
 * a PDF tool. Nothing here touches the network: there is no upload endpoint
 * behind any DO101 PDF tool, which is what makes the privacy claim structural
 * rather than a promise.
 */

export const MAX_PDF_BYTES = 100 * 1024 * 1024; // 100 MB
export const WARN_PDF_BYTES = 25 * 1024 * 1024;

export class PdfError extends Error {}

type PdfLib = typeof import("pdf-lib");

let cached: PdfLib | null = null;

async function lib(): Promise<PdfLib> {
  if (!cached) cached = await import("pdf-lib");
  return cached;
}

export interface LoadedPdf {
  name: string;
  bytes: ArrayBuffer;
  pageCount: number;
  /** Page sizes in PDF points, used for previews and page pickers. */
  sizes: Array<{ width: number; height: number }>;
  encrypted: boolean;
}

function friendlyLoadError(name: string, error: unknown): PdfError {
  const message = error instanceof Error ? error.message : "";
  if (/encrypt/i.test(message)) {
    return new PdfError(
      `${name} is password-protected. DO101 cannot open encrypted PDFs — remove the password in the app that created it first.`,
    );
  }
  return new PdfError(
    `${name} could not be read as a PDF. It may be corrupted, or it may not be a PDF at all.`,
  );
}

export async function loadPdf(file: File): Promise<LoadedPdf> {
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfError(
      `${file.name} is larger than the 100 MB limit for in-browser processing.`,
    );
  }
  const { PDFDocument } = await lib();
  const bytes = await file.arrayBuffer();

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pages = doc.getPages();
    return {
      name: file.name,
      bytes,
      pageCount: pages.length,
      sizes: pages.map((p) => ({ width: p.getWidth(), height: p.getHeight() })),
      encrypted: false,
    };
  } catch (error) {
    throw friendlyLoadError(file.name, error);
  }
}

async function open(bytes: ArrayBuffer) {
  const { PDFDocument } = await lib();
  return PDFDocument.load(bytes);
}

/** Copies the given pages, in the given order, into a fresh document. */
export async function selectPages(bytes: ArrayBuffer, indices: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await lib();
  const source = await open(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, indices);
  copied.forEach((page) => out.addPage(page));
  return out.save({ useObjectStreams: true });
}

export async function deletePages(bytes: ArrayBuffer, indices: number[]): Promise<Uint8Array> {
  const source = await open(bytes);
  const keep = invertSelection(indices, source.getPageCount());
  if (!keep.length) {
    throw new PdfError("That would delete every page. A PDF needs at least one page.");
  }
  return selectPages(bytes, keep);
}

export async function mergePdfs(
  documents: Array<{ bytes: ArrayBuffer; indices?: number[] }>,
): Promise<Uint8Array> {
  const { PDFDocument } = await lib();
  const out = await PDFDocument.create();

  for (const item of documents) {
    const source = await PDFDocument.load(item.bytes);
    const indices = item.indices ?? source.getPageIndices();
    const copied = await out.copyPages(source, indices);
    copied.forEach((page) => out.addPage(page));
  }

  if (out.getPageCount() === 0) {
    throw new PdfError("None of those files contributed any pages.");
  }
  return out.save({ useObjectStreams: true });
}

/** Splits into one document per chunk of `every` pages, or one per page. */
export async function splitPdf(
  bytes: ArrayBuffer,
  { every = 1 }: { every?: number } = {},
): Promise<Array<{ label: string; bytes: Uint8Array }>> {
  const source = await open(bytes);
  const total = source.getPageCount();
  const step = Math.max(1, Math.floor(every));
  const out: Array<{ label: string; bytes: Uint8Array }> = [];

  for (let start = 0; start < total; start += step) {
    const indices = [];
    for (let i = start; i < Math.min(start + step, total); i++) indices.push(i);
    const label =
      indices.length === 1 ? `page-${indices[0] + 1}` : `pages-${indices[0] + 1}-${indices[indices.length - 1] + 1}`;
    out.push({ label, bytes: await selectPages(bytes, indices) });
  }
  return out;
}

export type Rotation = 0 | 90 | 180 | 270;

export async function rotatePages(
  bytes: ArrayBuffer,
  indices: number[],
  turn: Rotation,
): Promise<Uint8Array> {
  const { degrees } = await lib();
  const doc = await open(bytes);
  const selected = new Set(indices);

  doc.getPages().forEach((page, i) => {
    if (!selected.has(i)) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + turn + 360) % 360));
  });
  return doc.save({ useObjectStreams: true });
}

export interface WatermarkOptions {
  text: string;
  opacity: number;
  fontSize: number;
  color: { r: number; g: number; b: number };
  diagonal: boolean;
}

export async function addWatermark(
  bytes: ArrayBuffer,
  options: WatermarkOptions,
): Promise<Uint8Array> {
  const { StandardFonts, rgb, degrees } = await lib();
  const doc = await open(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    page.drawText(options.text, {
      x: (width - textWidth * (options.diagonal ? 0.72 : 1)) / 2,
      y: height / 2 - options.fontSize / 2,
      size: options.fontSize,
      font,
      color: rgb(options.color.r, options.color.g, options.color.b),
      opacity: options.opacity,
      rotate: options.diagonal ? degrees(45) : degrees(0),
    });
  });
  return doc.save({ useObjectStreams: true });
}

export type NumberPosition = "bottom-center" | "bottom-right" | "bottom-left" | "top-right";

export async function addPageNumbers(
  bytes: ArrayBuffer,
  {
    position = "bottom-center",
    fontSize = 11,
    startAt = 1,
    format = "{n}",
  }: {
    position?: NumberPosition;
    fontSize?: number;
    startAt?: number;
    format?: string;
  } = {},
): Promise<Uint8Array> {
  const { StandardFonts, rgb } = await lib();
  const doc = await open(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();

  doc.getPages().forEach((page, i) => {
    const label = format
      .replace(/\{n\}/g, String(i + startAt))
      .replace(/\{total\}/g, String(total + startAt - 1));
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const margin = 28;

    const x =
      position === "bottom-center"
        ? (width - textWidth) / 2
        : position === "bottom-right" || position === "top-right"
          ? width - textWidth - margin
          : margin;
    const y = position === "top-right" ? page.getHeight() - margin : margin;

    page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.25, 0.25, 0.25) });
  });
  return doc.save({ useObjectStreams: true });
}

export type PageSize = "fit" | "a4" | "letter";
export type PageOrientation = "auto" | "portrait" | "landscape";

const SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Builds a PDF from images. JPEG and PNG embed natively; anything else is re-encoded to JPEG first. */
export async function imagesToPdf(
  files: File[],
  {
    pageSize = "fit",
    orientation = "auto",
    margin = 0,
  }: { pageSize?: PageSize; orientation?: PageOrientation; margin?: number } = {},
): Promise<Uint8Array> {
  const { PDFDocument } = await lib();
  const doc = await PDFDocument.create();

  for (const file of files) {
    const { bytes, type } = await toEmbeddable(file);
    const image = type === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

    let pageWidth: number;
    let pageHeight: number;

    if (pageSize === "fit") {
      pageWidth = image.width + margin * 2;
      pageHeight = image.height + margin * 2;
    } else {
      const [shortSide, longSide] = SIZES[pageSize];
      const landscape =
        orientation === "landscape" ||
        (orientation === "auto" && image.width > image.height);
      pageWidth = landscape ? longSide : shortSide;
      pageHeight = landscape ? shortSide : longSide;
    }

    const page = doc.addPage([pageWidth, pageHeight]);
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const scale = Math.min(usableWidth / image.width, usableHeight / image.height, pageSize === "fit" ? 1 : Infinity);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    page.drawImage(image, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  if (doc.getPageCount() === 0) throw new PdfError("Add at least one image.");
  return doc.save({ useObjectStreams: true });
}

/** PNG and JPEG embed directly; every other format is re-encoded through a canvas. */
async function toEmbeddable(file: File): Promise<{ bytes: ArrayBuffer; type: "png" | "jpg" }> {
  if (file.type === "image/png") return { bytes: await file.arrayBuffer(), type: "png" };
  if (file.type === "image/jpeg") return { bytes: await file.arrayBuffer(), type: "jpg" };

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new PdfError(`${file.name} could not be decoded as an image.`);
  });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PdfError("This browser blocked canvas rendering.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new PdfError(`${file.name} could not be converted.`);
  return { bytes: await blob.arrayBuffer(), type: "jpg" };
}

/** Re-saves with object streams. Keeps text selectable; savings are modest. */
export async function optimizePdf(bytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await open(bytes);
  return doc.save({ useObjectStreams: true });
}

export function downloadBytes(bytes: Uint8Array, filename: string, type = "application/pdf") {
  // Copy into a fresh buffer so the Blob owns plain bytes.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const blob = new Blob([copy], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pdfName(original: string, suffix: string): string {
  return `${original.replace(/\.pdf$/i, "")}-${suffix}.pdf`;
}
