/**
 * The WBS on a timeline.
 *
 * Bars come from the start and finish columns, which already roll up: a
 * summary task's bar spans its children because its start is their earliest
 * and its finish their latest. Nothing here is drawn — it produces dates,
 * periods and a sheet grid, so the same numbers feed the screen, the
 * clipboard and the workbook.
 */

import { isoWeek, MONTH_NAMES } from "@/lib/calendar/grid";
import { formatValue, ISO_DATE } from "./fields";
import { buildGrid, textCell, type GridCell, type GridColumn, type SheetGrid } from "./grid";
import { flatten, type GanttScale, type GanttSettings, type WbsDoc, type WbsRow } from "./model";

/* ------------------------------ date maths ------------------------------ */

const DAY = 86400000;

/** Epoch milliseconds for an ISO date, in UTC so no timezone can shift it. */
export function parseIso(iso: string | null | undefined): number | null {
  if (!iso || !ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  return Number.isNaN(ms) ? null : ms;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const ms = parseIso(iso);
  return ms === null ? iso : toIso(ms + days * DAY);
}

/** Whole days from a to b. Same day is 0. */
export function dayDiff(a: string, b: string): number {
  const from = parseIso(a);
  const to = parseIso(b);
  if (from === null || to === null) return 0;
  return Math.round((to - from) / DAY);
}

export function todayIso(now = new Date()): string {
  return toIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 0 = Monday. Used for weekend shading and week snapping. */
export function weekday(iso: string): number {
  return (localDate(iso).getDay() + 6) % 7;
}

export function isWeekend(iso: string): boolean {
  return weekday(iso) >= 5;
}

/* -------------------------------- periods -------------------------------- */

export interface GanttPeriod {
  key: string;
  label: string;
  /** Inclusive first and last day of the period. */
  start: string;
  end: string;
  weekend: boolean;
}

/** The first day of the period a date falls in. */
export function periodStart(iso: string, scale: GanttScale): string {
  const [y, m, d] = iso.split("-").map(Number);
  switch (scale) {
    case "week":
      return addDays(iso, -weekday(iso));
    case "month":
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
    case "quarter": {
      const first = Math.floor((m - 1) / 3) * 3 + 1;
      return `${String(y).padStart(4, "0")}-${String(first).padStart(2, "0")}-01`;
    }
    default:
      void d;
      return iso;
  }
}

function nextPeriod(iso: string, scale: GanttScale): string {
  const [y, m] = iso.split("-").map(Number);
  switch (scale) {
    case "week":
      return addDays(iso, 7);
    case "month":
      return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    case "quarter": {
      const month = m + 3;
      return month > 12
        ? `${y + 1}-${String(month - 12).padStart(2, "0")}-01`
        : `${y}-${String(month).padStart(2, "0")}-01`;
    }
    default:
      return addDays(iso, 1);
  }
}

function periodLabel(start: string, scale: GanttScale): string {
  const [y, m, d] = start.split("-").map(Number);
  const month = MONTH_NAMES[m - 1].slice(0, 3);
  switch (scale) {
    case "week":
      return `W${isoWeek(localDate(start))}`;
    case "month":
      return `${month} ${y}`;
    case "quarter":
      return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    default:
      return `${d} ${month}`;
  }
}

/** Columns get wider as the scale gets coarser, so labels still fit. */
export const PERIOD_WIDTH: Record<GanttScale, number> = {
  day: 30,
  week: 44,
  month: 62,
  quarter: 62,
};

/** More than this and both the screen and the sheet stop being readable. */
export const MAX_PERIODS = 400;

export function buildPeriods(
  from: string,
  to: string,
  scale: GanttScale,
): { periods: GanttPeriod[]; truncated: boolean } {
  const periods: GanttPeriod[] = [];
  let cursor = periodStart(from, scale);
  let truncated = false;

  while (dayDiff(cursor, to) >= 0) {
    if (periods.length >= MAX_PERIODS) {
      truncated = true;
      break;
    }
    const next = nextPeriod(cursor, scale);
    periods.push({
      key: cursor,
      label: periodLabel(cursor, scale),
      start: cursor,
      end: addDays(next, -1),
      weekend: scale === "day" && isWeekend(cursor),
    });
    cursor = next;
  }

  return { periods, truncated };
}

/**
 * The band above the period columns: months over days and weeks, years over
 * months and quarters. A timeline of week numbers is unreadable without it.
 */
export interface TimeBand {
  key: string;
  label: string;
  /** How many period columns this band covers. */
  span: number;
}

export function timeBands(periods: GanttPeriod[], scale: GanttScale): TimeBand[] {
  const bands: TimeBand[] = [];
  for (const period of periods) {
    const [y, m] = period.start.split("-").map(Number);
    const byYear = scale === "month" || scale === "quarter";
    const key = byYear ? String(y) : `${y}-${m}`;
    const label = byYear ? String(y) : `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
    const last = bands[bands.length - 1];
    if (last && last.key === key) last.span += 1;
    else bands.push({ key, label, span: 1 });
  }
  return bands;
}

/* --------------------------------- bars --------------------------------- */

export interface GanttBar {
  row: WbsRow;
  /** A task of a single day, drawn as a diamond rather than a bar. */
  milestone: boolean;
  start: string | null;
  end: string | null;
  /** Inclusive duration in days. 0 when the task has no dates. */
  days: number;
  progress: number | null;
  /** Position along the timeline, as a share of it. */
  offset: number;
  length: number;
}

export interface GanttRange {
  start: string;
  end: string;
}

function datesFor(row: WbsRow, settings: GanttSettings): { start: string | null; end: string | null } {
  const rawStart = row.values[settings.startFieldId];
  const rawEnd = row.values[settings.endFieldId];
  const start = typeof rawStart === "string" && ISO_DATE.test(rawStart) ? rawStart : null;
  const end = typeof rawEnd === "string" && ISO_DATE.test(rawEnd) ? rawEnd : null;
  // A task with only one date is treated as a single day, which is what a
  // milestone is — better than dropping it off the chart entirely.
  return { start: start ?? end, end: end ?? start };
}

/** The window the timeline covers: the work, or the dates that were pinned. */
export function ganttRange(rows: WbsRow[], settings: GanttSettings): GanttRange {
  let earliest: string | null = settings.rangeStart;
  let latest: string | null = settings.rangeEnd;

  if (!earliest || !latest) {
    for (const row of rows) {
      const { start, end } = datesFor(row, settings);
      if (start && (!earliest || dayDiff(start, earliest) > 0)) earliest = settings.rangeStart ?? start;
      if (end && (!latest || dayDiff(latest, end) > 0)) latest = settings.rangeEnd ?? end;
    }
  }

  // Nothing has dates yet: show the month ahead so the chart is not empty.
  if (!earliest || !latest) {
    const today = todayIso();
    return { start: settings.rangeStart ?? today, end: settings.rangeEnd ?? addDays(today, 30) };
  }
  if (dayDiff(earliest, latest) < 0) return { start: latest, end: earliest };
  return { start: earliest, end: latest };
}

export function ganttBars(doc: WbsDoc, rows: WbsRow[], range: GanttRange): GanttBar[] {
  const settings = doc.gantt;
  const span = Math.max(1, dayDiff(range.start, range.end) + 1);

  return rows.map((row) => {
    const { start, end } = datesFor(row, settings);
    const progressRaw = settings.progressFieldId ? row.values[settings.progressFieldId] : null;
    const progress = typeof progressRaw === "number" ? progressRaw : null;

    if (!start || !end) {
      return { row, milestone: false, start: null, end: null, days: 0, progress, offset: 0, length: 0 };
    }

    const days = dayDiff(start, end) + 1;
    const offset = dayDiff(range.start, start) / span;
    return {
      row,
      milestone: days <= 1 && !row.isSummary,
      start,
      end,
      days,
      progress,
      offset: Math.max(0, Math.min(1, offset)),
      length: Math.max(0, Math.min(1 - Math.max(0, offset), days / span)),
    };
  });
}

/** Whether a bar covers any part of a period. */
export function coversPeriod(bar: GanttBar, period: GanttPeriod): boolean {
  if (!bar.start || !bar.end) return false;
  return dayDiff(bar.start, period.end) >= 0 && dayDiff(period.start, bar.end) >= 0;
}

const BAR_DONE = "█";

/* ------------------------------- the sheet ------------------------------- */

/**
 * The Gantt as a grid: the task, its dates, and one column per period with a
 * block where the task is running. Pasting that into Excel gives a chart you
 * can see straight away, and conditional formatting turns it into colour.
 */
export function buildGanttGrid(doc: WbsDoc): SheetGrid {
  const settings = doc.gantt;
  const rows = flatten(doc);
  const range = ganttRange(rows, settings);
  const { periods } = buildPeriods(range.start, range.end, settings.scale);
  const bars = ganttBars(doc, rows, range);

  // The same table as the WBS sheet, so the structure is identical wherever
  // the plan is opened — the timeline is columns appended to it, not a
  // different layout with the same data in it.
  const base = buildGrid(doc);

  const columns: GridColumn[] = [
    ...base.columns,
    ...periods.map((period) => ({
      key: `p-${period.key}`,
      label: period.label,
      width: 5,
      align: "left" as const,
    })),
  ];

  const body: GridCell[][] = base.rows.map((cells, index) => {
    const bar = bars[index];
    return [
      ...cells,
      ...periods.map((period) =>
        textCell(bar && coversPeriod(bar, period) ? BAR_DONE : ""),
      ),
    ];
  });

  return { columns, rows: body, outline: base.outline, source: base.source };
}

/**
 * Moves or resizes a bar by whole days.
 *
 * Dragging a bar shifts both ends; dragging an edge moves one and never lets
 * it cross the other, so a task cannot come out finishing before it starts.
 */
export function shiftBar(
  bar: GanttBar,
  days: number,
  edge: "move" | "start" | "end",
): { start: string; end: string } | null {
  if (!bar.start || !bar.end || days === 0) return null;
  if (edge === "move") {
    return { start: addDays(bar.start, days), end: addDays(bar.end, days) };
  }
  if (edge === "start") {
    const start = addDays(bar.start, days);
    return { start: dayDiff(start, bar.end) < 0 ? bar.end : start, end: bar.end };
  }
  const end = addDays(bar.end, days);
  return { start: bar.start, end: dayDiff(bar.start, end) < 0 ? bar.start : end };
}

/** A one-line summary for the heading above the chart. */
export function describeRange(range: GanttRange, doc: WbsDoc): string {
  const field = doc.fields.find((entry) => entry.id === doc.gantt.startFieldId);
  if (!field) return `${range.start} to ${range.end}`;
  const from = formatValue(range.start, field, doc.settings) || range.start;
  const to = formatValue(range.end, field, doc.settings) || range.end;
  const days = dayDiff(range.start, range.end) + 1;
  return `${from} → ${to} · ${days} days`;
}
