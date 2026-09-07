"use client";

import { PdfError } from "./engine";

/**
 * Rendering and text extraction with pdf.js, in the browser.
 *
 * The parser runs in a Web Worker served from /pdf.worker.min.mjs (copied out
 * of node_modules by scripts/copy-pdf-worker.mjs), so a heavy document never
 * blocks the interface. Nothing is uploaded.
 */

type PdfJs = typeof import("pdfjs-dist");

let cached: PdfJs | null = null;

async function lib(): Promise<PdfJs> {
  if (cached) return cached;
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  cached = pdfjs;
  return pdfjs;
}

/**
 * Returns both the document and its loading task: only the task can shut the
 * worker down, and leaving it running leaks a thread per document opened.
 */
async function openDocument(bytes: ArrayBuffer) {
  const pdfjs = await lib();
  // pdf.js transfers and detaches the buffer, so hand it a copy.
  const task = pdfjs.getDocument({ data: bytes.slice(0) });
  try {
    const doc = await task.promise;
    return { doc, task };
  } catch (error) {
    void task.destroy();
    const message = error instanceof Error ? error.message : "";
    if (/password/i.test(message)) {
      throw new PdfError("This PDF is password-protected, so its pages cannot be read.");
    }
    throw new PdfError("This PDF could not be opened for rendering.");
  }
}

export interface RenderedPage {
  page: number;
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

/**
 * Renders pages to raster images.
 * `scale` 1 is 72 DPI; 2 ≈ 144 DPI, which is the useful default for screen use.
 */
export async function renderPdfPages(
  bytes: ArrayBuffer,
  {
    scale = 2,
    format = "image/png",
    quality = 0.92,
    pages,
    onProgress,
  }: {
    scale?: number;
    format?: "image/png" | "image/jpeg" | "image/webp";
    quality?: number;
    pages?: number[];
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<RenderedPage[]> {
  const { doc, task } = await openDocument(bytes);
  const wanted = pages ?? Array.from({ length: doc.numPages }, (_, i) => i);
  const out: RenderedPage[] = [];

  try {
    for (let i = 0; i < wanted.length; i++) {
      const pageNumber = wanted[i] + 1;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new PdfError("This browser blocked canvas rendering.");

      // JPEG and WebP have no alpha, so pages need a white ground.
      if (format !== "image/png") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, format, format === "image/png" ? undefined : quality),
      );
      if (!blob) throw new PdfError(`Page ${pageNumber} could not be encoded.`);

      out.push({
        page: pageNumber,
        blob,
        url: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height,
      });
      onProgress?.(i + 1, wanted.length);
    }
  } finally {
    await task.destroy();
  }

  return out;
}

export interface ExtractedPage {
  page: number;
  text: string;
}

/** Extracts the text layer. Scanned PDFs have none — see the OCR tool for those. */
export async function extractPdfText(
  bytes: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<{ pages: ExtractedPage[]; hasText: boolean }> {
  const { doc, task } = await openDocument(bytes);
  const pages: ExtractedPage[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      // pdf.js emits positioned runs; rebuild lines from their y coordinates.
      let text = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform?.[5] as number | undefined;
        if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) {
          text += "\n";
        } else if (text && !text.endsWith(" ") && !text.endsWith("\n")) {
          text += item.str.startsWith(" ") ? "" : " ";
        }
        text += item.str;
        if (item.hasEOL) text += "\n";
        if (y !== undefined) lastY = y;
      }

      pages.push({ page: i, text: text.replace(/[ \t]+\n/g, "\n").trim() });
      page.cleanup();
      onProgress?.(i, doc.numPages);
    }
  } finally {
    await task.destroy();
  }

  return { pages, hasText: pages.some((p) => p.text.trim().length > 0) };
}

export async function getPdfPageCount(bytes: ArrayBuffer): Promise<number> {
  const { doc, task } = await openDocument(bytes);
  const count = doc.numPages;
  await task.destroy();
  return count;
}
