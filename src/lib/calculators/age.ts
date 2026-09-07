export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalWeeks: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  birthDayOfWeek: string;
  nextBirthdayInDays: number;
  nextBirthdayDate: Date;
  turningAge: number;
}

const MS_PER_DAY = 86_400_000;

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Adds whole months, clamping the day to the target month's length (31 Jan + 1 month = 28 Feb). */
function addMonths(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const day = Math.min(date.getDate(), daysInMonth(year, month));
  return new Date(year, month, day);
}

/**
 * Exact calendar age: whole years, then whole months from that anniversary,
 * then the remaining days. Leap years and 28/30/31-day months are handled
 * by the platform Date, never approximated as "30 days".
 */
export function calculateAge(birth: Date, on: Date = new Date()): AgeResult | null {
  if (Number.isNaN(birth.getTime()) || Number.isNaN(on.getTime())) return null;
  const from = atMidnight(birth);
  const to = atMidnight(on);
  if (from > to) return null;

  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  // The current month is not complete until the day-of-month is reached.
  if (to.getDate() < from.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Remaining days are measured from the last completed month anniversary,
  // so February and 31-day months are counted as they actually are.
  const anchor = addMonths(from, years * 12 + months);
  const days = Math.round((to.getTime() - anchor.getTime()) / MS_PER_DAY);

  // Rounded, not floored: a daylight-saving change makes a calendar day 23 or 25 hours long.
  const totalDays = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);

  // A 29 February birth date rolls to 1 March in non-leap years, matching how
  // most jurisdictions treat the anniversary.
  let nextBirthday = new Date(to.getFullYear(), from.getMonth(), from.getDate());
  if (nextBirthday < to) nextBirthday = new Date(to.getFullYear() + 1, from.getMonth(), from.getDate());
  const nextBirthdayInDays = Math.round((nextBirthday.getTime() - to.getTime()) / MS_PER_DAY);

  return {
    years,
    months,
    days,
    totalMonths: years * 12 + months,
    totalWeeks: Math.floor(totalDays / 7),
    totalDays,
    totalHours: totalDays * 24,
    totalMinutes: totalDays * 24 * 60,
    birthDayOfWeek: from.toLocaleDateString(undefined, { weekday: "long" }),
    nextBirthdayInDays,
    nextBirthdayDate: nextBirthday,
    turningAge: years + 1,
  };
}
