/**
 * Market structure: where the floors and ceilings are, and which way the
 * market has been stepping.
 *
 * Both answers are built only from *confirmed* swing pivots. A swing high that
 * has not yet been confirmed is just a bar that happens to be the highest one
 * so far, and treating it as a level is how a backtest quietly starts reading
 * the future.
 */

import { pivots, pivotsKnownAt, type Pivot } from "./indicators";
import type { Candle } from "./types";

export type Trend = "up" | "down" | "range";

export interface StructureRead {
  trend: Trend;
  /** Plain-English description of the last four swings. */
  detail: string;
  lastHigh: Pivot | null;
  lastLow: Pivot | null;
  /** The swing low a long trade would be invalidated by, and vice versa. */
  invalidationLong: number | null;
  invalidationShort: number | null;
}

/**
 * Reads structure as of bar `at` — higher highs and higher lows, or lower
 * highs and lower lows, or neither.
 */
export function structureAt(all: Pivot[], at: number): StructureRead {
  // Four swings is all the structure read needs, but highs and lows alternate
  // irregularly, so a dozen covers it with room to spare.
  const known = pivotsKnownAt(all, at, 12);
  const swingHighs = known.filter((p) => p.kind === "high").slice(-2);
  const swingLows = known.filter((p) => p.kind === "low").slice(-2);

  const lastHigh = swingHighs.at(-1) ?? null;
  const lastLow = swingLows.at(-1) ?? null;

  if (swingHighs.length < 2 || swingLows.length < 2) {
    return {
      trend: "range",
      detail: "Not enough confirmed swings yet to call the structure.",
      lastHigh,
      lastLow,
      invalidationLong: lastLow?.price ?? null,
      invalidationShort: lastHigh?.price ?? null,
    };
  }

  const higherHigh = swingHighs[1].price > swingHighs[0].price;
  const higherLow = swingLows[1].price > swingLows[0].price;
  const lowerHigh = swingHighs[1].price < swingHighs[0].price;
  const lowerLow = swingLows[1].price < swingLows[0].price;

  let trend: Trend = "range";
  let detail = "Swings overlap — the market is ranging rather than trending.";
  if (higherHigh && higherLow) {
    trend = "up";
    detail = "Higher high and higher low — an uptrend by structure.";
  } else if (lowerHigh && lowerLow) {
    trend = "down";
    detail = "Lower high and lower low — a downtrend by structure.";
  } else if (higherHigh && lowerLow) {
    detail = "Higher high but lower low — an expanding range, not a trend.";
  } else if (lowerHigh && higherLow) {
    detail = "Lower high and higher low — a contracting range, often before a break.";
  }

  return {
    trend,
    detail,
    lastHigh,
    lastLow,
    invalidationLong: lastLow?.price ?? null,
    invalidationShort: lastHigh?.price ?? null,
  };
}

export interface Level {
  price: number;
  /** How many confirmed pivots sit inside the cluster. */
  touches: number;
  kind: "support" | "resistance";
  /** Index of the most recent touch, for recency weighting and drawing. */
  lastTouch: number;
  /** 0–1. Touches and recency, normalised across the levels found. */
  strength: number;
}

/**
 * Support and resistance as price clusters rather than single lines.
 *
 * Pivots within `tolerance` of each other are one level: markets turn at a
 * zone, and a line drawn to five decimal places is a false precision that
 * makes every level look untested.
 */
export function levelsAt(
  candles: Candle[],
  all: Pivot[],
  at: number,
  tolerance: number,
  limit = 6,
  /** How far back to look for levels, in confirmed pivots. */
  lookback = 40,
): Level[] {
  const known = pivotsKnownAt(all, at, lookback);
  if (known.length === 0 || tolerance <= 0) return [];

  const reference = candles[at]?.close ?? candles.at(-1)?.close ?? 0;
  const clusters: { prices: number[]; lastTouch: number }[] = [];

  // Clustered by price alone, not by which side made the pivot. A ceiling that
  // price broke through and later bounced off is one zone, and counting the
  // high and the low as two separate levels would hide exactly the levels that
  // have been tested most.
  for (const pivot of known) {
    const hit = clusters.find((c) => Math.abs(average(c.prices) - pivot.price) <= tolerance);
    if (hit) {
      hit.prices.push(pivot.price);
      hit.lastTouch = Math.max(hit.lastTouch, pivot.index);
    } else {
      clusters.push({ prices: [pivot.price], lastTouch: pivot.index });
    }
  }

  const scored = clusters.map((c) => {
    const price = average(c.prices);
    // Recency on a 0–1 scale across the window we can see.
    const recency = at <= 0 ? 0 : Math.max(0, Math.min(1, c.lastTouch / at));
    return {
      price,
      touches: c.prices.length,
      kind: (price < reference ? "support" : "resistance") as Level["kind"],
      lastTouch: c.lastTouch,
      raw: c.prices.length + recency * 2,
    };
  });

  const strongest = Math.max(...scored.map((s) => s.raw), 1);
  return scored
    .map((s) => ({
      price: s.price,
      touches: s.touches,
      kind: s.kind,
      lastTouch: s.lastTouch,
      strength: s.raw / strongest,
    }))
    .sort((a, b) => Math.abs(a.price - reference) - Math.abs(b.price - reference))
    .slice(0, limit);
}

/** The nearest level above and below a price. */
export function bracketing(levels: Level[], price: number): { above: Level | null; below: Level | null } {
  let above: Level | null = null;
  let below: Level | null = null;
  for (const level of levels) {
    if (level.price > price && (!above || level.price < above.price)) above = level;
    if (level.price < price && (!below || level.price > below.price)) below = level;
  }
  return { above, below };
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Convenience for the panels, which want pivots and structure in one call. */
export function readStructure(candles: Candle[], window: number, at?: number): {
  pivots: Pivot[];
  structure: StructureRead;
} {
  const all = pivots(candles, window, window);
  const index = at ?? candles.length - 1;
  return { pivots: all, structure: structureAt(all, index) };
}
