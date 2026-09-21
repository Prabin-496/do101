"use client";

import * as React from "react";
import type { HourPoint } from "@/lib/weather/api";
import { weatherIcon } from "@/lib/weather/codes";
import { formatClock, formatTemp, formatWind, type Units } from "@/lib/weather/units";
import { cn } from "@/lib/utils/cn";

/**
 * The next 24 hours.
 *
 * Temperature and chance-of-rain are two different measures, so they get two
 * stacked plots against one shared hour axis rather than being crushed onto
 * one pair of axes — a second y-scale would let either line be drawn to say
 * anything. The hour labels, the icons and both plots share the same columns,
 * so reading straight down a column answers "what is it doing at four?".
 *
 * The block scrolls sideways rather than squeezing: 24 legible columns beat
 * 24 unreadable ones, and it is the gesture people already use on a phone
 * for an hourly strip.
 */

/** Column width in px. Wide enough for "10pm" and a two-digit temperature. */
const COL = 54;
const PAD_LEFT = 8;

const ROW = {
  time: 16,
  icon: 42,
  tempTop: 56,
  tempBottom: 124,
  barTop: 140,
  barBase: 186,
  percent: 200,
};
const HEIGHT = 208;

export interface HourlyChartProps {
  hours: HourPoint[];
  units: Units;
}

export function HourlyChart({ hours, units }: HourlyChartProps) {
  const [active, setActive] = React.useState<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  if (hours.length < 2) return null;

  const width = PAD_LEFT * 2 + hours.length * COL;
  const x = (i: number) => PAD_LEFT + i * COL + COL / 2;

  /* --------------------------- the temperature line -------------------------- */

  const temps = hours.map((h) => h.temp);
  const lowest = Math.min(...temps);
  const highest = Math.max(...temps);
  // A flat day would otherwise divide by zero and draw a line off the top.
  const span = Math.max(1, highest - lowest);
  const y = (temp: number) =>
    ROW.tempBottom - ((temp - lowest) / span) * (ROW.tempBottom - ROW.tempTop);

  const linePath = hours.map((h, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${round(y(h.temp))}`).join(" ");
  const warmestAt = temps.indexOf(highest);
  const coldestAt = temps.indexOf(lowest);

  /* ------------------------------ the rain bars ------------------------------ */

  const barHeight = (probability: number) =>
    Math.max(0, (Math.min(100, Math.max(0, probability)) / 100) * (ROW.barBase - ROW.barTop));
  const anyRain = hours.some((h) => h.precipProbability >= 5);

  /* --------------------------------- labels --------------------------------- */

  // Selective, not every point: the extremes always, then every third hour.
  const labelled = new Set<number>([0, warmestAt, coldestAt]);
  for (let i = 3; i < hours.length; i += 3) labelled.add(i);

  const summary = `Hourly forecast. Temperature between ${formatTemp(lowest, units, true)} and ${formatTemp(highest, units, true)}. ${
    anyRain
      ? `Highest chance of rain ${Math.round(Math.max(...hours.map((h) => h.precipProbability)))}%.`
      : "No rain expected."
  } The hour-by-hour figures are listed below the chart.`;

  const hovered = active !== null ? hours[active] : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-extrabold">The next {hours.length} hours</h3>
        <p className="text-xs font-semibold text-[var(--muted)]">
          <span className="text-[var(--chart-warm)]">●</span> temperature
          {anyRain ? (
            <>
              {" · "}
              <span className="text-[var(--chart-cool)]">●</span> chance of rain
            </>
          ) : null}
          {" · scroll sideways for more"}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="do-scroll relative overflow-x-auto rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)]"
      >
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block"
          role="img"
          aria-label={summary}
          onPointerLeave={() => setActive(null)}
        >
          {/* Night hours get a recessive band, so dusk and dawn are visible. */}
          {hours.map((hour, i) =>
            hour.isDay ? null : (
              <rect
                key={`night-${hour.time}`}
                x={PAD_LEFT + i * COL}
                y={ROW.time + 4}
                width={COL}
                height={ROW.barBase - ROW.time}
                fill="var(--ink)"
                opacity={0.045}
              />
            ),
          )}

          {/* The baseline the bars stand on, and the only rule on the plot. */}
          <line
            x1={PAD_LEFT}
            y1={ROW.barBase}
            x2={width - PAD_LEFT}
            y2={ROW.barBase}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {hours.map((hour, i) => {
            const isNow = i === 0;
            const height = barHeight(hour.precipProbability);
            return (
              <g key={hour.time}>
                <text
                  x={x(i)}
                  y={ROW.time}
                  textAnchor="middle"
                  className={cn(
                    "text-[11px]",
                    isNow ? "fill-[var(--ink)] font-extrabold" : "fill-[var(--muted)] font-bold",
                  )}
                >
                  {isNow ? "Now" : formatClock(hour.time, units)}
                </text>

                <text x={x(i)} y={ROW.icon} textAnchor="middle" className="text-[15px]">
                  {weatherIcon(hour.code, hour.isDay)}
                </text>

                {/* 4px rounded end, anchored to the baseline. */}
                {height > 0.5 ? (
                  <rect
                    x={x(i) - 9}
                    y={ROW.barBase - height}
                    width={18}
                    height={height}
                    rx={4}
                    fill="var(--chart-cool)"
                  />
                ) : null}

                {hour.precipProbability >= 15 ? (
                  <text
                    x={x(i)}
                    y={ROW.percent}
                    textAnchor="middle"
                    className="fill-[var(--muted)] text-[10px] font-bold"
                  >
                    {Math.round(hour.precipProbability)}%
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* The line goes over the bars but under the labels and the crosshair. */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--chart-warm)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hours.map((hour, i) => {
            if (!labelled.has(i)) return null;
            const point = y(hour.temp);
            const extreme = i === warmestAt || i === coldestAt;
            return (
              <g key={`label-${hour.time}`}>
                {/* A surface ring keeps the dot readable where it meets the line. */}
                <circle
                  cx={x(i)}
                  cy={point}
                  r={extreme ? 4.5 : 3.5}
                  fill="var(--chart-warm)"
                  stroke="var(--panel)"
                  strokeWidth={2}
                />
                <text
                  x={x(i)}
                  y={point - 10}
                  textAnchor="middle"
                  className={cn(
                    "text-[11px]",
                    extreme ? "fill-[var(--ink)] font-extrabold" : "fill-[var(--muted)] font-bold",
                  )}
                >
                  {formatTemp(hour.temp, units)}
                </text>
              </g>
            );
          })}

          {/* Crosshair for whichever column the pointer is over. */}
          {active !== null ? (
            <line
              x1={x(active)}
              y1={ROW.icon + 6}
              x2={x(active)}
              y2={ROW.barBase}
              stroke="var(--ink)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.45}
              pointerEvents="none"
            />
          ) : null}

          {/* Hit targets: a full-height column each, far bigger than the marks. */}
          {hours.map((hour, i) => (
            <rect
              key={`hit-${hour.time}`}
              x={PAD_LEFT + i * COL}
              y={0}
              width={COL}
              height={HEIGHT}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              tabIndex={-1}
            />
          ))}
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg)] px-2.5 py-1.5 text-center shadow-[0_2px_0_var(--border-strong)]"
            style={{ left: x(active!) }}
          >
            <p className="text-[11px] font-extrabold">
              {active === 0 ? "Now" : formatClock(hovered.time, units)} · {formatTemp(hovered.temp, units, true)}
            </p>
            <p className="text-[10px] font-semibold text-[var(--muted)]">
              feels {formatTemp(hovered.apparent, units)} · {Math.round(hovered.precipProbability)}% rain ·{" "}
              {formatWind(hovered.wind, units)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
