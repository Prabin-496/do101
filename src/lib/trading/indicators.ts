/**
 * Indicators.
 *
 * Every function here returns an array the same length as its input, with
 * `null` for the bars where the indicator is not defined yet. That shape is
 * deliberate: it means index `i` of a result always lines up with bar `i`, and
 * it makes look-ahead bias structurally impossible, because nothing in this
 * file ever reads an index greater than the one it is writing.
 *
 * The warm-up nulls matter. An EMA seeded from bar zero is a different series
 * from one seeded from a settled average, and a backtest that starts trading
 * during the warm-up is really testing the seeding, not the strategy.
 */

import type { Candle } from "./types";

export type MaybeNumber = number | null;

/* --------------------------------- helpers -------------------------------- */

export const closes = (candles: Candle[]): number[] => candles.map((c) => c.close);
export const highs = (candles: Candle[]): number[] => candles.map((c) => c.high);
export const lows = (candles: Candle[]): number[] => candles.map((c) => c.low);

function filled(length: number): MaybeNumber[] {
  return new Array<MaybeNumber>(length).fill(null);
}

/* ------------------------------ moving averages ---------------------------- */

export function sma(values: number[], period: number): MaybeNumber[] {
  const out = filled(values.length);
  if (period < 1) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential moving average, seeded with the simple average of the first
 * `period` values — the convention every charting platform uses, and the
 * reason an EMA on a long history matches one on a short history to within
 * rounding after a few hundred bars.
 */
export function ema(values: number[], period: number): MaybeNumber[] {
  const out = filled(values.length);
  if (period < 1 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function movingAverage(values: number[], period: number, type: "ema" | "sma"): MaybeNumber[] {
  return type === "sma" ? sma(values, period) : ema(values, period);
}

/** Wilder's smoothing — the running average behind RSI, ATR and ADX. */
function wilder(values: number[], period: number): MaybeNumber[] {
  const out = filled(values.length);
  if (period < 1 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (prev * (period - 1) + values[i]) / period;
    out[i] = prev;
  }
  return out;
}

/* ----------------------------------- RSI ----------------------------------- */

export function rsi(values: number[], period = 14): MaybeNumber[] {
  const out = filled(values.length);
  if (values.length <= period) return out;

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  }

  // The first `period` changes seed the averages, so the first defined RSI
  // sits at index `period`, not at index 0.
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = rsiFrom(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    out[i] = rsiFrom(avgGain, avgLoss);
  }
  return out;
}

function rsiFrom(avgGain: number, avgLoss: number): number {
  // A run with no down-closes has no defined RS; by convention that is 100.
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/* ----------------------------------- MACD ---------------------------------- */

export interface MacdResult {
  macd: MaybeNumber[];
  signal: MaybeNumber[];
  histogram: MaybeNumber[];
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const line = filled(values.length);
  for (let i = 0; i < values.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== null && s !== null) line[i] = f - s;
  }

  // The signal line is an EMA of the MACD line, which only exists from the
  // slow EMA onwards — so it is computed on the defined slice and mapped back.
  const firstDefined = line.findIndex((v) => v !== null);
  const signal = filled(values.length);
  const histogram = filled(values.length);
  if (firstDefined >= 0) {
    const slice = line.slice(firstDefined) as number[];
    const sig = ema(slice, signalPeriod);
    for (let i = 0; i < sig.length; i++) {
      const v = sig[i];
      if (v === null) continue;
      signal[firstDefined + i] = v;
      histogram[firstDefined + i] = (line[firstDefined + i] as number) - v;
    }
  }
  return { macd: line, signal, histogram };
}

/* ------------------------------ Bollinger Bands ---------------------------- */

export interface BollingerResult {
  middle: MaybeNumber[];
  upper: MaybeNumber[];
  lower: MaybeNumber[];
  /** (upper − lower) / middle. The squeeze/expansion measure. */
  bandwidth: MaybeNumber[];
  /** Where price sits in the band: 0 at the lower band, 1 at the upper. */
  percentB: MaybeNumber[];
}

export function bollinger(values: number[], period = 20, multiplier = 2): BollingerResult {
  const middle = sma(values, period);
  const upper = filled(values.length);
  const lower = filled(values.length);
  const bandwidth = filled(values.length);
  const percentB = filled(values.length);

  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i];
    if (mean === null) continue;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - mean) ** 2;
    // Population standard deviation, which is what Bollinger specified.
    const sd = Math.sqrt(variance / period);
    const up = mean + multiplier * sd;
    const low = mean - multiplier * sd;
    upper[i] = up;
    lower[i] = low;
    bandwidth[i] = mean === 0 ? null : (up - low) / mean;
    percentB[i] = up === low ? 0.5 : (values[i] - low) / (up - low);
  }
  return { middle, upper, lower, bandwidth, percentB };
}

/* ----------------------------------- ATR ----------------------------------- */

export function trueRange(candles: Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
}

export function atr(candles: Candle[], period = 14): MaybeNumber[] {
  return wilder(trueRange(candles), period);
}

/* ----------------------------------- ADX ----------------------------------- */

export interface AdxResult {
  adx: MaybeNumber[];
  plusDi: MaybeNumber[];
  minusDi: MaybeNumber[];
}

/**
 * Average Directional Index — how *strongly* a market is trending, regardless
 * of direction. Used here only as a filter: a moving-average crossover in a
 * flat market is the single most reliable way to lose money slowly.
 */
export function adx(candles: Candle[], period = 14): AdxResult {
  const n = candles.length;
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }

  const tr = trueRange(candles);
  const smoothTr = wilder(tr.slice(1), period);
  const smoothPlus = wilder(plusDm.slice(1), period);
  const smoothMinus = wilder(minusDm.slice(1), period);

  const plusDi = filled(n);
  const minusDi = filled(n);
  const dx: number[] = [];
  const dxIndex: number[] = [];

  for (let i = 0; i < smoothTr.length; i++) {
    const t = smoothTr[i];
    const p = smoothPlus[i];
    const m = smoothMinus[i];
    if (t === null || p === null || m === null || t === 0) continue;
    const pd = (p / t) * 100;
    const md = (m / t) * 100;
    plusDi[i + 1] = pd;
    minusDi[i + 1] = md;
    const sum = pd + md;
    dx.push(sum === 0 ? 0 : (Math.abs(pd - md) / sum) * 100);
    dxIndex.push(i + 1);
  }

  const smoothedDx = wilder(dx, period);
  const adxOut = filled(n);
  for (let i = 0; i < smoothedDx.length; i++) {
    const v = smoothedDx[i];
    if (v !== null) adxOut[dxIndex[i]] = v;
  }
  return { adx: adxOut, plusDi, minusDi };
}

/* -------------------------------- Donchian --------------------------------- */

export interface DonchianResult {
  upper: MaybeNumber[];
  lower: MaybeNumber[];
}

/**
 * Highest high and lowest low of the `period` bars *before* the current one.
 *
 * Excluding the current bar is what makes "price broke the range" a question
 * with an answer. Include it and every new high is trivially a breakout.
 */
export function donchian(candles: Candle[], period = 20): DonchianResult {
  const upper = filled(candles.length);
  const lower = filled(candles.length);
  for (let i = period; i < candles.length; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period; j < i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    upper[i] = hi;
    lower[i] = lo;
  }
  return { upper, lower };
}

/* --------------------------------- momentum -------------------------------- */

/** Rate of change over `period` bars, as a percentage. */
export function roc(values: number[], period = 10): MaybeNumber[] {
  const out = filled(values.length);
  for (let i = period; i < values.length; i++) {
    const past = values[i - period];
    if (past === 0) continue;
    out[i] = ((values[i] - past) / past) * 100;
  }
  return out;
}

/* ------------------------------ swing structure ---------------------------- */

export interface Pivot {
  index: number;
  price: number;
  kind: "high" | "low";
  /**
   * The bar at which this pivot could first be known — `index + right`.
   *
   * A swing high is only a swing high once enough bars to its right have
   * failed to exceed it, so anything reading pivots for a decision at bar `i`
   * must ignore pivots whose `confirmedAt` is greater than `i`.
   */
  confirmedAt: number;
}

export function pivots(candles: Candle[], left = 3, right = 3): Pivot[] {
  const out: Pivot[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const { high, low } = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= high) isHigh = false;
      if (candles[j].low <= low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ index: i, price: high, kind: "high", confirmedAt: i + right });
    if (isLow) out.push({ index: i, price: low, kind: "low", confirmedAt: i + right });
  }
  return out;
}

/**
 * Pivots that were already confirmed as of bar `at`, newest last.
 *
 * `pivots` emits in index order and `confirmedAt` is `index + right`, so the
 * list is already sorted by confirmation — which means the cut-off can be
 * found by bisection instead of filtering the whole history on every bar. That
 * matters: a backtest calls this once per bar, and the naive version turns a
 * 5,000-bar run into a quadratic one.
 *
 * `limit` keeps only the most recent few, which is both faster and a better
 * reading of a market: a level last touched two thousand bars ago is history,
 * not support.
 */
export function pivotsKnownAt(all: Pivot[], at: number, limit?: number): Pivot[] {
  let low = 0;
  let high = all.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (all[mid].confirmedAt <= at) low = mid + 1;
    else high = mid;
  }
  if (limit === undefined || low <= limit) return all.slice(0, low);
  return all.slice(low - limit, low);
}
