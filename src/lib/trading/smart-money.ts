/**
 * "Deep Smart Money" — a gate-and-trigger strategy.
 *
 * Structurally this is the opposite of the weighted engine next door. Nothing
 * votes and nothing is averaged: a stack of filters must *all* pass, and then
 * at least one of four entry triggers must fire. One failed filter is a veto,
 * however good everything else looks.
 *
 * It is a faithful implementation of a Pine Script that was handed over
 * bottom-half-first, so the conditions its top half defined — `above200`,
 * `highVol`, `boxH`, `prevLiqLow`, `smBuy` and the rest — are reconstructed
 * here from the conventional meanings, and every one of them is a named,
 * adjustable parameter rather than a number baked into the code. Where a
 * choice had to be made it is stated in the comment above it.
 *
 * Two things the original could not know about, handled explicitly:
 *
 *  - Spot forex and metals have no real volume. MetaTrader reports tick
 *    volume, some sources report none at all, and a `highVol` filter that
 *    silently passes on a series with no volume is a filter that is not
 *    running. So the engine says which of the three it is doing.
 *  - The stop sits at the signal bar's low. On a small candle that is a stop a
 *    few pips wide, which turns position sizing into a leverage cap rather
 *    than a risk decision. A floor of a fraction of ATR is applied by default
 *    and reported when it binds; set it to zero for exact parity.
 */

import {
  atr as atrOf,
  donchian,
  ema,
  movingAverage,
  pivots,
  pivotsKnownAt,
  rsi as rsiOf,
  sma,
  closes,
  type MaybeNumber,
  type Pivot,
} from "./indicators";
import { levelsAt, structureAt } from "./levels";
import type { Signal, SignalEngine } from "./strategy";
import { instrumentOf, type Candle, type Series, type SignalVerdict } from "./types";

export interface SmartMoneyParams {
  /** The "above/below 200" regime filter. */
  trendMa: number;
  trendMaType: "ema" | "sma";
  /** bullTrend / bearTrend, and the crossover the EMA trigger watches. */
  fastEma: number;
  slowEma: number;
  rsiPeriod: number;
  atrPeriod: number;
  /** highVol: this bar's volume against its own moving average. */
  volumeMa: number;
  volumeMultiple: number;
  requireHighVolume: boolean;
  /** strongBull / strongBear: body as a share of the whole candle range. */
  strongBodyShare: number;
  /** buyOk / sellOk: bars that must pass before the same side may fire again. */
  cooldownBars: number;
  /** The consolidation box the breakout trigger measures. */
  boxLookback: number;
  /** A box only counts as consolidation if it is no wider than this × ATR. */
  boxMaxRangeAtr: number;
  /** Swing window for the liquidity highs and lows the hunt trigger sweeps. */
  liquidityPivot: number;
  /** How recently structure must have broken for an order block to be live. */
  bosLookback: number;
  orderBlockValidBars: number;
  /** Reward-to-risk multiple used for the take-profit. */
  rr: number;
  /** ATR padding below the sweep low on a stop-hunt entry. */
  huntStopAtrPad: number;
  /** Minimum stop distance in ATR. Zero means exactly what the script says. */
  minStopAtr: number;
  triggers: {
    smartMoney: boolean;
    emaCross: boolean;
    boxBreakout: boolean;
    stopHunt: boolean;
  };
}

export const DEFAULT_SMART_MONEY: SmartMoneyParams = {
  trendMa: 200,
  trendMaType: "ema",
  fastEma: 9,
  slowEma: 21,
  rsiPeriod: 14,
  atrPeriod: 14,
  volumeMa: 20,
  volumeMultiple: 1.2,
  requireHighVolume: true,
  strongBodyShare: 0.5,
  cooldownBars: 10,
  boxLookback: 20,
  boxMaxRangeAtr: 2.5,
  liquidityPivot: 3,
  bosLookback: 30,
  orderBlockValidBars: 30,
  rr: 2,
  huntStopAtrPad: 0.1,
  minStopAtr: 0.2,
  triggers: { smartMoney: true, emaCross: true, boxBreakout: true, stopHunt: true },
};

export type TriggerId = "smartMoney" | "emaCross" | "boxBreakout" | "stopHunt";

export const TRIGGER_LABELS: Record<TriggerId, string> = {
  smartMoney: "Smart money — break of structure, then the order block",
  emaCross: "EMA crossover",
  boxBreakout: "Box breakout",
  stopHunt: "Stop-loss hunt",
};

export const GATE_LABELS = {
  regime: "Above / below the trend average",
  trend: "Fast average on the right side of the slow one",
  volume: "Volume above its average",
  candle: "Strong candle in the signal's direction",
  rsi: "RSI on the right side of 50",
  cooldown: "Cooldown since the last signal",
} as const;

export type GateId = keyof typeof GATE_LABELS;

interface Condition {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

interface DirectionRead {
  gates: Condition[];
  triggers: Condition[];
  gatesPass: boolean;
  firedTriggers: Condition[];
  /** Set when the stop-hunt trigger is the one that fired. */
  hunt: boolean;
}

interface Precomputed {
  trendMa: MaybeNumber[];
  fastEma: MaybeNumber[];
  slowEma: MaybeNumber[];
  rsi: MaybeNumber[];
  atr: MaybeNumber[];
  volumeAvg: MaybeNumber[];
  boxHigh: MaybeNumber[];
  boxLow: MaybeNumber[];
  pivots: Pivot[];
  /** Bullish and bearish order blocks, live from an index to an index. */
  bullBlocks: OrderBlock[];
  bearBlocks: OrderBlock[];
  hasVolume: boolean;
}

interface OrderBlock {
  /** Bar the block candle sits on. */
  index: number;
  low: number;
  high: number;
  /** The bar structure actually broke on — the block is not live before it. */
  bosIndex: number;
}

/**
 * Break of structure, then the order block behind it.
 *
 * The interpretation used here, which is the common one: price closes beyond
 * the last *confirmed* swing, and the last opposite-coloured candle before
 * that push is the block. A later tap back into that block, closed in the
 * original direction, is the entry. Confirmed swings matter — an unconfirmed
 * one is just the highest bar so far, and building a signal on it would let
 * the strategy see bars that had not happened yet.
 */
function findOrderBlocks(candles: Candle[], all: Pivot[]): {
  bull: OrderBlock[];
  bear: OrderBlock[];
} {
  const bull: OrderBlock[] = [];
  const bear: OrderBlock[] = [];
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  let known = 0;

  for (let i = 0; i < candles.length; i++) {
    // Pivots arrive in confirmation order, so one pass keeps the latest pair.
    while (known < all.length && all[known].confirmedAt <= i) {
      const pivot = all[known];
      if (pivot.kind === "high") lastHigh = pivot.price;
      else lastLow = pivot.price;
      known += 1;
    }

    if (lastHigh !== null && candles[i].close > lastHigh) {
      const block = lastOppositeCandle(candles, i, "down");
      if (block !== null) bull.push({ index: block, low: candles[block].low, high: candles[block].high, bosIndex: i });
      lastHigh = null;
    }
    if (lastLow !== null && candles[i].close < lastLow) {
      const block = lastOppositeCandle(candles, i, "up");
      if (block !== null) bear.push({ index: block, low: candles[block].low, high: candles[block].high, bosIndex: i });
      lastLow = null;
    }
  }
  return { bull, bear };
}

function lastOppositeCandle(candles: Candle[], from: number, want: "up" | "down"): number | null {
  for (let i = from; i >= Math.max(0, from - 20); i--) {
    const bullish = candles[i].close > candles[i].open;
    if (want === "down" && !bullish) return i;
    if (want === "up" && bullish) return i;
  }
  return null;
}

function precompute(series: Series, params: SmartMoneyParams): Precomputed {
  const candles = series.candles;
  const price = closes(candles);
  const box = donchian(candles, params.boxLookback);
  const found = pivots(candles, params.liquidityPivot, params.liquidityPivot);
  const blocks = findOrderBlocks(candles, found);
  const hasVolume = candles.some((c) => c.volume !== null && c.volume > 0);

  return {
    trendMa: movingAverage(price, params.trendMa, params.trendMaType),
    fastEma: ema(price, params.fastEma),
    slowEma: ema(price, params.slowEma),
    rsi: rsiOf(price, params.rsiPeriod),
    atr: atrOf(candles, params.atrPeriod),
    volumeAvg: hasVolume ? sma(candles.map((c) => c.volume ?? 0), params.volumeMa) : [],
    boxHigh: box.upper,
    boxLow: box.lower,
    pivots: found,
    bullBlocks: blocks.bull,
    bearBlocks: blocks.bear,
    hasVolume,
  };
}

function readDirection(
  candles: Candle[],
  pre: Precomputed,
  params: SmartMoneyParams,
  i: number,
  long: boolean,
  lastFired: number,
  digits: number,
): DirectionRead {
  const bar = candles[i];
  const price = bar.close;
  const range = bar.high - bar.low;
  const body = Math.abs(bar.close - bar.open);
  const atr = pre.atr[i];
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(digits));

  const gates: Condition[] = [];

  /* --------------------------------- gates --------------------------------- */

  const trendMa = pre.trendMa[i];
  gates.push({
    id: "regime",
    label: GATE_LABELS.regime,
    passed: trendMa !== null && (long ? price > trendMa : price < trendMa),
    detail:
      trendMa === null
        ? `The ${params.trendMa}-period average is not settled yet.`
        : `Close ${fmt(price)} is ${price > trendMa ? "above" : "below"} the ${params.trendMa}-period ${params.trendMaType.toUpperCase()} at ${fmt(trendMa)}.`,
  });

  const fast = pre.fastEma[i];
  const slow = pre.slowEma[i];
  gates.push({
    id: "trend",
    label: GATE_LABELS.trend,
    passed: fast !== null && slow !== null && (long ? fast > slow : fast < slow),
    detail:
      fast === null || slow === null
        ? "The fast and slow averages are not settled yet."
        : `EMA ${params.fastEma} at ${fmt(fast)} is ${fast > slow ? "above" : "below"} EMA ${params.slowEma} at ${fmt(slow)}.`,
  });

  // No volume means the filter cannot run. Passing it silently would be a
  // filter that exists on screen and nowhere else.
  const volumeAvg = pre.hasVolume ? pre.volumeAvg[i] : null;
  const volume = bar.volume;
  const volumePassed = !params.requireHighVolume
    ? true
    : !pre.hasVolume
      ? true
      : volume !== null && volumeAvg !== null && volume > volumeAvg * params.volumeMultiple;
  gates.push({
    id: "volume",
    label: GATE_LABELS.volume,
    passed: volumePassed,
    detail: !params.requireHighVolume
      ? "Turned off, so this bar is not filtered on volume."
      : !pre.hasVolume
        ? "This source publishes no volume, so the filter cannot run and is not blocking anything."
        : `Volume ${volume === null ? "—" : Math.round(volume).toLocaleString()} against a ${params.volumeMa}-bar average of ${volumeAvg === null ? "—" : Math.round(volumeAvg).toLocaleString()} × ${params.volumeMultiple}.`,
  });

  const directional = long ? bar.close > bar.open : bar.close < bar.open;
  const strong = range > 0 && directional && body > range * params.strongBodyShare;
  gates.push({
    id: "candle",
    label: GATE_LABELS.candle,
    passed: strong,
    detail:
      range === 0
        ? "A flat bar with no range."
        : `Body is ${Math.round((body / range) * 100)}% of the bar's range, and the bar closed ${bar.close > bar.open ? "up" : "down"}. Needs over ${Math.round(params.strongBodyShare * 100)}% in the signal's direction.`,
  });

  const rsi = pre.rsi[i];
  gates.push({
    id: "rsi",
    label: GATE_LABELS.rsi,
    passed: rsi !== null && (long ? rsi > 50 : rsi < 50),
    detail: rsi === null ? "RSI is not settled yet." : `RSI ${rsi.toFixed(1)}, needs to be ${long ? "above" : "below"} 50.`,
  });

  const sinceLast = lastFired < 0 ? Infinity : i - lastFired;
  gates.push({
    id: "cooldown",
    label: GATE_LABELS.cooldown,
    passed: sinceLast > params.cooldownBars,
    detail:
      lastFired < 0
        ? "No signal on this side yet."
        : `${sinceLast} bar${sinceLast === 1 ? "" : "s"} since the last ${long ? "buy" : "sell"}, and ${params.cooldownBars} are required.`,
  });

  const gatesPass = gates.every((g) => g.passed);

  /* -------------------------------- triggers -------------------------------- */

  const triggers: Condition[] = [];

  // 1. Smart money: a live order block, tapped and reclaimed.
  if (params.triggers.smartMoney) {
    const blocks = long ? pre.bullBlocks : pre.bearBlocks;
    const live = blocks.filter(
      (b) => b.bosIndex <= i && i - b.bosIndex <= params.orderBlockValidBars && i - b.bosIndex <= params.bosLookback,
    );
    const block = live.at(-1) ?? null;
    const tapped = block !== null && (long ? bar.low <= block.high : bar.high >= block.low);
    const reclaimed = block !== null && (long ? bar.close > block.high : bar.close < block.low);
    triggers.push({
      id: "smartMoney",
      label: TRIGGER_LABELS.smartMoney,
      passed: Boolean(block && tapped && reclaimed && directional),
      detail:
        block === null
          ? `No ${long ? "bullish" : "bearish"} order block from a structure break in the last ${params.bosLookback} bars.`
          : `Order block ${fmt(block.low)} – ${fmt(block.high)} from the break at bar ${block.bosIndex}. ${tapped ? "Tapped" : "Not tapped"}, ${reclaimed ? "reclaimed on the close" : "not reclaimed"}.`,
    });
  }

  // 2. EMA crossover on this bar.
  if (params.triggers.emaCross) {
    const fastBefore = pre.fastEma[i - 1];
    const slowBefore = pre.slowEma[i - 1];
    const crossed =
      fast !== null && slow !== null && fastBefore !== null && slowBefore !== null &&
      (long ? fastBefore <= slowBefore && fast > slow : fastBefore >= slowBefore && fast < slow);
    triggers.push({
      id: "emaCross",
      label: TRIGGER_LABELS.emaCross,
      passed: crossed,
      detail: crossed
        ? `EMA ${params.fastEma} crossed ${long ? "above" : "below"} EMA ${params.slowEma} on this bar.`
        : `No cross on this bar; the averages were already ${fast !== null && slow !== null && fast > slow ? "bullish" : "bearish"}.`,
    });
  }

  // 3. Box breakout: out of a tight range, not still inside it.
  if (params.triggers.boxBreakout) {
    const boxHigh = pre.boxHigh[i];
    const boxLow = pre.boxLow[i];
    const width = boxHigh !== null && boxLow !== null ? boxHigh - boxLow : null;
    const tight = width !== null && atr !== null && width <= atr * params.boxMaxRangeAtr;
    const broke = boxHigh !== null && boxLow !== null && (long ? price > boxHigh : price < boxLow);
    triggers.push({
      id: "boxBreakout",
      label: TRIGGER_LABELS.boxBreakout,
      passed: Boolean(tight && broke),
      detail:
        width === null
          ? `Not yet ${params.boxLookback} earlier bars to measure a box from.`
          : `Box ${fmt(boxLow)} – ${fmt(boxHigh)} over ${params.boxLookback} bars, ${tight ? "tight enough" : `too wide (${fmt(width)} against ${params.boxMaxRangeAtr} × ATR)`} to count as consolidation. Close ${broke ? "broke out" : "is still inside"}.`,
    });
  }

  // 4. Stop hunt: through the liquidity level, then closed back the other side.
  if (params.triggers.stopHunt) {
    const known = pivotsKnownAt(pre.pivots, i, 12);
    const level = long
      ? known.filter((p) => p.kind === "low").at(-1)
      : known.filter((p) => p.kind === "high").at(-1);
    const swept = level ? (long ? bar.low < level.price : bar.high > level.price) : false;
    const reclaimed = level ? (long ? bar.close > level.price : bar.close < level.price) : false;
    triggers.push({
      id: "stopHunt",
      label: TRIGGER_LABELS.stopHunt,
      passed: Boolean(level && swept && reclaimed && strong),
      detail: level
        ? `Liquidity ${long ? "low" : "high"} at ${fmt(level.price)}. ${swept ? "Swept" : "Not swept"}, and the bar closed ${reclaimed ? "back on the right side" : "beyond it"}.`
        : "No confirmed liquidity level yet.",
    });
  }

  const fired = triggers.filter((t) => t.passed);
  return {
    gates,
    triggers,
    gatesPass,
    firedTriggers: fired,
    hunt: fired.some((t) => t.id === "stopHunt"),
  };
}

/**
 * The cooldown is state that walks forward through the bars, exactly as the
 * `var` in the original does — so it is computed once, in one causal pass,
 * rather than guessed at per bar.
 */
export function smartMoneyEngine(series: Series, params: SmartMoneyParams): SignalEngine {
  const candles = series.candles;
  const pre = precompute(series, params);
  const digits = instrumentOf(series).digits;

  const warmupBars = Math.max(
    params.trendMa,
    params.slowEma,
    params.rsiPeriod + 1,
    params.atrPeriod,
    params.boxLookback + 1,
    params.volumeMa,
    params.liquidityPivot * 2 + 1,
  );

  const firedBuy = new Uint8Array(candles.length);
  const firedSell = new Uint8Array(candles.length);
  const lastBuyAt = new Int32Array(candles.length).fill(-1);
  const lastSellAt = new Int32Array(candles.length).fill(-1);

  let lastBuy = -1;
  let lastSell = -1;
  for (let i = 0; i < candles.length; i++) {
    // Recorded before this bar is judged, so a bar never cools itself down.
    lastBuyAt[i] = lastBuy;
    lastSellAt[i] = lastSell;
    if (i < warmupBars) continue;

    const buy = readDirection(candles, pre, params, i, true, lastBuy, digits);
    if (buy.gatesPass && buy.firedTriggers.length > 0) {
      firedBuy[i] = 1;
      lastBuy = i;
      continue;
    }
    const sell = readDirection(candles, pre, params, i, false, lastSell, digits);
    if (sell.gatesPass && sell.firedTriggers.length > 0) {
      firedSell[i] = 1;
      lastSell = i;
    }
  }

  const evaluate = (i: number): Signal => {
    const bar = candles[i];
    const atr = pre.atr[i];
    const structure = structureAt(pre.pivots, i);
    const levels = levelsAt(candles, pre.pivots, i, (atr ?? bar.close * 0.002) * 0.75);

    const buy = readDirection(candles, pre, params, i, true, lastBuyAt[i], digits);
    const sell = readDirection(candles, pre, params, i, false, lastSellAt[i], digits);

    const isBuy = firedBuy[i] === 1;
    const isSell = firedSell[i] === 1;
    const verdict: SignalVerdict = isBuy ? "buy" : isSell ? "sell" : "neutral";

    // With nothing firing, report whichever side is closer to firing, so the
    // panel shows what is actually missing rather than an arbitrary side.
    const buyMet = buy.gates.filter((g) => g.passed).length;
    const sellMet = sell.gates.filter((g) => g.passed).length;
    const read = isBuy ? buy : isSell ? sell : buyMet >= sellMet ? buy : sell;
    const long = read === buy;

    const metGates = read.gates.filter((g) => g.passed).length;
    const totalConditions = read.gates.length + 1;
    const met = metGates + (read.firedTriggers.length > 0 ? 1 : 0);
    const score = verdict === "neutral" ? Math.round((met / totalConditions) * 100) : 100;

    /* ------------------------- the stop and the target ------------------------ */

    let stopHint: number | null = null;
    let targetHint: number | null = null;
    const cautions: string[] = [];

    if (verdict !== "neutral") {
      const pad = read.hunt && atr !== null ? atr * params.huntStopAtrPad : 0;
      let stop = long ? bar.low - pad : bar.high + pad;
      let risk = long ? bar.close - stop : stop - bar.close;

      const floor = atr !== null ? atr * params.minStopAtr : 0;
      if (floor > 0 && risk < floor) {
        cautions.push(
          `The rule puts the stop at this bar's ${long ? "low" : "high"}, ${risk <= 0 ? "which is not on the losing side of the entry at all" : `only ${risk.toFixed(digits)} away`}. A floor of ${params.minStopAtr} × ATR was applied instead, because a stop that tight sizes the position by your leverage limit rather than your risk limit. Set the floor to zero for exactly what the script says.`,
        );
        risk = floor;
        stop = long ? bar.close - floor : bar.close + floor;
      }

      if (risk > 0) {
        stopHint = stop;
        targetHint = long ? bar.close + risk * params.rr : bar.close - risk * params.rr;
      } else {
        cautions.push("The stop this rule produces is not on the losing side of the entry, so no trade can be sized from it.");
      }
    }

    if (params.requireHighVolume && !pre.hasVolume) {
      cautions.push(
        "This source publishes no volume, so the volume filter is not running. On spot forex and metals there is no real volume to publish; MetaTrader's figure is tick volume, a count of price changes.",
      );
    }
    if (i < warmupBars) {
      cautions.push("Inside the warm-up window — the longest average this strategy uses is not settled yet.");
    }

    /* ------------------------------ presentation ------------------------------ */

    const rules = [
      ...read.gates.map((gate) => ({
        id: gate.id,
        label: gate.label,
        kind: "filter" as const,
        passed: gate.passed,
        vote: (gate.passed ? (long ? 1 : -1) : 0) as -1 | 0 | 1,
        weight: 1,
        detail: gate.detail,
      })),
      ...read.triggers.map((trigger) => ({
        id: trigger.id,
        label: trigger.label,
        kind: "trigger" as const,
        passed: trigger.passed,
        vote: (trigger.passed ? (long ? 1 : -1) : 0) as -1 | 0 | 1,
        weight: 1,
        detail: trigger.detail,
      })),
    ];

    const invalidations: string[] = [];
    if (verdict === "neutral") {
      const missing = read.gates.filter((g) => !g.passed).map((g) => g.label.toLowerCase());
      invalidations.push(
        missing.length > 0
          ? `Nothing can fire on the ${long ? "buy" : "sell"} side until these pass: ${missing.join(", ")}.`
          : "Every filter passes; the strategy is waiting for one of its four triggers.",
      );
    } else {
      const trendMa = pre.trendMa[i];
      if (trendMa !== null) {
        invalidations.push(
          `A close back ${long ? "below" : "above"} the ${params.trendMa}-period average at ${trendMa.toFixed(digits)} removes the regime filter this entry depends on.`,
        );
      }
      if (stopHint !== null) {
        invalidations.push(`Price trading through ${stopHint.toFixed(digits)} — the stop the rule itself set.`);
      }
      invalidations.push(
        `The fast and slow averages crossing back, which turns off the trend filter for this side.`,
      );
    }

    return {
      index: i,
      time: bar.time,
      verdict,
      score,
      scoreMeaning:
        "How many of this strategy's conditions are met out of all of them. Every filter has to pass and one trigger has to fire, so anything under 100 means it is not trading — it is not a measure of how likely a trade is to work.",
      // The same count the score is built from, so the tile and the score agree.
      bullishWeight: long ? met : 0,
      bearishWeight: long ? 0 : met,
      totalWeight: totalConditions,
      rules,
      cautions,
      invalidations,
      close: bar.close,
      atr,
      trend: structure,
      levels,
      stopHint,
      targetHint,
      readingSide: long ? "buy" : "sell",
    };
  };

  return {
    id: "smart-money",
    label: "Deep Smart Money",
    series,
    candles,
    warmupBars,
    evaluateAt: evaluate,
  };
}
