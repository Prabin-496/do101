/**
 * Column definitions and value formatting.
 *
 * Columns are data, not code: the built-ins below are only a starting point,
 * and anything the editor lets you add behaves identically to them. Each
 * column carries the Excel number format it wants, so the spreadsheet comes
 * out with real dates, real currency and real percentages rather than text.
 */

import type {
  ChartSettings,
  GanttSettings,
  FieldType,
  FieldValue,
  Rollup,
  WbsDoc,
  WbsField,
  WbsSettings,
} from "./model";
import { asNumber } from "./model";

export const FIELD_TYPES: { id: FieldType; label: string; hint: string }[] = [
  { id: "text", label: "Text", hint: "Names, owners, notes" },
  { id: "number", label: "Number", hint: "Effort, quantities, counts" },
  { id: "currency", label: "Currency", hint: "Budget and cost columns" },
  { id: "percent", label: "Percent", hint: "0–100, exported as a real %" },
  { id: "date", label: "Date", hint: "Exported as a real Excel date" },
  { id: "select", label: "Choice", hint: "A fixed list of options" },
];

export const ROLLUPS: { id: Rollup; label: string; hint: string }[] = [
  { id: "none", label: "No roll-up", hint: "Summary rows keep their own value" },
  { id: "sum", label: "Sum", hint: "Adds up the work packages beneath" },
  { id: "min", label: "Earliest / lowest", hint: "Good for a start date" },
  { id: "max", label: "Latest / highest", hint: "Good for a finish date" },
  { id: "average", label: "Average", hint: "Mean of the children" },
  { id: "weighted", label: "Weighted average", hint: "Weighted by the chosen column" },
];

/** Roll-ups that can be written as a live Excel formula on a summary row. */
export const FORMULA_ROLLUPS: Record<string, string> = {
  sum: "SUM",
  min: "MIN",
  max: "MAX",
  average: "AVERAGE",
};

export const DEFAULT_FIELDS: WbsField[] = [
  { id: "owner", label: "Owner", type: "text", rollup: "none", width: 16, visible: true, builtin: true },
  { id: "start", label: "Start", type: "date", rollup: "min", width: 12, visible: true, builtin: true },
  { id: "finish", label: "Finish", type: "date", rollup: "max", width: 12, visible: true, builtin: true },
  { id: "hours", label: "Effort (h)", type: "number", rollup: "sum", width: 11, visible: true, builtin: true },
  { id: "cost", label: "Cost", type: "currency", rollup: "sum", width: 13, visible: true, builtin: true },
  { id: "progress", label: "% Complete", type: "percent", rollup: "weighted", width: 12, visible: true, builtin: true },
  {
    id: "status",
    label: "Status",
    type: "select",
    rollup: "none",
    options: ["Not started", "In progress", "Blocked", "Done"],
    width: 14,
    visible: true,
    builtin: true,
  },
  { id: "deliverable", label: "Deliverable", type: "text", rollup: "none", width: 24, visible: false, builtin: true },
  {
    id: "risk",
    label: "Risk",
    type: "select",
    rollup: "none",
    options: ["Low", "Medium", "High"],
    width: 10,
    visible: false,
    builtin: true,
  },
  { id: "notes", label: "Notes", type: "text", rollup: "none", width: 28, visible: false, builtin: true },
];

export const DEFAULT_SETTINGS: WbsSettings = {
  projectName: "New project",
  numbering: { style: "decimal", prefix: "", separator: ".", pad: 0, startAt: 1 },
  showCode: true,
  showLevel: true,
  showParent: false,
  showType: true,
  nameLayout: "indent",
  indentUnit: "    ",
  currencySymbol: "$",
  dateFormat: "yyyy-mm-dd",
  liveFormulas: true,
  groupRows: true,
  includeDictionary: true,
  includeSummary: true,
  weightFieldId: "hours",
};

export const DEFAULT_CHART: ChartSettings = {
  orientation: "down",
  shape: "rounded",
  routing: "orthogonal",
  palette: "brand",
  colourBy: "level",
  colourFieldId: "status",
  nodeWidth: 190,
  nodeHeight: 74,
  siblingGap: 28,
  levelGap: 64,
  fontSize: 13,
  showCode: true,
  showFields: [],
  arrows: false,
  showRoot: true,
  snap: 10,
  positions: {},
};

export const DEFAULT_GANTT: GanttSettings = {
  scale: "week",
  startFieldId: "start",
  endFieldId: "finish",
  progressFieldId: "progress",
  showProgress: true,
  showToday: true,
  showWeekends: true,
  showTextBar: true,
  barWidth: 28,
  colourBy: "level",
  colourFieldId: "status",
  rangeStart: null,
  rangeEnd: null,
  showFields: ["owner"],
  includeInWorkbook: true,
};

export function defaultGantt(): GanttSettings {
  return { ...DEFAULT_GANTT, showFields: [...DEFAULT_GANTT.showFields] };
}

export function defaultChart(): ChartSettings {
  return { ...DEFAULT_CHART, showFields: [], positions: {} };
}

export function defaultFields(): WbsField[] {
  return DEFAULT_FIELDS.map((field) => ({ ...field, options: field.options ? [...field.options] : undefined }));
}

export function defaultSettings(): WbsSettings {
  return { ...DEFAULT_SETTINGS, numbering: { ...DEFAULT_SETTINGS.numbering } };
}

export function visibleFields(doc: WbsDoc): WbsField[] {
  return doc.fields.filter((field) => field.visible);
}

/** A stable, collision-free id derived from a column's label. */
export function fieldIdFromLabel(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "column";
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function newField(label: string, type: FieldType, taken: string[]): WbsField {
  return {
    id: fieldIdFromLabel(label, taken),
    label: label.trim() || "Column",
    type,
    rollup: type === "number" || type === "currency" ? "sum" : "none",
    options: type === "select" ? ["Option A", "Option B"] : undefined,
    width: type === "text" ? 20 : 13,
    visible: true,
  };
}

/* ----------------------------- value coercion ----------------------------- */

const NUMERIC_TYPES: FieldType[] = ["number", "currency", "percent"];

export function isNumericField(field: WbsField): boolean {
  return NUMERIC_TYPES.includes(field.type);
}

/** Turns whatever the input produced into the value the model should store. */
export function coerceValue(raw: string, field: WbsField): FieldValue {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (isNumericField(field)) return asNumber(trimmed);
  return trimmed;
}

/* ------------------------------- formatting ------------------------------- */

export function formatValue(
  value: FieldValue,
  field: WbsField,
  settings: WbsSettings,
): string {
  if (value === null || value === "") return "";
  switch (field.type) {
    case "currency": {
      const n = asNumber(value);
      if (n === null) return String(value);
      return `${settings.currencySymbol}${n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    case "percent": {
      const n = asNumber(value);
      return n === null ? String(value) : `${Math.round(n * 10) / 10}%`;
    }
    case "number": {
      const n = asNumber(value);
      return n === null ? String(value) : String(Math.round(n * 100) / 100);
    }
    default:
      return String(value);
  }
}

/**
 * The Excel number format for a column. Percent columns are stored 0–100 but
 * written as a fraction, because Excel's own % format multiplies by 100.
 */
export function excelNumberFormat(field: WbsField, settings: WbsSettings): string | undefined {
  switch (field.type) {
    case "currency":
      return `"${settings.currencySymbol.replace(/"/g, "")}"#,##0.00`;
    case "percent":
      return "0%";
    case "number":
      return "#,##0.##";
    case "date":
      return settings.dateFormat;
    default:
      return undefined;
  }
}

/** The number Excel should hold for a cell, or null when it is text. */
export function excelNumber(value: FieldValue, field: WbsField): number | null {
  if (value === null || value === "") return null;
  if (field.type === "percent") {
    const n = asNumber(value);
    return n === null ? null : n / 100;
  }
  if (field.type === "number" || field.type === "currency") return asNumber(value);
  return null;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Excel serial number for an ISO date, so the cell is a real date rather than
 * a string that merely looks like one. Day 1 is 1900-01-01, and the sheet
 * format keeps Lotus's phantom 1900-02-29, hence the +1 below 1900-03-01.
 */
export function excelSerialDate(iso: string): number | null {
  if (!ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  if (Number.isNaN(utc)) return null;
  const days = Math.round(utc / 86400000) + 25569;
  return days <= 60 ? days - 1 : days;
}
