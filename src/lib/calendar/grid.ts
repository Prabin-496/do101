/**
 * Calendar maths.
 *
 * Everything is computed in local time from year/month/day numbers rather than
 * by adding milliseconds, because adding 24 hours across a daylight-saving
 * boundary lands on the wrong day — the bug behind most off-by-one calendars.
 */

export interface DayCell {
  date: Date;
  day: number;
  month: number;
  year: number;
  /** False for the leading and trailing days borrowed from adjacent months. */
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  /** ISO-8601 week number. */
  week: number;
  dayOfYear: number;
  key: string;
}

export interface MonthGrid {
  year: number;
  month: number;
  label: string;
  weeks: DayCell[][];
  /** ISO week number for each row, shown down the side. */
  weekNumbers: number[];
}

export const WEEKDAYS_SUNDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_MONDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** ISO-8601 week number: weeks start Monday and week 1 holds the first Thursday. */
export function isoWeek(date: Date): number {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Shift to the Thursday of this week; its year decides the week's year.
  const day = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - day + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const here = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((here.getTime() - start.getTime()) / 86400000) + 1;
}

/** Whole days between two dates, ignoring the time of day. */
export function daysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function buildMonth(
  year: number,
  month: number,
  { weekStartsMonday = true, today = new Date() }: { weekStartsMonday?: boolean; today?: Date } = {},
): MonthGrid {
  const first = new Date(year, month, 1);
  const offset = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();

  const cells: DayCell[] = [];
  // Six rows always, so the grid does not jump height between months.
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(year, month, 1 - offset + i);
    const weekday = date.getDay();
    cells.push({
      date,
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      inMonth: date.getMonth() === month && date.getFullYear() === year,
      isToday: isSameDay(date, today),
      isWeekend: weekday === 0 || weekday === 6,
      week: isoWeek(date),
      dayOfYear: dayOfYear(date),
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    year,
    month,
    label: `${MONTH_NAMES[month]} ${year}`,
    weeks,
    weekNumbers: weeks.map((week) => isoWeek(week[weekStartsMonday ? 0 : 1].date)),
  };
}

export interface DayFacts {
  weekday: string;
  formatted: string;
  iso: string;
  week: number;
  dayOfYear: number;
  daysLeftInYear: number;
  quarter: number;
  fromToday: number;
  monthLength: number;
  leapYear: boolean;
}

export function describeDay(date: Date, today = new Date()): DayFacts {
  const year = date.getFullYear();
  const doy = dayOfYear(date);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "long" }),
    formatted: date.toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    }),
    iso: `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    week: isoWeek(date),
    dayOfYear: doy,
    daysLeftInYear: (isLeapYear(year) ? 366 : 365) - doy,
    quarter: Math.floor(date.getMonth() / 3) + 1,
    fromToday: daysBetween(today, date),
    monthLength: daysInMonth(year, date.getMonth()),
    leapYear: isLeapYear(year),
  };
}

/** Plain-language description of how far away a date is. */
export function relativeDay(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  const magnitude = Math.abs(days);
  const direction = days > 0 ? "from now" : "ago";
  if (magnitude < 14) return `${magnitude} days ${direction}`;
  if (magnitude < 60) return `${Math.round(magnitude / 7)} weeks ${direction}`;
  if (magnitude < 365) return `${Math.round(magnitude / 30.44)} months ${direction}`;
  const years = magnitude / 365.25;
  return `${years.toFixed(1)} years ${direction}`;
}
