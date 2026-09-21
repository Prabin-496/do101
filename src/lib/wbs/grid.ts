/**
 * The exported sheet, built once and reused everywhere.
 *
 * The on-screen preview, the CSV, the Markdown table and the .xlsx all read
 * this same grid, so what the preview shows is exactly what the download
 * contains. Cells keep their type and their Excel number format rather than
 * being flattened to strings early, which is what makes the workbook come out
 * with real dates, currency and percentages.
 */

import type { FieldValue, WbsDoc, WbsField, WbsRow } from "./model";
import { asNumber, flatten, maxDepth } from "./model";
import {
  FORMULA_ROLLUPS,
  excelNumber,
  excelNumberFormat,
  excelSerialDate,
  formatValue,
  ISO_DATE,
  visibleFields,
} from "./fields";

export type CellKind = "text" | "number" | "date";

export interface GridCell {
  /** What a human should read — used by the preview, CSV and Markdown. */
  text: string;
  /** What Excel should store. Numbers and dates keep their type. */
  value: string | number | null;
  kind: CellKind;
  /** Excel number format, e.g. "$"#,##0.00. */
  format?: string;
  /** Excel formula for this cell, without the leading "=". */
  formula?: string;
  align: "left" | "right";
}

export interface GridColumn {
  key: string;
  label: string;
  width: number;
  align: "left" | "right";
}

export interface SheetGrid {
  columns: GridColumn[];
  rows: GridCell[][];
  /** Excel outline level per row, so summary rows collapse with +/-. */
  outline: number[];
  /** Parallel to rows: the WBS row each grid row came from. */
  source: WbsRow[];
}

export function textCell(text: string, align: "left" | "right" = "left"): GridCell {
  return { text, value: text === "" ? null : text, kind: "text", align };
}

const COLUMN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 0 → A, 26 → AA. Excel column references for the roll-up formulas. */
export function columnLetter(index: number): string {
  let left = index;
  let out = "";
  while (left >= 0) {
    out = COLUMN_LETTERS[left % 26] + out;
    left = Math.floor(left / 26) - 1;
  }
  return out;
}

/** Excel evaluates a leading =, +, - or @ in a CSV, so text is quoted out. */
export function csvSafe(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function valueCell(value: FieldValue, field: WbsField, doc: WbsDoc): GridCell {
  const text = formatValue(value, field, doc.settings);
  const format = excelNumberFormat(field, doc.settings);
  const align = field.type === "text" || field.type === "select" ? "left" : "right";

  if (field.type === "date") {
    const iso = typeof value === "string" ? value : "";
    const serial = ISO_DATE.test(iso) ? excelSerialDate(iso) : null;
    if (serial !== null) {
      return { text: iso, value: serial, kind: "date", format, align: "right" };
    }
    return textCell(text, "left");
  }

  const n = excelNumber(value, field);
  if (n !== null) return { text, value: n, kind: "number", format, align };
  return textCell(text, align);
}

/**
 * Builds the sheet. Name layout decides whether the hierarchy is shown by
 * indenting one column or by giving each level a column of its own — the
 * latter being the shape most project offices expect a WBS to arrive in.
 */
export function buildGrid(doc: WbsDoc): SheetGrid {
  const rows = flatten(doc);
  const fields = visibleFields(doc);
  const settings = doc.settings;
  const depth = Math.max(1, maxDepth(doc.tasks));

  const columns: GridColumn[] = [];
  if (settings.showCode) columns.push({ key: "code", label: "WBS Number", width: 14, align: "left" });
  if (settings.showLevel) columns.push({ key: "level", label: "Level", width: 7, align: "right" });
  if (settings.showParent) columns.push({ key: "parent", label: "Parent", width: 12, align: "left" });

  const nameColumnIndexes: number[] = [];
  if (settings.nameLayout === "levels") {
    for (let i = 1; i <= depth; i++) {
      nameColumnIndexes.push(columns.length);
      columns.push({ key: `level-${i}`, label: `Level ${i}`, width: 26, align: "left" });
    }
  } else {
    nameColumnIndexes.push(columns.length);
    columns.push({ key: "name", label: "Task Title", width: 38, align: "left" });
  }

  if (settings.showType) columns.push({ key: "type", label: "Type", width: 14, align: "left" });

  const fieldColumnIndex = new Map<string, number>();
  for (const field of fields) {
    fieldColumnIndex.set(field.id, columns.length);
    columns.push({
      key: field.id,
      label: field.label,
      width: field.width,
      align: field.type === "text" || field.type === "select" ? "left" : "right",
    });
  }

  // Row 1 is the header, so a WBS row at index i lives on sheet row i + 2.
  const sheetRow = (index: number) => index + 2;

  const body: GridCell[][] = rows.map((row) => {
    const cells: GridCell[] = columns.map(() => textCell(""));
    const put = (key: string, cell: GridCell) => {
      const index = columns.findIndex((column) => column.key === key);
      if (index >= 0) cells[index] = cell;
    };

    if (settings.showCode) put("code", textCell(row.code));
    if (settings.showLevel) {
      cells[columns.findIndex((c) => c.key === "level")] = {
        text: String(row.level),
        value: row.level,
        kind: "number",
        align: "right",
      };
    }
    if (settings.showParent) put("parent", textCell(row.parentCode));

    if (settings.nameLayout === "levels") {
      const target = nameColumnIndexes[Math.min(row.level, depth) - 1];
      cells[target] = textCell(row.name);
    } else {
      const indent = settings.nameLayout === "indent" ? settings.indentUnit.repeat(row.level - 1) : "";
      cells[nameColumnIndexes[0]] = textCell(`${indent}${row.name}`);
    }

    if (settings.showType) put("type", textCell(row.isSummary ? "Summary" : "Work package"));

    for (const field of fields) {
      const cell = valueCell(row.values[field.id] ?? null, field, doc);
      cells[fieldColumnIndex.get(field.id)!] = cell;
    }

    return cells;
  });

  // Summary rows can carry live formulas so the workbook keeps recalculating
  // after someone edits a work package in Excel.
  if (settings.liveFormulas) {
    rows.forEach((row, index) => {
      if (!row.isSummary || row.childRows.length === 0) return;
      for (const field of fields) {
        const fn = FORMULA_ROLLUPS[field.rollup];
        if (!fn) continue;
        const columnIndex = fieldColumnIndex.get(field.id)!;
        const cell = body[index][columnIndex];
        if (cell.value === null) continue;
        const letter = columnLetter(columnIndex);
        const refs = row.childRows.map((child) => `${letter}${sheetRow(child)}`);
        body[index][columnIndex] = { ...cell, formula: `${fn}(${refs.join(",")})` };
      }
    });
  }

  return {
    columns,
    rows: body,
    outline: settings.groupRows ? rows.map((row) => Math.max(0, row.level - 1)) : rows.map(() => 0),
    source: rows,
  };
}

/* ------------------------------- text output ------------------------------- */

function csvField(text: string): string {
  const safe = csvSafe(text);
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function gridToCsv(grid: SheetGrid): string {
  const lines = [grid.columns.map((column) => csvField(column.label)).join(",")];
  for (const row of grid.rows) {
    lines.push(row.map((cell) => csvField(cell.text)).join(","));
  }
  // A BOM-free CRLF file is what Excel opens most predictably on both platforms.
  return lines.join("\r\n");
}

export function gridToMarkdown(grid: SheetGrid): string {
  const escape = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const header = `| ${grid.columns.map((c) => escape(c.label)).join(" | ")} |`;
  const rule = `| ${grid.columns.map((c) => (c.align === "right" ? "---:" : ":---")).join(" | ")} |`;
  const body = grid.rows.map((row) => `| ${row.map((cell) => escape(cell.text)).join(" | ")} |`);
  return [header, rule, ...body].join("\n");
}

/* -------------------------- supporting sheets -------------------------- */

/** The WBS dictionary: one row per task, with its scope description. */
export function buildDictionaryGrid(doc: WbsDoc): SheetGrid {
  const rows = flatten(doc);
  const columns: GridColumn[] = [
    { key: "code", label: "WBS", width: 14, align: "left" },
    { key: "name", label: "Task", width: 34, align: "left" },
    { key: "level", label: "Level", width: 7, align: "right" },
    { key: "type", label: "Type", width: 14, align: "left" },
    { key: "parent", label: "Parent", width: 14, align: "left" },
    { key: "description", label: "Description / acceptance criteria", width: 60, align: "left" },
  ];
  const body = rows.map((row) => [
    textCell(row.code),
    textCell(row.name),
    { text: String(row.level), value: row.level, kind: "number" as const, align: "right" as const },
    textCell(row.isSummary ? "Summary" : "Work package"),
    textCell(row.parentCode),
    textCell(row.description),
  ]);
  return { columns, rows: body, outline: rows.map(() => 0), source: rows };
}

/** Totals for each top-level branch — the one-page view a sponsor asks for. */
export function buildSummaryGrid(doc: WbsDoc): SheetGrid {
  const rows = flatten(doc);
  const fields = visibleFields(doc).filter((field) => field.rollup === "sum");
  const branches = rows.filter((row) => row.level === 1);

  const columns: GridColumn[] = [
    { key: "code", label: "WBS", width: 12, align: "left" },
    { key: "name", label: "Branch", width: 34, align: "left" },
    { key: "tasks", label: "Tasks", width: 8, align: "right" },
    ...fields.map((field) => ({
      key: field.id,
      label: field.label,
      width: field.width,
      align: "right" as const,
    })),
    { key: "share", label: "Share", width: 9, align: "right" },
  ];

  const primary = fields[0];
  const grandTotal = primary
    ? branches.reduce((sum, row) => sum + (asNumber(row.values[primary.id] ?? null) ?? 0), 0)
    : 0;

  const countDescendants = (row: WbsRow) => {
    const start = rows.indexOf(row);
    let n = 0;
    for (let i = start + 1; i < rows.length && rows[i].level > row.level; i++) n += 1;
    return n + 1;
  };

  const body = branches.map((row) => {
    const share = primary && grandTotal > 0
      ? (asNumber(row.values[primary.id] ?? null) ?? 0) / grandTotal
      : null;
    return [
      textCell(row.code),
      textCell(row.name),
      {
        text: String(countDescendants(row)),
        value: countDescendants(row),
        kind: "number" as const,
        align: "right" as const,
      },
      ...fields.map((field) => valueCell(row.values[field.id] ?? null, field, doc)),
      share === null
        ? textCell("", "right")
        : {
            text: `${Math.round(share * 100)}%`,
            value: share,
            kind: "number" as const,
            format: "0%",
            align: "right" as const,
          },
    ];
  });

  return { columns, rows: body, outline: branches.map(() => 0), source: branches };
}

/* ------------------------------ the clipboard ------------------------------ */

/**
 * Tab-separated text.
 *
 * This is the format a spreadsheet understands when it is pasted rather than
 * opened: Excel, Sheets and Numbers all split a tabbed line into columns. Tabs
 * and newlines inside a cell would break that, so they become spaces.
 */
export function gridToTsv(grid: SheetGrid): string {
  const clean = (text: string) => text.replace(/[\t\r\n]+/g, " ");
  const lines = [grid.columns.map((column) => clean(column.label)).join("\t")];
  for (const row of grid.rows) {
    lines.push(row.map((cell) => clean(cell.text)).join("\t"));
  }
  return lines.join("\r\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Keeps the outline indent through a paste.
 *
 * HTML collapses runs of spaces, and Excel prefers the HTML flavour on the
 * clipboard — so the leading spaces that show the level have to survive as
 * non-breaking ones or every task lands flush left.
 */
function preserveIndent(text: string): string {
  const leading = text.match(/^\s+/);
  if (!leading) return escapeHtml(text);
  return "&nbsp;".repeat(leading[0].length) + escapeHtml(text.slice(leading[0].length));
}

/**
 * The same grid as an HTML table.
 *
 * Offered alongside the plain text on the clipboard: Excel prefers the HTML
 * flavour when it is there, which keeps the alignment and stops a code like
 * 1.10 being read as a number.
 */
export function gridToHtml(grid: SheetGrid): string {
  const head = grid.columns
    .map((column) => `<th style="text-align:${column.align}">${escapeHtml(column.label)}</th>`)
    .join("");
  const body = grid.rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const align = `text-align:${cell.align}`;
          // Text cells are marked as text so a spreadsheet keeps them verbatim.
          const type = cell.kind === "text" ? ';mso-number-format:"\\@"' : "";
          return `<td style="${align}${type}">${preserveIndent(cell.text)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
