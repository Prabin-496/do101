"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { useIsHydrated } from "@/lib/utils/use-local";
import { paletteFor, swatchIndex } from "@/lib/wbs/chart";
import {
  buildPeriods,
  coversPeriod,
  dayDiff,
  ganttBars,
  ganttRange,
  PERIOD_WIDTH,
  todayIso,
  type GanttBar,
} from "@/lib/wbs/gantt";
import type { WbsDoc, WbsRow } from "@/lib/wbs/model";

/**
 * The timeline view.
 *
 * Bars are read from the start and finish columns, so a summary task spans its
 * children automatically. Nothing is stored for the chart itself — change a
 * date in the grid and the bar moves, which is the point of having both in
 * front of you at once.
 */

const ROW_HEIGHT = 34;
const NAME_WIDTH = 260;

function barTitle(bar: GanttBar): string {
  if (!bar.start || !bar.end) return `${bar.row.name} — no dates yet`;
  const progress = bar.progress === null ? "" : ` · ${Math.round(bar.progress)}% complete`;
  return `${bar.row.name}\n${bar.start} → ${bar.end} · ${bar.days} day${bar.days === 1 ? "" : "s"}${progress}`;
}

export function WbsGantt({
  doc,
  rows,
  selectedId,
  onSelect,
  height = 460,
}: {
  doc: WbsDoc;
  rows: WbsRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  height?: number;
}) {
  const settings = doc.gantt;
  const palette = paletteFor(doc.chart.palette);

  const { range, periods, truncated, bars, width } = React.useMemo(() => {
    const range = ganttRange(rows, settings);
    const { periods, truncated } = buildPeriods(range.start, range.end, settings.scale);
    const bars = ganttBars(doc, rows, range);
    return {
      range,
      periods,
      truncated,
      bars,
      width: Math.max(periods.length * PERIOD_WIDTH[settings.scale], 240),
    };
  }, [doc, rows, settings]);

  // Today comes from the visitor's clock, which a server render cannot know,
  // so the line waits for this browser rather than risking a mismatch.
  const hydrated = useIsHydrated();
  const span = Math.max(1, dayDiff(range.start, range.end) + 1);
  const todayOffset = hydrated ? dayDiff(range.start, todayIso()) : -1;
  const showToday = settings.showToday && hydrated && todayOffset >= 0 && todayOffset < span;

  return (
    <div className="space-y-2">
      <div
        className="do-scroll overflow-auto rounded-2xl border-2 border-[var(--border)]"
        style={{ maxHeight: height }}
      >
        <div className="relative" style={{ width: NAME_WIDTH + width, minWidth: "100%" }}>
          <div className="sticky top-0 z-30 flex border-b-2 border-[var(--border)] bg-[var(--panel)]">
            <div
              className="sticky left-0 z-40 shrink-0 bg-[var(--panel)] px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              style={{ width: NAME_WIDTH }}
            >
              Task
            </div>
            <div className="relative flex" style={{ width }}>
              {periods.map((period) => (
                <div
                  key={period.key}
                  className={cn(
                    "shrink-0 border-l border-[var(--border)] px-1 py-2 text-center text-[11px] font-extrabold text-[var(--muted)]",
                    period.weekend && settings.showWeekends && "bg-[var(--border)]/35",
                  )}
                  style={{ width: PERIOD_WIDTH[settings.scale] }}
                >
                  {period.label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* One background layer for the whole body rather than gridlines
                per row, which would be thousands of elements on a big plan. */}
            <div className="pointer-events-none absolute inset-0 z-0 flex" style={{ left: NAME_WIDTH }}>
              {periods.map((period) => (
                <div
                  key={period.key}
                  className={cn(
                    "h-full shrink-0 border-l border-[var(--border)]",
                    period.weekend && settings.showWeekends && "bg-[var(--border)]/25",
                  )}
                  style={{ width: PERIOD_WIDTH[settings.scale] }}
                />
              ))}
            </div>

            {showToday ? (
              <div
                className="pointer-events-none absolute top-0 z-20 h-full border-l-2 border-dashed border-[var(--cherry)]"
                style={{ left: NAME_WIDTH + ((todayOffset + 0.5) / span) * width }}
                aria-hidden
              />
            ) : null}

            {bars.map((bar) => {
              const row = bar.row;
              const selected = row.id === selectedId;
              const swatch =
                palette.swatches[
                  swatchIndex(row, doc, palette.swatches.length, settings.colourBy, settings.colourFieldId)
                ];
              const done =
                settings.showProgress && bar.progress !== null
                  ? Math.max(0, Math.min(100, bar.progress))
                  : null;

              return (
                <div
                  key={row.id}
                  className={cn(
                    "relative z-10 flex border-b border-[var(--border)]",
                    selected && "bg-[var(--sky-soft)]",
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onSelect(row.id)}
                >
                  <div
                    className={cn(
                      "sticky left-0 z-20 flex shrink-0 items-center gap-1.5 px-3 text-xs",
                      selected ? "bg-[var(--sky-soft)]" : row.isSummary ? "bg-[var(--panel)]" : "bg-[var(--bg)]",
                    )}
                    style={{ width: NAME_WIDTH, paddingLeft: 12 + (row.level - 1) * 12 }}
                  >
                    <span className="shrink-0 font-mono text-[10px] font-bold text-[var(--muted)]">
                      {row.code}
                    </span>
                    <span className={cn("truncate", row.isSummary && "font-extrabold")}>
                      {row.name || "Untitled task"}
                    </span>
                  </div>

                  <div className="relative" style={{ width }} title={barTitle(bar)}>
                    {bar.days > 0 ? (
                      <div
                        className={cn(
                          "absolute overflow-hidden",
                          row.isSummary ? "rounded-sm" : "rounded-md",
                        )}
                        style={{
                          left: bar.offset * width,
                          width: Math.max(4, bar.length * width),
                          top: row.isSummary ? ROW_HEIGHT / 2 - 5 : ROW_HEIGHT / 2 - 9,
                          height: row.isSummary ? 10 : 18,
                          background: swatch.fill,
                          border: `2px solid ${swatch.stroke}`,
                        }}
                      >
                        {done === null ? null : (
                          <div
                            className="h-full"
                            style={{ width: `${done}%`, background: swatch.stroke, opacity: 0.45 }}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--muted)]">
                        no dates
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xs font-semibold text-[var(--muted)]">
        {truncated
          ? "The timeline is longer than this view can draw — choose a coarser scale to see all of it."
          : `Bars come from the ${
              doc.fields.find((field) => field.id === settings.startFieldId)?.label ?? "start"
            } and ${
              doc.fields.find((field) => field.id === settings.endFieldId)?.label ?? "finish"
            } columns. Summary rows span their children.`}
      </p>
    </div>
  );
}

/** Whether any task has dates yet, so the panel can say something useful. */
export function hasDates(doc: WbsDoc, rows: WbsRow[]): boolean {
  const range = ganttRange(rows, doc.gantt);
  const { periods } = buildPeriods(range.start, range.end, doc.gantt.scale);
  return ganttBars(doc, rows, range).some((bar) =>
    periods.some((period) => coversPeriod(bar, period)),
  );
}
