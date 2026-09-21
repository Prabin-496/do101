/**
 * The backtester.
 *
 * The rules of the simulation, all of which exist to stop it flattering
 * itself:
 *
 *  1. A signal is read at the *close* of a bar and filled at the *open of the
 *     next one*. Filling at the close of the bar that produced the signal is
 *     the most common way a backtest invents money that was never available.
 *  2. Within a bar, only the open, high, low and close are known — not the
 *     order the high and the low happened in. When a bar contains both the
 *     stop and the target, the stop is taken. That is pessimistic on purpose.
 *  3. Gaps fill at the open, not at the level. A market that opens through a
 *     stop fills below it.
 *  4. Every trade pays half the spread on entry and half on exit, plus any
 *     commission and slippage set. Costs are reported separately so it is
 *     obvious how much of the result they ate.
 *  5. Close-only data cannot test a stop honestly, so on such a series the
 *     engine only checks levels at the close and says so in the result.
 */

import { computeMetrics, emptyMetrics, type EquityPoint, type Metrics } from "./metrics";
import { sizePosition, type SizingResult } from "./risk";
import type { Signal, SignalEngine } from "./strategy";
import { instrumentOf, type Direction, type Instrument } from "./types";

export type StopMode = "atr" | "pips" | "swing" | "signal";
export type TargetMode = "rr" | "atr" | "pips";
export type ExitReason = "stop" | "target" | "opposite signal" | "time limit" | "end of data";

export interface ExecutionConfig {
  initialBalance: number;
  riskPercent: number;
  stopMode: StopMode;
  atrMultiple: number;
  stopPips: number;
  targetMode: TargetMode;
  riskReward: number;
  targetAtrMultiple: number;
  targetPips: number;
  /** Spread assumption in pips. Half is charged on entry, half on exit. */
  spreadPips: number;
  /** Round-turn commission per standard lot, in the account currency. */
  commissionPerLot: number;
  slippagePips: number;
  leverage: number;
  allowLong: boolean;
  allowShort: boolean;
  exitOnOppositeSignal: boolean;
  /** 0 means hold until the stop, the target or the end of the data. */
  maxBarsInTrade: number;
  quoteToAccountRate: number;
  roundLots: boolean;
}

export const DEFAULT_EXECUTION: ExecutionConfig = {
  initialBalance: 10_000,
  riskPercent: 1,
  stopMode: "atr",
  atrMultiple: 2,
  stopPips: 30,
  targetMode: "rr",
  riskReward: 2,
  targetAtrMultiple: 4,
  targetPips: 60,
  spreadPips: 1,
  commissionPerLot: 0,
  slippagePips: 0,
  leverage: 30,
  allowLong: true,
  allowShort: true,
  exitOnOppositeSignal: true,
  maxBarsInTrade: 0,
  quoteToAccountRate: 1,
  roundLots: true,
};

export interface Trade {
  id: number;
  direction: Direction;
  entryIndex: number;
  entryTime: number;
  entryPrice: number;
  exitIndex: number;
  exitTime: number;
  exitPrice: number;
  stop: number;
  target: number;
  units: number;
  lots: number;
  /** What the stop was planned to cost, in the account currency. */
  plannedRisk: number;
  grossPnl: number;
  costs: number;
  pnl: number;
  /** Result measured in units of the risk taken. */
  rMultiple: number;
  exitReason: ExitReason;
  barsHeld: number;
  balanceAfter: number;
  scoreAtEntry: number;
  reasons: string[];
}

export interface SkippedTrade {
  index: number;
  time: number;
  reason: string;
}

export interface BacktestResult {
  trades: Trade[];
  skipped: SkippedTrade[];
  equity: EquityPoint[];
  metrics: Metrics;
  /** Index range actually simulated. */
  from: number;
  to: number;
  fromTime: number;
  toTime: number;
  barsTested: number;
  /** Warnings that belong with the numbers, shown next to them. */
  warnings: string[];
}

export function runBacktest(
  engine: SignalEngine,
  config: ExecutionConfig,
  range?: { from?: number; to?: number },
): BacktestResult {
  const candles = engine.candles;
  const instrument = instrumentOf(engine.series);
  const warnings: string[] = [];

  // Nothing before the warm-up can be traded honestly: the indicators are
  // still settling, so any "signal" there is an artefact of the seeding.
  const from = Math.max(range?.from ?? 0, engine.warmupBars);
  const to = Math.min(range?.to ?? candles.length - 1, candles.length - 1);

  if (to - from < 5) {
    return {
      trades: [], skipped: [], equity: [],
      metrics: emptyMetrics(config.initialBalance),
      from, to,
      fromTime: candles[from]?.time ?? 0,
      toTime: candles[to]?.time ?? 0,
      barsTested: 0,
      warnings: ["Not enough bars in this range to test anything. Load more history or widen the dates."],
    };
  }

  if (engine.series.closeOnly) {
    warnings.push(
      "This series has closing prices only, so the engine can only check stops and targets at each close. A real stop sits inside the bar, so these results are not a fair test of one — import OHLC data for that.",
    );
  }

  const halfSpread = (config.spreadPips * instrument.pip) / 2;
  const slippage = config.slippagePips * instrument.pip;

  const trades: Trade[] = [];
  const skipped: SkippedTrade[] = [];
  const equity: EquityPoint[] = [];

  let balance = config.initialBalance;
  let position: OpenPosition | null = null;
  let pending: { direction: Direction; signal: Signal } | null = null;
  let nextId = 1;

  for (let i = from; i <= to; i++) {
    const bar = candles[i];

    /* ------------------- 1. fill anything queued last bar ------------------- */

    if (!position && pending) {
      const opened = open(pending, bar, i);
      if (opened) position = opened;
      pending = null;
    } else {
      pending = null;
    }

    /* --------------------------- 2. manage the trade ------------------------ */

    if (position) {
      const exit = findExit(position, bar, i);
      if (exit) {
        const trade = close(position, exit.price, exit.reason, i, bar.time);
        trades.push(trade);
        balance = trade.balanceAfter;
        position = null;
      }
    }

    /* ------------------------- 3. mark the account ------------------------- */

    const unrealised = position ? pnlOf(position, bar.close) : 0;
    equity.push({ time: bar.time, equity: balance + unrealised, balance, drawdown: 0 });

    /* ---------------------- 4. read the next bar's order -------------------- */

    if (i < to) {
      const signal = engine.evaluateAt(i);
      if (position) {
        if (
          config.exitOnOppositeSignal &&
          signal.verdict !== "neutral" &&
          ((position.direction === "long" && signal.verdict === "sell") ||
            (position.direction === "short" && signal.verdict === "buy"))
        ) {
          // Flattened at the next open, like any other order.
          const nextBar = candles[i + 1];
          const price = position.direction === "long"
            ? nextBar.open - halfSpread - slippage
            : nextBar.open + halfSpread + slippage;
          const trade = close(position, price, "opposite signal", i + 1, nextBar.time);
          trades.push(trade);
          balance = trade.balanceAfter;
          position = null;
        }
      } else if (signal.verdict !== "neutral") {
        const direction: Direction = signal.verdict === "buy" ? "long" : "short";
        const allowed = direction === "long" ? config.allowLong : config.allowShort;
        if (allowed) pending = { direction, signal };
      }
    }
  }

  // An open position at the end is closed at the last close, and labelled, so
  // it never masquerades as a winner that was never realised.
  if (position) {
    const last = candles[to];
    const trade = close(position, last.close, "end of data", to, last.time);
    trades.push(trade);
    balance = trade.balanceAfter;
    if (equity.length) equity[equity.length - 1] = { ...equity[equity.length - 1], balance, equity: balance };
  }

  if (trades.length > 0 && trades.length < 30) {
    warnings.push(
      `Only ${trades.length} trade${trades.length === 1 ? "" : "s"} in this run. Under about thirty, the statistics are describing luck as much as the rules.`,
    );
  }
  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length} signal${skipped.length === 1 ? " was" : "s were"} skipped because the position size fell below the minimum lot — a real account of this size could not have taken them at this risk setting.`,
    );
  }

  return {
    trades,
    skipped,
    equity,
    metrics: computeMetrics(trades, equity, config.initialBalance, to - from + 1),
    from,
    to,
    fromTime: candles[from].time,
    toTime: candles[to].time,
    barsTested: to - from + 1,
    warnings,
  };

  /* ------------------------------ local helpers ----------------------------- */

  function open(
    order: { direction: Direction; signal: Signal },
    bar: { open: number; time: number },
    index: number,
  ): OpenPosition | null {
    const isLong = order.direction === "long";
    const entry = isLong ? bar.open + halfSpread + slippage : bar.open - halfSpread - slippage;
    const stopDistance = stopDistanceFor(order.signal, entry, instrument, config);
    if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
      skipped.push({ index, time: bar.time, reason: "No usable stop distance on this bar." });
      return null;
    }

    const stop = isLong ? entry - stopDistance : entry + stopDistance;
    const targetDistance = targetDistanceFor(order.signal, stopDistance, instrument, config);
    const target = isLong ? entry + targetDistance : entry - targetDistance;

    const sizing = sizePosition({
      balance,
      riskPercent: config.riskPercent,
      entry,
      stop,
      instrument,
      leverage: config.leverage,
      quoteToAccountRate: config.quoteToAccountRate,
      roundLots: config.roundLots,
      minLot: 0.01,
      lotStep: 0.01,
    });

    if (sizing.units <= 0) {
      skipped.push({
        index,
        time: bar.time,
        reason: sizing.note || "Position size rounded to zero.",
      });
      return null;
    }

    return {
      direction: order.direction,
      entryIndex: index,
      entryTime: bar.time,
      entryPrice: entry,
      stop,
      target,
      sizing,
      signal: order.signal,
    };
  }

  function findExit(pos: OpenPosition, bar: (typeof candles)[number], index: number): { price: number; reason: ExitReason } | null {
    const isLong = pos.direction === "long";

    if (engine.series.closeOnly) {
      // Only the close exists, so only the close can trigger anything.
      if (isLong ? bar.close <= pos.stop : bar.close >= pos.stop) return { price: bar.close, reason: "stop" };
      if (isLong ? bar.close >= pos.target : bar.close <= pos.target) return { price: bar.close, reason: "target" };
    } else {
      // A gap through a level fills at the open, not at the level.
      if (isLong ? bar.open <= pos.stop : bar.open >= pos.stop) return { price: bar.open, reason: "stop" };
      if (isLong ? bar.open >= pos.target : bar.open <= pos.target) return { price: bar.open, reason: "target" };

      const stopHit = isLong ? bar.low <= pos.stop : bar.high >= pos.stop;
      const targetHit = isLong ? bar.high >= pos.target : bar.low <= pos.target;
      // Both inside one bar: the order is unknowable, so assume the worse one.
      if (stopHit) return { price: pos.stop, reason: "stop" };
      if (targetHit) return { price: pos.target, reason: "target" };
    }

    if (config.maxBarsInTrade > 0 && index - pos.entryIndex >= config.maxBarsInTrade) {
      return { price: bar.close, reason: "time limit" };
    }
    return null;
  }

  function pnlOf(pos: OpenPosition, price: number): number {
    const move = pos.direction === "long" ? price - pos.entryPrice : pos.entryPrice - price;
    return move * pos.sizing.units * config.quoteToAccountRate;
  }

  function close(pos: OpenPosition, rawExit: number, reason: ExitReason, index: number, time: number): Trade {
    // The exit pays the other half of the spread, whichever side it is on.
    const exitPrice = pos.direction === "long" ? rawExit - halfSpread : rawExit + halfSpread;
    const gross = pnlOf(pos, exitPrice);
    const commission = config.commissionPerLot * pos.sizing.lots;
    const net = gross - commission;
    const newBalance = balance + net;

    return {
      id: nextId++,
      direction: pos.direction,
      entryIndex: pos.entryIndex,
      entryTime: pos.entryTime,
      entryPrice: pos.entryPrice,
      exitIndex: index,
      exitTime: time,
      exitPrice,
      stop: pos.stop,
      target: pos.target,
      units: pos.sizing.units,
      lots: pos.sizing.lots,
      plannedRisk: pos.sizing.actualRisk,
      grossPnl: gross,
      // The spread is already inside `gross`; commission is the separate part.
      costs: commission + pos.sizing.units * config.spreadPips * instrument.pip * config.quoteToAccountRate,
      pnl: net,
      rMultiple: pos.sizing.actualRisk > 0 ? net / pos.sizing.actualRisk : 0,
      exitReason: reason,
      barsHeld: index - pos.entryIndex,
      balanceAfter: newBalance,
      scoreAtEntry: pos.signal.score,
      reasons: pos.signal.rules
        .filter((r) => (pos.direction === "long" ? r.vote === 1 : r.vote === -1))
        .map((r) => `${r.label}: ${r.detail}`),
    };
  }
}

interface OpenPosition {
  direction: Direction;
  entryIndex: number;
  entryTime: number;
  entryPrice: number;
  stop: number;
  target: number;
  sizing: SizingResult;
  signal: Signal;
}

export function stopDistanceFor(
  signal: Signal,
  entry: number,
  instrument: Instrument,
  config: ExecutionConfig,
): number {
  // Some strategies set their own stop as part of their rules. Overriding it
  // with an ATR multiple would be testing a different strategy.
  if (config.stopMode === "signal") {
    if (signal.stopHint !== null && signal.stopHint !== undefined) {
      const distance = Math.abs(entry - signal.stopHint);
      if (distance > instrument.pip) return distance;
    }
    return (signal.atr ?? config.stopPips * instrument.pip) * config.atrMultiple;
  }
  if (config.stopMode === "pips") return config.stopPips * instrument.pip;
  if (config.stopMode === "swing") {
    const level = signal.verdict === "sell" ? signal.trend.invalidationShort : signal.trend.invalidationLong;
    if (level !== null) {
      const distance = Math.abs(entry - level);
      // A swing that is already behind price gives a zero-width stop; fall
      // back to ATR rather than sizing a position against nothing.
      if (distance > instrument.pip) return distance;
    }
    return (signal.atr ?? config.stopPips * instrument.pip) * config.atrMultiple;
  }
  return (signal.atr ?? config.stopPips * instrument.pip) * config.atrMultiple;
}

export function targetDistanceFor(
  signal: Signal,
  stopDistance: number,
  instrument: Instrument,
  config: ExecutionConfig,
): number {
  if (config.stopMode === "signal" && signal.targetHint !== null && signal.targetHint !== undefined) {
    const distance = Math.abs(signal.targetHint - signal.close);
    if (distance > instrument.pip) return distance;
  }
  if (config.targetMode === "pips") return config.targetPips * instrument.pip;
  if (config.targetMode === "atr") return (signal.atr ?? stopDistance) * config.targetAtrMultiple;
  return stopDistance * config.riskReward;
}
