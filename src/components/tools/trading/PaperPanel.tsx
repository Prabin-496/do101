"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { formatBarTime, formatMoney, formatPercent, formatPips, formatPrice, formatRatio, formatSignedMoney } from "@/lib/trading/format";
import {
  closePosition,
  createAccount,
  equityOf,
  lastPriceOf,
  openPosition,
  paperMetrics,
  settleAgainst,
  unrealised,
  type PaperAccount,
} from "@/lib/trading/paper";
import { sizePosition } from "@/lib/trading/risk";
import { instrumentOf, type Series } from "@/lib/trading/types";
import { writeLocal } from "@/lib/utils/storage";
import { useLocalValue } from "@/lib/utils/use-local";
import { MetricTile, NumberField, Panel, PastPerformanceNote } from "./shared";

const STORAGE = "tradelens:paper";
const FRESH = createAccount(10_000);

export interface PaperTicket {
  direction: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  riskPercent: number;
  leverage: number;
}

/**
 * The paper account.
 *
 * Nothing here can reach a broker. There is no order endpoint in this
 * application to reach one with, and the "account" is a JSON object in this
 * browser's local storage — which is also why it survives a reload and why
 * clearing site data deletes it.
 */
export function PaperPanel({
  series,
  ticket,
  onTicket,
}: {
  series: Series | null;
  ticket: PaperTicket;
  onTicket: (next: PaperTicket) => void;
}) {
  const account = useLocalValue<PaperAccount>(STORAGE, FRESH);
  const save = (next: PaperAccount) => writeLocal(STORAGE, next);

  const instrument = series ? instrumentOf(series) : null;
  const price = series ? lastPriceOf(series) : 0;

  // Stops and targets are checked against the bars that have arrived since a
  // position was opened, using the backtester's pessimistic rule.
  React.useEffect(() => {
    if (!series || account.positions.length === 0) return;
    const settled = settleAgainst(account, series, series.candles);
    if (settled.closed.length > 0) writeLocal(STORAGE, settled.account);
  }, [series, account]);

  const equity = series ? equityOf(account, { [series.symbol]: price }) : account.balance;
  const metrics = paperMetrics(account);
  const openRisk = account.positions.reduce((total, position) => total + position.plannedRisk, 0);

  const sizing =
    instrument && ticket.entry > 0 && ticket.stop > 0
      ? sizePosition({
          balance: equity,
          riskPercent: ticket.riskPercent,
          entry: ticket.entry,
          stop: ticket.stop,
          instrument,
          leverage: ticket.leverage,
          quoteToAccountRate: 1,
          roundLots: true,
          minLot: 0.01,
          lotStep: 0.01,
        })
      : null;

  const place = () => {
    const lastBar = series?.candles.at(-1);
    if (!series || !instrument || !sizing || sizing.units <= 0 || !lastBar) return;
    save(
      openPosition(account, {
        symbol: series.symbol,
        instrumentId: series.instrumentId,
        direction: ticket.direction,
        entryPrice: ticket.entry,
        stop: ticket.stop,
        target: ticket.target,
        units: sizing.units,
        lots: sizing.lots,
        plannedRisk: sizing.actualRisk,
        openedBarTime: lastBar.time,
        note: `${series.source} · ${series.timeframe}`,
        quoteToAccountRate: 1,
      }),
    );
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Paper account"
        icon="📒"
        subtitle="Simulated. No broker is connected, and no order leaves this page."
        right={
          <Button
            tone="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm("Reset the paper account? The balance, open positions and trade history are deleted.")) {
                save(createAccount(account.startingBalance));
              }
            }}
          >
            Reset
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricTile label="Balance" value={formatMoney(account.balance)} hint={`started at ${formatMoney(account.startingBalance)}`} />
          <MetricTile
            label="Equity"
            value={formatMoney(equity)}
            hint="balance plus open positions"
            tone={equity >= account.startingBalance ? "grass" : "cherry"}
          />
          <MetricTile label="Open positions" value={account.positions.length} hint={openRisk > 0 ? `${formatMoney(openRisk)} at risk` : undefined} />
          <MetricTile
            label="Since you started"
            value={formatSignedMoney(equity - account.startingBalance)}
            tone={equity >= account.startingBalance ? "grass" : "cherry"}
          />
        </div>
      </Panel>

      {series && instrument ? (
        <Panel title="Open a simulated position" icon="✍️" subtitle={`${series.symbol} · last price ${formatPrice(price, instrument)}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="paper-side">Direction</Label>
              <Select
                id="paper-side"
                value={ticket.direction}
                onChange={(event) => onTicket({ ...ticket, direction: event.target.value as "long" | "short" })}
              >
                <option value="long">Buy</option>
                <option value="short">Sell</option>
              </Select>
            </div>
            <NumberField label="Entry" value={ticket.entry} min={0} step={instrument.pip} onChange={(v) => onTicket({ ...ticket, entry: v })} />
            <NumberField label="Stop-loss" value={ticket.stop} min={0} step={instrument.pip} onChange={(v) => onTicket({ ...ticket, stop: v })} />
            <NumberField label="Take-profit" value={ticket.target} min={0} step={instrument.pip} onChange={(v) => onTicket({ ...ticket, target: v })} />
            <NumberField label="Risk" value={ticket.riskPercent} min={0.05} max={100} step={0.05} onChange={(v) => onTicket({ ...ticket, riskPercent: v })} suffix="%" />
            <NumberField label="Maximum leverage" value={ticket.leverage} min={1} max={2000} onChange={(v) => onTicket({ ...ticket, leverage: v })} suffix=":1" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={place} disabled={!sizing || sizing.units <= 0}>
              Open paper position
            </Button>
            <Button
              tone="panel"
              onClick={() =>
                onTicket({
                  ...ticket,
                  entry: Number(price.toFixed(instrument.digits)),
                  stop: Number((price - (ticket.direction === "long" ? 1 : -1) * price * 0.004).toFixed(instrument.digits)),
                  target: Number((price + (ticket.direction === "long" ? 1 : -1) * price * 0.008).toFixed(instrument.digits)),
                })
              }
            >
              Fill from the last price
            </Button>
            {sizing ? (
              <span className="text-xs font-semibold text-[var(--muted)]">
                {sizing.units > 0
                  ? `${sizing.lots.toFixed(2)} lots · ${formatMoney(sizing.actualRisk)} at risk · stop ${formatPips(sizing.stopPips)} away`
                  : sizing.note}
              </span>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {account.positions.length > 0 ? (
        <Panel title="Open positions" icon="📌">
          <div className="space-y-2">
            {account.positions.map((position) => {
              const markPrice = series && position.symbol === series.symbol ? price : position.entryPrice;
              const pnl = unrealised(position, markPrice);
              const specs = instrumentOf({ instrumentId: position.instrumentId, instrument: series?.instrument });
              return (
                <div key={position.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--panel)] px-4 py-3">
                  <div className="min-w-0 text-xs font-semibold">
                    <p className="font-extrabold">
                      {position.direction === "long" ? "Buy" : "Sell"} {position.lots.toFixed(2)} lots {position.symbol}
                    </p>
                    <p className="text-[var(--muted)]">
                      Entry {formatPrice(position.entryPrice, specs)} · stop {formatPrice(position.stop, specs)} · target{" "}
                      {formatPrice(position.target, specs)}
                      {series && position.symbol === series.symbol ? ` · marked at ${formatPrice(markPrice, specs)}` : " · no live price for this symbol"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-extrabold tabular-nums ${pnl >= 0 ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"}`}>
                      {formatSignedMoney(pnl)}
                    </span>
                    <Button tone="panel" size="sm" onClick={() => save(closePosition(account, position.id, markPrice, "closed by hand"))}>
                      Close
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <Panel title="Performance" icon="📈" subtitle="The same measures the backtester reports, over your paper trades.">
        {metrics.trades === 0 ? (
          <p className="text-xs font-semibold text-[var(--muted)]">
            No closed paper trades yet. Open one above, or send one straight over from the Signal panel.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <MetricTile label="Trades" value={metrics.trades} hint={`${metrics.wins} won, ${metrics.losses} lost`} />
              <MetricTile label="Win rate" value={formatPercent(metrics.winRate)} />
              <MetricTile label="Net" value={formatSignedMoney(metrics.netProfit)} tone={metrics.netProfit >= 0 ? "grass" : "cherry"} />
              <MetricTile label="Profit factor" value={formatRatio(metrics.profitFactor)} />
              <MetricTile label="Average result" value={`${metrics.expectancyR.toFixed(2)}R`} />
              <MetricTile label="Deepest drawdown" value={formatPercent(metrics.maxDrawdownPercent)} tone="cherry" />
            </div>

            <div className="do-scroll overflow-x-auto rounded-2xl border-2 border-[var(--border)]">
              <table className="w-full min-w-[560px] text-xs font-semibold tabular-nums">
                <thead className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Closed</th>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Entry</th>
                    <th className="px-3 py-2">Exit</th>
                    <th className="px-3 py-2">Why</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">R</th>
                  </tr>
                </thead>
                <tbody>
                  {account.history.slice(0, 25).map((trade) => {
                    const specs = instrumentOf({ instrumentId: trade.instrumentId, instrument: series?.instrument });
                    return (
                      <tr key={trade.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-1.5 text-[var(--muted)]">{formatBarTime(trade.closedAt, "1h")}</td>
                        <td className="px-3 py-1.5 font-extrabold">{trade.direction === "long" ? "Buy" : "Sell"}</td>
                        <td className="px-3 py-1.5">{trade.symbol}</td>
                        <td className="px-3 py-1.5">{formatPrice(trade.entryPrice, specs)}</td>
                        <td className="px-3 py-1.5">{formatPrice(trade.exitPrice, specs)}</td>
                        <td className="px-3 py-1.5 text-[var(--muted)]">{trade.reason}</td>
                        <td className={`px-3 py-1.5 font-extrabold ${trade.pnl >= 0 ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"}`}>
                          {formatSignedMoney(trade.pnl)}
                        </td>
                        <td className="px-3 py-1.5">{trade.rMultiple.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PastPerformanceNote />
          </div>
        )}
      </Panel>

      <p className="rounded-2xl border-2 border-[var(--sky)] bg-[var(--sky-soft)] px-4 py-3 text-xs font-semibold">
        <strong>How this differs from trading for real.</strong> Your fills are exact, your stop never slips, the
        spread never widens on news, and nothing is at stake — which is the part that changes how people
        actually behave. Paper trading is good for testing whether you can follow a plan, and poor evidence of
        what you would do with money on the line.
      </p>
    </div>
  );
}
