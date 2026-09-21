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
  shiftBar,
  timeBands,
  todayIso,
  type GanttBar,
} from "@/lib/wbs/gantt";
import type { WbsDoc, WbsRow } from "@/lib/wbs/model";

/**
 * The timeline.
 *
 * Bars are read from the start and finish columns, so a summary task spans its
 * children without anything being stored for the chart. Dragging a bar writes
 * the dates back to those columns, which is why the sheet beside it moves at
 * the same moment — there is one set of dates, not a chart with its own copy.
 */

const ROW_HEIGHT = 34;
const NAME_WIDTH = 260;
const EDGE = 7;

type Drag = {
  id: string;
  edge: "move" | "start" | "end";
  fromX: number;
  days: number;
};

function barTitle(bar: GanttBar): string {
  if (!bar.start || !bar.end) return `${bar.row.name} — no dates yet`;
  const progress = bar.progress === null ? "" : ` · ${Math.round(bar.progress)}% complete`;
  const span = bar.milestone ? "milestone" : `${bar.days} day${bar.days === 1 ? "" : "s"}`;
  return `${bar.row.name}\n${bar.start} → ${bar.end} · ${span}${progress}\nDrag to move, or drag an edge to change the dates`;
}

export function WbsGantt({
  doc,
  rows,
  selectedId,
  onSelect,
  onDates,
  height = 460,
}: {
  doc: WbsDoc;
  rows: WbsRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called when a bar is dragged, with the dates it landed on. */
  onDates?: (id: string, dates: { start: string; end: string }) => void;
  height?: number;
}) {
  const settings = doc.gantt;
  const palette = paletteFor(doc.chart.palette);
  const [drag, setDrag] = React.useState<Drag | null>(null);

  const { range, periods, bands, truncated, bars, width } = React.useMemo(() => {
    const range = ganttRange(rows, settings);
    const { periods, truncated } = buildPeriods(range.start, range.end, settings.scale);
    return {
      range,
      periods,
      bands: timeBands(periods, settings.scale),
      truncated,
      bars: ganttBars(doc, rows, range),
      width: Math.max(periods.length * (PERIOD_WIDTH[settings.scale] ?? PERIOD_WIDTH.week), 240),
    };
  }, [doc, rows, settings]);

  const hydrated = useIsHydrated();
  const span = Math.max(1, dayDiff(range.start, range.end) + 1);
  const pxPerDay = width / span;
  const todayOffset = hydrated ? dayDiff(range.start, todayIso()) : -1;
  const showToday = settings.showToday && hydrated && todayOffset >= 0 && todayOffset < span;
  const columnWidth = PERIOD_WIDTH[settings.scale] ?? PERIOD_WIDTH.week;

  function startDrag(event: React.PointerEvent, bar: GanttBar) {
    if (!onDates || !bar.start || bar.row.isSummary) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offset = event.clientX - box.left;
    const edge: Drag["edge"] =
      bar.milestone || box.width < EDGE * 3
        ? "move"
        : offset < EDGE
          ? "start"
          : offset > box.width - EDGE
            ? "end"
            : "move";
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    event.stopPropagation();
    onSelect(bar.row.id);
    setDrag({ id: bar.row.id, edge, fromX: event.clientX, days: 0 });
  }

  function onDragMove(event: React.PointerEvent) {
    if (!drag) return;
    const days = Math.round((event.clientX - drag.fromX) / pxPerDay);
    if (days !== drag.days) setDrag({ ...drag, days });
  }

  function endDrag(event: React.PointerEvent) {
    if (!drag) return;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    const bar = bars.find((entry) => entry.row.id === drag.id);
    const dates = bar ? shiftBar(bar, drag.days, drag.edge) : null;
    if (dates && onDates) onDates(drag.id, dates);
    setDrag(null);
  }

  /** Where a bar sits while it is being dragged, before anything is saved. */
  function placement(bar: GanttBar) {
    let { offset, length } = bar;
    if (drag?.id === bar.row.id && drag.days !== 0) {
      const shift = (drag.days * pxPerDay) / width;
      if (drag.edge === "move") offset += shift;
      else if (drag.edge === "start") {
        offset += shift;
        length -= shift;
      } else length += shift;
    }
    return { left: offset * width, width: Math.max(6, length * width) };
  }

  return (
    <div className="space-y-2">
      <div
        className="do-scroll overflow-auto rounded-2xl border-2 border-[var(--border)]"
        style={{ maxHeight: height }}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div className="relative" style={{ width: NAME_WIDTH + width, minWidth: "100%" }}>
          <div className="sticky top-0 z-30 border-b-2 border-[var(--border)] bg-[var(--panel)]">
            <div className="flex">
              <div
                className="sticky left-0 z-40 shrink-0 border-r border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]"
                style={{ width: NAME_WIDTH }}
              >
                Task
              </div>
              {/* The band that says which month or year the columns are in. */}
              <div className="flex" style={{ width }}>
                {bands.map((band) => (
                  <div
                    key={band.key}
                    className="shrink-0 border-l border-[var(--border)] px-2 py-1 text-[11px] font-extrabold text-[var(--muted)]"
                    style={{ width: band.span * columnWidth }}
                  >
                    {band.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex">
              <div
                className="sticky left-0 z-40 shrink-0 border-r border-[var(--border)] bg-[var(--panel)]"
                style={{ width: NAME_WIDTH }}
              />
              <div className="flex" style={{ width }}>
                {periods.map((period) => (
                  <div
                    key={period.key}
                    className={cn(
                      "shrink-0 border-l border-[var(--border)] px-1 pb-1 text-center text-[10px] font-bold text-[var(--muted)]",
                      period.weekend && settings.showWeekends && "bg-[var(--border)]/35",
                    )}
                    style={{ width: columnWidth }}
                  >
                    {period.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-0 z-0 flex" style={{ left: NAME_WIDTH }}>
              {periods.map((period) => (
                <div
                  key={period.key}
                  className={cn(
                    "h-full shrink-0 border-l border-[var(--border)]",
                    period.weekend && settings.showWeekends && "bg-[var(--border)]/25",
                  )}
                  style={{ width: columnWidth }}
                />
              ))}
            </div>

            {showToday ? (
              <div
                className="pointer-events-none absolute top-0 z-20 h-full border-l-2 border-dashed border-[var(--cherry)]"
                style={{ left: NAME_WIDTH + (todayOffset + 0.5) * pxPerDay }}
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
              const at = placement(bar);

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
                      "sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-[var(--border)] px-3 text-xs",
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
                    {bar.days === 0 ? (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--muted)]">
                        no dates
                      </span>
                    ) : bar.milestone ? (
                      <div
                        onPointerDown={(event) => startDrag(event, bar)}
                        className={cn("absolute", onDates && "cursor-grab")}
                        style={{
                          left: at.left - 1,
                          top: ROW_HEIGHT / 2 - 8,
                          width: 16,
                          height: 16,
                          background: swatch.stroke,
                          transform: "rotate(45deg)",
                          borderRadius: 3,
                        }}
                      />
                    ) : (
                      <div
                        onPointerDown={(event) => startDrag(event, bar)}
                        className={cn(
                          "absolute overflow-hidden",
                          row.isSummary ? "rounded-sm" : "rounded-md",
                          onDates && !row.isSummary && "cursor-grab",
                        )}
                        style={{
                          left: at.left,
                          width: at.width,
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
          : onDates
            ? "Drag a bar to move it, or an edge to change one date. Summary bars span their children and follow the work beneath them."
            : "Summary bars span their children."}
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
