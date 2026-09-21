"use client";

import * as React from "react";
import type { DayPoint, HourPoint, WeatherReport } from "@/lib/weather/api";
import { weatherCode, weatherIcon } from "@/lib/weather/codes";
import {
  daylightSentence,
  feelsLike,
  headline,
  rainSentence,
  warnings,
  whatToWear,
  yesterdaySentence,
} from "@/lib/weather/describe";
import { formatTemp, type Units } from "@/lib/weather/units";

/**
 * The answer, before any of the numbers.
 *
 * Someone opening a weather page wants one sentence and then a decision —
 * coat or no coat, umbrella or no umbrella. That is what this panel is; the
 * readings underneath are for anybody who wants to check the working.
 */

export interface WeatherNowProps {
  report: WeatherReport;
  today: DayPoint | undefined;
  hoursAhead: HourPoint[];
  sameHourYesterday: HourPoint | undefined;
  placeName: string;
  units: Units;
}

export function WeatherNow({
  report,
  today,
  hoursAhead,
  sameHourYesterday,
  placeName,
  units,
}: WeatherNowProps) {
  const { current } = report;
  const sky = weatherCode(current.code);
  const feels = feelsLike(current, units);
  const alerts = warnings(current, today);
  const advice = whatToWear(current, hoursAhead, today?.uvMax ?? 0);
  const yesterday = yesterdaySentence(current, sameHourYesterday, units);
  const daylight = today ? daylightSentence(today, current.time, units) : "";

  return (
    <section
      className="space-y-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
      aria-label="Current weather"
    >
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="text-6xl leading-none sm:text-7xl">
          {weatherIcon(current.code, current.isDay)}
        </span>

        <div className="min-w-[8rem]">
          <p className="text-5xl font-extrabold leading-none tabular-nums sm:text-6xl">
            {formatTemp(current.temp, units)}
          </p>
          <p className="mt-1 text-sm font-extrabold text-[var(--muted)]">
            Feels like {formatTemp(current.apparent, units, true)}
          </p>
        </div>

        <div className="min-w-[14rem] flex-1">
          <p className="text-lg font-extrabold leading-snug">{headline(current, placeName, units)}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{sky.sentence}</p>
          {today ? (
            <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
              Today: {formatTemp(today.max, units)} high, {formatTemp(today.min, units)} low.
              {yesterday ? ` ${yesterday}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {alerts.length ? (
        <ul className="space-y-1.5" aria-label="Warnings">
          {alerts.map((alert) => (
            <li
              key={alert}
              className="flex items-start gap-2 rounded-xl border-2 border-[var(--cherry)] bg-[var(--cherry-soft)] px-3 py-2 text-sm font-extrabold"
            >
              <span aria-hidden>⚠️</span>
              <span>{alert}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {feels.reason ? <Line icon="🌡" text={feels.reason} /> : null}
        <Line icon="🌧" text={rainSentence(hoursAhead, units)} />
        {daylight ? <Line icon={current.isDay ? "🌇" : "🌙"} text={daylight} /> : null}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          If you are going out
        </h3>
        <ul className="flex flex-wrap gap-2">
          {advice.map((item) => (
            <li
              key={item}
              className="rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm font-semibold"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Line({ icon, text }: { icon: string; text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-[var(--bg)] px-3 py-2 text-sm font-semibold">
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
    </p>
  );
}
