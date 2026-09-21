/**
 * The paper account.
 *
 * Simulated only. There is no broker connection anywhere in TradeLens, no
 * order ever leaves the page, and there is no code path that could place one:
 * an account here is a number and a list, kept in this browser's local storage.
 *
 * Positions are marked against the last price of the loaded series, so the
 * account is exactly as live as the chart is. Stops and targets are checked
 * against each new bar as it arrives, using the same pessimistic rule the
 * backtester uses — if a bar contains both, the stop wins.
 */

import { computeMetrics, type EquityPoint, type Metrics } from "./metrics";
import type { Trade } from "./backtest";
import { instrumentOf, type Candle, type Direction, type Series } from "./types";

export interface PaperPosition {
  id: string;
  symbol: string;
  instrumentId: string;
  direction: Direction;
  entryPrice: number;
  stop: number;
  target: number;
  units: number;
  lots: number;
  /** What the stop was planned to cost when the position was opened. */
  plannedRisk: number;
  openedAt: number;
  /** Bar time of the entry, so a re-opened tab does not re-check old bars. */
  openedBarTime: number;
  note: string;
  quoteToAccountRate: number;
}

export interface PaperClosed extends PaperPosition {
  exitPrice: number;
  closedAt: number;
  pnl: number;
  rMultiple: number;
  reason: "stop" | "target" | "closed by hand";
}

export interface PaperAccount {
  startingBalance: number;
  balance: number;
  positions: PaperPosition[];
  history: PaperClosed[];
  createdAt: number;
}

export function createAccount(startingBalance = 10_000): PaperAccount {
  return { startingBalance, balance: startingBalance, positions: [], history: [], createdAt: Date.now() };
}

export function openPosition(account: PaperAccount, position: Omit<PaperPosition, "id" | "openedAt">): PaperAccount {
  return {
    ...account,
    positions: [
      ...account.positions,
      { ...position, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, openedAt: Date.now() },
    ],
  };
}

export function unrealised(position: PaperPosition, price: number): number {
  const move = position.direction === "long" ? price - position.entryPrice : position.entryPrice - price;
  return move * position.units * position.quoteToAccountRate;
}

export function closePosition(
  account: PaperAccount,
  id: string,
  price: number,
  reason: PaperClosed["reason"],
  at = Date.now(),
): PaperAccount {
  const position = account.positions.find((p) => p.id === id);
  if (!position) return account;
  const pnl = unrealised(position, price);
  const closed: PaperClosed = {
    ...position,
    exitPrice: price,
    closedAt: at,
    pnl,
    rMultiple: position.plannedRisk > 0 ? pnl / position.plannedRisk : 0,
    reason,
  };
  return {
    ...account,
    balance: account.balance + pnl,
    positions: account.positions.filter((p) => p.id !== id),
    history: [closed, ...account.history],
  };
}

/**
 * Walks any bars that have appeared since a position was opened and closes it
 * if one of them touched the stop or the target.
 *
 * Only bars that closed *after* the entry are considered: filling from the bar
 * the position was opened in would let an entry be stopped out by price action
 * that had already happened.
 */
export function settleAgainst(account: PaperAccount, series: Series, candles: Candle[]): {
  account: PaperAccount;
  closed: PaperClosed[];
} {
  let next = account;
  const closed: PaperClosed[] = [];

  for (const position of account.positions) {
    if (position.symbol !== series.symbol) continue;
    const isLong = position.direction === "long";
    const fresh = candles.filter((c) => c.time > position.openedBarTime);

    for (const bar of fresh) {
      const stopHit = series.closeOnly
        ? isLong ? bar.close <= position.stop : bar.close >= position.stop
        : isLong ? bar.low <= position.stop : bar.high >= position.stop;
      const targetHit = series.closeOnly
        ? isLong ? bar.close >= position.target : bar.close <= position.target
        : isLong ? bar.high >= position.target : bar.low <= position.target;

      // Same pessimism as the backtester: within one bar, the stop wins.
      if (stopHit) {
        next = closePosition(next, position.id, position.stop, "stop", bar.time);
        const justClosed = next.history[0];
        if (justClosed) closed.push(justClosed);
        break;
      }
      if (targetHit) {
        next = closePosition(next, position.id, position.target, "target", bar.time);
        const justClosed = next.history[0];
        if (justClosed) closed.push(justClosed);
        break;
      }
    }
  }
  return { account: next, closed };
}

export function equityOf(account: PaperAccount, prices: Record<string, number>): number {
  return account.positions.reduce(
    (total, position) => total + (prices[position.symbol] !== undefined ? unrealised(position, prices[position.symbol]) : 0),
    account.balance,
  );
}

/**
 * The same statistics the backtester reports, computed over the paper history,
 * so a simulated run and a backtest can be compared like for like.
 */
export function paperMetrics(account: PaperAccount): Metrics {
  const ordered = [...account.history].sort((a, b) => a.closedAt - b.closedAt);
  let running = account.startingBalance;
  const equity: EquityPoint[] = [
    { time: account.createdAt, equity: running, balance: running, drawdown: 0 },
  ];
  const trades: Trade[] = ordered.map((closedTrade, index) => {
    running += closedTrade.pnl;
    equity.push({ time: closedTrade.closedAt, equity: running, balance: running, drawdown: 0 });
    return {
      id: index + 1,
      direction: closedTrade.direction,
      entryIndex: 0,
      entryTime: closedTrade.openedBarTime,
      entryPrice: closedTrade.entryPrice,
      exitIndex: 0,
      exitTime: closedTrade.closedAt,
      exitPrice: closedTrade.exitPrice,
      stop: closedTrade.stop,
      target: closedTrade.target,
      units: closedTrade.units,
      lots: closedTrade.lots,
      plannedRisk: closedTrade.plannedRisk,
      grossPnl: closedTrade.pnl,
      costs: 0,
      pnl: closedTrade.pnl,
      rMultiple: closedTrade.rMultiple,
      exitReason: closedTrade.reason === "closed by hand" ? "opposite signal" : closedTrade.reason,
      barsHeld: 0,
      balanceAfter: running,
      scoreAtEntry: 0,
      reasons: [],
    };
  });
  return computeMetrics(trades, equity, account.startingBalance, trades.length);
}

/** The last traded price of a series, for marking positions. */
export function lastPriceOf(series: Series): number {
  return series.candles.at(-1)?.close ?? 0;
}

export function pipDistance(series: Series, a: number, b: number): number {
  const instrument = instrumentOf(series);
  return instrument.pip > 0 ? Math.abs(a - b) / instrument.pip : 0;
}
