"use client";

import { gridToHtml, gridToTsv, type SheetGrid } from "./grid";

/**
 * Puts a grid on the clipboard in both flavours a spreadsheet understands.
 *
 * Excel takes the HTML when it is offered, which keeps the outline indent and
 * stops a WBS code like 1.10 being read as a number; the tab-separated copy is
 * the fallback that everything else — Sheets, Numbers, a plain text field —
 * reads correctly.
 */
export async function copyGridForSpreadsheet(grid: SheetGrid): Promise<void> {
  const tsv = gridToTsv(grid);
  const clipboard = navigator.clipboard;

  if (typeof ClipboardItem !== "undefined" && clipboard?.write) {
    try {
      await clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([tsv], { type: "text/plain" }),
          "text/html": new Blob([gridToHtml(grid)], { type: "text/html" }),
        }),
      ]);
      return;
    } catch {
      // Some browsers refuse the rich flavour; the plain one still works.
    }
  }

  await clipboard.writeText(tsv);
}
