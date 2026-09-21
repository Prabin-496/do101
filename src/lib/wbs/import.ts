/**
 * Getting an existing breakdown in.
 *
 * Two routes cover almost everything people already have: a pasted outline
 * (indented lines, bullets, or numbered like 1.2.3) and a spreadsheet that was
 * exported from somewhere else. The spreadsheet reader works out the hierarchy
 * from whichever convention the file uses — a WBS code column, a column per
 * level, a numeric level column, or indentation in the task column.
 */

import type { FieldType, FieldValue, WbsDoc, WbsField, WbsTask } from "./model";
import { CHART_SHAPES, newTask } from "./model";
import {
  coerceValue,
  defaultChart,
  defaultFields,
  defaultGantt,
  defaultSettings,
  fieldIdFromLabel,
  ISO_DATE,
} from "./fields";

/* ------------------------------- outlines ------------------------------- */

const BULLET = /^[-*•·–—]\s+/;
const NUMBERED = /^((?:\d+)(?:[.)-]\d+)*)([.)])?(\s+|$)/;

interface OutlineLine {
  level: number;
  name: string;
}

function indentWidth(line: string): number {
  const match = line.match(/^[ \t]*/);
  if (!match) return 0;
  // A tab is a level on its own; spaces are counted and scaled later.
  return match[0].split("").reduce((total, ch) => total + (ch === "\t" ? 8 : 1), 0);
}

/**
 * Parses an outline into levelled lines. A numbering prefix wins over
 * indentation, because "1.2.1" states the depth unambiguously and pasted text
 * often loses its leading whitespace.
 */
export function parseOutlineLines(text: string): OutlineLine[] {
  const raw = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (raw.length === 0) return [];

  const indents = raw.map(indentWidth);
  const steps = [...new Set(indents.filter((n) => n > 0))].sort((a, b) => a - b);
  const unit = steps.length > 0 ? steps[0] : 1;

  return raw.map((line, i) => {
    let name = line.trim();
    let level = Math.floor(indents[i] / unit) + 1;

    const numbered = name.match(NUMBERED);
    // A line that is only digits ("2026") is a task name, not a code. It
    // counts as numbering only when a separator or terminator says so.
    const isCode =
      numbered !== null &&
      (numbered[3] !== "" || Boolean(numbered[2]) || /[.)-]/.test(numbered[1]));
    if (numbered && isCode) {
      const segments = numbered[1].split(/[.)-]/).filter(Boolean);
      level = segments.length;
      name = name.slice(numbered[0].length).trim();
    } else {
      name = name.replace(BULLET, "").trim();
    }

    return { level: Math.max(1, level), name: name || "Untitled task" };
  });
}

/** Builds a tree from levelled lines, clamping jumps that skip a level. */
export function linesToTasks(
  lines: { level: number; name: string; values?: Record<string, FieldValue>; description?: string }[],
): WbsTask[] {
  const roots: WbsTask[] = [];
  const stack: WbsTask[] = [];

  for (const line of lines) {
    const task = newTask(line.name, line.values ?? {});
    if (line.description) task.description = line.description;
    // A level deeper than one past its parent is treated as one past it,
    // which is what keeps a ragged paste from producing a broken tree.
    const level = Math.min(line.level, stack.length + 1);
    stack.length = Math.max(0, level - 1);
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(task);
    else roots.push(task);
    stack.push(task);
  }

  return roots;
}

export function parseOutline(text: string): WbsTask[] {
  return linesToTasks(parseOutlineLines(text));
}

/* ----------------------------- spreadsheets ----------------------------- */

const CODE_HEADER = /^(wbs|wbs\s*(code|id|no|number|#)|code|id|item|ref)$/i;
const NAME_HEADER =
  /^(task|task\s*(name|title)|wbs\s*(name|title)|name|title|activity|work\s*package|element|deliverable|description)$/i;
const LEVEL_HEADER = /^(level|depth|tier|outline\s*level)$/i;
const LEVEL_COLUMN = /^level\s*(\d+)$/i;
const CODE_VALUE = /^[A-Za-z]*[-_.]?\d+([.\-]\d+)*$/;

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function guessType(values: string[]): FieldType {
  const filled = values.filter((v) => v.trim() !== "");
  if (filled.length === 0) return "text";
  if (filled.every((v) => ISO_DATE.test(v.trim()))) return "date";
  if (filled.every((v) => /^-?[\d,]+(\.\d+)?%$/.test(v.trim()))) return "percent";
  if (filled.every((v) => /^[$£€¥]\s?-?[\d,]+(\.\d+)?$/.test(v.trim()))) return "currency";
  if (filled.every((v) => /^-?[\d,]+(\.\d+)?$/.test(v.trim()))) return "number";
  const unique = new Set(filled.map((v) => v.trim()));
  if (unique.size <= 6 && filled.length >= unique.size * 2) return "select";
  return "text";
}

export interface ImportResult {
  tasks: WbsTask[];
  /** Columns found in the file — existing ones matched, new ones created. */
  fields: WbsField[];
  /** Human-readable account of how the hierarchy was read. */
  notes: string[];
}

/**
 * Turns a sheet into a tree. `existing` lets a file be matched against the
 * columns already in the editor, so re-importing an exported workbook keeps
 * the same columns rather than duplicating them.
 */
export function tableToTasks(rows: string[][], existing: WbsField[] = []): ImportResult {
  const notes: string[] = [];
  const headerIndex = rows.findIndex(
    (row) => row.filter((cell) => cell.trim() !== "").length >= 2,
  );
  if (headerIndex < 0) return { tasks: [], fields: existing, notes: ["No rows found in the file."] };

  const header = rows[headerIndex].map((cell) => cell.trim());
  const body = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim() !== ""));

  const codeColumn = header.findIndex((cell) => CODE_HEADER.test(normalise(cell)));
  const levelColumn = header.findIndex((cell) => LEVEL_HEADER.test(normalise(cell)));
  const levelColumns = header
    .map((cell, index) => ({ index, match: cell.match(LEVEL_COLUMN) }))
    .filter((entry): entry is { index: number; match: RegExpMatchArray } => Boolean(entry.match))
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .map((entry) => entry.index);
  const nameColumn = header.findIndex((cell) => NAME_HEADER.test(normalise(cell)));
  const descriptionColumn = header.findIndex((cell) =>
    /^(description|scope|acceptance|dictionary|detail|notes?)$/i.test(normalise(cell)),
  );

  // Columns consumed by the structure must not also become data columns.
  const structural = new Set<number>([codeColumn, levelColumn, nameColumn, ...levelColumns]);
  structural.delete(-1);

  const fields: WbsField[] = existing.map((field) => ({ ...field }));
  const dataColumns: { index: number; field: WbsField }[] = [];
  const takenIds = fields.map((field) => field.id);

  header.forEach((label, index) => {
    if (structural.has(index) || label.trim() === "") return;
    if (index === descriptionColumn) return;
    if (/^(type|parent|share)$/i.test(normalise(label))) return;
    const match = fields.find((field) => normalise(field.label) === normalise(label));
    if (match) {
      match.visible = true;
      dataColumns.push({ index, field: match });
      return;
    }
    const type = guessType(body.map((row) => row[index] ?? ""));
    const created: WbsField = {
      id: fieldIdFromLabel(label, takenIds),
      label: label.trim(),
      type,
      rollup: type === "number" || type === "currency" ? "sum" : "none",
      options:
        type === "select"
          ? [...new Set(body.map((row) => (row[index] ?? "").trim()).filter(Boolean))]
          : undefined,
      width: type === "text" ? 22 : 13,
      visible: true,
    };
    takenIds.push(created.id);
    fields.push(created);
    dataColumns.push({ index, field: created });
  });

  let strategy = "";
  const lines = body.map((row) => {
    const cell = (index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");

    let level = 1;
    let name = "";

    const code = cell(codeColumn);
    if (code && CODE_VALUE.test(code)) {
      level = code.replace(/^[A-Za-z]*[-_.]?/, "").split(/[.\-]/).filter(Boolean).length;
      strategy = strategy || "the WBS code column";
    }

    if (levelColumns.length > 0) {
      const found = levelColumns.findIndex((index) => cell(index) !== "");
      if (found >= 0) {
        level = found + 1;
        name = cell(levelColumns[found]);
        strategy = strategy || "one column per level";
      }
    }

    if (!name && nameColumn >= 0) {
      const rawName = row[nameColumn] ?? "";
      name = rawName.trim();
      if (levelColumns.length === 0 && !code) {
        const numeric = Number(cell(levelColumn));
        if (levelColumn >= 0 && Number.isFinite(numeric) && numeric > 0) {
          level = Math.round(numeric);
          strategy = strategy || "the level column";
        } else {
          const indent = rawName.match(/^[ \t]+/);
          if (indent) {
            level = Math.floor(indent[0].replace(/\t/g, "    ").length / 4) + 1;
            strategy = strategy || "indentation in the task column";
          }
        }
      }
    }

    if (!name) name = cell(0) || "Untitled task";

    const values: Record<string, FieldValue> = {};
    for (const column of dataColumns) {
      const value = coerceValue(cell(column.index).replace(/%$/, ""), column.field);
      if (value !== null) values[column.field.id] = value;
    }

    return { level: Math.max(1, level), name, values, description: cell(descriptionColumn) };
  });

  notes.push(`Read ${lines.length} rows using ${strategy || "a flat list"}.`);
  if (dataColumns.length > 0) {
    notes.push(`Matched columns: ${dataColumns.map((c) => c.field.label).join(", ")}.`);
  }

  return { tasks: linesToTasks(lines), fields, notes };
}

/* --------------------------------- JSON --------------------------------- */

export function docToJson(doc: WbsDoc): string {
  return JSON.stringify(doc, null, 2);
}

function sanitiseTask(input: unknown): WbsTask | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const task = newTask(typeof record.name === "string" ? record.name : "");
  if (typeof record.description === "string") task.description = record.description;
  if (record.values && typeof record.values === "object") {
    for (const [key, value] of Object.entries(record.values as Record<string, unknown>)) {
      if (typeof value === "string" || typeof value === "number" || value === null) {
        task.values[key] = value;
      }
    }
  }
  if (record.style && typeof record.style === "object") {
    const style = record.style as Record<string, unknown>;
    const shape = CHART_SHAPES.find((kind) => kind === style.shape);
    task.style = {
      fill: typeof style.fill === "string" ? style.fill : undefined,
      stroke: typeof style.stroke === "string" ? style.stroke : undefined,
      shape,
    };
  }
  if (typeof record.collapsed === "boolean") task.collapsed = record.collapsed;
  if (Array.isArray(record.children)) {
    task.children = record.children
      .map(sanitiseTask)
      .filter((child): child is WbsTask => child !== null);
  }
  return task;
}

/** Rebuilds a document from a saved file, filling in anything missing. */
export function parseDoc(json: string): WbsDoc | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.tasks)) return null;

  const fields = Array.isArray(record.fields)
    ? (record.fields as unknown[]).filter(
        (field): field is WbsField =>
          Boolean(field) &&
          typeof (field as WbsField).id === "string" &&
          typeof (field as WbsField).label === "string",
      )
    : defaultFields();

  return {
    version: 1,
    settings: { ...defaultSettings(), ...(record.settings as object | undefined) },
    chart: { ...defaultChart(), ...(record.chart as object | undefined) },
    gantt: { ...defaultGantt(), ...(record.gantt as object | undefined) },
    fields: fields.length > 0 ? fields : defaultFields(),
    tasks: record.tasks.map(sanitiseTask).filter((task): task is WbsTask => task !== null),
  };
}
