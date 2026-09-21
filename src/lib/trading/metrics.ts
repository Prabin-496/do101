/**
 * Performance statistics for a finished run.
 *
 * Deliberately includes the unflattering ones. A win rate on its own says
 * almost nothing — 80% wins with an average loss four times the average win is
 * a losing system — so win rate, profit factor, expectancy and drawdown are
 * always reported together.
 */

import type { Trade } from "./backtest";

export interface EquityPoint {
  time: number;
  /** Balance plus any open position marked to the close. */
  equity: number;
  /** Realised balance only. */
  balance: number;
  /** Drawdown from the running peak, as a fraction. */
  drawdown: number;
}

export interface Metrics {
  trades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  netProfit: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  /** Average profit per trade in account currency. */
  expectancy: number;
  /** Average outcome measured in units of the risk taken. The honest one. */
  expectancyR: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  longestDrawdownBars: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  /**
   * Mean R divided by the standard deviation of R, scaled by the square root
   * of the trade count. Sharpe-*like*: it is computed per trade rather than
   * per year, so it compares runs with each other and nothing else.
   */
  riskAdjusted: number | null;
  averageBarsHeld: number;
  totalCosts: number;
  finalBalance: number;
  exposure: number;
}

export function emptyMetrics(initialBalance: number): Metrics {
  return {
    trades: 0, wins: 0, losses: 0, breakEven: 0, winRate: 0,
    netProfit: 0, netProfitPercent: 0, grossProfit: 0, grossLoss: 0,
    profitFactor: null, averageWin: 0, averageLoss: 0, largestWin: 0, largestLoss: 0,
    expectancy: 0, expectancyR: 0, maxDrawdown: 0, maxDrawdownPercent: 0,
    longestDrawdownBars: 0, maxConsecutiveWins: 0, maxConsecutiveLosses: 0,
    riskAdjusted: null, averageBarsHeld: 0, totalCosts: 0,
    finalBalance: initialBalance, exposure: 0,
  };
}

export function computeMetrics(
  trades: Trade[],
  equity: EquityPoint[],
  initialBalance: number,
  barsInRun: number,
): Metrics {
  if (trades.length === 0) {
    const drawdowns = drawdownStats(equity);
    return { ...emptyMetrics(initialBalance), ...drawdowns, finalBalance: equity.at(-1)?.balance ?? initialBalance };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const breakEven = trades.length - wins.length - losses.length;

  const grossProfit = sum(wins.map((t) => t.pnl));
  const grossLoss = Math.abs(sum(losses.map((t) => t.pnl)));
  const netProfit = sum(trades.map((t) => t.pnl));

  const rs = trades.map((t) => t.rMultiple);
  const meanR = average(rs);
  const sd = standardDeviation(rs);

  let streakWin = 0;
  let streakLoss = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  for (const t of trades) {
    if (t.pnl > 0) {
      streakWin += 1;
      streakLoss = 0;
    } else if (t.pnl < 0) {
      streakLoss += 1;
      streakWin = 0;
    }
    bestWinStreak = Math.max(bestWinStreak, streakWin);
    worstLossStreak = Math.max(worstLossStreak, streakLoss);
  }

  const { maxDrawdown, maxDrawdownPercent, longestDrawdownBars } = drawdownStats(equity);
  const barsHeld = sum(trades.map((t) => t.barsHeld));

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakEven,
    winRate: (wins.length / trades.length) * 100,
    netProfit,
    netProfitPercent: initialBalance > 0 ? (netProfit / initialBalance) * 100 : 0,
    grossProfit,
    grossLoss,
    // No losing trades means the ratio is undefined, not infinite-and-therefore-great.
    profitFactor: grossLoss === 0 ? null : grossProfit / grossLoss,
    averageWin: wins.length ? grossProfit / wins.length : 0,
    averageLoss: losses.length ? grossLoss / losses.length : 0,
    largestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0,
    expectancy: netProfit / trades.length,
    expectancyR: meanR,
    maxDrawdown,
    maxDrawdownPercent,
    longestDrawdownBars,
    maxConsecutiveWins: bestWinStreak,
    maxConsecutiveLosses: worstLossStreak,
    riskAdjusted: sd === 0 ? null : (meanR / sd) * Math.sqrt(trades.length),
    averageBarsHeld: barsHeld / trades.length,
    totalCosts: sum(trades.map((t) => t.costs)),
    finalBalance: equity.at(-1)?.balance ?? initialBalance + netProfit,
    exposure: barsInRun > 0 ? (barsHeld / barsInRun) * 100 : 0,
  };
}

function drawdownStats(equity: EquityPoint[]): Pick<Metrics, "maxDrawdown" | "maxDrawdownPercent" | "longestDrawdownBars"> {
  let peak = equity[0]?.equity ?? 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let barsUnderwater = 0;
  let longest = 0;

  for (const point of equity) {
    if (point.equity >= peak) {
      peak = point.equity;
      barsUnderwater = 0;
    } else {
      barsUnderwater += 1;
      longest = Math.max(longest, barsUnderwater);
      const drop = peak - point.equity;
      if (drop > maxDrawdown) maxDrawdown = drop;
      if (peak > 0) maxDrawdownPercent = Math.max(maxDrawdownPercent, (drop / peak) * 100);
    }
  }
  return { maxDrawdown, maxDrawdownPercent, longestDrawdownBars: longest };
}

/** Running peak-to-trough series, used by the equity chart's shading. */
export function drawdownSeries(equity: EquityPoint[]): number[] {
  let peak = equity[0]?.equity ?? 0;
  return equity.map((p) => {
    peak = Math.max(peak, p.equity);
    return peak > 0 ? (peak - p.equity) / peak : 0;
  });
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = sum(values.map((v) => (v - mean) ** 2)) / (values.length - 1);
  return Math.sqrt(variance);
}
