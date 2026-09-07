"use client";

import { sanitizeWinAnsi, wrapText, type Block, type Run } from "./layout";

/**
 * Renders the block model into a real PDF with pdf-lib.
 *
 * Deliberately a *readable* rendering, not a pixel-perfect one: headings,
 * paragraphs, lists, bold/italic, images, horizontal rules and simple tables
 * are drawn. Exact fonts, columns, floats and complex table layout are not
 * reproduced, and every page that offers this conversion says so.
 */

export interface RenderOptions {
  pageSize?: "a4" | "letter";
  margin?: number;
  baseFontSize?: number;
}

export interface RenderReport {
  bytes: Uint8Array;
  pages: number;
  /** Characters outside Latin-1 that the standard PDF fonts cannot draw. */
  droppedCharacters: number;
  imagesEmbedded: number;
  imagesSkipped: number;
  tablesFlattened: number;
}

const SIZES = {
  a4: [595.28, 841.89] as [number, number],
  letter: [612, 792] as [number, number],
};

const HEADING_SIZE: Record<number, number> = { 1: 22, 2: 18, 3: 15, 4: 13, 5: 12, 6: 11 };

export async function blocksToPdf(
  blocks: Block[],
  { pageSize = "a4", margin = 56, baseFontSize = 11 }: RenderOptions = {},
): Promise<RenderReport> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  const [pageWidth, pageHeight] = SIZES[pageSize];
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let cursor = pageHeight - margin;
  let dropped = 0;
  let imagesEmbedded = 0;
  let imagesSkipped = 0;
  let tablesFlattened = 0;

  const fontFor = (run: Run) =>
    run.bold && run.italic ? boldItalic : run.bold ? bold : run.italic ? italic : regular;

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    cursor = pageHeight - margin;
  };

  const ensure = (height: number) => {
    if (cursor - height < margin) newPage();
  };

  /** Draws a run of text, wrapping and paginating as it goes. */
  const drawRuns = (runs: Run[], size: number, indent = 0, prefix = "") => {
    // Runs are merged into one string for wrapping; the dominant style wins.
    const merged = runs.map((r) => r.text).join("");
    const clean = sanitizeWinAnsi(merged);
    dropped += clean.dropped;

    const styled = runs.find((r) => r.bold || r.italic) ?? { text: "" };
    const font = fontFor(styled);
    const width = contentWidth - indent;
    const lineHeight = size * 1.42;

    const text = prefix ? `${prefix}${clean.text}` : clean.text;
    const lines = wrapText(text, width, (s) => font.widthOfTextAtSize(s, size));

    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, {
        x: margin + indent,
        y: cursor - size,
        size,
        font,
        color: rgb(0.1, 0.12, 0.15),
      });
      cursor -= lineHeight;
    }
  };

  const drawImage = async (dataUrl: string) => {
    try {
      const response = await fetch(dataUrl);
      const bytes = await response.arrayBuffer();
      const isPng = dataUrl.startsWith("data:image/png") || dataUrl.includes("image/png");
      const embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

      const scale = Math.min(contentWidth / embedded.width, 1);
      const drawWidth = embedded.width * scale;
      const drawHeight = embedded.height * scale;

      if (drawHeight > pageHeight - margin * 2) {
        // Taller than a whole page: scale to fit the page instead.
        const pageScale = (pageHeight - margin * 2) / drawHeight;
        ensure(drawHeight * pageScale);
        page.drawImage(embedded, {
          x: margin,
          y: cursor - drawHeight * pageScale,
          width: drawWidth * pageScale,
          height: drawHeight * pageScale,
        });
        cursor -= drawHeight * pageScale + 12;
      } else {
        ensure(drawHeight + 12);
        page.drawImage(embedded, {
          x: margin,
          y: cursor - drawHeight,
          width: drawWidth,
          height: drawHeight,
        });
        cursor -= drawHeight + 12;
      }
      imagesEmbedded++;
    } catch {
      imagesSkipped++;
    }
  };

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const size = HEADING_SIZE[block.level] ?? baseFontSize;
        cursor -= size * 0.5;
        drawRuns(
          block.runs.map((r) => ({ ...r, bold: true })),
          size,
        );
        cursor -= size * 0.35;
        break;
      }
      case "paragraph":
        drawRuns(block.runs, baseFontSize);
        cursor -= baseFontSize * 0.5;
        break;
      case "listItem": {
        const marker = block.ordered ? `${block.index}. ` : "•  ";
        drawRuns(block.runs, baseFontSize, 18 + block.depth * 18, marker);
        break;
      }
      case "image":
        await drawImage(block.dataUrl);
        break;
      case "rule":
        ensure(16);
        page.drawLine({
          start: { x: margin, y: cursor - 6 },
          end: { x: pageWidth - margin, y: cursor - 6 },
          thickness: 1,
          color: rgb(0.8, 0.83, 0.85),
        });
        cursor -= 16;
        break;
      case "table": {
        // Tables are flattened to tab-separated lines: honest and readable,
        // rather than a broken attempt at real table layout.
        tablesFlattened++;
        for (const row of block.rows) {
          drawRuns([{ text: row.join("   |   ") }], baseFontSize - 1, 8);
        }
        cursor -= baseFontSize * 0.6;
        break;
      }
    }
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return {
    bytes,
    pages: doc.getPageCount(),
    droppedCharacters: dropped,
    imagesEmbedded,
    imagesSkipped,
    tablesFlattened,
  };
}
