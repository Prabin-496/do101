import { describe, it, expect } from "vitest";
import {
  adx, atr, bollinger, donchian, ema, macd, pivots, pivotsKnownAt, roc, rsi, sma, trueRange,
} from "@/lib/trading/indicators";
import { aggregate, higherTimeframe } from "@/lib/trading/aggregate";
import { levelsAt, structureAt } from "@/lib/trading/levels";
import { buildContext, DEFAULT_PARAMS, describeStrategy, evaluateAt, weightedEngine, type Signal, type SignalEngine } from "@/lib/trading/strategy";
import { DEFAULT_ENGINE_SETTINGS, ENGINE_META, makeEngine } from "@/lib/trading/engines";
import { DEFAULT_SMART_MONEY, smartMoneyEngine, TRIGGER_LABELS } from "@/lib/trading/smart-money";
import { DEFAULT_EXECUTION, runBacktest } from "@/lib/trading/backtest";
import { computeMetrics } from "@/lib/trading/metrics";
import { rewardProfile, sizePosition, valuePerPipPerLot } from "@/lib/trading/risk";
import { detectDayFirst, inferTimeframe, parseCsv, parseTime } from "@/lib/trading/csv";
import { expandGrid, runOptimization, spearman } from "@/lib/trading/optimize";
import { analyseSessions } from "@/lib/trading/sessions";
import { closePosition, createAccount, openPosition, paperMetrics, settleAgainst, unrealised } from "@/lib/trading/paper";
import { PRESETS } from "@/lib/trading/presets";
import { buildPlan } from "@/lib/trading/plan";
import { TOOLS, getTool } from "@/lib/tools/tool-registry";
import { getInstrument, INSTRUMENTS, type Candle, type Series } from "@/lib/trading/types";
import { binanceUrl, parseBinance } from "@/lib/trading/adapters/binance";
import { frankfurterUrl, parseFrankfurter } from "@/lib/trading/adapters/frankfurter";
import { parseTwelveData, twelveDataUrl } from "@/lib/trading/adapters/twelvedata";
import { alphaVantageUrl, parseAlphaVantage } from "@/lib/trading/adapters/alphavantage";
import { mt5Instrument, mt5Series, parseMt5Bars, pipFromDigits, MT5_BRIDGE_SCRIPT } from "@/lib/trading/mt5";

/* ------------------------------- fixtures ------------------------------- */

/** Deterministic PRNG, so every run tests exactly the same market. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;

function walk(count: number, seed = 7, start = 2000, drift = 0): Candle[] {
  const random = mulberry32(seed);
  const candles: Candle[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const open = price;
    const move = (random() - 0.5) * 8 + drift;
    const close = Math.max(1, open + move);
    const high = Math.max(open, close) + random() * 3;
    const low = Math.min(open, close) - random() * 3;
    candles.push({ time: Date.UTC(2024, 0, 1) + i * HOUR, open, high, low, close, volume: Math.round(random() * 1000) });
    price = close;
  }
  return candles;
}

function seriesOf(candles: Candle[], overrides: Partial<Series> = {}): Series {
  return {
    symbol: "XAU/USD",
    instrumentId: "XAUUSD",
    timeframe: "1h",
    candles,
    closeOnly: false,
    source: "test",
    sourceNote: "test",
    fetchedAt: 0,
    ...overrides,
  };
}

/* ------------------------------- indicators ------------------------------ */

describe("indicators", () => {
  it("computes a simple moving average and leaves the warm-up undefined", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result.slice(0, 2)).toEqual([null, null]);
    expect(result[2]).toBeCloseTo(2);
    expect(result[4]).toBeCloseTo(4);
  });

  it("seeds an EMA from the simple average of the first period", () => {
    const values = [1, 2, 3, 4, 5, 6];
    const result = ema(values, 3);
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(2); // (1+2+3)/3
    // k = 2/(3+1) = 0.5, so the next value is halfway between 2 and 4.
    expect(result[3]).toBeCloseTo(3);
    expect(result[4]).toBeCloseTo(4);
  });

  it("returns 100 for an unbroken run of gains and 50 for a flat line", () => {
    const rising = rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
    expect(rising[14]).toBeCloseTo(100);
    const flat = rsi(new Array(20).fill(5), 14);
    expect(flat[14]).toBeCloseTo(50);
  });

  it("keeps RSI inside 0 and 100 on random data", () => {
    const values = walk(400).map((c) => c.close);
    for (const value of rsi(values, 14)) {
      if (value === null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("makes the MACD histogram the difference between the line and its signal", () => {
    const values = walk(200).map((c) => c.close);
    const result = macd(values, 12, 26, 9);
    for (let i = 0; i < values.length; i++) {
      if (result.macd[i] === null || result.signal[i] === null) continue;
      expect(result.histogram[i]).toBeCloseTo((result.macd[i] as number) - (result.signal[i] as number), 10);
    }
  });

  it("puts price inside the Bollinger bands almost always, and centres them on the SMA", () => {
    const values = walk(300).map((c) => c.close);
    const bands = bollinger(values, 20, 2);
    const middle = sma(values, 20);
    let outside = 0;
    let defined = 0;
    for (let i = 0; i < values.length; i++) {
      if (bands.upper[i] === null) continue;
      defined += 1;
      expect(bands.middle[i]).toBeCloseTo(middle[i] as number, 10);
      expect(bands.upper[i] as number).toBeGreaterThan(bands.lower[i] as number);
      if (values[i] > (bands.upper[i] as number) || values[i] < (bands.lower[i] as number)) outside += 1;
    }
    expect(outside / defined).toBeLessThan(0.15);
  });

  it("computes true range from the previous close, not just the bar", () => {
    const candles: Candle[] = [
      { time: 0, open: 10, high: 11, low: 9, close: 10, volume: null },
      { time: HOUR, open: 20, high: 21, low: 19.5, close: 20, volume: null },
    ];
    const tr = trueRange(candles);
    expect(tr[0]).toBeCloseTo(2);
    // The gap up makes |high − previous close| the widest of the three.
    expect(tr[1]).toBeCloseTo(11);
  });

  it("keeps ATR positive and ADX between 0 and 100", () => {
    const candles = walk(300);
    for (const value of atr(candles, 14)) if (value !== null) expect(value).toBeGreaterThan(0);
    for (const value of adx(candles, 14).adx) {
      if (value === null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("excludes the current bar from the Donchian range", () => {
    const candles: Candle[] = [1, 2, 3, 4, 5, 99].map((v, i) => ({
      time: i * HOUR, open: v, high: v, low: v, close: v, volume: null,
    }));
    const result = donchian(candles, 3);
    // At index 5 the range covers bars 2..4, so the spike itself is not in it.
    expect(result.upper[5]).toBeCloseTo(5);
    expect(result.lower[5]).toBeCloseTo(3);
  });

  it("confirms a pivot only once the bars to its right exist", () => {
    const heights = [1, 2, 5, 2, 1, 2, 3];
    const candles: Candle[] = heights.map((v, i) => ({
      time: i * HOUR, open: v, high: v, low: v, close: v, volume: null,
    }));
    const found = pivots(candles, 2, 2);
    const high = found.find((p) => p.kind === "high");
    expect(high?.index).toBe(2);
    expect(high?.confirmedAt).toBe(4);
    expect(pivotsKnownAt(found, 3)).not.toContainEqual(high);
    expect(pivotsKnownAt(found, 4)).toContainEqual(high);
  });

  it("measures rate of change as a percentage", () => {
    expect(roc([100, 0, 0, 0, 0, 110], 5)[5]).toBeCloseTo(10);
  });
});

/* ------------------------------ aggregation ------------------------------ */

describe("higher timeframe aggregation", () => {
  it("buckets bars by wall-clock time and keeps the real high and low", () => {
    const candles = walk(24);
    const result = aggregate(candles, 4 * HOUR);
    expect(result.candles).toHaveLength(6);
    const firstFour = candles.slice(0, 4);
    expect(result.candles[0].open).toBe(firstFour[0].open);
    expect(result.candles[0].close).toBe(firstFour[3].close);
    expect(result.candles[0].high).toBeCloseTo(Math.max(...firstFour.map((c) => c.high)));
    expect(result.candles[0].low).toBeCloseTo(Math.min(...firstFour.map((c) => c.low)));
  });

  it("never points a bar at a higher-timeframe candle that contains it", () => {
    const candles = walk(40);
    const result = aggregate(candles, 4 * HOUR);
    candles.forEach((candle, i) => {
      const index = result.htfIndexAt[i];
      if (index < 0) return;
      const htfBar = result.candles[index];
      // The referenced bar must have finished before this bar started.
      expect(htfBar.time + 4 * HOUR).toBeLessThanOrEqual(candle.time);
    });
  });

  it("climbs the timeframe ladder and stops at the top", () => {
    expect(higherTimeframe("1h", 2)).toBe("1d");
    expect(higherTimeframe("1w", 2)).toBeNull();
  });
});

/* -------------------------------- structure ------------------------------ */

describe("market structure", () => {
  it("calls higher highs and higher lows an uptrend", () => {
    const shape = [10, 8, 12, 9, 14, 11, 16, 13, 18];
    const candles: Candle[] = shape.map((v, i) => ({
      time: i * HOUR, open: v, high: v + 0.5, low: v - 0.5, close: v, volume: null,
    }));
    const found = pivots(candles, 1, 1);
    expect(structureAt(found, candles.length - 1).trend).toBe("up");
  });

  it("clusters nearby pivots into one level", () => {
    const shape = [10, 8, 12, 8.05, 11, 8.02, 13];
    const candles: Candle[] = shape.map((v, i) => ({
      time: i * HOUR, open: v, high: v + 0.1, low: v - 0.1, close: v, volume: null,
    }));
    const found = pivots(candles, 1, 1);
    const levels = levelsAt(candles, found, candles.length - 1, 0.5);
    // The three visits to ~8 are one zone with three touches, not three lines.
    const nearEight = levels.filter((l) => Math.abs(l.price - 8) < 0.5);
    expect(nearEight).toHaveLength(1);
    expect(nearEight[0].touches).toBe(3);
    expect(nearEight[0].kind).toBe("support");
  });
});

/* ----------------------------- strategy engine ---------------------------- */

describe("strategy engine", () => {
  const series = seriesOf(walk(600, 11));
  const ctx = buildContext(series, DEFAULT_PARAMS);

  it("reads the same signal whether or not the future exists", () => {
    // The property that matters most: truncating the series at bar i must not
    // change the signal at bar i. If it does, something is reading ahead.
    for (const i of [200, 300, 420, 555]) {
      const full = evaluateAt(ctx, i);
      const truncated = buildContext(seriesOf(series.candles.slice(0, i + 1)), DEFAULT_PARAMS);
      const partial = evaluateAt(truncated, i);
      expect(partial.verdict).toBe(full.verdict);
      expect(partial.score).toBe(full.score);
      expect(partial.rules.map((r) => r.vote)).toEqual(full.rules.map((r) => r.vote));
    }
  });

  it("stays neutral through the warm-up window", () => {
    for (let i = 0; i < Math.min(ctx.warmupBars, series.candles.length); i++) {
      expect(evaluateAt(ctx, i).verdict).toBe("neutral");
    }
  });

  it("scores agreement between the rules, never above 100", () => {
    for (let i = ctx.warmupBars; i < series.candles.length; i += 17) {
      const signal = evaluateAt(ctx, i);
      expect(signal.score).toBeGreaterThanOrEqual(0);
      expect(signal.score).toBeLessThanOrEqual(100);
      expect(signal.bullishWeight + signal.bearishWeight).toBeLessThanOrEqual(signal.totalWeight);
    }
  });

  it("never lets a rule drop out of the denominator", () => {
    // A rule with nothing to say still counts, with no vote. Dropping it would
    // make the score rise simply because fewer rules were available.
    const active = Object.values(DEFAULT_PARAMS.weights).filter((w) => w > 0);
    const totalWeight = active.reduce((a, b) => a + b, 0);
    for (let i = 0; i < series.candles.length; i += 13) {
      const signal = evaluateAt(ctx, i);
      expect(signal.rules).toHaveLength(active.length);
      expect(signal.totalWeight).toBe(totalWeight);
    }
  });

  it("gives a reason for every rule it applies", () => {
    const signal = evaluateAt(ctx, 400);
    expect(signal.rules.length).toBeGreaterThan(4);
    for (const rule of signal.rules) {
      expect(rule.detail.length).toBeGreaterThan(10);
      expect(rule.weight).toBeGreaterThan(0);
    }
    expect(signal.invalidations.length).toBeGreaterThan(0);
  });

  it("switches a rule off when its weight is zero", () => {
    const params = { ...DEFAULT_PARAMS, weights: { ...DEFAULT_PARAMS.weights, rsi: 0, macd: 0 } };
    const signal = evaluateAt(buildContext(series, params), 400);
    expect(signal.rules.find((r) => r.id === "rsi")).toBeUndefined();
    expect(signal.rules.find((r) => r.id === "macd")).toBeUndefined();
  });

  it("downgrades a signal that fights the higher timeframe when asked to", () => {
    const strict = buildContext(series, { ...DEFAULT_PARAMS, requireHtfAgreement: true, minScore: 0 });
    for (let i = strict.warmupBars; i < series.candles.length; i++) {
      const signal = evaluateAt(strict, i);
      if (signal.verdict === "neutral") continue;
      const htf = signal.rules.find((r) => r.id === "htfTrend");
      if (htf && htf.vote !== 0) {
        expect(htf.vote).toBe(signal.verdict === "buy" ? 1 : -1);
      }
    }
  });

  it("describes every active rule in words", () => {
    const described = describeStrategy(DEFAULT_PARAMS);
    expect(described.length).toBe(Object.values(DEFAULT_PARAMS.weights).filter((w) => w > 0).length);
    for (const entry of described) expect(entry.rule.length).toBeGreaterThan(40);
  });
});

/* ------------------------------- backtesting ------------------------------ */

describe("backtester", () => {
  it("enters at the open of the bar after the signal, never the signal bar", () => {
    const series = seriesOf(walk(500, 3));
    const engine = weightedEngine(series, { ...DEFAULT_PARAMS, minScore: 40 });
    const result = runBacktest(engine, { ...DEFAULT_EXECUTION, spreadPips: 0, slippagePips: 0 });
    expect(result.trades.length).toBeGreaterThan(0);
    for (const trade of result.trades) {
      const bar = series.candles[trade.entryIndex];
      expect(trade.entryPrice).toBeCloseTo(bar.open, 8);
      expect(trade.exitIndex).toBeGreaterThanOrEqual(trade.entryIndex);
    }
  });

  it("never trades before the indicators are warm", () => {
    const series = seriesOf(walk(500, 5));
    const engine = weightedEngine(series, DEFAULT_PARAMS);
    const result = runBacktest(engine, DEFAULT_EXECUTION);
    for (const trade of result.trades) {
      expect(trade.entryIndex).toBeGreaterThan(engine.warmupBars);
    }
  });

  it("charges the spread, and charging more of it makes the result worse", () => {
    const series = seriesOf(walk(800, 9));
    const engine = weightedEngine(series, { ...DEFAULT_PARAMS, minScore: 45 });
    const free = runBacktest(engine, { ...DEFAULT_EXECUTION, spreadPips: 0, commissionPerLot: 0 });
    const costly = runBacktest(engine, { ...DEFAULT_EXECUTION, spreadPips: 60, commissionPerLot: 0 });
    expect(free.trades.length).toBeGreaterThan(3);
    expect(costly.metrics.netProfit).toBeLessThan(free.metrics.netProfit);
  });

  it("risks what it was told to risk, before rounding", () => {
    const series = seriesOf(walk(700, 13));
    const engine = weightedEngine(series, { ...DEFAULT_PARAMS, minScore: 45 });
    const result = runBacktest(engine, { ...DEFAULT_EXECUTION, riskPercent: 1, roundLots: false, spreadPips: 0 });
    for (const trade of result.trades) {
      const balanceBefore = trade.balanceAfter - trade.pnl;
      // The planned loss is 1% of the balance at the time, within rounding.
      expect(trade.plannedRisk).toBeGreaterThan(0);
      expect(trade.plannedRisk / balanceBefore).toBeCloseTo(0.01, 4);
      // And a stopped-out trade loses about that, never wildly more.
      if (trade.exitReason === "stop") expect(trade.pnl).toBeGreaterThan(-trade.plannedRisk * 1.5);
    }
  });

  it("is deterministic", () => {
    const series = seriesOf(walk(400, 21));
    const engine = weightedEngine(series, DEFAULT_PARAMS);
    const a = runBacktest(engine, DEFAULT_EXECUTION);
    const b = runBacktest(engine, DEFAULT_EXECUTION);
    expect(a.metrics).toEqual(b.metrics);
    expect(a.trades.map((t) => t.pnl)).toEqual(b.trades.map((t) => t.pnl));
  });

  it("keeps the equity curve in step with the closed trades", () => {
    const series = seriesOf(walk(600, 17));
    const engine = weightedEngine(series, { ...DEFAULT_PARAMS, minScore: 45 });
    const result = runBacktest(engine, DEFAULT_EXECUTION);
    const realised = result.trades.reduce((a, t) => a + t.pnl, 0);
    expect(result.metrics.finalBalance).toBeCloseTo(DEFAULT_EXECUTION.initialBalance + realised, 6);
    expect(result.equity).toHaveLength(result.barsTested);
  });

  it("checks only the close on a close-only series, and says so", () => {
    const candles = walk(400, 23).map((c) => ({ ...c, open: c.close, high: c.close, low: c.close }));
    const series = seriesOf(candles, { closeOnly: true });
    const engine = weightedEngine(series, { ...DEFAULT_PARAMS, minScore: 45 });
    const result = runBacktest(engine, DEFAULT_EXECUTION);
    expect(result.warnings.join(" ")).toContain("closing prices only");
    for (const trade of result.trades) {
      if (trade.exitReason !== "stop" && trade.exitReason !== "target") continue;
      const bar = series.candles[trade.exitIndex];
      // With no intrabar data, an exit can only ever happen at a close.
      expect([bar.close, trade.stop, trade.target]).toContain(
        trade.exitReason === "stop" ? trade.stop : trade.target,
      );
    }
  });

  it("refuses a range too short to test", () => {
    const series = seriesOf(walk(300, 4));
    const engine = weightedEngine(series, DEFAULT_PARAMS);
    const result = runBacktest(engine, DEFAULT_EXECUTION, { from: 100, to: 103 });
    expect(result.trades).toHaveLength(0);
    expect(result.warnings[0]).toContain("Not enough bars");
  });

  it("closes an open position at the end and labels it", () => {
    const series = seriesOf(walk(600, 31));
    const engine = weightedEngine(series, { ...DEFAULT_PARAMS, minScore: 40 });
    const result = runBacktest(engine, { ...DEFAULT_EXECUTION, targetMode: "rr", riskReward: 50 });
    const last = result.trades.at(-1);
    if (last) expect(["end of data", "stop", "target", "opposite signal", "time limit"]).toContain(last.exitReason);
    expect(result.trades.filter((t) => t.exitReason === "end of data").length).toBeLessThanOrEqual(1);
  });

  it("honours a long-only or short-only run", () => {
    const series = seriesOf(walk(700, 41));
    const engine = weightedEngine(series, { ...DEFAULT_PARAMS, minScore: 45 });
    const longs = runBacktest(engine, { ...DEFAULT_EXECUTION, allowShort: false });
    expect(longs.trades.every((t) => t.direction === "long")).toBe(true);
    const shorts = runBacktest(engine, { ...DEFAULT_EXECUTION, allowLong: false });
    expect(shorts.trades.every((t) => t.direction === "short")).toBe(true);
  });
});

/* --------------------------------- metrics -------------------------------- */

describe("metrics", () => {
  const trade = (pnl: number, r: number) => ({
    id: 1, direction: "long" as const, entryIndex: 0, entryTime: 0, entryPrice: 1,
    exitIndex: 1, exitTime: 1, exitPrice: 1, stop: 0, target: 2, units: 1, lots: 0.1,
    plannedRisk: 100, grossPnl: pnl, costs: 0, pnl, rMultiple: r, exitReason: "stop" as const,
    barsHeld: 1, balanceAfter: 0, scoreAtEntry: 60, reasons: [],
  });

  it("computes win rate, profit factor and expectancy together", () => {
    const trades = [trade(200, 2), trade(-100, -1), trade(150, 1.5), trade(-100, -1)];
    const equity = [
      { time: 0, equity: 1000, balance: 1000, drawdown: 0 },
      { time: 1, equity: 1200, balance: 1200, drawdown: 0 },
      { time: 2, equity: 1100, balance: 1100, drawdown: 0 },
      { time: 3, equity: 1250, balance: 1250, drawdown: 0 },
      { time: 4, equity: 1150, balance: 1150, drawdown: 0 },
    ];
    const metrics = computeMetrics(trades, equity, 1000, 4);
    expect(metrics.winRate).toBeCloseTo(50);
    expect(metrics.profitFactor).toBeCloseTo(350 / 200);
    expect(metrics.netProfit).toBeCloseTo(150);
    expect(metrics.expectancy).toBeCloseTo(37.5);
    expect(metrics.expectancyR).toBeCloseTo(0.375);
    expect(metrics.maxDrawdown).toBeCloseTo(100);
  });

  it("reports an undefined profit factor rather than infinity when nothing lost", () => {
    const metrics = computeMetrics([trade(100, 1)], [{ time: 0, equity: 1000, balance: 1000, drawdown: 0 }], 1000, 1);
    expect(metrics.profitFactor).toBeNull();
  });

  it("counts the longest losing streak", () => {
    const trades = [trade(-1, -1), trade(-1, -1), trade(5, 1), trade(-1, -1), trade(-1, -1), trade(-1, -1)];
    const metrics = computeMetrics(trades, [{ time: 0, equity: 1000, balance: 1000, drawdown: 0 }], 1000, 6);
    expect(metrics.maxConsecutiveLosses).toBe(3);
    expect(metrics.maxConsecutiveWins).toBe(1);
  });

  it("measures the deepest drawdown from the running peak", () => {
    const equity = [1000, 1500, 900, 1200, 600, 1400].map((v, i) => ({
      time: i, equity: v, balance: v, drawdown: 0,
    }));
    const metrics = computeMetrics([], equity, 1000, 6);
    expect(metrics.maxDrawdown).toBeCloseTo(900);
    expect(metrics.maxDrawdownPercent).toBeCloseTo(60);
  });
});

/* ---------------------------------- risk ---------------------------------- */

describe("risk calculator", () => {
  const gold = getInstrument("XAUUSD");

  it("sizes gold from the stop distance", () => {
    // $100 at risk over a $5 stop on a 100-ounce contract is 20 ounces.
    const result = sizePosition({
      balance: 10_000, riskPercent: 1, entry: 2000, stop: 1995, instrument: gold,
      leverage: 100, quoteToAccountRate: 1, roundLots: false, minLot: 0.01, lotStep: 0.01,
    });
    expect(result.riskMoney).toBeCloseTo(100);
    expect(result.units).toBeCloseTo(20);
    expect(result.lots).toBeCloseTo(0.2);
    expect(result.actualRisk).toBeCloseTo(100);
    expect(result.stopPips).toBeCloseTo(500);
  });

  it("lets leverage cap the size, and says that is what happened", () => {
    const result = sizePosition({
      balance: 1000, riskPercent: 5, entry: 2000, stop: 1999, instrument: gold,
      leverage: 20, quoteToAccountRate: 1, roundLots: false, minLot: 0.01, lotStep: 0.01,
    });
    expect(result.cappedByLeverage).toBe(true);
    expect(result.notional).toBeCloseTo(20_000);
    expect(result.actualRisk).toBeLessThan(result.riskMoney);
    expect(result.note).toContain("Leverage");
  });

  it("refuses to round a position up past the risk limit", () => {
    const result = sizePosition({
      balance: 200, riskPercent: 1, entry: 2000, stop: 1990, instrument: gold,
      leverage: 100, quoteToAccountRate: 1, roundLots: true, minLot: 0.01, lotStep: 0.01,
    });
    expect(result.belowMinimumLot).toBe(true);
    expect(result.lots).toBe(0);
    expect(result.note).toContain("minimum lot");
  });

  it("rounds lots down, never up", () => {
    const result = sizePosition({
      balance: 10_000, riskPercent: 1, entry: 2000, stop: 1993, instrument: gold,
      leverage: 100, quoteToAccountRate: 1, roundLots: true, minLot: 0.01, lotStep: 0.01,
    });
    expect(result.actualRisk).toBeLessThanOrEqual(result.riskMoney + 1e-9);
  });

  it("values a pip from the contract size", () => {
    expect(valuePerPipPerLot(getInstrument("EURUSD"))).toBeCloseTo(10);
    expect(valuePerPipPerLot(gold)).toBeCloseTo(1);
  });

  it("works out reward to risk and the break-even win rate it implies", () => {
    const profile = rewardProfile(2000, 1990, 2020, 20);
    expect(profile.ratio).toBeCloseTo(2);
    expect(profile.potentialLoss).toBeCloseTo(200);
    expect(profile.potentialProfit).toBeCloseTo(400);
    expect(profile.breakEvenWinRate).toBeCloseTo(33.333, 2);
  });

  it("says nothing useful rather than something wrong when the stop equals the entry", () => {
    const result = sizePosition({
      balance: 10_000, riskPercent: 1, entry: 2000, stop: 2000, instrument: gold,
      leverage: 30, quoteToAccountRate: 1, roundLots: true, minLot: 0.01, lotStep: 0.01,
    });
    expect(result.units).toBe(0);
    expect(result.note).toContain("stop-loss");
  });

  it("has a sane contract specification for every listed instrument", () => {
    for (const instrument of INSTRUMENTS) {
      expect(instrument.pip).toBeGreaterThan(0);
      expect(instrument.contractSize).toBeGreaterThan(0);
      expect(instrument.digits).toBeGreaterThanOrEqual(2);
    }
  });
});

/* ----------------------------------- CSV ---------------------------------- */

describe("CSV import", () => {
  const rows = (count: number, start = 1.1) =>
    Array.from({ length: count }, (_, i) => {
      const open = start + i * 0.001;
      return `2024-01-${String((i % 28) + 1).padStart(2, "0")} ${String(i % 24).padStart(2, "0")}:00,${open.toFixed(5)},${(open + 0.002).toFixed(5)},${(open - 0.002).toFixed(5)},${(open + 0.001).toFixed(5)},1000`;
    }).join("\n");

  it("reads a headed OHLC file", () => {
    const parsed = parseCsv(`Date,Open,High,Low,Close,Volume\n${rows(120)}`, "EURUSD_H1.csv");
    expect(parsed.series.candles.length).toBe(120);
    expect(parsed.series.closeOnly).toBe(false);
    expect(parsed.series.symbol).toBe("EUR/USD");
    expect(parsed.series.instrumentId).toBe("EURUSD");
  });

  it("reads MetaTrader's headerless date, time, OHLCV export", () => {
    const body = Array.from({ length: 80 }, (_, i) =>
      `2024.03.${String((i % 28) + 1).padStart(2, "0")},${String(i % 24).padStart(2, "0")}:00,1.0850,1.0870,1.0840,1.0860,500`,
    ).join("\n");
    const parsed = parseCsv(body, "XAUUSD_M15.csv");
    expect(parsed.series.candles.length).toBeGreaterThan(50);
    expect(parsed.series.instrumentId).toBe("XAUUSD");
    expect(parsed.notes.join(" ")).toContain("No header row");
  });

  it("flags a close-only file instead of inventing a high and low", () => {
    const body = Array.from({ length: 90 }, (_, i) => `2024-02-${String((i % 28) + 1).padStart(2, "0")},1.${1000 + i}`).join("\n");
    const parsed = parseCsv(`Date,Close\n${body}`, "gold.csv");
    expect(parsed.series.closeOnly).toBe(true);
    for (const candle of parsed.series.candles) {
      expect(candle.high).toBe(candle.close);
      expect(candle.low).toBe(candle.close);
    }
    expect(parsed.notes.join(" ")).toContain("close-only");
  });

  it("works out which way round an ambiguous date is", () => {
    expect(detectDayFirst(["01/02/2024", "13/02/2024"])).toBe("day");
    expect(detectDayFirst(["01/02/2024", "02/13/2024"])).toBe("month");
    expect(detectDayFirst(["01/02/2024", "03/04/2024"])).toBe("ambiguous");
  });

  it("parses the timestamp formats price exports actually use", () => {
    expect(parseTime("2024-01-02", undefined, false)).toBe(Date.UTC(2024, 0, 2));
    expect(parseTime("2024.01.02", "13:45", false)).toBe(Date.UTC(2024, 0, 2, 13, 45));
    expect(parseTime("02/01/2024", undefined, true)).toBe(Date.UTC(2024, 0, 2));
    expect(parseTime("01/02/2024", undefined, false)).toBe(Date.UTC(2024, 0, 2));
    expect(parseTime("1704153600", undefined, false)).toBe(1704153600000);
    expect(parseTime("1704153600000", undefined, false)).toBe(1704153600000);
    expect(parseTime("nonsense", undefined, false)).toBeNull();
  });

  it("sorts, de-duplicates and repairs impossible bars", () => {
    const body = [
      "Date,Open,High,Low,Close",
      ...Array.from({ length: 60 }, (_, i) => `2024-01-${String((i % 28) + 1).padStart(2, "0")}T0${i % 9}:00,10,11,9,10.5`),
      // A bar whose "high" is below its close, and a duplicate stamp.
      "2024-02-01T00:00,10,10.2,9.8,10.9",
      "2024-02-01T00:00,10,10.2,9.8,10.4",
    ].join("\n");
    const parsed = parseCsv(body, "test.csv");
    const times = parsed.series.candles.map((c) => c.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
    for (const candle of parsed.series.candles) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
    }
  });

  it("reads the file the MetaTrader bridge writes in its CSV mode", () => {
    // The two halves of the MetaTrader story have to meet: whatever the bridge
    // script writes must load through the importer without a special case.
    const header = "Date,Open,High,Low,Close,Volume";
    const body = Array.from({ length: 120 }, (_, i) => {
      const stamp = new Date(Date.UTC(2024, 2, 4) + i * 15 * 60_000).toISOString().slice(0, 16).replace("T", " ");
      const open = 2000 + i * 0.1;
      return `${stamp},${open.toFixed(2)},${(open + 2).toFixed(2)},${(open - 1).toFixed(2)},${(open + 1).toFixed(2)},${100 + i}`;
    });
    const parsed = parseCsv([header, ...body].join("\n"), "XAUUSD_15m.csv");
    expect(parsed.series.candles).toHaveLength(120);
    expect(parsed.series.timeframe).toBe("15m");
    expect(parsed.series.instrumentId).toBe("XAUUSD");
    expect(parsed.series.closeOnly).toBe(false);
    expect(parsed.series.candles[0].time).toBe(Date.UTC(2024, 2, 4));
    expect(parsed.series.candles[0].volume).toBe(100);
  });

  it("refuses a file too small to analyse", () => {
    expect(() => parseCsv("Date,Close\n2024-01-01,1.1\n2024-01-02,1.2", "x.csv")).toThrow();
  });

  it("infers the timeframe from the median gap, not the mean", () => {
    const hourly = Array.from({ length: 50 }, (_, i) => ({
      time: Date.UTC(2024, 0, 1) + i * HOUR, open: 1, high: 1, low: 1, close: 1, volume: null,
    }));
    // A weekend-sized hole must not drag the answer up to daily.
    hourly.push({ time: Date.UTC(2024, 0, 6), open: 1, high: 1, low: 1, close: 1, volume: null });
    expect(inferTimeframe(hourly)).toBe("1h");
    const daily = Array.from({ length: 50 }, (_, i) => ({
      time: Date.UTC(2024, 0, 1) + i * 24 * HOUR, open: 1, high: 1, low: 1, close: 1, volume: null,
    }));
    expect(inferTimeframe(daily)).toBe("1d");
  });
});

/* -------------------------------- optimiser ------------------------------- */

describe("optimiser", () => {
  it("expands a grid and caps it", () => {
    const { grid, total, truncated } = expandGrid(
      [{ knob: "fastMa", values: [5, 10, 20] }, { knob: "slowMa", values: [50, 100] }],
      100,
    );
    expect(total).toBe(6);
    expect(grid).toHaveLength(6);
    expect(truncated).toBe(false);
    const capped = expandGrid([{ knob: "fastMa", values: Array.from({ length: 40 }, (_, i) => i + 1) }], 10);
    expect(capped.grid).toHaveLength(10);
    expect(capped.truncated).toBe(true);
  });

  it("measures rank agreement between the two halves", () => {
    const make = (inScore: number, outScore: number) =>
      ({ values: {}, inScore, outScore } as never);
    const agree = spearman([make(1, 1), make(2, 2), make(3, 3), make(4, 4)]);
    expect(agree).toBeCloseTo(1);
    const opposed = spearman([make(1, 4), make(2, 3), make(3, 2), make(4, 1)]);
    expect(opposed).toBeCloseTo(-1);
    expect(spearman([make(1, 1)])).toBeNull();
  });

  it("splits the data, never scores the winner on the half it was chosen from, and warns", async () => {
    const series = seriesOf(walk(900, 77));
    const result = await runOptimization(
      series,
      { ...DEFAULT_ENGINE_SETTINGS, weighted: { ...DEFAULT_PARAMS, minScore: 45 } },
      DEFAULT_EXECUTION,
      [{ knob: "fastMa", values: [9, 14, 21] }, { knob: "atrMultiple", values: [1.5, 2, 3] }],
      { inSampleShare: 0.7, objective: "expectancyR", minTrades: 1, maxCombinations: 20 },
    );
    expect(result.combinations).toHaveLength(9);
    expect(result.splitIndex).toBeGreaterThan(500);
    expect(result.best).not.toBeNull();
    // The two halves must not overlap by a single bar.
    expect(result.best!.inSample.to).toBeLessThan(result.best!.outOfSample.from);
    // The winner is the best in-sample score, by definition of the search.
    const bestIn = Math.max(...result.combinations.filter((c) => c.inSample.metrics.trades >= 1).map((c) => c.inScore));
    expect(result.best!.inScore).toBeCloseTo(bestIn);
  });
});

/* -------------------------------- sessions -------------------------------- */

describe("gold session analysis", () => {
  it("measures the range in each session from the loaded bars", () => {
    // A market that only moves between 12:00 and 16:00 UTC.
    const candles: Candle[] = Array.from({ length: 24 * 20 }, (_, i) => {
      const time = Date.UTC(2024, 0, 1) + i * HOUR;
      const hour = new Date(time).getUTCHours();
      const range = hour >= 12 && hour < 16 ? 10 : 1;
      return { time, open: 2000, high: 2000 + range, low: 2000, close: 2000 + range / 2, volume: null };
    });
    const analysis = analyseSessions(seriesOf(candles));
    expect(analysis.busiest?.session.id).toBe("overlap");
    expect(analysis.busiest!.averageRange).toBeCloseTo(10);
    expect(analysis.busiest!.relative).toBeGreaterThan(1);
    expect(analysis.byHour[13].averageRange).toBeCloseTo(10);
    expect(analysis.byHour[3].averageRange).toBeCloseTo(1);
    expect(analysis.daysCovered).toBe(20);
  });

  it("declines to analyse sessions on a daily chart", () => {
    const analysis = analyseSessions(seriesOf(walk(60), { timeframe: "1d" }));
    expect(analysis.tooCoarse).toBe(true);
    expect(analysis.stats).toHaveLength(0);
  });
});

/* ------------------------------ paper trading ----------------------------- */

describe("paper account", () => {
  const position = {
    symbol: "XAU/USD", instrumentId: "XAUUSD", direction: "long" as const,
    entryPrice: 2000, stop: 1990, target: 2020, units: 10, lots: 0.1,
    plannedRisk: 100, openedBarTime: 0, note: "", quoteToAccountRate: 1,
  };

  it("marks an open position against the last price", () => {
    expect(unrealised({ ...position, id: "x", openedAt: 0 }, 2005)).toBeCloseTo(50);
    expect(unrealised({ ...position, id: "x", openedAt: 0, direction: "short" }, 2005)).toBeCloseTo(-50);
  });

  it("closes a position and moves the money to the balance", () => {
    const account = openPosition(createAccount(10_000), position);
    const closed = closePosition(account, account.positions[0].id, 2010, "closed by hand");
    expect(closed.balance).toBeCloseTo(10_100);
    expect(closed.positions).toHaveLength(0);
    expect(closed.history[0].rMultiple).toBeCloseTo(1);
  });

  it("settles a stop against later bars only, taking the stop over the target", () => {
    const series = seriesOf([]);
    const account = openPosition(createAccount(10_000), position);
    const bars: Candle[] = [
      // Before the entry — must be ignored entirely.
      { time: -HOUR, open: 2000, high: 2100, low: 1900, close: 2000, volume: null },
      // After it, and wide enough to cover both levels.
      { time: HOUR, open: 2000, high: 2030, low: 1980, close: 2000, volume: null },
    ];
    const settled = settleAgainst(account, series, bars);
    expect(settled.closed).toHaveLength(1);
    expect(settled.closed[0].reason).toBe("stop");
    expect(settled.account.balance).toBeCloseTo(9900);
  });

  it("reports the same statistics a backtest would", () => {
    let account = createAccount(1000);
    account = openPosition(account, position);
    account = closePosition(account, account.positions[0].id, 2020, "target", 10);
    account = openPosition(account, { ...position, openedBarTime: 20 });
    account = closePosition(account, account.positions[0].id, 1990, "stop", 30);
    const metrics = paperMetrics(account);
    expect(metrics.trades).toBe(2);
    expect(metrics.winRate).toBeCloseTo(50);
    expect(metrics.netProfit).toBeCloseTo(100);
    expect(metrics.finalBalance).toBeCloseTo(1100);
  });
});

/* -------------------------------- adapters -------------------------------- */

describe("market data adapters", () => {
  it("builds a Binance klines request and reads the reply", () => {
    const url = binanceUrl("PAXGUSDT", "15m", 5000);
    expect(url).toContain("symbol=PAXGUSDT");
    expect(url).toContain("interval=15m");
    expect(url).toContain("limit=1000");
    const candles = parseBinance([
      [1700000000000, "2000.1", "2010.5", "1999.0", "2005.2", "12.5", 1700003599999, "0", 10, "0", "0", "0"],
      [1700003600000, "2005.2", "2006.0", "2001.0", "2002.0", "0", 1700007199999, "0", 4, "0", "0", "0"],
      ["broken"],
    ]);
    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({ time: 1700000000000, open: 2000.1, high: 2010.5, low: 1999, close: 2005.2, volume: 12.5 });
    // A kline with no trades in it really did have zero volume; that is data,
    // not a missing field, so it is kept rather than nulled.
    expect(candles[1].volume).toBe(0);
  });

  it("builds a Frankfurter range request and reads one close per day", () => {
    const url = frankfurterUrl("GBP/USD", 6, new Date(Date.UTC(2026, 0, 15)));
    expect(url).toContain("2020-01-15..2026-01-15");
    expect(url).toContain("base=GBP");
    expect(url).toContain("symbols=USD");
    const candles = parseFrankfurter(
      { base: "GBP", rates: { "2024-01-03": { USD: 1.27 }, "2024-01-02": { USD: 1.26 }, "2024-01-04": { EUR: 1.16 } } },
      "GBP/USD",
    );
    expect(candles).toHaveLength(2);
    expect(candles[0].time).toBeLessThan(candles[1].time);
    // One published rate: it is the open, high, low and close, not a guess.
    expect(candles[0].open).toBe(1.26);
    expect(candles[0].high).toBe(1.26);
    expect(candles[0].volume).toBeNull();
  });

  it("builds a Twelve Data request and sorts its newest-first reply", () => {
    const url = twelveDataUrl("XAU/USD", "4h", 9000, "KEY123");
    expect(url).toContain("symbol=XAU%2FUSD");
    expect(url).toContain("interval=4h");
    expect(url).toContain("outputsize=5000");
    const candles = parseTwelveData({
      values: [
        { datetime: "2024-01-02 12:00:00", open: "2050", high: "2060", low: "2040", close: "2055" },
        { datetime: "2024-01-02 08:00:00", open: "2040", high: "2052", low: "2035", close: "2050" },
      ],
    });
    expect(candles[0].time).toBeLessThan(candles[1].time);
    expect(candles[0].close).toBe(2050);
    expect(() => parseTwelveData({ status: "error", message: "bad key" })).toThrow("bad key");
  });

  it("builds an Alpha Vantage request and treats a quota note as an error", () => {
    expect(alphaVantageUrl("EUR/USD", "1d", "KEY")).toContain("function=FX_DAILY");
    expect(alphaVantageUrl("EUR/USD", "1h", "KEY")).toContain("interval=60min");
    const candles = parseAlphaVantage({
      "Time Series FX (Daily)": {
        "2024-01-02": { "1. open": "1.1040", "2. high": "1.1060", "3. low": "1.1020", "4. close": "1.1050" },
        "2024-01-01": { "1. open": "1.1000", "2. high": "1.1050", "3. low": "1.0990", "4. close": "1.1040" },
      },
    });
    expect(candles).toHaveLength(2);
    expect(candles[0].close).toBe(1.104);
    expect(() => parseAlphaVantage({ Note: "quota" })).toThrow("quota");
  });

  it("reads MetaTrader bars, converts server time to UTC and takes the broker's contract details", () => {
    const response = {
      symbol: "XAUUSD", timeframe: "15m", server_utc_offset: 10_800,
      digits: 2, point: 0.01, contract_size: 100, spread_points: 18, currency_profit: "USD",
      bars: [
        { t: 1_700_010_000, o: 2000, h: 2003, l: 1999, c: 2002, v: 500, s: 18 },
        { t: 1_700_000_100, o: 1998, h: 2001, l: 1997, c: 2000, v: 400, s: 20 },
      ],
    };
    const candles = parseMt5Bars(response);
    // Server time is three hours ahead, so UTC is three hours behind it.
    expect(candles[0].time).toBe((1_700_000_100 - 10_800) * 1000);
    expect(candles[0].time).toBeLessThan(candles[1].time);

    const instrument = mt5Instrument(response);
    expect(instrument.pip).toBe(0.01);
    expect(instrument.contractSize).toBe(100);
    expect(instrument.kind).toBe("metal");
    expect(instrument.typicalSpreadPips).toBeCloseTo(18);

    const series = mt5Series(response, "15m");
    expect(series.instrument?.contractSize).toBe(100);
    expect(series.closeOnly).toBe(false);
    expect(series.liveSpreadPips).toBeCloseTo(18);
  });

  it("turns points into pips the way brokers do", () => {
    expect(pipFromDigits(0.00001, 5)).toBeCloseTo(0.0001);
    expect(pipFromDigits(0.0001, 4)).toBeCloseTo(0.0001);
    expect(pipFromDigits(0.01, 2)).toBeCloseTo(0.01);
    expect(pipFromDigits(0.001, 3)).toBeCloseTo(0.01);
  });

  it("ships a bridge script that is read-only and never trades", () => {
    // The script is handed to people to run on the machine their terminal is
    // logged into, so the absence of any order function is a property worth
    // testing rather than trusting.
    expect(MT5_BRIDGE_SCRIPT).toContain("copy_rates_from_pos");
    expect(MT5_BRIDGE_SCRIPT).toContain("127.0.0.1");
    for (const forbidden of ["order_send", "order_check", "account_info", "positions_get", "history_deals_get"]) {
      expect(MT5_BRIDGE_SCRIPT).not.toContain(forbidden);
    }
  });
});

/* --------------------------------- presets -------------------------------- */

describe("presets", () => {
  it("every preset runs, names what it is bad at, and produces a testable strategy", () => {
    const series = seriesOf(walk(700, 99));
    for (const preset of PRESETS) {
      expect(preset.weakness.length).toBeGreaterThan(30);
      expect(preset.intent.length).toBeGreaterThan(30);
      const engine = weightedEngine(series, preset.params);
      const result = runBacktest(engine, { ...DEFAULT_EXECUTION, ...preset.execution });
      expect(result.metrics.trades).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.metrics.finalBalance)).toBe(true);
    }
  });

  it("offers gold presets, because that is what the tool is built around", () => {
    expect(PRESETS.filter((p) => p.gold).length).toBeGreaterThanOrEqual(3);
  });
});

/* ------------------------------- trade plan ------------------------------- */

describe("trade plan", () => {
  const series = seriesOf(walk(600, 55));
  const ctx = buildContext(series, { ...DEFAULT_PARAMS, minScore: 40, requireHtfAgreement: false });

  it("puts the stop on the losing side and the target on the winning one", () => {
    let planned = 0;
    for (let i = ctx.warmupBars; i < series.candles.length; i += 7) {
      const signal = evaluateAt(ctx, i);
      const plan = buildPlan(signal, series, DEFAULT_EXECUTION, 10_000);
      if (!plan) continue;
      planned += 1;
      if (plan.direction === "long") {
        expect(plan.stop).toBeLessThan(plan.reference);
        expect(plan.target).toBeGreaterThan(plan.reference);
        expect(plan.entryLow).toBeLessThanOrEqual(plan.entryHigh);
        expect(plan.rLevels[1].price).toBeGreaterThan(plan.rLevels[0].price);
      } else {
        expect(plan.stop).toBeGreaterThan(plan.reference);
        expect(plan.target).toBeLessThan(plan.reference);
        expect(plan.rLevels[1].price).toBeLessThan(plan.rLevels[0].price);
      }
      expect(plan.riskReward).toBeCloseTo(DEFAULT_EXECUTION.riskReward, 6);
    }
    expect(planned).toBeGreaterThan(0);
  });

  it("has no plan for a neutral read", () => {
    const strict = buildContext(series, { ...DEFAULT_PARAMS, minScore: 101 });
    const signal = evaluateAt(strict, series.candles.length - 1);
    expect(signal.verdict).toBe("neutral");
    expect(buildPlan(signal, series, DEFAULT_EXECUTION, 10_000)).toBeNull();
  });

  it("uses the same stop the backtester would have used", () => {
    const signal = evaluateAt(ctx, 500);
    const plan = buildPlan(signal, series, { ...DEFAULT_EXECUTION, stopMode: "pips", stopPips: 40 }, 10_000);
    if (!plan) return;
    const instrument = getInstrument(series.instrumentId);
    expect(plan.stopDistance).toBeCloseTo(40 * instrument.pip, 10);
    expect(plan.stopPips).toBeCloseTo(40);
  });
});

/* ------------------------------ DO101 wiring ------------------------------ */

describe("tool registry entry", () => {
  const tool = getTool("trading-analyzer");

  it("is registered, so it reaches the directory, search and sitemap", () => {
    expect(tool).toBeDefined();
    expect(tool!.route).toBe("/tools/trading-analyzer");
    expect(TOOLS.filter((t) => t.route === tool!.route)).toHaveLength(1);
    expect(tool!.browserOnly).toBe(true);
  });

  it("points only at tools that exist", () => {
    for (const id of tool!.related) expect(getTool(id)).toBeDefined();
  });

  it("never promises accuracy, profit or certainty anywhere in its copy", () => {
    // The whole surface a search engine and a visitor read, in one string.
    const copy = [
      tool!.name, tool!.short, tool!.long, tool!.seoTitle, tool!.seoDescription,
      ...tool!.features, ...tool!.steps, ...tool!.faqs.flatMap((f) => [f.q, f.a]),
    ]
      .join(" ")
      .toLowerCase();

    for (const phrase of [
      "guaranteed", "highly accurate", "profitable strategy", "make money",
      "win rate of", "never loses", "sure thing", "risk-free", "proven profits",
    ]) {
      expect(copy).not.toContain(phrase);
    }
  });

  it("says plainly that it is not advice and cannot trade", () => {
    const copy = `${tool!.long} ${tool!.faqs.map((f) => f.a).join(" ")}`.toLowerCase();
    expect(copy).toContain("not financial advice");
    expect(copy).toContain("cannot place a real order");
  });
});

/* -------------------- the execution model, on its own -------------------- */

/**
 * A stand-in strategy that returns exactly the signals a test asks for.
 *
 * The engine seam makes this possible, and it is worth a lot: the fill rules
 * are the part of a backtester most likely to quietly flatter a result, and
 * checking them against a real strategy means hoping it happens to signal on
 * the bar the scenario needs.
 */
function scriptedEngine(
  series: Series,
  script: Record<number, { verdict: "buy" | "sell"; stop?: number; target?: number }>,
): SignalEngine {
  return {
    id: "scripted",
    label: "Scripted",
    series,
    candles: series.candles,
    warmupBars: 0,
    evaluateAt: (index): Signal => {
      const entry = script[index];
      const bar = series.candles[index];
      return {
        index,
        time: bar.time,
        verdict: entry?.verdict ?? "neutral",
        score: entry ? 100 : 0,
        scoreMeaning: "scripted",
        bullishWeight: 0,
        bearishWeight: 0,
        totalWeight: 1,
        rules: [],
        cautions: [],
        invalidations: [],
        close: bar.close,
        atr: 1,
        trend: { trend: "range", detail: "", lastHigh: null, lastLow: null, invalidationLong: null, invalidationShort: null },
        levels: [],
        stopHint: entry?.stop ?? null,
        targetHint: entry?.target ?? null,
      };
    },
  };
}

const flat = (count: number, price = 100): Candle[] =>
  Array.from({ length: count }, (_, i) => ({
    time: i * HOUR, open: price, high: price + 1, low: price - 1, close: price, volume: 100,
  }));

describe("execution model", () => {
  // 1000 pips on gold is 10.00, so a stop sits at 90 and a 2R target at 120.
  const pipStop = { ...DEFAULT_EXECUTION, stopMode: "pips" as const, stopPips: 1000, targetMode: "rr" as const, riskReward: 2, spreadPips: 0, slippagePips: 0 };

  it("fills at the open of the bar after the signal", () => {
    const candles = flat(10);
    candles[2].open = 104;
    const series = seriesOf(candles);
    const result = runBacktest(scriptedEngine(series, { 1: { verdict: "buy" } }), pipStop);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].entryIndex).toBe(2);
    expect(result.trades[0].entryPrice).toBeCloseTo(104);
  });

  it("takes the stop when one bar contains both the stop and the target", () => {
    const candles = flat(10);
    // The bar after entry covers 70 to 130 — both levels, in an unknowable order.
    candles[3] = { time: 3 * HOUR, open: 100, high: 130, low: 70, close: 100, volume: 100 };
    const series = seriesOf(candles);
    const result = runBacktest(scriptedEngine(series, { 1: { verdict: "buy" } }), pipStop);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("stop");
    expect(result.trades[0].exitPrice).toBeCloseTo(90);
    expect(result.trades[0].pnl).toBeLessThan(0);
  });

  it("fills a gap through the stop at the open, not at the stop", () => {
    const candles = flat(10);
    candles[3] = { time: 3 * HOUR, open: 80, high: 85, low: 78, close: 82, volume: 100 };
    const series = seriesOf(candles);
    const result = runBacktest(scriptedEngine(series, { 1: { verdict: "buy" } }), pipStop);
    const trade = result.trades[0];
    expect(trade.exitReason).toBe("stop");
    expect(trade.exitPrice).toBeCloseTo(80);
    // Worse than the planned loss, which is the whole point of modelling gaps.
    expect(trade.pnl).toBeLessThan(-trade.plannedRisk);
  });

  it("charges half the spread on the way in and half on the way out", () => {
    const candles = flat(10);
    candles[3] = { time: 3 * HOUR, open: 100, high: 130, low: 99, close: 129, volume: 100 };
    const series = seriesOf(candles);
    // 100 pips of gold is 1.00, so half a spread is 0.50 on each side.
    const result = runBacktest(scriptedEngine(series, { 1: { verdict: "buy" } }), { ...pipStop, spreadPips: 100 });
    const trade = result.trades[0];
    expect(trade.entryPrice).toBeCloseTo(100.5);
    expect(trade.exitReason).toBe("target");
    // The target is measured from the entry, and the fill gives back the rest.
    expect(trade.exitPrice).toBeCloseTo(trade.target - 0.5);
    expect(trade.pnl).toBeGreaterThan(0);
  });

  it("mirrors all of that for a short", () => {
    const candles = flat(10);
    candles[3] = { time: 3 * HOUR, open: 100, high: 130, low: 70, close: 100, volume: 100 };
    const series = seriesOf(candles);
    const result = runBacktest(scriptedEngine(series, { 1: { verdict: "sell" } }), pipStop);
    const trade = result.trades[0];
    expect(trade.direction).toBe("short");
    expect(trade.stop).toBeCloseTo(110);
    expect(trade.exitReason).toBe("stop");
    expect(trade.pnl).toBeLessThan(0);
  });

  it("closes what is still open at the end and says so", () => {
    const series = seriesOf(flat(8));
    const result = runBacktest(scriptedEngine(series, { 1: { verdict: "buy" } }), pipStop);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("end of data");
    expect(result.trades[0].exitIndex).toBe(7);
  });

  it("uses the strategy's own stop and target when asked to", () => {
    const candles = flat(6);
    const series = seriesOf(candles);
    const result = runBacktest(
      scriptedEngine(series, { 1: { verdict: "buy", stop: 95, target: 115 } }),
      { ...pipStop, stopMode: "signal" },
    );
    const trade = result.trades[0];
    expect(trade.stop).toBeCloseTo(95);
    expect(trade.target).toBeCloseTo(115);
  });

  it("falls back to ATR when a strategy offers no stop of its own", () => {
    const series = seriesOf(flat(6));
    const result = runBacktest(
      scriptedEngine(series, { 1: { verdict: "buy" } }),
      { ...pipStop, stopMode: "signal", atrMultiple: 3 },
    );
    // The scripted signal reports an ATR of 1, so the stop is three away.
    expect(result.trades[0].stop).toBeCloseTo(97);
  });

  it("never opens a second position while one is open", () => {
    const series = seriesOf(flat(12));
    const result = runBacktest(
      scriptedEngine(series, { 1: { verdict: "buy" }, 3: { verdict: "buy" }, 5: { verdict: "buy" } }),
      pipStop,
    );
    expect(result.trades).toHaveLength(1);
  });
});

/* ------------------------- Deep Smart Money engine ------------------------ */

describe("Deep Smart Money", () => {
  /** A long uphill grind with dips, so crossings and sweeps both occur. */
  const series = seriesOf(walk(2500, 41, 2000, 0.35));

  it("fires only when every filter passes and a trigger goes off", () => {
    const engine = smartMoneyEngine(series, DEFAULT_SMART_MONEY);
    let fired = 0;
    for (let i = 0; i < series.candles.length; i++) {
      const signal = engine.evaluateAt(i);
      if (signal.verdict === "neutral") continue;
      fired += 1;
      expect(signal.score).toBe(100);
      const filters = signal.rules.filter((r) => r.kind === "filter");
      const triggers = signal.rules.filter((r) => r.kind === "trigger");
      expect(filters.length).toBe(6);
      expect(filters.every((r) => r.passed)).toBe(true);
      expect(triggers.some((r) => r.passed)).toBe(true);
    }
    expect(fired).toBeGreaterThan(0);
  });

  it("reads the same whether or not the future exists", () => {
    const engine = smartMoneyEngine(series, DEFAULT_SMART_MONEY);
    for (const i of [800, 1400, 2100]) {
      const truncated = smartMoneyEngine(seriesOf(series.candles.slice(0, i + 1)), DEFAULT_SMART_MONEY);
      expect(truncated.evaluateAt(i).verdict).toBe(engine.evaluateAt(i).verdict);
      expect(truncated.evaluateAt(i).score).toBe(engine.evaluateAt(i).score);
    }
  });

  it("keeps the cooldown between signals on the same side", () => {
    const cooldown = 40;
    const engine = smartMoneyEngine(series, { ...DEFAULT_SMART_MONEY, cooldownBars: cooldown });
    let lastBuy = -Infinity;
    let lastSell = -Infinity;
    for (let i = 0; i < series.candles.length; i++) {
      const signal = engine.evaluateAt(i);
      if (signal.verdict === "buy") {
        expect(i - lastBuy).toBeGreaterThan(cooldown);
        lastBuy = i;
      }
      if (signal.verdict === "sell") {
        expect(i - lastSell).toBeGreaterThan(cooldown);
        lastSell = i;
      }
    }
  });

  it("stays silent through the warm-up", () => {
    const engine = smartMoneyEngine(series, DEFAULT_SMART_MONEY);
    for (let i = 0; i < engine.warmupBars; i++) {
      expect(engine.evaluateAt(i).verdict).toBe("neutral");
    }
  });

  it("sets its own stop on the losing side, with the target a multiple of it", () => {
    const engine = smartMoneyEngine(series, { ...DEFAULT_SMART_MONEY, rr: 2.5 });
    let checked = 0;
    for (let i = 0; i < series.candles.length; i++) {
      const signal = engine.evaluateAt(i);
      if (signal.verdict === "neutral" || signal.stopHint === null || signal.stopHint === undefined) continue;
      checked += 1;
      const risk = Math.abs(signal.close - signal.stopHint);
      const reward = Math.abs((signal.targetHint as number) - signal.close);
      expect(reward / risk).toBeCloseTo(2.5, 6);
      if (signal.verdict === "buy") expect(signal.stopHint).toBeLessThan(signal.close);
      else expect(signal.stopHint).toBeGreaterThan(signal.close);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("applies the minimum-stop floor and says when it did", () => {
    const engine = smartMoneyEngine(series, { ...DEFAULT_SMART_MONEY, minStopAtr: 3 });
    let floored = 0;
    for (let i = 0; i < series.candles.length; i++) {
      const signal = engine.evaluateAt(i);
      if (signal.verdict === "neutral" || signal.stopHint === null || signal.stopHint === undefined) continue;
      const risk = Math.abs(signal.close - signal.stopHint);
      expect(risk).toBeGreaterThanOrEqual((signal.atr as number) * 3 - 1e-9);
      if (signal.cautions.some((c) => c.includes("floor"))) floored += 1;
    }
    expect(floored).toBeGreaterThan(0);
  });

  it("says out loud when the volume filter cannot run", () => {
    const noVolume = seriesOf(series.candles.map((c) => ({ ...c, volume: null })));
    const engine = smartMoneyEngine(noVolume, DEFAULT_SMART_MONEY);
    const signal = engine.evaluateAt(noVolume.candles.length - 1);
    expect(signal.cautions.join(" ")).toContain("publishes no volume");
    const volumeRule = signal.rules.find((r) => r.id === "volume");
    expect(volumeRule?.detail).toContain("cannot run");
  });

  it("reports a passed filter as passed, whichever side it is reading", () => {
    // The bug this guards against: a sell-side filter that passed was shown as
    // "pointing the other way", because the panel read its vote as a bearish vote
    // against a neutral verdict.
    const engine = smartMoneyEngine(series, DEFAULT_SMART_MONEY);
    for (let i = engine.warmupBars; i < series.candles.length; i += 11) {
      const signal = engine.evaluateAt(i);
      expect(signal.readingSide).toBeDefined();
      const met = signal.rules.filter((r) => r.kind === "filter" && r.passed).length
        + (signal.rules.some((r) => r.kind === "trigger" && r.passed) ? 1 : 0);
      // The tile, the score and the rules all describe the same count.
      expect(Math.max(signal.bullishWeight, signal.bearishWeight)).toBe(met);
      if (signal.verdict === "neutral") expect(signal.score).toBe(Math.round((met / 7) * 100));
    }
  });

  it("turning every trigger off makes it silent", () => {
    const engine = smartMoneyEngine(series, {
      ...DEFAULT_SMART_MONEY,
      triggers: { smartMoney: false, emaCross: false, boxBreakout: false, stopHunt: false },
    });
    for (let i = 0; i < series.candles.length; i += 7) {
      expect(engine.evaluateAt(i).verdict).toBe("neutral");
    }
  });

  it("backtests through the same engine seam as everything else", () => {
    const engine = smartMoneyEngine(series, DEFAULT_SMART_MONEY);
    const result = runBacktest(engine, { ...DEFAULT_EXECUTION, stopMode: "signal", spreadPips: 30 });
    expect(Number.isFinite(result.metrics.finalBalance)).toBe(true);
    for (const trade of result.trades) {
      expect(trade.entryIndex).toBeGreaterThan(engine.warmupBars);
      expect(trade.plannedRisk).toBeGreaterThan(0);
    }
  });

  it("is reachable through the engine registry, and every engine explains its own score", () => {
    for (const id of ["weighted", "smart-money"] as const) {
      const engine = makeEngine(series, { ...DEFAULT_ENGINE_SETTINGS, engine: id });
      expect(engine.id).toBe(id);
      const signal = engine.evaluateAt(series.candles.length - 1);
      expect(signal.scoreMeaning.length).toBeGreaterThan(40);
      // No engine may describe its number as a chance of the trade working.
      expect(signal.scoreMeaning.toLowerCase()).not.toContain("probability of winning");
      expect(ENGINE_META[id].caveat.length).toBeGreaterThan(30);
    }
  });

  it("names all four triggers", () => {
    expect(Object.keys(TRIGGER_LABELS)).toHaveLength(4);
  });
});
