export type TimestampUnit = "seconds" | "milliseconds";

export interface TimestampInfo {
  ms: number;
  unit: TimestampUnit;
  iso: string;
  utc: string;
  local: string;
  relative: string;
  dayOfWeek: string;
  seconds: number;
  milliseconds: number;
}

/** Ten-digit values are seconds; thirteen-digit values are milliseconds. */
export function detectUnit(value: number): TimestampUnit {
  return Math.abs(value) >= 1e12 ? "milliseconds" : "seconds";
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
    ["second", 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.round(diff / size), unit);
  }
  return "just now";
}

export function describeTimestamp(
  input: number,
  unitOverride?: TimestampUnit,
): TimestampInfo | null {
  if (!Number.isFinite(input)) return null;
  const unit = unitOverride ?? detectUnit(input);
  const ms = unit === "seconds" ? input * 1000 : input;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;

  return {
    ms,
    unit,
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }),
    relative: relativeTime(ms),
    dayOfWeek: date.toLocaleDateString(undefined, { weekday: "long" }),
    seconds: Math.floor(ms / 1000),
    milliseconds: ms,
  };
}

export function dateToTimestamp(value: string): TimestampInfo | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return describeTimestamp(date.getTime(), "milliseconds");
}
