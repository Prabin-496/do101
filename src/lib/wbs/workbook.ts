/**
 * Excel output.
 *
 * SheetJS is imported on demand so the library is only downloaded when someone
 * actually exports. Its community build writes values, number formats, column
 * widths, autofilters, outline grouping and formulas — but not cell styling,
 * so the workbook is made readable through structure and formats rather than
 * by promising bold headers this build cannot produce.
 */

import type { GridCell, SheetGrid } from "./grid";
import { buildDictionaryGrid, buildGrid, buildSummaryGrid } from "./grid";
import { buildGanttGrid } from "./gantt";
import { enhanceXlsx, type SheetEnhancement } from "./office";
import type { WbsDoc } from "./model";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Excel supports seven outline levels; deeper rows sit at the last one. */
const MAX_OUTLINE = 7;

type SheetJs = typeof import("xlsx");

function toSheet(XLSX: SheetJs, grid: SheetGrid, withFilter: boolean) {
  const sheet: Record<string, unknown> = {};

  grid.columns.forEach((column, c) => {
    sheet[XLSX.utils.encode_cell({ r: 0, c })] = { t: "s", v: column.label };
  });

  grid.rows.forEach((row, r) => {
    row.forEach((cell: GridCell, c) => {
      if (cell.value === null && !cell.formula) return;
      const ref = XLSX.utils.encode_cell({ r: r + 1, c });
      if (cell.kind === "text") {
        sheet[ref] = { t: "s", v: String(cell.value ?? "") };
        return;
      }
      const out: Record<string, unknown> = { t: "n", v: Number(cell.value ?? 0) };
      if (cell.format) out.z = cell.format;
      // The cached value goes in alongside the formula, so the number is
      // correct even before Excel recalculates.
      if (cell.formula) out.f = cell.formula;
      sheet[ref] = out;
    });
  });

  const lastRow = grid.rows.length;
  const lastColumn = Math.max(0, grid.columns.length - 1);
  const ref = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: lastColumn },
  });
  sheet["!ref"] = ref;
  sheet["!cols"] = grid.columns.map((column) => ({ wch: column.width }));
  sheet["!rows"] = [
    {},
    ...grid.outline.map((level) =>
      level > 0 ? { level: Math.min(level, MAX_OUTLINE) } : {},
    ),
  ];
  if (withFilter && lastRow > 0) sheet["!autofilter"] = { ref };

  return sheet;
}

/**
 * What Excel should do with a sheet once it is open: hold the headings and
 * the first two columns still, colour the timeline, and print across the page.
 */
function planFor(name: string, grid: SheetGrid): SheetEnhancement {
  const barColumns = grid.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.key === "timeline" || column.key.startsWith("p-"))
    .map(({ index }) => index);
  const percentColumn = grid.columns.findIndex((column) => column.key === "progress");
  // The WBS Number and Task Title columns, when they are there to freeze.
  const frozen = grid.columns.filter((column) => column.key === "code" || column.key === "name").length;

  return {
    sheet: name,
    freezeColumns: frozen,
    freezeRows: 1,
    rows: grid.rows.length,
    barColumns,
    percentColumn: percentColumn >= 0 ? percentColumn : null,
    landscape: true,
  };
}

export function workbookFilename(doc: WbsDoc, extension: string): string {
  const slug =
    doc.settings.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "wbs";
  return `${slug}-wbs-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

/** Builds the .xlsx: the WBS itself, plus the optional extra sheets. */
export async function buildWorkbook(doc: WbsDoc): Promise<Blob> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const plans: SheetEnhancement[] = [];

  const sheet = buildGrid(doc);
  XLSX.utils.book_append_sheet(workbook, toSheet(XLSX, sheet, true), "WBS");
  plans.push(planFor("WBS", sheet));

  if (doc.settings.includeDictionary) {
    XLSX.utils.book_append_sheet(
      workbook,
      toSheet(XLSX, buildDictionaryGrid(doc), true),
      "Dictionary",
    );
  }
  if (doc.gantt.includeInWorkbook) {
    // The Gantt sheet carries the dates as real dates and a block per period,
    // so a conditional format turns the blocks into bars in one step.
    const gantt = buildGanttGrid(doc);
    XLSX.utils.book_append_sheet(workbook, toSheet(XLSX, gantt, true), "Gantt");
    plans.push(planFor("Gantt", gantt));
  }
  if (doc.settings.includeSummary) {
    XLSX.utils.book_append_sheet(
      workbook,
      toSheet(XLSX, buildSummaryGrid(doc), false),
      "Summary",
    );
  }

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const polished = doc.settings.officeFormatting
    ? enhanceXlsx(new Uint8Array(output), plans)
    : new Uint8Array(output);
  return new Blob([polished], { type: XLSX_MIME });
}

/** Reads the first sheet of an uploaded spreadsheet as a grid of strings. */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false, cellDates: true });
  const first = workbook.SheetNames[0];
  if (!first) return [];
  const sheet = workbook.Sheets[first];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  return rows.map((row) =>
    (row as unknown[]).map((cell) =>
      cell === null || cell === undefined ? "" : String(cell),
    ),
  );
}
