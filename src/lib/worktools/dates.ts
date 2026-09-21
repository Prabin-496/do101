/**
 * Deadlines in ordinary language — "by Friday", "EOD", "next Tuesday",
 * "明日まで", "9月30日" — turned into calendar dates.
 *
 * Everything is worked out in the visitor's own calendar days, relative to a
 * reference date passed in, so a test can pin "today" and a page can use the
 * real one. Where a phrase is genuinely ambiguous the convention used is the
 * one stated here, and the matched text is always returned so the interface
 * can show what was read rather than just the answer.
 *
 *  - "Friday", "by Friday", "this Friday": the next Friday, today included.
 *  - "next Friday": the Friday of next week (weeks start on Monday).
 *  - "end of week" and "今週中": this week's Friday.
 *  - "3/4" style dates are month-first unless the first number is over 12,
 *    and are only read after a word like "by" or "due", so that "3/4 of the
 *    team" is not mistaken for a deadline.
 */

export interface DueDate {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM, when a time was given. */
  time: string | null;
  /** The words the date was read from. */
  text: string;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};
const JA_WEEKDAYS: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9,
  sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

const WEEKDAY_RE = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)";
const MONTH_RE =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)";

/** Calendar arithmetic at local noon, so daylight-saving changes cannot shift a day. */
function day(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function startOf(now: Date): Date {
  return day(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function addDays(date: Date, n: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + n);
  return out;
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function comingWeekday(today: Date, weekday: number): Date {
  return addDays(today, (weekday - today.getDay() + 7) % 7);
}

function nextWeekWeekday(today: Date, weekday: number): Date {
  // Monday of next week, then along to the weekday wanted.
  const toMonday = ((8 - today.getDay()) % 7) || 7;
  const monday = addDays(today, toMonday);
  return addDays(monday, (weekday + 6) % 7);
}

function endOfWeek(today: Date): Date {
  // Friday of this working week; on a weekend, the Friday just gone is past,
  // so the coming Friday is meant.
  return comingWeekday(today, 5);
}

function endOfMonth(today: Date, monthsAhead = 0): Date {
  return day(today.getFullYear(), today.getMonth() + 2 + monthsAhead, 0);
}

/** A month and day with no year: this year, unless that is long past. */
function withYear(today: Date, month: number, date: number, year?: number): Date | null {
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  if (year) return valid(day(year < 100 ? 2000 + year : year, month, date), month, date);
  let candidate = valid(day(today.getFullYear(), month, date), month, date);
  if (!candidate) return null;
  // Two months in the past is more likely next year than badly overdue.
  if (candidate.getTime() < addDays(today, -60).getTime()) {
    candidate = valid(day(today.getFullYear() + 1, month, date), month, date);
  }
  return candidate;
}

/** Rejects dates like 31 February that JavaScript would silently roll over. */
function valid(date: Date, month: number, dayOfMonth: number): Date | null {
  return date.getMonth() + 1 === month && date.getDate() === dayOfMonth ? date : null;
}

function findTime(text: string): string | null {
  const noon = /\b(noon|midday)\b|正午/i.exec(text);
  if (noon) return "12:00";
  const ampm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === "pm") hour += 12;
    return `${String(hour).padStart(2, "0")}:${ampm[2] ?? "00"}`;
  }
  const clock = /(?:^|[^\d/:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/.exec(text);
  if (clock) return `${clock[1].padStart(2, "0")}:${clock[2]}`;
  const ja = /(\d{1,2})時(?:(\d{1,2})分|半)?/.exec(text);
  if (ja) {
    const minutes = ja[0].endsWith("半") ? "30" : (ja[2] ?? "00").padStart(2, "0");
    return `${ja[1].padStart(2, "0")}:${minutes}`;
  }
  return null;
}

interface Rule {
  re: RegExp;
  resolve: (m: RegExpExecArray, today: Date) => Date | null;
}

const RULES: Rule[] = [
  // ISO and Japanese-style full dates.
  { re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, resolve: (m, t) => withYear(t, +m[2], +m[3], +m[1]) },
  { re: /(\d{4})年(\d{1,2})月(\d{1,2})日/, resolve: (m, t) => withYear(t, +m[2], +m[3], +m[1]) },
  { re: /(\d{1,2})月(\d{1,2})日/, resolve: (m, t) => withYear(t, +m[1], +m[2]) },
  // "September 30th", "Sep 30, 2026".
  {
    re: new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"),
    resolve: (m, t) => withYear(t, MONTHS[m[1].toLowerCase()], +m[2], m[3] ? +m[3] : undefined),
  },
  // "30 September", "30th of Sept".
  {
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`, "i"),
    resolve: (m, t) => withYear(t, MONTHS[m[2].toLowerCase()], +m[1], m[3] ? +m[3] : undefined),
  },
  // Numeric dates, only after a deadline word, or before まで / までに.
  {
    re: /\b(?:by|on|due|until|till|before|deadline:?|due date:?)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/i,
    resolve: (m, t) => {
      const a = +m[1];
      const b = +m[2];
      const [month, date] = a > 12 ? [b, a] : [a, b];
      return withYear(t, month, date, m[3] ? +m[3] : undefined);
    },
  },
  { re: /(\d{1,2})\/(\d{1,2})\s*(?:\([^)]*\)\s*)?まで/, resolve: (m, t) => withYear(t, +m[1], +m[2]) },
  // Japanese relative words.
  { re: /明後日|あさって/, resolve: (_m, t) => addDays(t, 2) },
  { re: /明日|あした/, resolve: (_m, t) => addDays(t, 1) },
  { re: /本日中?|今日中?|きょう/, resolve: (_m, t) => t },
  { re: /来週の?([日月火水木金土])曜/, resolve: (m, t) => nextWeekWeekday(t, JA_WEEKDAYS[m[1]]) },
  { re: /今週の?([日月火水木金土])曜/, resolve: (m, t) => comingWeekday(t, JA_WEEKDAYS[m[1]]) },
  { re: /(?<![来今])([日月火水木金土])曜日?(?:まで|に|中)/, resolve: (m, t) => comingWeekday(t, JA_WEEKDAYS[m[1]]) },
  { re: /今週中|今週末/, resolve: (_m, t) => endOfWeek(t) },
  { re: /来週中|来週末/, resolve: (_m, t) => addDays(endOfWeek(t), 7) },
  { re: /来週/, resolve: (_m, t) => nextWeekWeekday(t, 1) },
  { re: /今月末|月末/, resolve: (_m, t) => endOfMonth(t) },
  { re: /来月末/, resolve: (_m, t) => endOfMonth(t, 1) },
  { re: /来月/, resolve: (_m, t) => day(t.getFullYear(), t.getMonth() + 2, 1) },
  // English relative words.
  { re: /\bday after tomorrow\b/i, resolve: (_m, t) => addDays(t, 2) },
  { re: /\b(tomorrow|tmrw|tmr)\b/i, resolve: (_m, t) => addDays(t, 1) },
  {
    re: /\b(today|tonight|eod|end of (?:the )?day|cob|close of business|this (?:morning|afternoon|evening))\b/i,
    resolve: (_m, t) => t,
  },
  { re: /\bin\s+(\d{1,3}|a|one|two|three|four|five)\s+(day|week)s?\b/i, resolve: (m, t) => {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
    const n = Number.isNaN(+m[1]) ? words[m[1].toLowerCase()] : +m[1];
    return addDays(t, m[2].toLowerCase() === "week" ? n * 7 : n);
  } },
  { re: new RegExp(`\\bnext\\s+${WEEKDAY_RE}\\b`, "i"), resolve: (m, t) => nextWeekWeekday(t, WEEKDAYS[m[1].toLowerCase()]) },
  { re: /\b(?:end of (?:the )?week|eow)\b/i, resolve: (_m, t) => endOfWeek(t) },
  { re: /\b(?:end of (?:the )?month|eom)\b/i, resolve: (_m, t) => endOfMonth(t) },
  { re: /\bnext week\b/i, resolve: (_m, t) => nextWeekWeekday(t, 1) },
  { re: /\bnext month\b/i, resolve: (_m, t) => day(t.getFullYear(), t.getMonth() + 2, 1) },
  { re: /\bthis week\b/i, resolve: (_m, t) => endOfWeek(t) },
  {
    re: new RegExp(`\\b(?:by|on|this|until|till|before|due)?\\s*${WEEKDAY_RE}\\b`, "i"),
    resolve: (m, t) => comingWeekday(t, WEEKDAYS[m[1].toLowerCase()]),
  },
];

export function findDueDate(sentence: string, now: Date = new Date()): DueDate | null {
  const today = startOf(now);
  for (const rule of RULES) {
    const match = rule.re.exec(sentence);
    if (!match) continue;
    const resolved = rule.resolve(match, today);
    if (!resolved) continue;
    return { date: isoDate(resolved), time: findTime(sentence), text: match[0].trim() };
  }
  return null;
}

/** Whole days from today to a YYYY-MM-DD date. Negative means overdue. */
export function daysUntil(date: string, now: Date = new Date()): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((day(y, m, d).getTime() - startOf(now).getTime()) / 86_400_000);
}

export function formatDue(date: string | null, now: Date = new Date()): string {
  if (!date) return "No date";
  const days = daysUntil(date, now);
  const [y, m, d] = date.split("-").map(Number);
  const label = day(y, m, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  if (days === 0) return `Today (${label})`;
  if (days === 1) return `Tomorrow (${label})`;
  if (days < 0) return `${label} — ${-days} day${days === -1 ? "" : "s"} overdue`;
  return label;
}
