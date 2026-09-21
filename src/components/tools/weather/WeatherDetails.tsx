"use client";

import * as React from "react";
import type { DayPoint, WeatherReport } from "@/lib/weather/api";
import { weatherCode, weatherIcon } from "@/lib/weather/codes";
import {
  beaufort,
  cloudReading,
  compass,
  dewPointReading,
  gustNote,
  humidityReading,
  pressureReading,
  uvReading,
} from "@/lib/weather/describe";
import {
  formatClock,
  formatDay,
  formatDuration,
  formatRain,
  formatTemp,
  formatWind,
  type Units,
} from "@/lib/weather/units";
import { cn } from "@/lib/utils/cn";

/**
 * Every reading, with what it means next to it.
 *
 * A number on its own ("1013 hPa", "UV 7") tells most people nothing, so no
 * reading appears here without the sentence that makes it useful.
 */

export interface WeatherDetailsProps {
  report: WeatherReport;
  today: DayPoint | undefined;
  days: DayPoint[];
  pressureThreeHoursAgo: number | null;
  units: Units;
}

export function WeatherDetails({
  report,
  today,
  days,
  pressureThreeHoursAgo,
  units,
}: WeatherDetailsProps) {
  const { current } = report;
  const wind = beaufort(current.wind);
  const gust = gustNote(current.wind, current.gusts);
  const dew = dewPointReading(current.dewPoint);
  const humidity = humidityReading(current.humidity);
  const uv = uvReading(today?.uvMax ?? 0);
  const pressure = pressureReading(current.pressure, pressureThreeHoursAgo);
  const cloud = cloudReading(current.cloudCover);

  return (
    <div className="space-y-4">
      <section aria-label="Readings explained">
        <h3 className="mb-2 text-base font-extrabold">What the numbers mean</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Reading
            icon="💨"
            title="Wind"
            value={`${formatWind(current.wind, units)} from the ${compass(current.windDirection)}`}
            note={`Force ${wind.force}, ${wind.name.toLowerCase()} — ${wind.effect}.${gust ? ` ${gust}` : ""}`}
          />
          <Reading
            icon="💧"
            title="How muggy"
            value={dew.word}
            note={`${dew.note} Dew point ${formatTemp(current.dewPoint, units, true)}, humidity ${Math.round(current.humidity)}% — ${humidity.note.toLowerCase()}`}
          />
          <Reading
            icon="🕶"
            title="UV today"
            value={`${Math.round(today?.uvMax ?? 0)} — ${uv.word.toLowerCase()}`}
            note={uv.note}
          />
          <Reading icon="📊" title="Pressure" value={pressure.word} note={pressure.note} />
          <Reading
            icon="☁️"
            title="Cloud"
            value={`${cloud.word}, ${Math.round(current.cloudCover)}%`}
            note={cloud.note}
          />
          {today ? (
            <Reading
              icon="🌅"
              title="Sun"
              value={`${formatClock(today.sunrise, units)} → ${formatClock(today.sunset, units)}`}
              note={`${formatDuration(today.daylightSeconds / 60)} of daylight today.`}
            />
          ) : null}
        </div>
      </section>

      <section aria-label="The week ahead">
        <h3 className="mb-2 text-base font-extrabold">The week ahead</h3>
        <ul className="overflow-hidden rounded-2xl border-2 border-[var(--border)]">
          {days.map((day, i) => (
            <DayRow
              key={day.date}
              day={day}
              todayIso={report.current.time.slice(0, 10)}
              units={units}
              striped={i % 2 === 1}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Reading({
  icon,
  title,
  value,
  note,
}: {
  icon: string;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
        <span aria-hidden>{icon}</span> {title}
      </p>
      <p className="mt-0.5 text-lg font-extrabold leading-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-snug text-[var(--muted)]">{note}</p>
    </div>
  );
}

function DayRow({
  day,
  todayIso,
  units,
  striped,
}: {
  day: DayPoint;
  todayIso: string;
  units: Units;
  striped: boolean;
}) {
  const sky = weatherCode(day.code);
  const wet = day.precipProbabilityMax >= 30 || day.precipSum > 0.5;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5",
        striped ? "bg-[var(--panel)]" : "bg-[var(--bg)]",
      )}
    >
      <span className="w-16 shrink-0 text-sm font-extrabold">
        {formatDay(day.date, todayIso)}
      </span>
      <span aria-hidden className="w-7 shrink-0 text-center text-lg leading-none">
        {weatherIcon(day.code, true)}
      </span>
      <span className="w-24 shrink-0 text-sm font-extrabold tabular-nums">
        {formatTemp(day.max, units)}
        <span className="ml-1 font-bold text-[var(--muted)]">{formatTemp(day.min, units)}</span>
      </span>
      <span className="min-w-[8rem] flex-1 text-xs font-semibold text-[var(--muted)]">
        {sky.label}
        {wet
          ? ` · ${Math.round(day.precipProbabilityMax)}% chance, ${formatRain(day.precipSum, units)}`
          : " · staying dry"}
        {day.gustMax >= 50 ? ` · gusts ${formatWind(day.gustMax, units)}` : ""}
      </span>
      <span className="shrink-0 text-[11px] font-bold text-[var(--muted)]">
        {formatClock(day.sunrise, units)}–{formatClock(day.sunset, units)}
      </span>
    </li>
  );
}
