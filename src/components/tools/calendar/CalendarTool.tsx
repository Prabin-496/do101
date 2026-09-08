"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { Stat, InfoNote } from "@/components/ui/Feedback";
import { Tabs } from "@/components/ui/Tabs";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  MONTH_NAMES, WEEKDAYS_MONDAY, WEEKDAYS_SUNDAY, buildMonth, daysBetween,
  describeDay, isSameDay, relativeDay,
} from "@/lib/calendar/grid";
import { useIsHydrated } from "@/lib/utils/use-local";
import { cn } from "@/lib/utils/cn";

type View = "month" | "year";

function parseISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CalendarTool() {
  const hydrated = useIsHydrated();
  // The server has no idea what "today" is where the reader is, so the grid is
  // built from a fixed reference until hydration and then re-based on the real
  // local date. Doing it the other way round marks the wrong day.
  const today = React.useMemo(() => (hydrated ? new Date() : new Date(2026, 0, 1)), [hydrated]);

  const [view, setView] = React.useState<View>("month");
  const [cursor, setCursor] = React.useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = React.useState<Date | null>(null);
  const [mondayFirst, setMondayFirst] = React.useState(true);
  const [showWeeks, setShowWeeks] = React.useState(true);
  const [rangeStart, setRangeStart] = React.useState("");
  const [rangeEnd, setRangeEnd] = React.useState("");

  // Keep the visible month on today's month once the real date is known.
  const based = React.useRef(false);
  React.useEffect(() => {
    if (based.current || !hydrated) return;
    based.current = true;
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  }, [hydrated]);

  const grid = React.useMemo(
    () => buildMonth(cursor.year, cursor.month, { weekStartsMonday: mondayFirst, today }),
    [cursor, mondayFirst, today],
  );

  const facts = React.useMemo(
    () => describeDay(selected ?? today, today),
    [selected, today],
  );

  const weekdays = mondayFirst ? WEEKDAYS_MONDAY : WEEKDAYS_SUNDAY;

  function shift(months: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month + months, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  const start = parseISO(rangeStart);
  const end = parseISO(rangeEnd);
  const spanDays = start && end ? daysBetween(start, end) : null;

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="Calendar view"
        value={view}
        onChange={(id) => setView(id as View)}
        items={[
          { id: "month", label: "Month" },
          { id: "year", label: "Whole year" },
        ]}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" tone="panel" onClick={() => shift(view === "year" ? -12 : -1)} aria-label="Previous">
              ‹
            </Button>
            <Button
              size="sm"
              tone="panel"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getFullYear(), month: now.getMonth() });
                setSelected(null);
              }}
            >
              Today
            </Button>
            <Button size="sm" tone="panel" onClick={() => shift(view === "year" ? 12 : 1)} aria-label="Next">
              ›
            </Button>
          </div>
          <p className="text-xl font-black">
            {view === "year" ? cursor.year : grid.label}
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="cal-year" className="mb-0">Jump to</Label>
            <Input
              id="cal-year"
              type="number"
              value={cursor.year}
              min={1}
              max={9999}
              onChange={(event) => {
                const year = Number(event.target.value);
                if (year >= 1 && year <= 9999) setCursor((c) => ({ ...c, year }));
              }}
              className="w-24"
            />
          </div>
        </div>

        {view === "month" ? (
          <div className="mt-4">
            <div
              className={cn(
                "grid gap-1 text-center text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]",
                showWeeks ? "grid-cols-[2.5rem_repeat(7,1fr)]" : "grid-cols-7",
              )}
            >
              {showWeeks ? <span className="py-2">Wk</span> : null}
              {weekdays.map((day) => (
                <span key={day} className="py-2">{day}</span>
              ))}
            </div>

            {grid.weeks.map((week, rowIndex) => (
              <div
                key={rowIndex}
                className={cn("grid gap-1", showWeeks ? "grid-cols-[2.5rem_repeat(7,1fr)]" : "grid-cols-7")}
              >
                {showWeeks ? (
                  <span className="flex items-center justify-center text-xs font-bold text-[var(--muted)]">
                    {grid.weekNumbers[rowIndex]}
                  </span>
                ) : null}
                {week.map((cell) => {
                  const isSelected = selected ? isSameDay(cell.date, selected) : false;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelected(cell.date)}
                      aria-current={cell.isToday ? "date" : undefined}
                      aria-pressed={isSelected}
                      className={cn(
                        "aspect-square rounded-xl border-2 text-sm font-extrabold transition",
                        cell.inMonth ? "" : "opacity-35",
                        cell.isWeekend && cell.inMonth ? "text-[var(--cherry-dark)] dark:text-[var(--cherry)]" : "",
                        cell.isToday
                          ? "border-[var(--grass)] bg-[var(--grass-soft)]"
                          : isSelected
                            ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                            : "border-transparent hover:border-[var(--border-strong)]",
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MONTH_NAMES.map((name, monthIndex) => {
              const month = buildMonth(cursor.year, monthIndex, {
                weekStartsMonday: mondayFirst,
                today,
              });
              return (
                <div key={name} className="rounded-2xl border-2 border-[var(--border)] p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCursor({ year: cursor.year, month: monthIndex });
                      setView("month");
                    }}
                    className="mb-2 w-full text-left text-sm font-extrabold hover:underline"
                  >
                    {name}
                  </button>
                  <div className="grid grid-cols-7 gap-px text-center text-[10px] font-bold text-[var(--muted)]">
                    {weekdays.map((day) => (
                      <span key={day}>{day[0]}</span>
                    ))}
                  </div>
                  {month.weeks.map((week, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-7 gap-px">
                      {week.map((cell) => (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => {
                            setSelected(cell.date);
                            setCursor({ year: cell.year, month: cell.month });
                            setView("month");
                          }}
                          className={cn(
                            "aspect-square rounded text-[11px] font-bold transition",
                            cell.inMonth ? "" : "opacity-25",
                            cell.isToday
                              ? "bg-[var(--grass)] text-white"
                              : "hover:bg-[var(--panel)]",
                          )}
                        >
                          {cell.day}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <Toggle
            checked={mondayFirst}
            onChange={setMondayFirst}
            label="Week starts on Monday"
            description="Off starts the week on Sunday, as calendars in the US usually do."
          />
        </Card>
        <Card className="p-4">
          <Toggle
            checked={showWeeks}
            onChange={setShowWeeks}
            label="Show ISO week numbers"
            description="Week 1 is the week holding the first Thursday of the year."
          />
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          {selected ? "Selected date" : "Today"}
        </p>
        <p className="mt-1 text-2xl font-black">{facts.formatted}</p>
        <p className="mt-1 text-sm font-bold text-[var(--muted)]">
          {relativeDay(facts.fromToday)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="ISO week" value={String(facts.week)} tone="sky" />
          <Stat label="Day of year" value={String(facts.dayOfYear)} tone="grape" />
          <Stat label="Days left in year" value={String(facts.daysLeftInYear)} tone="fire" />
          <Stat label="Quarter" value={`Q${facts.quarter}`} tone="grass" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton value={facts.iso} label={`Copy ${facts.iso}`} />
          {selected ? (
            <Button size="sm" tone="ghost" onClick={() => setSelected(null)}>
              Back to today
            </Button>
          ) : null}
          <span className="text-xs font-bold text-[var(--muted)]">
            {MONTH_NAMES[(selected ?? today).getMonth()]} has {facts.monthLength} days ·{" "}
            {facts.leapYear ? "leap year" : "not a leap year"}
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-extrabold">Days between two dates</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cal-from">From</Label>
            <Input
              id="cal-from"
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cal-to">To</Label>
            <Input
              id="cal-to"
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            tone="panel"
            onClick={() => setRangeStart(toISO(today))}
          >
            From today
          </Button>
          <Button
            size="sm"
            tone="panel"
            onClick={() => setRangeEnd(toISO(selected ?? today))}
            disabled={!selected}
          >
            To selected date
          </Button>
        </div>
        {spanDays !== null ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Days" value={String(Math.abs(spanDays))} tone="sky" />
            <Stat label="Weeks" value={(Math.abs(spanDays) / 7).toFixed(1)} tone="grape" />
            <Stat label="Weekdays" value={String(countWeekdays(start!, end!))} tone="grass" hint="Mon–Fri" />
            <Stat
              label="Direction"
              value={spanDays === 0 ? "Same day" : spanDays > 0 ? "Forward" : "Back"}
              tone="fire"
            />
          </div>
        ) : rangeStart || rangeEnd ? (
          <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
            Pick both dates to see the gap.
          </p>
        ) : null}
      </Card>

      <InfoNote icon="📅">
        <strong className="font-extrabold">Dates are counted, not estimated.</strong>{" "}
        Gaps are worked out from calendar days rather than by adding hours, so
        daylight-saving changes and leap years do not shift the answer by a day.
        Week numbers follow ISO-8601, the standard used across Europe and in most
        business software: weeks start on Monday and week 1 is the one containing
        the first Thursday of the year.
      </InfoNote>
    </div>
  );
}

/** Whole weekdays in a range, inclusive of both ends. */
function countWeekdays(a: Date, b: Date): number {
  const [from, to] = daysBetween(a, b) >= 0 ? [a, b] : [b, a];
  let count = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= last) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
