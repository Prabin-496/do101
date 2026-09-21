/**
 * The strategy engine.
 *
 * This is a rule engine, not a prediction engine. Every signal is the sum of a
 * handful of named, inspectable rules, each of which votes bullish, bearish or
 * neither, and each of which can be turned off or re-weighted by the visitor.
 * The score that comes out is the *agreement between those rules* — nothing in
 * here estimates a probability of winning, because nothing in here could.
 *
 * Two structural rules keep the engine honest:
 *
 *  - `evaluateAt(ctx, i)` never reads an index greater than `i`. The whole
 *    context is precomputed for speed, but every array in it is causal.
 *  - Higher-timeframe confirmation reads the last *closed* higher-timeframe
 *    bar, so it cannot see the rest of the current one.
 */

import {
  adx,
  atr,
  bollinger,
  closes,
  sma,
  donchian,
  macd as macdOf,
  movingAverage,
  pivots,
  roc,
  rsi as rsiOf,
  type MaybeNumber,
  type Pivot,
} from "./indicators";
import { aggregate, higherTimeframe } from "./aggregate";
import { bracketing, levelsAt, structureAt, type Level, type StructureRead } from "./levels";
import { TIMEFRAME_MS, type Candle, type Series, type SignalVerdict, type Timeframe } from "./types";

export type RuleId =
  | "htfTrend"
  | "structure"
  | "maCross"
  | "rsi"
  | "macd"
  | "bollinger"
  | "breakout"
  | "levels"
  | "momentum";

export const RULE_IDS: RuleId[] = [
  "htfTrend",
  "structure",
  "maCross",
  "rsi",
  "macd",
  "bollinger",
  "breakout",
  "levels",
  "momentum",
];

export const RULE_LABELS: Record<RuleId, string> = {
  htfTrend: "Higher-timeframe trend",
  structure: "Market structure",
  maCross: "Moving-average crossover",
  rsi: "RSI",
  macd: "MACD",
  bollinger: "Bollinger Bands",
  breakout: "Breakout",
  levels: "Support / resistance",
  momentum: "Momentum",
};

/** What each rule actually tests, in words, for the transparency panel. */
export const RULE_RULES: Record<RuleId, (p: StrategyParams) => string> = {
  htfTrend: (p) =>
    `On the last closed higher-timeframe bar (${p.htfSteps} step${p.htfSteps === 1 ? "" : "s"} up), bullish when its close is above its ${p.trendMa}-period ${p.maType.toUpperCase()} and that average is rising; bearish when the mirror image is true.`,
  structure: (p) =>
    `From swing pivots confirmed by ${p.pivotWindow} bars either side: bullish on a higher high and a higher low, bearish on a lower high and a lower low, neutral when the swings overlap.`,
  maCross: (p) =>
    `Bullish while the ${p.fastMa}-period ${p.maType.toUpperCase()} is above the ${p.slowMa}-period one, bearish while it is below. A cross within the last 3 bars is noted as fresh.`,
  rsi: (p) =>
    `${p.rsiPeriod}-period RSI. Bullish when it climbs back above ${p.rsiOversold} having been below it in the last 5 bars, or when it is above 50 and rising. Bearish on the mirror image around ${p.rsiOverbought}.`,
  macd: (p) =>
    `MACD(${p.macdFast}, ${p.macdSlow}, ${p.macdSignal}). Bullish while the MACD line is above its signal line, bearish while below; a cross within the last 3 bars is noted as fresh.`,
  bollinger: (p) =>
    `${p.bbPeriod}-period bands at ${p.bbMultiplier} standard deviations. Bullish on a close above the upper band, bearish on a close below the lower band, and deliberately neutral in the middle of the band where there is no edge either way.`,
  breakout: (p) =>
    `Bullish when the close exceeds the highest high of the previous ${p.donchianPeriod} bars, bearish when it breaks the lowest low. The current bar is excluded from the range, so a new high is not trivially its own breakout.`,
  levels: () =>
    `Bullish when price is within half an ATR of a confirmed support cluster, bearish within half an ATR of resistance. Levels are clusters of confirmed pivots, never single ticks.`,
  momentum: (p) => `${p.momentumPeriod}-bar rate of change: bullish above zero, bearish below.`,
};

export interface StrategyParams {
  maType: "ema" | "sma";
  fastMa: number;
  slowMa: number;
  /** The slower average used for the higher-timeframe trend read. */
  trendMa: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbMultiplier: number;
  atrPeriod: number;
  donchianPeriod: number;
  pivotWindow: number;
  adxPeriod: number;
  /** Below this ADX the market is treated as directionless and the score is cut. */
  adxMinimum: number;
  momentumPeriod: number;
  /** How many steps up the timeframe ladder the confirmation bar sits. */
  htfSteps: number;
  /** When true, a signal against the higher-timeframe trend is downgraded to neutral. */
  requireHtfAgreement: boolean;
  /** Rules scoring below this are reported as NEUTRAL rather than BUY/SELL. */
  minScore: number;
  /** Zero switches a rule off entirely. */
  weights: Record<RuleId, number>;
}

export const DEFAULT_PARAMS: StrategyParams = {
  maType: "ema",
  fastMa: 21,
  slowMa: 50,
  trendMa: 50,
  rsiPeriod: 14,
  rsiOversold: 35,
  rsiOverbought: 65,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bbPeriod: 20,
  bbMultiplier: 2,
  atrPeriod: 14,
  donchianPeriod: 20,
  pivotWindow: 3,
  adxPeriod: 14,
  adxMinimum: 18,
  momentumPeriod: 10,
  htfSteps: 2,
  requireHtfAgreement: true,
  minScore: 55,
  weights: {
    htfTrend: 3,
    structure: 2,
    maCross: 2,
    rsi: 1,
    macd: 2,
    bollinger: 1,
    breakout: 2,
    levels: 1,
    momentum: 1,
  },
};

export interface RuleResult {
  /** A `RuleId` from this engine, or whatever another engine names its rules. */
  id: string;
  label: string;
  /** +1 bullish, −1 bearish, 0 no opinion on this bar. */
  vote: -1 | 0 | 1;
  weight: number;
  /** What the rule saw, with the numbers it saw. */
  detail: string;
  /**
   * Voting rules leave this unset. In a gate-and-trigger strategy, a filter
   * must pass and a trigger must fire — pass/fail, not a vote — and reading
   * one as the other turns a passed filter into "pointing the other way".
   */
  kind?: "filter" | "trigger";
  passed?: boolean;
}

export interface Signal {
  index: number;
  time: number;
  verdict: SignalVerdict;
  /** 0–100. What it counts depends on the engine — see `scoreMeaning`. */
  score: number;
  /**
   * What this engine's score is measuring, in one sentence.
   *
   * Different engines count different things — one weighs rules that vote, the
   * other counts conditions in a chain that must all hold — and a number on a
   * screen with no stated meaning is the easiest thing in this tool to
   * misread as a probability.
   */
  scoreMeaning: string;
  bullishWeight: number;
  bearishWeight: number;
  totalWeight: number;
  rules: RuleResult[];
  /** Filters that did not pass, each of which cut the score. */
  cautions: string[];
  /** Concrete conditions that would void the read. */
  invalidations: string[];
  close: number;
  atr: number | null;
  trend: StructureRead;
  levels: Level[];
  /**
   * A stop and target the strategy itself worked out, when it has an opinion.
   * The weighted engine leaves these null and lets the execution settings
   * decide; a strategy whose stop is part of its rules fills them in.
   */
  stopHint?: number | null;
  targetHint?: number | null;
  /**
   * For a gate-and-trigger strategy: which side the rules shown belong to.
   * When nothing fires, that is the side closest to firing.
   */
  readingSide?: "buy" | "sell";
}

/**
 * The seam every strategy plugs into.
 *
 * The backtester, the optimiser, the paper account and the chart all talk to
 * this and nothing else, so a new set of rules needs no changes anywhere
 * downstream — and a test can hand the engine a scripted signal to check the
 * execution model on its own.
 */
export interface SignalEngine {
  id: string;
  label: string;
  series: Series;
  candles: Candle[];
  /** Bars at the start that no strategy may trade, while indicators settle. */
  warmupBars: number;
  evaluateAt(index: number): Signal;
}

/** Everything precomputed once for a series, then read causally per bar. */
export interface StrategyContext {
  series: Series;
  params: StrategyParams;
  candles: Candle[];
  fast: MaybeNumber[];
  slow: MaybeNumber[];
  rsi: MaybeNumber[];
  macd: MaybeNumber[];
  macdSignal: MaybeNumber[];
  macdHistogram: MaybeNumber[];
  bbUpper: MaybeNumber[];
  bbLower: MaybeNumber[];
  bbMiddle: MaybeNumber[];
  bbPercentB: MaybeNumber[];
  atr: MaybeNumber[];
  /** Rolling average ATR, for spotting a bar that is unusually wild. */
  atrAverage: MaybeNumber[];
  adx: MaybeNumber[];
  donchianUpper: MaybeNumber[];
  donchianLower: MaybeNumber[];
  momentum: MaybeNumber[];
  pivots: Pivot[];
  /** Higher-timeframe bars and, per base bar, the last one that had closed. */
  htf: { candles: Candle[]; indexAt: number[]; ma: MaybeNumber[]; timeframe: Timeframe | null };
  /** First bar at which every enabled indicator is warm. */
  warmupBars: number;
}

export function buildContext(series: Series, params: StrategyParams): StrategyContext {
  const candles = series.candles;
  const price = closes(candles);

  const atrValues = atr(candles, params.atrPeriod);
  const macdResult = macdOf(price, params.macdFast, params.macdSlow, params.macdSignal);
  const bb = bollinger(price, params.bbPeriod, params.bbMultiplier);
  const donch = donchian(candles, params.donchianPeriod);

  const htfTimeframe = higherTimeframe(series.timeframe, params.htfSteps);
  const htf = htfTimeframe
    ? aggregate(candles, TIMEFRAME_MS[htfTimeframe])
    : { candles: [], htfIndexAt: new Array(candles.length).fill(-1) };
  const htfMa = movingAverage(closes(htf.candles), params.trendMa, params.maType);

  const warmup = Math.max(
    params.slowMa,
    params.macdSlow + params.macdSignal,
    params.bbPeriod,
    params.rsiPeriod + 1,
    params.donchianPeriod + 1,
    params.atrPeriod,
    params.adxPeriod * 2,
    params.pivotWindow * 2 + 1,
    params.momentumPeriod,
  );

  return {
    series,
    params,
    candles,
    fast: movingAverage(price, params.fastMa, params.maType),
    slow: movingAverage(price, params.slowMa, params.maType),
    rsi: rsiOf(price, params.rsiPeriod),
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbMiddle: bb.middle,
    bbPercentB: bb.percentB,
    atr: atrValues,
    // Precomputed rather than measured per bar: taking a median of the last
    // hundred ATRs inside the per-bar evaluation turned a backtest into a
    // sorting benchmark.
    atrAverage: sma(
      atrValues.map((v) => v ?? 0),
      Math.max(20, params.atrPeriod * 5),
    ),
    adx: adx(candles, params.adxPeriod).adx,
    donchianUpper: donch.upper,
    donchianLower: donch.lower,
    momentum: roc(price, params.momentumPeriod),
    pivots: pivots(candles, params.pivotWindow, params.pivotWindow),
    htf: { candles: htf.candles, indexAt: htf.htfIndexAt, ma: htfMa, timeframe: htfTimeframe },
    warmupBars: warmup,
  };
}

/** How much a failed filter cuts the score. A caution, not a veto. */
const CAUTION_FACTOR = 0.75;

export function evaluateAt(ctx: StrategyContext, i: number): Signal {
  const { params, candles } = ctx;
  const candle = candles[i];
  const price = candle.close;
  const atrNow = ctx.atr[i];
  const structure = structureAt(ctx.pivots, i);
  const tolerance = atrNow ?? price * 0.002;
  const levels = levelsAt(candles, ctx.pivots, i, tolerance * 0.75);

  const rules: RuleResult[] = [];
  const add = (id: RuleId, vote: -1 | 0 | 1, detail: string) => {
    const weight = params.weights[id] ?? 0;
    if (weight <= 0) return;
    rules.push({ id, label: RULE_LABELS[id], vote, weight, detail });
  };

  /* ------------------------- higher-timeframe trend ------------------------- */

  let htfVote: -1 | 0 | 1 = 0;
  const htfIndex = ctx.htf.indexAt[i] ?? -1;
  if (ctx.htf.timeframe) {
    const htfBar = htfIndex >= 1 ? ctx.htf.candles[htfIndex] : undefined;
    const ma = htfIndex >= 1 ? ctx.htf.ma[htfIndex] : null;
    const maBefore = htfIndex >= 1 ? ctx.htf.ma[htfIndex - 1] : null;

    if (htfBar && ma !== null && maBefore !== null) {
      const above = htfBar.close > ma;
      const rising = ma > maBefore;
      htfVote = above && rising ? 1 : !above && !rising ? -1 : 0;
      add(
        "htfTrend",
        htfVote,
        htfVote === 1
          ? `Last closed ${ctx.htf.timeframe} bar closed above a rising ${params.trendMa}-period average.`
          : htfVote === -1
            ? `Last closed ${ctx.htf.timeframe} bar closed below a falling ${params.trendMa}-period average.`
            : `Last closed ${ctx.htf.timeframe} bar is on the ${above ? "bullish" : "bearish"} side of a ${rising ? "rising" : "falling"} average — mixed, so no vote.`,
      );
    } else if (htfBar) {
      // The rule is still counted, with no vote. Dropping it instead would
      // quietly shrink the denominator and inflate every score — and the
      // visitor would never learn that their history is too short for the
      // higher-timeframe average they asked for.
      add(
        "htfTrend",
        0,
        `Only ${ctx.htf.candles.length} ${ctx.htf.timeframe} bars fit in this history, and a ${params.trendMa}-period average needs ${params.trendMa}. Load more bars, drop the higher timeframe a step, or shorten that average.`,
      );
    } else {
      add("htfTrend", 0, `Not enough history yet for a closed ${ctx.htf.timeframe} bar.`);
    }
  }

  /* ----------------------------- market structure --------------------------- */

  add(
    "structure",
    structure.trend === "up" ? 1 : structure.trend === "down" ? -1 : 0,
    structure.detail,
  );

  /* ------------------------------ MA crossover ------------------------------ */

  const fast = ctx.fast[i];
  const slow = ctx.slow[i];
  if (fast === null || slow === null) {
    add("maCross", 0, `The ${params.slowMa}-period average is not settled yet on this bar.`);
  } else {
    const above = fast > slow;
    let fresh = false;
    for (let k = Math.max(1, i - 3); k <= i; k++) {
      const f0 = ctx.fast[k - 1];
      const s0 = ctx.slow[k - 1];
      const f1 = ctx.fast[k];
      const s1 = ctx.slow[k];
      if (f0 === null || s0 === null || f1 === null || s1 === null) continue;
      if (f0 - s0 <= 0 !== (f1 - s1 <= 0)) fresh = true;
    }
    add(
      "maCross",
      above ? 1 : -1,
      `${params.fastMa}-period average is ${above ? "above" : "below"} the ${params.slowMa}-period one${fresh ? ", crossed within the last 3 bars" : ""}.`,
    );
  }

  /* ---------------------------------- RSI ----------------------------------- */

  const rsiNow = ctx.rsi[i];
  if (rsiNow === null) {
    add("rsi", 0, `RSI needs ${params.rsiPeriod + 1} bars before it means anything; this bar is inside that window.`);
  } else {
    const window = ctx.rsi.slice(Math.max(0, i - 5), i + 1).filter((v): v is number => v !== null);
    const wasOversold = window.some((v) => v <= params.rsiOversold);
    const wasOverbought = window.some((v) => v >= params.rsiOverbought);
    const prev = ctx.rsi[i - 1];
    const rising = prev !== null && rsiNow > prev;

    let vote: -1 | 0 | 1 = 0;
    let detail = `RSI ${rsiNow.toFixed(1)} — mid-range, no vote.`;
    if (wasOversold && rsiNow > params.rsiOversold) {
      vote = 1;
      detail = `RSI ${rsiNow.toFixed(1)} has recovered back above ${params.rsiOversold} after being oversold.`;
    } else if (wasOverbought && rsiNow < params.rsiOverbought) {
      vote = -1;
      detail = `RSI ${rsiNow.toFixed(1)} has dropped back below ${params.rsiOverbought} after being overbought.`;
    } else if (rsiNow > 50 && rsiNow < params.rsiOverbought && rising) {
      vote = 1;
      detail = `RSI ${rsiNow.toFixed(1)} is above 50 and rising.`;
    } else if (rsiNow < 50 && rsiNow > params.rsiOversold && !rising) {
      vote = -1;
      detail = `RSI ${rsiNow.toFixed(1)} is below 50 and falling.`;
    } else if (rsiNow >= params.rsiOverbought) {
      detail = `RSI ${rsiNow.toFixed(1)} is overbought — stretched, but stretched markets can stay stretched, so no vote.`;
    } else if (rsiNow <= params.rsiOversold) {
      detail = `RSI ${rsiNow.toFixed(1)} is oversold — no vote until it turns back up.`;
    }
    add("rsi", vote, detail);
  }

  /* ---------------------------------- MACD ---------------------------------- */

  const macdNow = ctx.macd[i];
  const macdSig = ctx.macdSignal[i];
  if (macdNow === null || macdSig === null) {
    add("macd", 0, "MACD and its signal line are not settled yet on this bar.");
  } else {
    const above = macdNow > macdSig;
    let fresh = false;
    for (let k = Math.max(1, i - 3); k <= i; k++) {
      const m0 = ctx.macd[k - 1];
      const s0 = ctx.macdSignal[k - 1];
      const m1 = ctx.macd[k];
      const s1 = ctx.macdSignal[k];
      if (m0 === null || s0 === null || m1 === null || s1 === null) continue;
      if (m0 - s0 <= 0 !== (m1 - s1 <= 0)) fresh = true;
    }
    add(
      "macd",
      above ? 1 : -1,
      `MACD line is ${above ? "above" : "below"} its signal line${fresh ? " after a cross in the last 3 bars" : ""}.`,
    );
  }

  /* ------------------------------- Bollinger -------------------------------- */

  const upper = ctx.bbUpper[i];
  const lower = ctx.bbLower[i];
  const pctB = ctx.bbPercentB[i];
  if (upper === null || lower === null || pctB === null) {
    add("bollinger", 0, `The bands need ${params.bbPeriod} bars; this one is inside that window.`);
  } else {
    let vote: -1 | 0 | 1 = 0;
    let detail = `Price sits ${Math.round(pctB * 100)}% of the way across the bands — mid-band, no edge either way.`;
    if (price > upper) {
      vote = 1;
      detail = "Closed above the upper band — an expansion higher.";
    } else if (price < lower) {
      vote = -1;
      detail = "Closed below the lower band — an expansion lower.";
    }
    add("bollinger", vote, detail);
  }

  /* -------------------------------- breakout -------------------------------- */

  const dUp = ctx.donchianUpper[i];
  const dDown = ctx.donchianLower[i];
  if (dUp === null || dDown === null) {
    add("breakout", 0, `There are not yet ${params.donchianPeriod} earlier bars to form a range from.`);
  } else {
    let vote: -1 | 0 | 1 = 0;
    let detail = `Inside the ${params.donchianPeriod}-bar range (${fmt(dDown)} – ${fmt(dUp)}).`;
    if (price > dUp) {
      vote = 1;
      detail = `Closed above the ${params.donchianPeriod}-bar high of ${fmt(dUp)}.`;
    } else if (price < dDown) {
      vote = -1;
      detail = `Closed below the ${params.donchianPeriod}-bar low of ${fmt(dDown)}.`;
    }
    add("breakout", vote, detail);
  }

  /* ---------------------------- support / resistance ------------------------ */

  if (levels.length === 0 || atrNow === null) {
    add("levels", 0, "No confirmed support or resistance has formed in the bars loaded so far.");
  } else {
    const { above, below } = bracketing(levels, price);
    const nearSupport = below && price - below.price <= atrNow * 0.5;
    const nearResistance = above && above.price - price <= atrNow * 0.5;
    let vote: -1 | 0 | 1 = 0;
    let detail = "Price is not near a confirmed level.";
    if (nearSupport && !nearResistance) {
      vote = 1;
      detail = `Sitting on support around ${fmt(below.price)} (${below.touches} confirmed touch${below.touches === 1 ? "" : "es"}).`;
    } else if (nearResistance && !nearSupport) {
      vote = -1;
      detail = `Pressed against resistance around ${fmt(above.price)} (${above.touches} confirmed touch${above.touches === 1 ? "" : "es"}).`;
    } else if (nearSupport && nearResistance) {
      detail = "Squeezed between support and resistance — no vote.";
    }
    add("levels", vote, detail);
  }

  /* -------------------------------- momentum -------------------------------- */

  const mom = ctx.momentum[i];
  if (mom === null) {
    add("momentum", 0, `Rate of change needs ${params.momentumPeriod} earlier bars.`);
  } else {
    add(
      "momentum",
      mom > 0 ? 1 : mom < 0 ? -1 : 0,
      `${params.momentumPeriod}-bar rate of change is ${mom >= 0 ? "+" : ""}${mom.toFixed(2)}%.`,
    );
  }

  /* --------------------------------- scoring -------------------------------- */

  // Every rule with a weight is counted, even when it has nothing to say. A
  // rule that quietly dropped out would shrink the denominator and inflate the
  // score — the one direction a confidence number must never drift.

  let bullish = 0;
  let bearish = 0;
  let total = 0;
  for (const rule of rules) {
    total += rule.weight;
    if (rule.vote === 1) bullish += rule.weight;
    if (rule.vote === -1) bearish += rule.weight;
  }

  const net = bullish - bearish;
  let verdict: SignalVerdict = net > 0 ? "buy" : net < 0 ? "sell" : "neutral";
  let score = total === 0 ? 0 : Math.round((Math.max(bullish, bearish) / total) * 100);

  const cautions: string[] = [];
  const adxNow = ctx.adx[i];
  if (adxNow !== null && adxNow < params.adxMinimum) {
    cautions.push(
      `ADX is ${adxNow.toFixed(1)}, below the ${params.adxMinimum} you set — the market is directionless, where trend rules perform worst.`,
    );
    score = Math.round(score * CAUTION_FACTOR);
  }
  const atrNormal = ctx.atrAverage[i];
  if (atrNow !== null && atrNormal !== null && atrNormal > 0 && price > 0) {
    const atrPct = (atrNow / price) * 100;
    if (atrNow > atrNormal * 2) {
      cautions.push(
        `Volatility is roughly double its recent normal (ATR ${atrPct.toFixed(2)}% of price) — stops sized on the old range will be hit by noise.`,
      );
      score = Math.round(score * CAUTION_FACTOR);
    }
  }
  if (params.requireHtfAgreement && htfVote !== 0 && verdict !== "neutral") {
    const wanted = verdict === "buy" ? 1 : -1;
    if (htfVote !== wanted) {
      cautions.push("Higher-timeframe trend disagrees, and you asked for that to be required.");
      verdict = "neutral";
    }
  }
  if (i < ctx.warmupBars) {
    cautions.push("Inside the indicator warm-up window — not all rules are settled yet.");
    verdict = "neutral";
  }
  if (verdict !== "neutral" && score < params.minScore) {
    cautions.push(`Agreement of ${score} is below your ${params.minScore} threshold.`);
    verdict = "neutral";
  }

  /* ------------------------------ invalidations ------------------------------ */

  const invalidations: string[] = [];
  if (verdict === "buy") {
    if (structure.invalidationLong !== null) {
      invalidations.push(`A close below the last confirmed swing low at ${fmt(structure.invalidationLong)} breaks the structure this read depends on.`);
    }
    if (slow !== null) invalidations.push(`Price closing back below the ${params.slowMa}-period average at ${fmt(slow)}.`);
    invalidations.push(`The moving averages crossing back down, or MACD losing its signal line.`);
  } else if (verdict === "sell") {
    if (structure.invalidationShort !== null) {
      invalidations.push(`A close above the last confirmed swing high at ${fmt(structure.invalidationShort)} breaks the structure this read depends on.`);
    }
    if (slow !== null) invalidations.push(`Price closing back above the ${params.slowMa}-period average at ${fmt(slow)}.`);
    invalidations.push(`The moving averages crossing back up, or MACD regaining its signal line.`);
  } else {
    invalidations.push("There is no position to invalidate — the rules do not agree strongly enough to point either way.");
  }

  return {
    index: i,
    time: candle.time,
    verdict,
    score,
    scoreMeaning:
      "The weight of the rules pointing one way, as a share of every active rule. It measures agreement between your rules — not how often such a setup has worked.",
    bullishWeight: bullish,
    bearishWeight: bearish,
    totalWeight: total,
    rules,
    cautions,
    invalidations,
    close: price,
    atr: atrNow,
    trend: structure,
    levels,
    stopHint: null,
    targetHint: null,
  };
}

function fmt(n: number): string {
  return n.toFixed(n >= 100 ? 2 : 5);
}

/** Wraps the weighted rule engine in the interface everything downstream uses. */
export function weightedEngine(series: Series, params: StrategyParams): SignalEngine {
  const ctx = buildContext(series, params);
  return {
    id: "weighted",
    label: "Weighted rules",
    series,
    candles: ctx.candles,
    warmupBars: ctx.warmupBars,
    evaluateAt: (index) => evaluateAt(ctx, index),
  };
}

/** The whole rule book as plain sentences, for the transparency panel. */
export function describeStrategy(params: StrategyParams): { label: string; rule: string; weight: number }[] {
  return RULE_IDS.filter((id) => (params.weights[id] ?? 0) > 0).map((id) => ({
    label: RULE_LABELS[id],
    rule: RULE_RULES[id](params),
    weight: params.weights[id],
  }));
}
