"use client";

import type { ExtractedPage } from "./render";

/**
 * Builds a real .docx from extracted PDF text.
 *
 * This is a **text conversion, not a layout conversion**. Paragraphs and page
 * breaks survive; columns, tables, images, fonts and exact positioning do not.
 * Every surface that offers it says so plainly, because a converter that
 * silently mangles a CV is worse than one that explains its limits.
 */
export async function textToDocx(
  pages: ExtractedPage[],
  { title, pageBreaks = true }: { title: string; pageBreaks?: boolean },
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, PageBreak } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];

  pages.forEach((page, pageIndex) => {
    const blocks = page.text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (!blocks.length) {
      children.push(new Paragraph({ children: [new TextRun("")] }));
    }

    blocks.forEach((block) => {
      // Single newlines inside a block are soft wraps from the PDF layout.
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      children.push(
        new Paragraph({
          spacing: { after: 160 },
          children: lines.map(
            (line, i) => new TextRun(i === 0 ? line : ` ${line}`),
          ),
        }),
      );
    });

    if (pageBreaks && pageIndex < pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({
    title,
    description: "Converted from PDF with DO101 (text only)",
    sections: [{ properties: {}, children }],
  });

  return Packer.toBlob(doc);
}

export function docxName(pdfName: string): string {
  return `${pdfName.replace(/\.pdf$/i, "")}.docx`;
}
