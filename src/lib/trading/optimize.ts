/**
 * Parameter search, run in the visitor's own browser.
 *
 * Optimisation is the part of backtesting that lies most easily, so this
 * module is built around catching itself out rather than finding a winner:
 *
 *  - The data is split once, up front. Parameters are chosen on the first
 *    part (in-sample) and then *reported* on the second (out-of-sample), which
 *    the search never gets to look at.
 *  - Every combination is scored on both halves, and the rank correlation
 *    between the two is reported. If it is near zero, the ranking learnt on
 *    the first half means nothing on the second, and no amount of a pretty
 *    equity curve changes that.
 *  - The neighbourhood of the winner is measured. A setting that only works at
 *    exactly 21 and fails at 20 and 22 is a curve fit, not an edge.
 */

import { runBacktest, type BacktestResult, type ExecutionConfig } from "./backtest";
import { makeEngine, type EngineSettings } from "./engines";
import type { Series } from "./types";

export type StrategyKnob =
  | "fastMa"
  | "slowMa"
  | "rsiPeriod"
  | "rsiOversold"
  | "rsiOverbought"
  | "bbPeriod"
  | "donchianPeriod"
  | "atrPeriod"
  | "adxMinimum"
  | "minScore"
  // Deep Smart Money. A knob is only offered when its engine is the active one.
  | "trendMa"
  | "fastEma"
  | "slowEma"
  | "cooldownBars"
  | "boxLookback"
  | "liquidityPivot"
  | "volumeMultiple"
  | "strongBodyShare"
  | "minStopAtr"
  | "rr";

export type ExecutionKnob = "atrMultiple" | "riskReward" | "riskPercent" | "stopPips" | "targetPips";

export type Knob = StrategyKnob | ExecutionKnob;

export const EXECUTION_KNOBS: ExecutionKnob[] = [
  "atrMultiple",
  "riskReward",
  "riskPercent",
  "stopPips",
  "targetPips",
];

export const KNOB_LABELS: Record<Knob, string> = {
  fastMa: "Fast MA period",
  slowMa: "Slow MA period",
  rsiPeriod: "RSI period",
  rsiOversold: "RSI oversold",
  rsiOverbought: "RSI overbought",
  bbPeriod: "Bollinger period",
  donchianPeriod: "Breakout lookback",
  atrPeriod: "ATR period",
  adxMinimum: "Minimum ADX",
  minScore: "Minimum score",
  trendMa: "Trend average",
  fastEma: "Fast EMA",
  slowEma: "Slow EMA",
  cooldownBars: "Cooldown, in bars",
  boxLookback: "Box lookback",
  liquidityPivot: "Liquidity swing window",
  volumeMultiple: "Volume multiple",
  strongBodyShare: "Candle body share",
  minStopAtr: "Minimum stop, in ATR",
  rr: "Reward-to-risk (strategy)",
  atrMultiple: "Stop, in ATR",
  riskReward: "Reward-to-risk target",
  riskPercent: "Risk per trade %",
  stopPips: "Stop, in pips",
  targetPips: "Target, in pips",
};

export interface KnobSpec {
  knob: Knob;
  values: number[];
}

export type Objective = "expectancyR" | "profitFactor" | "netProfit" | "riskAdjusted";

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  expectancyR: "Average result per trade, in R",
  profitFactor: "Profit factor",
  netProfit: "Net profit",
  riskAdjusted: "Risk-adjusted score",
};

export interface OptimizeOptions {
  /** Share of the bars used to choose parameters. The rest is held back. */
  inSampleShare: number;
  objective: Objective;
  /** Combinations with fewer trades than this are not eligible to win. */
  minTrades: number;
  /** Hard ceiling on the grid, so a browser tab cannot be locked up. */
  maxCombinations: number;
}

export const DEFAULT_OPTIMIZE: OptimizeOptions = {
  inSampleShare: 0.7,
  objective: "expectancyR",
  minTrades: 20,
  maxCombinations: 240,
};

export interface Combination {
  values: Partial<Record<Knob, number>>;
  inSample: BacktestResult;
  outOfSample: BacktestResult;
  inScore: number;
  outScore: number;
}

export interface OptimizationResult {
  combinations: Combination[];
  best: Combination | null;
  /** Spearman rank correlation of in- vs out-of-sample scores, −1 to 1. */
  rankCorrelation: number | null;
  /** Mean score of the winner's immediate neighbours, over the winner's score. */
  plateau: number | null;
  splitIndex: number;
  splitTime: number;
  truncated: boolean;
  totalCombinations: number;
  warnings: string[];
}

export function scoreOf(result: BacktestResult, objective: Objective): number {
  const m = result.metrics;
  if (m.trades === 0) return Number.NEGATIVE_INFINITY;
  switch (objective) {
    case "profitFactor":
      return m.profitFactor ?? (m.netProfit > 0 ? 10 : 0);
    case "netProfit":
      return m.netProfit;
    case "riskAdjusted":
      return m.riskAdjusted ?? 0;
    default:
      return m.expectancyR;
  }
}

/** Cartesian product of the chosen knobs, capped. */
export function expandGrid(specs: KnobSpec[], max: number): { grid: Partial<Record<Knob, number>>[]; total: number; truncated: boolean } {
  const usable = specs.filter((s) => s.values.length > 0);
  const total = usable.reduce((acc, s) => acc * s.values.length, 1);
  let grid: Partial<Record<Knob, number>>[] = [{}];
  for (const spec of usable) {
    const next: Partial<Record<Knob, number>>[] = [];
    for (const combo of grid) {
      for (const value of spec.values) next.push({ ...combo, [spec.knob]: value });
    }
    grid = next;
    if (grid.length > max * 4) break;
  }
  const truncated = grid.length > max;
  return { grid: truncated ? grid.slice(0, max) : grid, total, truncated };
}

/**
 * Routes each knob to whichever object owns it: the execution settings, or the
 * parameters of whichever strategy is running. Some names, like `rsiPeriod`,
 * exist in both engines and land on the active one.
 */
function applyCombo(
  settings: EngineSettings,
  execution: ExecutionConfig,
  combo: Partial<Record<Knob, number>>,
): { settings: EngineSettings; execution: ExecutionConfig } {
  const next: EngineSettings = {
    ...settings,
    weighted: { ...settings.weighted },
    smartMoney: { ...settings.smartMoney },
  };
  const nextExecution = { ...execution };
  const active = (next.engine === "smart-money" ? next.smartMoney : next.weighted) as unknown as Record<string, number>;

  for (const [knob, value] of Object.entries(combo) as [Knob, number][]) {
    if ((EXECUTION_KNOBS as string[]).includes(knob)) {
      (nextExecution as unknown as Record<string, number>)[knob] = value;
    } else if (knob in active) {
      active[knob] = value;
    }
  }
  return { settings: next, execution: nextExecution };
}

export async function runOptimization(
  series: Series,
  baseSettings: EngineSettings,
  baseExecution: ExecutionConfig,
  specs: KnobSpec[],
  options: OptimizeOptions = DEFAULT_OPTIMIZE,
  onProgress?: (done: number, total: number) => void,
): Promise<OptimizationResult> {
  const { grid, total, truncated } = expandGrid(specs, options.maxCombinations);
  const lastIndex = series.candles.length - 1;
  const splitIndex = Math.floor(lastIndex * clamp(options.inSampleShare, 0.3, 0.9));
  const splitTime = series.candles[splitIndex]?.time ?? 0;

  const combinations: Combination[] = [];
  for (let i = 0; i < grid.length; i++) {
    const combo = grid[i];
    const { settings, execution } = applyCombo(baseSettings, baseExecution, combo);
    const engine = makeEngine(series, settings);
    const inSample = runBacktest(engine, execution, { from: 0, to: splitIndex });
    const outOfSample = runBacktest(engine, execution, { from: splitIndex + 1, to: lastIndex });
    combinations.push({
      values: combo,
      inSample,
      outOfSample,
      inScore: scoreOf(inSample, options.objective),
      outScore: scoreOf(outOfSample, options.objective),
    });
    if (i % 4 === 3) {
      onProgress?.(i + 1, grid.length);
      await breathe();
    }
  }
  onProgress?.(grid.length, grid.length);

  const eligible = combinations.filter((c) => c.inSample.metrics.trades >= options.minTrades);
  const pool = eligible.length > 0 ? eligible : combinations;
  const best = pool.reduce<Combination | null>(
    (acc, c) => (acc === null || c.inScore > acc.inScore ? c : acc),
    null,
  );

  const warnings: string[] = [];
  if (eligible.length === 0 && combinations.length > 0) {
    warnings.push(
      `No combination reached ${options.minTrades} in-sample trades, so the winner below is chosen from a sample too small to mean much.`,
    );
  }

  const rankCorrelation = spearman(
    combinations.filter((c) => Number.isFinite(c.inScore) && Number.isFinite(c.outScore)),
  );
  const plateau = best ? plateauScore(combinations, best, specs) : null;

  if (best) {
    const inScore = best.inScore;
    const outScore = best.outScore;
    if (!Number.isFinite(outScore) || best.outOfSample.metrics.trades === 0) {
      warnings.push("The winning settings produced no trades at all on the held-back data, which tells you nothing good about them.");
    } else if (inScore > 0 && outScore <= 0) {
      warnings.push(
        "The best in-sample settings lose money on the held-back data. That is the signature of a curve fit: the parameters describe what already happened rather than how the market behaves.",
      );
    } else if (inScore > 0 && outScore < inScore * 0.5) {
      warnings.push(
        "Performance falls by more than half on the held-back data. Some decay is normal; this much usually means the search found noise.",
      );
    }
  }
  if (rankCorrelation !== null && rankCorrelation < 0.2) {
    warnings.push(
      `The ranking learnt in-sample barely survives out-of-sample (rank correlation ${rankCorrelation.toFixed(2)}). Picking the top row would be close to picking at random.`,
    );
  }
  if (plateau !== null && plateau < 0.5) {
    warnings.push(
      "The winning settings sit on a spike, not a plateau — neighbouring values perform far worse. A parameter that only works at one exact number rarely keeps working.",
    );
  }
  if (truncated) {
    warnings.push(`The grid was capped at ${options.maxCombinations} combinations out of ${total} so the page stays responsive.`);
  }

  return {
    combinations,
    best,
    rankCorrelation,
    plateau,
    splitIndex,
    splitTime,
    truncated,
    totalCombinations: total,
    warnings,
  };
}

/**
 * How the winner's immediate neighbours score, relative to the winner.
 *
 * Near 1 means a broad plateau of settings that all work; near 0 means the
 * winner is an isolated spike, which is the classic overfitting shape.
 */
function plateauScore(
  combinations: Combination[],
  best: Combination,
  specs: KnobSpec[],
): number | null {
  const neighbours = combinations.filter((c) => {
    if (c === best) return false;
    let steps = 0;
    for (const spec of specs) {
      const bestValue = best.values[spec.knob];
      const value = c.values[spec.knob];
      if (bestValue === undefined || value === undefined) continue;
      if (value === bestValue) continue;
      const bestAt = spec.values.indexOf(bestValue);
      const at = spec.values.indexOf(value);
      if (bestAt < 0 || at < 0) return false;
      steps += Math.abs(at - bestAt);
    }
    return steps === 1;
  });

  if (neighbours.length === 0 || !Number.isFinite(best.inScore) || best.inScore <= 0) return null;
  const mean = neighbours.reduce((a, c) => a + (Number.isFinite(c.inScore) ? c.inScore : 0), 0) / neighbours.length;
  return mean / best.inScore;
}

/** Spearman rank correlation between the in- and out-of-sample scores. */
export function spearman(combinations: Combination[]): number | null {
  const n = combinations.length;
  if (n < 3) return null;
  const inRanks = rank(combinations.map((c) => c.inScore));
  const outRanks = rank(combinations.map((c) => c.outScore));
  const meanIn = inRanks.reduce((a, b) => a + b, 0) / n;
  const meanOut = outRanks.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let varIn = 0;
  let varOut = 0;
  for (let i = 0; i < n; i++) {
    const a = inRanks[i] - meanIn;
    const b = outRanks[i] - meanOut;
    cov += a * b;
    varIn += a * a;
    varOut += b * b;
  }
  if (varIn === 0 || varOut === 0) return null;
  return cov / Math.sqrt(varIn * varOut);
}

/** Average ranks, ties shared. */
function rank(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j += 1;
    const shared = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k].i] = shared;
    i = j + 1;
  }
  return ranks;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Hands the main thread back so the progress bar can paint. */
function breathe(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
