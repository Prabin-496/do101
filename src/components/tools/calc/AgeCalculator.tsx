"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, Stat } from "@/components/ui/Feedback";
import { calculateAge } from "@/lib/calculators/age";
import { formatNumber } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AgeCalculator() {
  const [birth, setBirth] = React.useState("");
  const [on, setOn] = React.useState(todayIso());

  const result = React.useMemo(() => {
    if (!birth) return null;
    return calculateAge(new Date(`${birth}T00:00:00`), new Date(`${on}T00:00:00`));
  }, [birth, on]);

  const invalid = Boolean(birth) && result === null;

  React.useEffect(() => {
    if (result) track("tool_complete", { tool: "age" });
  }, [result]);

  const summary = result
    ? `${result.years} years, ${result.months} months and ${result.days} days`
    : "";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={birth}
              max={todayIso()}
              onChange={(e) => setBirth(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="on-date" hint="defaults to today">
              Age on
            </Label>
            <Input id="on-date" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            tone="ghost"
            onClick={() => {
              setBirth("");
              setOn(todayIso());
            }}
            disabled={!birth}
          >
            Reset
          </Button>
        </div>
      </Card>

      {invalid ? (
        <ErrorState message="The date of birth has to come before the second date. Check the two dates and try again." />
      ) : null}

      {result ? (
        <>
          <Card className="do-pop bg-[var(--grass-soft)] p-6 text-center">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              Exact age
            </p>
            <p className="mt-2 text-4xl font-extrabold sm:text-5xl">
              {result.years}
              <span className="text-2xl"> years</span> {result.months}
              <span className="text-2xl"> months</span> {result.days}
              <span className="text-2xl"> days</span>
            </p>
            <div className="mt-4 flex justify-center">
              <CopyButton value={summary} label="Copy result" tone="grass" />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Total months" value={formatNumber(result.totalMonths, 0)} tone="sky" />
            <Stat label="Total weeks" value={formatNumber(result.totalWeeks, 0)} tone="grape" />
            <Stat label="Total days" value={formatNumber(result.totalDays, 0)} tone="fire" />
            <Stat label="Total hours" value={formatNumber(result.totalHours, 0)} />
            <Stat label="Total minutes" value={formatNumber(result.totalMinutes, 0)} />
            <Stat label="Born on a" value={result.birthDayOfWeek} tone="grass" />
          </div>

          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Next birthday
              </p>
              <p className="text-lg font-extrabold">
                {result.nextBirthdayDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <p className="text-right">
              <span className="block text-3xl font-extrabold text-[var(--fire)]">
                {result.nextBirthdayInDays}
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                days — turning {result.turningAge}
              </span>
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
