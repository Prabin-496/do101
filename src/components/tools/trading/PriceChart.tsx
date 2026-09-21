"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  clampView,
  drawChart,
  indexAtX,
  layoutFor,
  DARK_CHART,
  LIGHT_CHART,
  type ChartView,
  type TradeMarker,
} from "@/lib/trading/chart";
import type { MaybeNumber } from "@/lib/trading/indicators";
import type { Level } from "@/lib/trading/levels";
import { formatBarTime } from "@/lib/trading/format";
import type { Candle, Instrument, Timeframe } from "@/lib/trading/types";
import { cn } from "@/lib/utils/cn";

export interface PriceChartProps {
  candles: Candle[];
  instrument: Instrument;
  timeframe: Timeframe;
  overlays: {
    fastMa?: MaybeNumber[];
    slowMa?: MaybeNumber[];
    bbUpper?: MaybeNumber[];
    bbLower?: MaybeNumber[];
    bbMiddle?: MaybeNumber[];
    levels?: Level[];
  };
  panes: {
    volume: boolean;
    rsi: MaybeNumber[] | null;
    macd: { macd: MaybeNumber[]; signal: MaybeNumber[]; histogram: MaybeNumber[] } | null;
  };
  markers?: TradeMarker[];
  rsiLevels: { oversold: number; overbought: number };
  style: "candles" | "line";
  height?: number;
  /** Label under the chart naming where the bars came from. */
  source: string;
}

/**
 * The chart surface.
 *
 * Wheel zooms around the cursor, drag pans, and the crosshair follows the
 * pointer with the bar's own numbers printed above it — no tooltip that
 * covers the candle you are trying to read.
 */
export function PriceChart({
  candles,
  instrument,
  timeframe,
  overlays,
  panes,
  markers,
  rsiLevels,
  style,
  height = 460,
  source,
}: PriceChartProps) {
  const { resolvedTheme } = useTheme();
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = React.useState(900);
  const [view, setView] = React.useState<ChartView>({ offset: 0, barsVisible: 160 });
  const [hover, setHover] = React.useState<number | null>(null);
  const drag = React.useRef<{ x: number; offset: number } | null>(null);
  const pinch = React.useRef<{ distance: number; bars: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const theme = resolvedTheme === "dark" ? DARK_CHART : LIGHT_CHART;

  /* ------------------------------- sizing -------------------------------- */

  React.useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A newly loaded series starts at its right-hand edge, showing the most
  // recent bars, which is what anyone opening a chart wants to see first.
  // Adjusted during render rather than in an effect, so the first paint of a
  // new series is already in the right place instead of jumping after it.
  const total = candles.length;
  const seriesKey = `${total}:${candles.at(-1)?.time ?? 0}`;
  const [lastSeriesKey, setLastSeriesKey] = React.useState(seriesKey);
  if (seriesKey !== lastSeriesKey) {
    setLastSeriesKey(seriesKey);
    const bars = Math.min(total, Math.max(60, view.barsVisible));
    setView(clampView({ barsVisible: bars, offset: total - bars }, total));
  }

  /* ------------------------------- drawing -------------------------------- */

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || total === 0) return;
    drawChart(canvas, {
      candles,
      instrument,
      view: clampView(view, total),
      theme,
      width,
      height,
      ratio: typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1),
      overlays,
      panes,
      markers,
      hover,
      rsiLevels,
      style,
    });
  }, [candles, instrument, view, theme, width, height, overlays, panes, markers, hover, rsiLevels, style, total]);

  /* ------------------------------ interaction ----------------------------- */

  const layout = React.useMemo(() => layoutFor({ width, height, panes }), [width, height, panes]);

  const indexFromEvent = React.useCallback(
    (clientX: number): number | null => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const index = indexAtX(clientX - rect.left, clampView(view, total), layout);
      return index >= 0 && index < total ? index : null;
    },
    [layout, view, total],
  );

  const zoom = React.useCallback(
    (factor: number, anchorX: number) => {
      setView((current) => {
        const clamped = clampView(current, total);
        const anchorIndex = indexAtX(anchorX, clamped, layout);
        const bars = Math.round(clamped.barsVisible * factor);
        const next = clampView({ ...clamped, barsVisible: bars }, total);
        // Keep the bar under the cursor under the cursor.
        const share = (anchorIndex - clamped.offset) / clamped.barsVisible;
        return clampView({ barsVisible: next.barsVisible, offset: Math.round(anchorIndex - share * next.barsVisible) }, total);
      });
    },
    [layout, total],
  );

  // Registered natively rather than through React's onWheel, which is passive
  // and so cannot stop the page scrolling underneath a zoom.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (event: WheelEvent) => {
      if (total === 0) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoom(event.deltaY > 0 ? 1.15 : 0.87, event.clientX - rect.left);
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, [zoom, total]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, offset: clampView(view, total).offset };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const index = indexFromEvent(event.clientX);
    setHover(index);
    if (!drag.current) return;
    const clamped = clampView(view, total);
    const perPixel = clamped.barsVisible / Math.max(1, layout.plotRight - layout.plotLeft);
    const moved = (drag.current.x - event.clientX) * perPixel;
    setView(clampView({ ...clamped, offset: Math.round(drag.current.offset + moved) }, total));
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
    setDragging(false);
  };

  const onTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length !== 2) return;
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const clamped = clampView(view, total);
    if (!pinch.current) {
      pinch.current = { distance, bars: clamped.barsVisible };
      return;
    }
    const scale = pinch.current.distance / Math.max(1, distance);
    setView(clampView({ ...clamped, barsVisible: Math.round(pinch.current.bars * scale) }, total));
  };

  const clamped = clampView(view, total);
  const readoutIndex = hover ?? total - 1;
  const readout = candles[readoutIndex] ?? null;
  const previous = candles[readoutIndex - 1] ?? null;
  const change = readout && previous ? readout.close - previous.close : null;

  return (
    <div ref={wrapRef} className="w-full">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs font-extrabold tabular-nums">
        {readout ? (
          <>
            <span className="text-[var(--muted)]">{formatBarTime(readout.time, timeframe)} UTC</span>
            <span>
              <span className="text-[var(--muted)]">O</span> {readout.open.toFixed(instrument.digits)}
            </span>
            <span>
              <span className="text-[var(--muted)]">H</span> {readout.high.toFixed(instrument.digits)}
            </span>
            <span>
              <span className="text-[var(--muted)]">L</span> {readout.low.toFixed(instrument.digits)}
            </span>
            <span>
              <span className="text-[var(--muted)]">C</span> {readout.close.toFixed(instrument.digits)}
            </span>
            {change !== null ? (
              <span className={change >= 0 ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"}>
                {change >= 0 ? "+" : "−"}
                {Math.abs(change).toFixed(instrument.digits)}
              </span>
            ) : null}
            {readout.volume !== null ? (
              <span className="text-[var(--muted)]">Vol {Math.round(readout.volume).toLocaleString()}</span>
            ) : null}
          </>
        ) : (
          <span className="text-[var(--muted)]">No data loaded.</span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Price chart, ${total} bars, showing bars ${clamped.offset + 1} to ${clamped.offset + clamped.barsVisible}.`}
        className={cn(
          "w-full touch-pan-y rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)]",
          dragging ? "cursor-grabbing" : "cursor-crosshair",
        )}
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
        onTouchMove={onTouchMove}
        onTouchEnd={() => {
          pinch.current = null;
        }}
      />

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[var(--muted)]">
        <span>{source}</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView(clampView({ offset: 0, barsVisible: total }, total))}
            className="rounded-lg px-2 py-1 font-extrabold hover:bg-[var(--panel)]"
          >
            Fit all
          </button>
          <button
            type="button"
            onClick={() => setView(clampView({ barsVisible: 120, offset: total - 120 }, total))}
            className="rounded-lg px-2 py-1 font-extrabold hover:bg-[var(--panel)]"
          >
            Latest
          </button>
          <span className="hidden sm:inline">Scroll to zoom, drag to pan</span>
        </span>
      </div>
    </div>
  );
}
