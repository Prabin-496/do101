"use client";

/**
 * Table extraction from a PDF's text layer.
 *
 * pdf.js gives every text run an x/y position. Rows are found by clustering
 * runs with similar y values; columns by clustering the x positions of every
 * run in the page. That recovers ordinary ruled and whitespace-aligned tables
 * well, and struggles with merged cells, nested tables and multi-line cells.
 * The UI states that limit rather than implying a perfect conversion.
 */

export interface ExtractedTable {
  page: number;
  rows: string[][];
  /** How confident the layout heuristics are, 0–1. Shown to the visitor. */
  confidence: number;
}

interface Run {
  text: string;
  x: number;
  y: number;
  width: number;
}

export async function extractTables(
  bytes: ArrayBuffer,
  { onProgress }: { onProgress?: (done: number, total: number) => void } = {},
): Promise<ExtractedTable[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: bytes.slice(0) });
  const doc = await task.promise;
  const tables: ExtractedTable[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();

      const runs: Run[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform = item.transform as number[];
        runs.push({
          text: item.str.trim(),
          x: transform[4],
          y: transform[5],
          width: item.width ?? 0,
        });
      }
      page.cleanup();
      onProgress?.(pageNumber, doc.numPages);
      if (runs.length < 4) continue;

      // Group runs into rows: same baseline within a small tolerance.
      const tolerance = 3;
      const rowBuckets = new Map<number, Run[]>();
      for (const run of runs) {
        const key = [...rowBuckets.keys()].find((k) => Math.abs(k - run.y) <= tolerance);
        if (key === undefined) rowBuckets.set(run.y, [run]);
        else rowBuckets.get(key)!.push(run);
      }

      const rows = [...rowBuckets.entries()]
        // PDF y grows upwards, so the top row has the largest value.
        .sort((a, b) => b[0] - a[0])
        .map(([, cells]) => cells.sort((a, b) => a.x - b.x));

      // Column edges: the distinct x positions used across the whole page.
      const columnTolerance = 12;
      const edges: number[] = [];
      for (const row of rows) {
        for (const cell of row) {
          if (!edges.some((e) => Math.abs(e - cell.x) <= columnTolerance)) edges.push(cell.x);
        }
      }
      edges.sort((a, b) => a - b);
      if (edges.length < 2) continue;

      const grid = rows.map((row) => {
        const cells = new Array<string>(edges.length).fill("");
        for (const cell of row) {
          let index = 0;
          let best = Infinity;
          edges.forEach((edge, i) => {
            const distance = Math.abs(edge - cell.x);
            if (distance < best) {
              best = distance;
              index = i;
            }
          });
          cells[index] = cells[index] ? `${cells[index]} ${cell.text}` : cell.text;
        }
        return cells;
      });

      // A believable table has several rows that fill most of their columns.
      const filled = grid.map((row) => row.filter(Boolean).length);
      const multiColumnRows = filled.filter((n) => n >= 2).length;
      if (multiColumnRows < 2) continue;

      const confidence = Math.min(
        1,
        (multiColumnRows / grid.length) * Math.min(1, edges.length / 3),
      );

      tables.push({ page: pageNumber, rows: grid, confidence });
    }
  } finally {
    await task.destroy();
  }

  return tables;
}

/** Builds a real .xlsx workbook, one sheet per page that produced a table. */
export async function tablesToWorkbook(tables: ExtractedTable[]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  tables.forEach((table) => {
    const sheet = XLSX.utils.aoa_to_sheet(table.rows);
    XLSX.utils.book_append_sheet(workbook, sheet, `Page ${table.page}`.slice(0, 31));
  });

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
