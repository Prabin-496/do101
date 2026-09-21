/**
 * Building a higher timeframe out of the loaded one.
 *
 * Multi-timeframe confirmation is only honest if the higher-timeframe bar you
 * consult has actually *closed*. The 4-hour candle forming around the current
 * 1-hour bar contains that bar, so asking it whether the trend is up is asking
 * a question whose answer you already have — and in a backtest it is worse
 * than useless, because the finished 4-hour candle contains the next three
 * hours too.
 *
 * `htfIndexAt` therefore points at the last *completed* higher-timeframe bar,
 * never the one in progress.
 */

import type { Candle, Timeframe } from "./types";
import { TIMEFRAME_MS, TIMEFRAMES } from "./types";

export interface Aggregated {
  candles: Candle[];
  /**
   * For each base bar, the index into `candles` of the newest higher-timeframe
   * bar that had already closed, or −1 when none had.
   */
  htfIndexAt: number[];
}

/** Bucket bars into `targetMs` blocks anchored to the epoch. */
export function aggregate(candles: Candle[], targetMs: number): Aggregated {
  const out: Candle[] = [];
  const htfIndexAt: number[] = new Array(candles.length).fill(-1);
  if (targetMs <= 0 || candles.length === 0) return { candles: out, htfIndexAt };

  let bucketStart = -1;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const bucket = Math.floor(c.time / targetMs) * targetMs;
    if (bucket !== bucketStart) {
      bucketStart = bucket;
      out.push({ time: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      const current = out[out.length - 1];
      current.high = Math.max(current.high, c.high);
      current.low = Math.min(current.low, c.low);
      current.close = c.close;
      if (current.volume !== null && c.volume !== null) current.volume += c.volume;
      else current.volume = current.volume ?? c.volume;
    }
    // The bar being built is out.length − 1, so the last closed one is before it.
    htfIndexAt[i] = out.length - 2;
  }
  return { candles: out, htfIndexAt };
}

/**
 * The timeframe a multiple of the base one, clamped to the list we offer.
 * Returns null when the base timeframe is already the highest we support.
 */
export function higherTimeframe(base: Timeframe, steps = 2): Timeframe | null {
  const index = TIMEFRAMES.findIndex((t) => t.id === base);
  if (index < 0) return null;
  const target = Math.min(TIMEFRAMES.length - 1, index + steps);
  return target === index ? null : TIMEFRAMES[target].id;
}

export function aggregateTo(candles: Candle[], target: Timeframe): Aggregated {
  return aggregate(candles, TIMEFRAME_MS[target]);
}
