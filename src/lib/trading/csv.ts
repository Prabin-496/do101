/**
 * CSV import.
 *
 * This is the adapter that never breaks, never rate-limits and never costs
 * anyone anything: whatever history a visitor can export from their own
 * platform, they can analyse here. MetaTrader, TradingView, Dukascopy and
 * plain "date,open,high,low,close" files all land in the same shape.
 *
 * Every guess the parser makes — which column is which, which way round an
 * ambiguous date is, what timeframe the bars are — is reported back rather
 * than applied silently, because a file read as month-first when it was
 * day-first produces a chart that looks fine and is wrong.
 */

import { guessInstrument, TIMEFRAMES, type Candle, type Series, type Timeframe } from "./types";

export interface ParsedCsv {
  series: Series;
  /** Assumptions and repairs, shown to the visitor after an import. */
  notes: string[];
  rowsRead: number;
  rowsSkipped: number;
}

export class CsvError extends Error {}

const DELIMITERS = [",", ";", "\t", "|"];

const COLUMN_PATTERNS: { key: keyof Row; patterns: RegExp[] }[] = [
  { key: "time", patterns: [/^(date|datetime|timestamp|time|local time|gmt time)$/i] },
  { key: "clock", patterns: [/^(time|hour)$/i] },
  { key: "open", patterns: [/^(open|o|open price)$/i] },
  { key: "high", patterns: [/^(high|h|max)$/i] },
  { key: "low", patterns: [/^(low|l|min)$/i] },
  { key: "close", patterns: [/^(close|c|close price|last|price|adj close|rate)$/i] },
  { key: "volume", patterns: [/^(volume|vol|tickvol|tick volume|real volume)$/i] },
];

interface Row {
  time: number;
  clock: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function parseCsv(text: string, fileName = "imported.csv"): ParsedCsv {
  const notes: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 3) throw new CsvError("That file has fewer than three rows of data in it.");

  const delimiter = pickDelimiter(lines[0]);
  const firstCells = splitRow(lines[0], delimiter);
  const hasHeader = firstCells.some((c) => /[a-z]{2,}/i.test(c) && !isDateLike(c));
  const header = hasHeader ? firstCells.map((c) => c.replace(/^"|"$/g, "").trim()) : [];
  const body = hasHeader ? lines.slice(1) : lines;

  const columns = hasHeader ? mapHeader(header) : mapPositional(splitRow(body[0], delimiter));
  if (columns.close < 0) {
    throw new CsvError(
      "No closing-price column found. The file needs a header row naming the columns, or the classic date, open, high, low, close order.",
    );
  }
  if (!hasHeader) notes.push("No header row found, so the columns were read in date, open, high, low, close, volume order.");

  // Ambiguous dates are decided once for the whole file, from the whole file.
  const dayFirst = detectDayFirst(body.map((l) => splitRow(l, delimiter)[columns.time] ?? ""));
  if (dayFirst === "ambiguous") {
    notes.push("Dates like 03/04/2024 could be read either way; they were read as month-first. If your file is day-first, the chart will be in the wrong order.");
  }

  const candles: Candle[] = [];
  let skipped = 0;

  for (const line of body) {
    const cells = splitRow(line, delimiter);
    const stamp = parseTime(cells[columns.time], columns.clock >= 0 ? cells[columns.clock] : undefined, dayFirst === "day");
    const close = num(cells[columns.close]);
    if (stamp === null || close === null) {
      skipped += 1;
      continue;
    }
    const open = columns.open >= 0 ? num(cells[columns.open]) : null;
    const high = columns.high >= 0 ? num(cells[columns.high]) : null;
    const low = columns.low >= 0 ? num(cells[columns.low]) : null;
    const volume = columns.volume >= 0 ? num(cells[columns.volume]) : null;

    candles.push({
      time: stamp,
      open: open ?? close,
      high: high ?? Math.max(open ?? close, close),
      low: low ?? Math.min(open ?? close, close),
      close,
      volume,
    });
  }

  if (candles.length < 30) {
    throw new CsvError(
      `Only ${candles.length} usable row${candles.length === 1 ? "" : "s"} were read. An analysis needs a few hundred bars to mean anything.`,
    );
  }

  candles.sort((a, b) => a.time - b.time);

  // Duplicate stamps are common in exports that repeat the last bar.
  const deduped: Candle[] = [];
  for (const candle of candles) {
    if (deduped.length && deduped[deduped.length - 1].time === candle.time) {
      deduped[deduped.length - 1] = candle;
      continue;
    }
    deduped.push(candle);
  }
  if (deduped.length !== candles.length) {
    notes.push(`${candles.length - deduped.length} duplicate timestamps were collapsed to the last row for that time.`);
  }

  const closeOnly = columns.high < 0 || columns.low < 0;
  if (closeOnly) {
    notes.push("The file has no high and low columns, so it is treated as a close-only series and stops can only be tested at the close.");
  }

  const repaired = repair(deduped);
  if (repaired.fixed > 0) {
    notes.push(`${repaired.fixed} bar${repaired.fixed === 1 ? " had a high or low" : "s had highs or lows"} that did not contain the open and close; they were widened to the real range.`);
  }

  const timeframe = inferTimeframe(repaired.candles);
  const symbol = symbolFrom(fileName);
  const instrument = guessInstrument(symbol);
  if (instrument.id === "GENERIC") {
    notes.push("The symbol could not be recognised from the file name, so generic contract details are used. Set the pip size and contract size in the risk panel if they are wrong.");
  }

  if (skipped > 0) notes.push(`${skipped} row${skipped === 1 ? "" : "s"} could not be read and were skipped.`);

  return {
    series: {
      symbol,
      instrumentId: instrument.id,
      timeframe,
      candles: repaired.candles,
      closeOnly,
      source: `CSV — ${fileName}`,
      sourceNote: "Imported from your own file. Nothing was uploaded; the file was read in this browser.",
      fetchedAt: Date.now(),
    },
    notes,
    rowsRead: repaired.candles.length,
    rowsSkipped: skipped,
  };
}

/* --------------------------------- helpers -------------------------------- */

function pickDelimiter(line: string): string {
  let best = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

function splitRow(line: string, delimiter: string): string[] {
  // Quoted fields are rare in price exports but do appear in spreadsheet saves.
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && ch === delimiter) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

interface Columns {
  time: number;
  clock: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function mapHeader(header: string[]): Columns {
  const columns: Columns = { time: -1, clock: -1, open: -1, high: -1, low: -1, close: -1, volume: -1 };
  header.forEach((name, index) => {
    for (const { key, patterns } of COLUMN_PATTERNS) {
      if (columns[key] >= 0) continue;
      if (patterns.some((p) => p.test(name))) {
        // "Time" is a date column when nothing else claimed the date, and a
        // clock column when a date column already exists.
        if (key === "clock" && columns.time < 0) continue;
        columns[key] = index;
        return;
      }
    }
  });
  if (columns.time < 0) columns.time = 0;
  return columns;
}

function mapPositional(firstRow: string[]): Columns {
  // MetaTrader's headerless export is date, time, O, H, L, C, volume.
  const hasClock = /^\d{1,2}:\d{2}/.test(firstRow[1] ?? "");
  const offset = hasClock ? 2 : 1;
  return {
    time: 0,
    clock: hasClock ? 1 : -1,
    open: offset,
    high: offset + 1,
    low: offset + 2,
    close: offset + 3,
    volume: firstRow.length > offset + 4 ? offset + 4 : -1,
  };
}

function isDateLike(cell: string): boolean {
  return /\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(cell) || /^\d{9,13}$/.test(cell);
}

export function detectDayFirst(cells: string[]): "day" | "month" | "ambiguous" {
  for (const cell of cells) {
    const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(cell.trim());
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12) return "day";
    if (second > 12) return "month";
  }
  // No row settles it, so the convention has to be assumed and declared.
  return cells.some((c) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(c.trim())) ? "ambiguous" : "month";
}

export function parseTime(dateCell: string | undefined, clockCell: string | undefined, dayFirst: boolean): number | null {
  if (!dateCell) return null;
  const raw = dateCell.trim();

  // Epoch seconds or milliseconds.
  if (/^\d{13}$/.test(raw)) return Number(raw);
  if (/^\d{10}$/.test(raw)) return Number(raw) * 1000;

  const clock = (clockCell ?? "").trim();
  const timePart = /^\d{1,2}:\d{2}/.test(clock) ? clock : "";

  // 2024-01-02, 2024.01.02, 2024/01/02, optionally with the time attached.
  const iso = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(raw);
  if (iso) {
    const [, y, m, d, hh, mm, ss] = iso;
    return utc(+y, +m, +d, hh ? +hh : hourOf(timePart), mm ? +mm : minuteOf(timePart), ss ? +ss : 0);
  }

  // 02/01/2024 and friends, where the order was decided for the whole file.
  const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(raw);
  if (slashed) {
    const [, a, b, y, hh, mm, ss] = slashed;
    const day = dayFirst ? +a : +b;
    const month = dayFirst ? +b : +a;
    return utc(+y, month, day, hh ? +hh : hourOf(timePart), mm ? +mm : minuteOf(timePart), ss ? +ss : 0);
  }

  const fallback = Date.parse(timePart ? `${raw} ${timePart}` : raw);
  return Number.isNaN(fallback) ? null : fallback;
}

function hourOf(clock: string): number {
  return clock ? Number(clock.slice(0, 2).replace(":", "")) : 0;
}

function minuteOf(clock: string): number {
  const match = /:(\d{2})/.exec(clock);
  return match ? Number(match[1]) : 0;
}

function utc(y: number, m: number, d: number, hh: number, mm: number, ss: number): number {
  return Date.UTC(y, m - 1, d, hh, mm, ss);
}

function num(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  // Thousands separators and stray currency symbols appear in spreadsheet saves.
  const cleaned = cell.replace(/[^0-9.,\-+eE]/g, "").replace(/,(?=\d{3}\b)/g, "");
  const value = Number(cleaned.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Widens any bar whose high or low does not contain its own open and close. */
function repair(candles: Candle[]): { candles: Candle[]; fixed: number } {
  let fixed = 0;
  const out = candles.map((c) => {
    const high = Math.max(c.high, c.open, c.close);
    const low = Math.min(c.low, c.open, c.close);
    if (high !== c.high || low !== c.low) fixed += 1;
    return { ...c, high, low };
  });
  return { candles: out, fixed };
}

/**
 * The timeframe, from the most common gap between bars.
 *
 * The median gap, not the mean: weekends and holidays leave big holes in a
 * price history, and an average would place a daily forex series somewhere
 * between daily and weekly.
 */
export function inferTimeframe(candles: Candle[]): Timeframe {
  if (candles.length < 3) return "1d";
  const gaps: number[] = [];
  for (let i = 1; i < Math.min(candles.length, 500); i++) {
    const gap = candles[i].time - candles[i - 1].time;
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return "1d";
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];

  let best: Timeframe = "1d";
  let closest = Infinity;
  for (const tf of TIMEFRAMES) {
    const distance = Math.abs(Math.log(tf.ms) - Math.log(median));
    if (distance < closest) {
      closest = distance;
      best = tf.id;
    }
  }
  return best;
}

function symbolFrom(fileName: string): string {
  const stem = fileName.replace(/\.[a-z]+$/i, "");
  const match = /([A-Z]{3}[/_-]?[A-Z]{3})/.exec(stem.toUpperCase());
  if (match) {
    const pair = match[1].replace(/[/_-]/g, "");
    return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  }
  if (/GOLD|XAU/i.test(stem)) return "XAU/USD";
  return stem.slice(0, 24) || "Imported";
}
