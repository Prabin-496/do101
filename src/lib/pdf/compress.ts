"use client";

import { renderPdfPages } from "./render";
import { PdfError } from "./engine";

/**
 * Two honest compression strategies.
 *
 * `optimize` re-saves the document with object streams. Text stays selectable
 * and searchable, but the saving is usually small — often only a few percent,
 * and occasionally nothing at all.
 *
 * `rasterize` re-renders every page as a JPEG and rebuilds the PDF around
 * those images. This shrinks scan-heavy documents dramatically, but it
 * **destroys the text layer**: the result is a picture of the document, so
 * text can no longer be selected, searched or copied. The UI says so before
 * the visitor picks it.
 */
export type CompressStrategy = "optimize" | "rasterize";

export interface CompressResult {
  bytes: Uint8Array;
  strategy: CompressStrategy;
  originalSize: number;
  newSize: number;
  /** True when the output ended up larger — reported rather than hidden. */
  grew: boolean;
  textPreserved: boolean;
}

export async function compressPdf(
  bytes: ArrayBuffer,
  {
    strategy,
    quality = 0.6,
    scale = 1.5,
    onProgress,
  }: {
    strategy: CompressStrategy;
    quality?: number;
    scale?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<CompressResult> {
  const originalSize = bytes.byteLength;
  const { PDFDocument } = await import("pdf-lib");

  if (strategy === "optimize") {
    const doc = await PDFDocument.load(bytes);
    const out = await doc.save({ useObjectStreams: true });
    return {
      bytes: out,
      strategy,
      originalSize,
      newSize: out.length,
      grew: out.length >= originalSize,
      textPreserved: true,
    };
  }

  const rendered = await renderPdfPages(bytes, {
    scale,
    format: "image/jpeg",
    quality,
    onProgress,
  });
  if (!rendered.length) throw new PdfError("This document has no pages to compress.");

  const doc = await PDFDocument.create();
  try {
    for (const page of rendered) {
      const jpg = await doc.embedJpg(await page.blob.arrayBuffer());
      // Convert pixels back to PDF points so the page keeps its physical size.
      const width = page.width / scale;
      const height = page.height / scale;
      const pdfPage = doc.addPage([width, height]);
      pdfPage.drawImage(jpg, { x: 0, y: 0, width, height });
    }
  } finally {
    rendered.forEach((p) => URL.revokeObjectURL(p.url));
  }

  const out = await doc.save({ useObjectStreams: true });
  return {
    bytes: out,
    strategy,
    originalSize,
    newSize: out.length,
    grew: out.length >= originalSize,
    textPreserved: false,
  };
}
