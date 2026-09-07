"use client";

import { renderPdfPages } from "./render";
import { PdfError } from "./engine";

/**
 * Redaction that genuinely removes content.
 *
 * Drawing a black rectangle over text in a PDF hides it visually while leaving
 * the words in the file, where anyone can select or extract them. That mistake
 * has leaked real documents.
 *
 * DO101 does it the safe way instead: each page is rendered to an image, the
 * marked areas are painted out on that image, and a new PDF is rebuilt from
 * the flattened result. The original text objects are gone because the page is
 * no longer text — which is also the trade-off, and the UI says so plainly.
 */

export interface RedactionBox {
  pageIndex: number;
  /** Fractions of the page, measured from the top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactResult {
  bytes: Uint8Array;
  pages: number;
  boxesApplied: number;
}

export async function redactPdf(
  bytes: ArrayBuffer,
  boxes: RedactionBox[],
  {
    scale = 2,
    quality = 0.92,
    color = "#000000",
    onProgress,
  }: {
    scale?: number;
    quality?: number;
    color?: string;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<RedactResult> {
  if (!boxes.length) {
    throw new PdfError("Mark at least one area to redact before applying.");
  }

  const rendered = await renderPdfPages(bytes, {
    scale,
    format: "image/png",
    onProgress,
  });

  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  let applied = 0;

  try {
    for (const page of rendered) {
      const canvas = document.createElement("canvas");
      canvas.width = page.width;
      canvas.height = page.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new PdfError("This browser blocked canvas rendering.");

      const bitmap = await createImageBitmap(page.blob);
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();

      // Paint the redactions onto the raster before it is ever encoded.
      ctx.fillStyle = color;
      for (const box of boxes.filter((b) => b.pageIndex === page.page - 1)) {
        ctx.fillRect(
          box.x * canvas.width,
          box.y * canvas.height,
          box.width * canvas.width,
          box.height * canvas.height,
        );
        applied++;
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) throw new PdfError(`Page ${page.page} could not be re-encoded.`);

      const jpg = await doc.embedJpg(await blob.arrayBuffer());
      const width = page.width / scale;
      const height = page.height / scale;
      const pdfPage = doc.addPage([width, height]);
      pdfPage.drawImage(jpg, { x: 0, y: 0, width, height });
    }
  } finally {
    rendered.forEach((p) => URL.revokeObjectURL(p.url));
  }

  return {
    bytes: await doc.save({ useObjectStreams: true }),
    pages: doc.getPageCount(),
    boxesApplied: applied,
  };
}
