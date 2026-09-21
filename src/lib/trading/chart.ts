/**
 * The chart renderer.
 *
 * Canvas rather than SVG: a gold chart is routinely a few thousand candles,
 * and a few thousand DOM nodes that re-layout on every pan is the difference
 * between a chart you can throw around and one that stutters.
 *
 * The drawing code lives here rather than in the component so the scale
 * arithmetic — which index is under the cursor, which price is at this pixel —
 * can be reasoned about on its own. Everything drawn comes from the loaded
 * series; nothing is smoothed, extended or filled in.
 */

import type { MaybeNumber } from "./indicators";
import type { Level } from "./levels";
import type { Candle, Instrument } from "./types";

export interface ChartTheme {
  bg: string;
  panel: string;
  grid: string;
  axis: string;
  text: string;
  muted: string;
  up: string;
  down: string;
  ma1: string;
  ma2: string;
  band: string;
  bandLine: string;
  level: string;
  levelStrong: string;
  crosshair: string;
  volume: string;
  line: string;
  signalBuy: string;
  signalSell: string;
  zero: string;
}

export const LIGHT_CHART: ChartTheme = {
  bg: "#ffffff",
  panel: "#f7f9fa",
  grid: "#eef2f4",
  axis: "#cfd8dd",
  text: "#22303c",
  muted: "#64757f",
  up: "#3aa22e",
  down: "#db3b3b",
  ma1: "#22b8f0",
  ma2: "#b45cff",
  band: "rgba(34,184,240,0.08)",
  bandLine: "rgba(34,184,240,0.45)",
  level: "rgba(100,117,127,0.45)",
  levelStrong: "rgba(255,138,0,0.8)",
  crosshair: "#64757f",
  volume: "rgba(100,117,127,0.35)",
  line: "#22303c",
  signalBuy: "#3aa22e",
  signalSell: "#db3b3b",
  zero: "#cfd8dd",
};

export const DARK_CHART: ChartTheme = {
  bg: "#111b21",
  panel: "#1b2830",
  grid: "#1b2830",
  axis: "#2e4049",
  text: "#edf4f7",
  muted: "#93a7b1",
  up: "#4cc93f",
  down: "#ff4b4b",
  ma1: "#22b8f0",
  ma2: "#b45cff",
  band: "rgba(34,184,240,0.10)",
  bandLine: "rgba(34,184,240,0.5)",
  level: "rgba(147,167,177,0.45)",
  levelStrong: "rgba(255,138,0,0.85)",
  crosshair: "#93a7b1",
  volume: "rgba(147,167,177,0.35)",
  line: "#edf4f7",
  signalBuy: "#4cc93f",
  signalSell: "#ff4b4b",
  zero: "#2e4049",
};

/** Which bars are on screen. `offset` is the index of the leftmost one. */
export interface ChartView {
  offset: number;
  barsVisible: number;
}

export interface TradeMarker {
  index: number;
  price: number;
  kind: "entry-long" | "entry-short" | "exit-win" | "exit-loss";
}

export interface ChartInput {
  candles: Candle[];
  instrument: Instrument;
  view: ChartView;
  theme: ChartTheme;
  width: number;
  height: number;
  /** CSS pixels → device pixels. */
  ratio: number;
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
  /** Index the cursor is over, for the crosshair. */
  hover: number | null;
  rsiLevels: { oversold: number; overbought: number };
  /** Draw markers as candles or as a single line. */
  style: "candles" | "line";
}

export const AXIS_WIDTH = 62;
export const TIME_HEIGHT = 20;
const PANE_GAP = 6;
const VOLUME_HEIGHT = 46;
const STUDY_HEIGHT = 62;

export interface Layout {
  plotLeft: number;
  plotRight: number;
  price: { top: number; bottom: number };
  volume: { top: number; bottom: number } | null;
  rsi: { top: number; bottom: number } | null;
  macd: { top: number; bottom: number } | null;
  timeTop: number;
}

export function layoutFor(input: Pick<ChartInput, "width" | "height" | "panes">): Layout {
  const plotLeft = 4;
  const plotRight = input.width - AXIS_WIDTH;
  const timeTop = input.height - TIME_HEIGHT;

  let bottom = timeTop;
  let macd: Layout["macd"] = null;
  let rsi: Layout["rsi"] = null;
  let volume: Layout["volume"] = null;

  if (input.panes.macd) {
    macd = { top: bottom - STUDY_HEIGHT, bottom };
    bottom = macd.top - PANE_GAP;
  }
  if (input.panes.rsi) {
    rsi = { top: bottom - STUDY_HEIGHT, bottom };
    bottom = rsi.top - PANE_GAP;
  }
  if (input.panes.volume) {
    volume = { top: bottom - VOLUME_HEIGHT, bottom };
    bottom = volume.top - PANE_GAP;
  }

  return { plotLeft, plotRight, price: { top: 6, bottom }, volume, rsi, macd, timeTop };
}

/** Clamps a view to the data, keeping at least 20 bars on screen. */
export function clampView(view: ChartView, total: number): ChartView {
  const barsVisible = Math.max(20, Math.min(total, Math.round(view.barsVisible)));
  const maxOffset = Math.max(0, total - barsVisible);
  return { barsVisible, offset: Math.max(0, Math.min(maxOffset, Math.round(view.offset))) };
}

export function xForIndex(index: number, view: ChartView, layout: Layout): number {
  const width = layout.plotRight - layout.plotLeft;
  const step = width / view.barsVisible;
  return layout.plotLeft + (index - view.offset + 0.5) * step;
}

export function indexAtX(x: number, view: ChartView, layout: Layout): number {
  const width = layout.plotRight - layout.plotLeft;
  const step = width / view.barsVisible;
  return Math.round((x - layout.plotLeft) / step - 0.5) + view.offset;
}

/** The price range on screen, including whatever overlays are drawn. */
export function priceRange(input: ChartInput): { min: number; max: number } {
  const { candles, view, overlays } = input;
  const from = Math.max(0, view.offset);
  const to = Math.min(candles.length - 1, view.offset + view.barsVisible - 1);

  let min = Infinity;
  let max = -Infinity;
  for (let i = from; i <= to; i++) {
    min = Math.min(min, candles[i].low);
    max = Math.max(max, candles[i].high);
    for (const line of [overlays.bbUpper, overlays.bbLower]) {
      const value = line?.[i];
      if (value !== null && value !== undefined) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  }
  // Levels deliberately do not widen the range: one far-off level would
  // otherwise squash every candle on screen into a flat line.
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  const pad = (max - min) * 0.08 || Math.max(1e-6, max * 0.001);
  return { min: min - pad, max: max + pad };
}

export function drawChart(canvas: HTMLCanvasElement, input: ChartInput): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height, ratio, theme, candles, view } = input;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);
  if (candles.length === 0) return;

  const layout = layoutFor(input);
  const { min, max } = priceRange(input);
  const priceHeight = layout.price.bottom - layout.price.top;
  const yFor = (price: number) => layout.price.bottom - ((price - min) / (max - min)) * priceHeight;

  const from = Math.max(0, view.offset);
  const to = Math.min(candles.length - 1, view.offset + view.barsVisible - 1);
  const step = (layout.plotRight - layout.plotLeft) / view.barsVisible;
  const bodyWidth = Math.max(1, Math.min(18, step * 0.68));

  ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";

  drawPriceGrid(ctx, input, layout, min, max, yFor);
  drawBands(ctx, input, layout, from, to, yFor);
  drawLevels(ctx, input, layout, yFor, min, max);

  if (input.style === "line") drawLine(ctx, input, layout, from, to, yFor);
  else drawCandles(ctx, input, layout, from, to, yFor, bodyWidth);

  drawOverlayLine(ctx, input.overlays.fastMa, theme.ma1, input, layout, from, to, yFor);
  drawOverlayLine(ctx, input.overlays.slowMa, theme.ma2, input, layout, from, to, yFor);
  drawMarkers(ctx, input, layout, yFor, from, to);
  drawLastPrice(ctx, input, layout, yFor);

  if (layout.volume) drawVolume(ctx, input, layout, from, to, bodyWidth);
  if (layout.rsi && input.panes.rsi) drawRsi(ctx, input, layout, from, to);
  if (layout.macd && input.panes.macd) drawMacd(ctx, input, layout, from, to, bodyWidth);

  drawTimeAxis(ctx, input, layout, from, to);
  drawCrosshair(ctx, input, layout, yFor);
}

/* ------------------------------- components ------------------------------- */

function drawPriceGrid(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  min: number,
  max: number,
  yFor: (p: number) => number,
): void {
  const { theme, instrument } = input;
  const steps = 5;
  ctx.strokeStyle = theme.grid;
  ctx.fillStyle = theme.muted;
  ctx.lineWidth = 1;
  ctx.textAlign = "left";

  for (let i = 0; i <= steps; i++) {
    const price = min + ((max - min) * i) / steps;
    const y = Math.round(yFor(price)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, y);
    ctx.lineTo(layout.plotRight, y);
    ctx.stroke();
    ctx.fillText(price.toFixed(instrument.digits), layout.plotRight + 6, y);
  }

  ctx.strokeStyle = theme.axis;
  ctx.beginPath();
  ctx.moveTo(layout.plotRight + 0.5, layout.price.top);
  ctx.lineTo(layout.plotRight + 0.5, layout.timeTop);
  ctx.stroke();
}

function drawCandles(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
  yFor: (p: number) => number,
  bodyWidth: number,
): void {
  const { candles, theme, view } = input;
  const thin = bodyWidth <= 1.5;

  for (let i = from; i <= to; i++) {
    const candle = candles[i];
    const x = xForIndex(i, view, layout);
    const rising = candle.close >= candle.open;
    const colour = rising ? theme.up : theme.down;

    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1;

    // The wick, drawn on a half pixel so it stays crisp at any width.
    const wickX = Math.round(x) + 0.5;
    ctx.beginPath();
    ctx.moveTo(wickX, yFor(candle.high));
    ctx.lineTo(wickX, yFor(candle.low));
    ctx.stroke();

    if (thin) continue;
    const top = yFor(Math.max(candle.open, candle.close));
    const bottom = yFor(Math.min(candle.open, candle.close));
    // A doji would otherwise vanish, so every body is at least a line.
    ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, Math.max(1, bottom - top));
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
  yFor: (p: number) => number,
): void {
  const { candles, theme, view } = input;
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = from; i <= to; i++) {
    const x = xForIndex(i, view, layout);
    const y = yFor(candles[i].close);
    if (i === from) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawOverlayLine(
  ctx: CanvasRenderingContext2D,
  values: MaybeNumber[] | undefined,
  colour: string,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
  yFor: (p: number) => number,
): void {
  if (!values) return;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;
  for (let i = from; i <= to; i++) {
    const value = values[i];
    if (value === null || value === undefined) {
      started = false;
      continue;
    }
    const x = xForIndex(i, input.view, layout);
    const y = yFor(value);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawBands(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
  yFor: (p: number) => number,
): void {
  const { bbUpper, bbLower, bbMiddle } = input.overlays;
  if (!bbUpper || !bbLower) return;

  ctx.fillStyle = input.theme.band;
  ctx.beginPath();
  let started = false;
  for (let i = from; i <= to; i++) {
    const value = bbUpper[i];
    if (value === null || value === undefined) continue;
    const x = xForIndex(i, input.view, layout);
    if (!started) {
      ctx.moveTo(x, yFor(value));
      started = true;
    } else ctx.lineTo(x, yFor(value));
  }
  for (let i = to; i >= from; i--) {
    const value = bbLower[i];
    if (value === null || value === undefined) continue;
    ctx.lineTo(xForIndex(i, input.view, layout), yFor(value));
  }
  if (started) {
    ctx.closePath();
    ctx.fill();
  }

  for (const line of [bbUpper, bbLower]) {
    drawOverlayLine(ctx, line, input.theme.bandLine, input, layout, from, to, yFor);
  }
  if (bbMiddle) {
    ctx.setLineDash([3, 3]);
    drawOverlayLine(ctx, bbMiddle, input.theme.bandLine, input, layout, from, to, yFor);
    ctx.setLineDash([]);
  }
}

function drawLevels(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  yFor: (p: number) => number,
  min: number,
  max: number,
): void {
  const levels = input.overlays.levels ?? [];
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.textAlign = "left";

  // Labels are placed top-down with a minimum gap, and only where the count is
  // worth reading. Two levels a few pixels apart would otherwise print their
  // counts on top of each other, which is how a chart ends up less legible for
  // having more information on it.
  const labelled: number[] = [];
  const visible = levels
    .filter((level) => level.price >= min && level.price <= max)
    .sort((a, b) => b.price - a.price);

  for (const level of visible) {
    const y = Math.round(yFor(level.price)) + 0.5;
    ctx.strokeStyle = level.strength > 0.75 ? input.theme.levelStrong : input.theme.level;
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, y);
    ctx.lineTo(layout.plotRight, y);
    ctx.stroke();

    if (level.touches < 2) continue;
    if (labelled.some((other) => Math.abs(other - y) < 14)) continue;
    labelled.push(y);
    ctx.fillStyle = input.theme.muted;
    ctx.fillText(`${level.touches} touches`, layout.plotLeft + 4, y - 7);
  }
  ctx.setLineDash([]);
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  yFor: (p: number) => number,
  from: number,
  to: number,
): void {
  for (const marker of input.markers ?? []) {
    if (marker.index < from || marker.index > to) continue;
    const x = xForIndex(marker.index, input.view, layout);
    const y = yFor(marker.price);
    const up = marker.kind === "entry-long";
    const down = marker.kind === "entry-short";

    if (up || down) {
      ctx.fillStyle = up ? input.theme.signalBuy : input.theme.signalSell;
      const tip = up ? y + 8 : y - 8;
      const base = up ? y + 18 : y - 18;
      ctx.beginPath();
      ctx.moveTo(x, tip);
      ctx.lineTo(x - 5, base);
      ctx.lineTo(x + 5, base);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = marker.kind === "exit-win" ? input.theme.signalBuy : input.theme.signalSell;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawLastPrice(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  yFor: (p: number) => number,
): void {
  const last = input.candles.at(-1);
  if (!last) return;
  const y = Math.round(yFor(last.close)) + 0.5;
  if (y < layout.price.top || y > layout.price.bottom) return;

  const rising = last.close >= last.open;
  ctx.strokeStyle = rising ? input.theme.up : input.theme.down;
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.plotLeft, y);
  ctx.lineTo(layout.plotRight, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = rising ? input.theme.up : input.theme.down;
  ctx.fillRect(layout.plotRight + 1, y - 8, AXIS_WIDTH - 2, 16);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(last.close.toFixed(input.instrument.digits), layout.plotRight + 5, y);
}

function drawVolume(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
  bodyWidth: number,
): void {
  const pane = layout.volume;
  if (!pane) return;
  const { candles, theme, view } = input;

  let peak = 0;
  for (let i = from; i <= to; i++) peak = Math.max(peak, candles[i].volume ?? 0);

  ctx.fillStyle = theme.muted;
  ctx.textAlign = "left";
  ctx.fillText("Volume", layout.plotLeft + 4, pane.top + 7);
  if (peak <= 0) {
    ctx.fillText("not published for this source", layout.plotLeft + 50, pane.top + 7);
    return;
  }

  const height = pane.bottom - pane.top - 10;
  for (let i = from; i <= to; i++) {
    const volume = candles[i].volume;
    if (volume === null || volume <= 0) continue;
    const x = xForIndex(i, view, layout);
    const barHeight = (volume / peak) * height;
    ctx.fillStyle = candles[i].close >= candles[i].open ? theme.up : theme.down;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x - bodyWidth / 2, pane.bottom - barHeight, Math.max(1, bodyWidth), barHeight);
    ctx.globalAlpha = 1;
  }
}

function drawRsi(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
): void {
  const pane = layout.rsi;
  const values = input.panes.rsi;
  if (!pane || !values) return;
  const { theme, view, rsiLevels } = input;
  const height = pane.bottom - pane.top;
  const yFor = (value: number) => pane.bottom - (value / 100) * height;

  ctx.strokeStyle = theme.grid;
  ctx.setLineDash([3, 3]);
  for (const level of [rsiLevels.oversold, 50, rsiLevels.overbought]) {
    const y = Math.round(yFor(level)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, y);
    ctx.lineTo(layout.plotRight, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = theme.ma1;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  let started = false;
  for (let i = from; i <= to; i++) {
    const value = values[i];
    if (value === null || value === undefined) {
      started = false;
      continue;
    }
    const x = xForIndex(i, view, layout);
    const y = yFor(value);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const latest = values[Math.min(to, values.length - 1)];
  ctx.fillStyle = theme.muted;
  ctx.textAlign = "left";
  ctx.fillText(`RSI ${latest === null || latest === undefined ? "—" : latest.toFixed(1)}`, layout.plotLeft + 4, pane.top + 7);
}

function drawMacd(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
  bodyWidth: number,
): void {
  const pane = layout.macd;
  const macd = input.panes.macd;
  if (!pane || !macd) return;
  const { theme, view } = input;

  let peak = 0;
  for (let i = from; i <= to; i++) {
    for (const series of [macd.macd, macd.signal, macd.histogram]) {
      const value = series[i];
      if (value !== null && value !== undefined) peak = Math.max(peak, Math.abs(value));
    }
  }
  if (peak === 0) peak = 1;

  const mid = (pane.top + pane.bottom) / 2;
  const half = (pane.bottom - pane.top) / 2 - 4;
  const yFor = (value: number) => mid - (value / peak) * half;

  ctx.strokeStyle = theme.zero;
  ctx.beginPath();
  ctx.moveTo(layout.plotLeft, Math.round(mid) + 0.5);
  ctx.lineTo(layout.plotRight, Math.round(mid) + 0.5);
  ctx.stroke();

  for (let i = from; i <= to; i++) {
    const value = macd.histogram[i];
    if (value === null || value === undefined) continue;
    const x = xForIndex(i, view, layout);
    const y = yFor(value);
    ctx.fillStyle = value >= 0 ? theme.up : theme.down;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - bodyWidth / 2, Math.min(y, mid), Math.max(1, bodyWidth), Math.abs(y - mid));
    ctx.globalAlpha = 1;
  }

  for (const [series, colour] of [
    [macd.macd, theme.ma1],
    [macd.signal, theme.ma2],
  ] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    let started = false;
    for (let i = from; i <= to; i++) {
      const value = series[i];
      if (value === null || value === undefined) {
        started = false;
        continue;
      }
      const x = xForIndex(i, view, layout);
      const y = yFor(value);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = theme.muted;
  ctx.textAlign = "left";
  ctx.fillText("MACD", layout.plotLeft + 4, pane.top + 7);
}

function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  from: number,
  to: number,
): void {
  const { candles, theme, view } = input;
  ctx.fillStyle = theme.muted;
  ctx.textAlign = "center";

  const visible = to - from + 1;
  const every = Math.max(1, Math.ceil(visible / 7));
  for (let i = from; i <= to; i += every) {
    const x = xForIndex(i, view, layout);
    if (x < layout.plotLeft + 20 || x > layout.plotRight - 20) continue;
    ctx.fillText(axisLabel(candles[i].time, visible), x, layout.timeTop + TIME_HEIGHT / 2);
  }
}

function axisLabel(time: number, visibleBars: number): string {
  const date = new Date(time);
  const day = `${String(date.getUTCDate()).padStart(2, "0")} ${date.toLocaleDateString("en", { month: "short", timeZone: "UTC" })}`;
  // Dense views want the clock; wide ones want the date.
  if (visibleBars <= 120) {
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  }
  return day;
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  input: ChartInput,
  layout: Layout,
  yFor: (p: number) => number,
): void {
  const index = input.hover;
  if (index === null || index < 0 || index >= input.candles.length) return;
  const x = Math.round(xForIndex(index, input.view, layout)) + 0.5;
  if (x < layout.plotLeft || x > layout.plotRight) return;

  ctx.strokeStyle = input.theme.crosshair;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, layout.price.top);
  ctx.lineTo(x, layout.timeTop);
  ctx.stroke();

  const y = Math.round(yFor(input.candles[index].close)) + 0.5;
  ctx.beginPath();
  ctx.moveTo(layout.plotLeft, y);
  ctx.lineTo(layout.plotRight, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
