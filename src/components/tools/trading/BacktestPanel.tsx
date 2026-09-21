"use client";

import * as React from "react";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import type { BacktestResult, ExecutionConfig } from "@/lib/trading/backtest";
import { formatBarTime, formatMoney, formatPercent, formatPips, formatPrice, formatRatio, formatSignedMoney } from "@/lib/trading/format";
import type { Metrics } from "@/lib/trading/metrics";
import { instrumentOf, type Series } from "@/lib/trading/types";
import { EquityChart } from "./EquityChart";
import { MetricTile, NumberField, Panel, PastPerformanceNote, WarningList } from "./shared";

export interface BacktestSettings {
  /** Fraction of the history kept back from every decision. */
  holdOutShare: number;
  useHoldOut: boolean;
  fromIndex: number;
  toIndex: number;
}

/**
 * The backtest.
 *
 * Two results, side by side, whenever the hold-out is on: the period the
 * settings were chosen against, and a period they have never seen. The second
 * one is the only one worth much, and it is shown with equal weight rather
 * than tucked away under the first.
 */
export function BacktestPanel({
  series,
  execution,
  onExecution,
  settings,
  onSettings,
  inSample,
  outOfSample,
  running,
}: {
  series: Series;
  execution: ExecutionConfig;
  onExecution: (next: ExecutionConfig) => void;
  settings: BacktestSettings;
  onSettings: (next: BacktestSettings) => void;
  inSample: BacktestResult | null;
  outOfSample: BacktestResult | null;
  running: boolean;
}) {
  const [view, setView] = React.useState("in");
  const set = <K extends keyof ExecutionConfig>(key: K, value: ExecutionConfig[K]) =>
    onExecution({ ...execution, [key]: value });

  const instrument = instrumentOf(series);
  const shown = view === "out" && outOfSample ? outOfSample : inSample;
  const candles = series.candles;

  const dateOf = (index: number) => {
    const candle = candles[Math.max(0, Math.min(candles.length - 1, index))];
    return candle ? new Date(candle.time).toISOString().slice(0, 10) : "";
  };
  const indexOfDate = (value: string) => {
    const target = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(target)) return null;
    const found = candles.findIndex((c) => c.time >= target);
    return found < 0 ? candles.length - 1 : found;
  };

  return (
    <div className="space-y-4">
      <Panel title="Trade rules and costs" icon="🧪" subtitle="What a signal would actually have cost to act on.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Starting balance" value={execution.initialBalance} min={100} step={1000} onChange={(v) => set("initialBalance", v)} suffix="$" />
          <NumberField label="Risk per trade" value={execution.riskPercent} min={0.05} max={100} step={0.05} onChange={(v) => set("riskPercent", v)} suffix="%" />
          <div>
            <Label htmlFor="stop-mode">Stop-loss from</Label>
            <Select id="stop-mode" value={execution.stopMode} onChange={(e) => set("stopMode", e.target.value as ExecutionConfig["stopMode"])}>
              <option value="atr">ATR — volatility</option>
              <option value="pips">A fixed number of pips</option>
              <option value="swing">The last confirmed swing</option>
              <option value="signal">The strategy&rsquo;s own stop</option>
            </Select>
          </div>
          {execution.stopMode === "signal" ? (
            <NumberField label="Fallback, in ATR" value={execution.atrMultiple} min={0.2} max={10} step={0.1} hint="only if the strategy sets none" onChange={(v) => set("atrMultiple", v)} suffix="×" />
          ) : execution.stopMode === "pips" ? (
            <NumberField label="Stop distance" value={execution.stopPips} min={1} step={1} onChange={(v) => set("stopPips", v)} suffix="pips" />
          ) : (
            <NumberField label="Stop, in ATR" value={execution.atrMultiple} min={0.2} max={10} step={0.1} onChange={(v) => set("atrMultiple", v)} suffix="×" />
          )}

          <div>
            <Label htmlFor="target-mode">Take-profit from</Label>
            <Select id="target-mode" value={execution.targetMode} onChange={(e) => set("targetMode", e.target.value as ExecutionConfig["targetMode"])}>
              <option value="rr">A multiple of the risk</option>
              <option value="atr">ATR — volatility</option>
              <option value="pips">A fixed number of pips</option>
            </Select>
          </div>
          {execution.stopMode === "signal" ? (
            <p className="self-end pb-3 text-xs font-semibold text-[var(--muted)]">
              The strategy sets its own target too, so the take-profit setting is ignored.
            </p>
          ) : execution.targetMode === "rr" ? (
            <NumberField label="Reward : risk" value={execution.riskReward} min={0.2} max={20} step={0.1} onChange={(v) => set("riskReward", v)} suffix=": 1" />
          ) : execution.targetMode === "atr" ? (
            <NumberField label="Target, in ATR" value={execution.targetAtrMultiple} min={0.2} max={20} step={0.1} onChange={(v) => set("targetAtrMultiple", v)} suffix="×" />
          ) : (
            <NumberField label="Target distance" value={execution.targetPips} min={1} step={1} onChange={(v) => set("targetPips", v)} suffix="pips" />
          )}
          <NumberField label="Spread assumption" value={execution.spreadPips} min={0} step={0.1} hint={`typical for ${instrument.name}: ${instrument.typicalSpreadPips}`} onChange={(v) => set("spreadPips", v)} suffix="pips" />
          <NumberField label="Commission" value={execution.commissionPerLot} min={0} step={1} hint="round turn, per lot" onChange={(v) => set("commissionPerLot", v)} suffix="$" />
          <NumberField label="Slippage" value={execution.slippagePips} min={0} step={0.1} onChange={(v) => set("slippagePips", v)} suffix="pips" />
          <NumberField label="Maximum leverage" value={execution.leverage} min={1} max={2000} onChange={(v) => set("leverage", v)} suffix=":1" />
          <NumberField label="Time limit" value={execution.maxBarsInTrade} min={0} step={1} hint="0 = no limit" onChange={(v) => set("maxBarsInTrade", v)} suffix="bars" />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Toggle checked={execution.allowLong} onChange={(v) => set("allowLong", v)} label="Take buy signals" />
          <Toggle checked={execution.allowShort} onChange={(v) => set("allowShort", v)} label="Take sell signals" />
          <Toggle checked={execution.roundLots} onChange={(v) => set("roundLots", v)} label="Round to 0.01 lots" description="Skips trades an account this size could not place." />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="bt-from">From</Label>
            <input
              id="bt-from"
              type="date"
              className="do-input"
              value={dateOf(settings.fromIndex)}
              min={dateOf(0)}
              max={dateOf(candles.length - 1)}
              onChange={(event) => {
                const index = indexOfDate(event.target.value);
                if (index !== null) onSettings({ ...settings, fromIndex: Math.min(index, settings.toIndex - 50) });
              }}
            />
          </div>
          <div>
            <Label htmlFor="bt-to">To</Label>
            <input
              id="bt-to"
              type="date"
              className="do-input"
              value={dateOf(settings.toIndex)}
              min={dateOf(0)}
              max={dateOf(candles.length - 1)}
              onChange={(event) => {
                const index = indexOfDate(event.target.value);
                if (index !== null) onSettings({ ...settings, toIndex: Math.max(index, settings.fromIndex + 50) });
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Toggle
              checked={settings.useHoldOut}
              onChange={(v) => onSettings({ ...settings, useHoldOut: v })}
              label={`Hold back the last ${Math.round(settings.holdOutShare * 100)}%`}
              description="Tune against the first part, judge on the part the tuning never saw."
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Results"
        icon="📊"
        subtitle={shown ? `${formatBarTime(shown.fromTime, series.timeframe)} to ${formatBarTime(shown.toTime, series.timeframe)} UTC · ${shown.barsTested.toLocaleString()} bars` : undefined}
        right={
          settings.useHoldOut && outOfSample ? (
            <Tabs
              ariaLabel="Which period"
              value={view}
              onChange={setView}
              items={[
                { id: "in", label: "Tuned on this" },
                { id: "out", label: "Held back" },
              ]}
            />
          ) : null
        }
      >
        {running ? (
          <p className="text-sm font-semibold text-[var(--muted)]">Running…</p>
        ) : shown ? (
          <div className="space-y-4">
            {settings.useHoldOut && inSample && outOfSample ? (
              <Comparison inSample={inSample.metrics} outOfSample={outOfSample.metrics} />
            ) : null}

            <MetricGrid metrics={shown.metrics} initialBalance={execution.initialBalance} />

            <EquityChart
              equity={shown.equity}
              initialBalance={execution.initialBalance}
              splitTime={settings.useHoldOut && view === "in" && outOfSample ? outOfSample.fromTime : null}
            />

            <WarningList items={shown.warnings} />

            <div className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
              <p className="font-extrabold text-[var(--ink)]">What this simulation assumed</p>
              <ul className="mt-1 space-y-0.5">
                <li>• Signals read at a bar&rsquo;s close, filled at the next bar&rsquo;s open — never at the closing price that produced them.</li>
                <li>• Half the {formatPips(execution.spreadPips)} spread charged on entry and half on exit, plus {formatMoney(execution.commissionPerLot)} per lot round turn{execution.slippagePips > 0 ? ` and ${formatPips(execution.slippagePips)} of slippage` : ""}.</li>
                <li>• One position at a time, sized to risk {formatPercent(execution.riskPercent)} of the balance at the time.</li>
                <li>• When a bar contained both the stop and the target, the stop was taken.</li>
                <li>• Spreads were fixed. Real spreads widen exactly when these rules want to trade — at news, at the open, and around the rollover.</li>
              </ul>
            </div>
            <PastPerformanceNote />
            <TradeTable result={shown} series={series} />
          </div>
        ) : (
          <p className="text-sm font-semibold text-[var(--muted)]">Load a chart to run a backtest.</p>
        )}
      </Panel>
    </div>
  );
}

function MetricGrid({ metrics, initialBalance }: { metrics: Metrics; initialBalance: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <MetricTile label="Trades" value={metrics.trades} hint={`${metrics.wins} won, ${metrics.losses} lost`} />
      <MetricTile label="Win rate" value={formatPercent(metrics.winRate)} />
      <MetricTile
        label="Net profit"
        value={formatSignedMoney(metrics.netProfit)}
        hint={formatPercent(metrics.netProfitPercent)}
        tone={metrics.netProfit >= 0 ? "grass" : "cherry"}
      />
      <MetricTile label="Profit factor" value={formatRatio(metrics.profitFactor)} hint="gross won ÷ gross lost" />
      <MetricTile label="Deepest drawdown" value={formatPercent(metrics.maxDrawdownPercent)} hint={formatMoney(metrics.maxDrawdown)} tone="cherry" />
      <MetricTile label="Average result" value={`${metrics.expectancyR >= 0 ? "+" : "−"}${Math.abs(metrics.expectancyR).toFixed(2)}R`} hint="per trade, in units of risk" tone={metrics.expectancyR >= 0 ? "grass" : "cherry"} />
      <MetricTile label="Average win" value={formatMoney(metrics.averageWin)} tone="grass" />
      <MetricTile label="Average loss" value={formatMoney(-metrics.averageLoss)} tone="cherry" />
      <MetricTile label="Largest win" value={formatMoney(metrics.largestWin)} />
      <MetricTile label="Largest loss" value={formatMoney(metrics.largestLoss)} />
      <MetricTile label="Worst losing run" value={`${metrics.maxConsecutiveLosses} in a row`} hint={`best run ${metrics.maxConsecutiveWins}`} />
      <MetricTile
        label="Risk-adjusted score"
        value={formatRatio(metrics.riskAdjusted)}
        hint="Sharpe-like, per trade — not annualised"
      />
      <MetricTile label="Final balance" value={formatMoney(metrics.finalBalance)} hint={`from ${formatMoney(initialBalance)}`} />
      <MetricTile label="Costs paid" value={formatMoney(metrics.totalCosts)} hint="spread and commission" />
      <MetricTile label="Time in the market" value={formatPercent(metrics.exposure)} hint={`${metrics.averageBarsHeld.toFixed(1)} bars per trade`} />
    </div>
  );
}

function Comparison({ inSample, outOfSample }: { inSample: Metrics; outOfSample: Metrics }) {
  const rows: [string, string, string][] = [
    ["Trades", String(inSample.trades), String(outOfSample.trades)],
    ["Win rate", formatPercent(inSample.winRate), formatPercent(outOfSample.winRate)],
    ["Profit factor", formatRatio(inSample.profitFactor), formatRatio(outOfSample.profitFactor)],
    ["Average result", `${inSample.expectancyR.toFixed(2)}R`, `${outOfSample.expectancyR.toFixed(2)}R`],
    ["Net profit", formatSignedMoney(inSample.netProfit), formatSignedMoney(outOfSample.netProfit)],
    ["Deepest drawdown", formatPercent(inSample.maxDrawdownPercent), formatPercent(outOfSample.maxDrawdownPercent)],
  ];

  const decayed =
    inSample.expectancyR > 0 && outOfSample.expectancyR < inSample.expectancyR * 0.5;

  return (
    <div className="rounded-2xl border-2 border-[var(--border)] p-3">
      <table className="w-full text-xs font-semibold tabular-nums">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <th className="py-1">Measure</th>
            <th className="py-1">Tuned on this</th>
            <th className="py-1">Held back</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-t border-[var(--border)]">
              <td className="py-1.5 font-extrabold">{label}</td>
              <td className="py-1.5 text-[var(--muted)]">{a}</td>
              <td className="py-1.5">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
        {decayed
          ? "The held-back period is much worse than the tuned one. Some decay is normal — this much usually means the settings describe what already happened."
          : "Compare the two columns rather than reading either alone. The right-hand one is the only period these settings have not been fitted to."}
      </p>
    </div>
  );
}

function TradeTable({ result, series }: { result: BacktestResult; series: Series }) {
  const [expanded, setExpanded] = React.useState(false);
  const instrument = instrumentOf(series);
  const trades = expanded ? result.trades : result.trades.slice(0, 12);
  if (result.trades.length === 0) {
    return (
      <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
        No trades in this period. Either the rules never agreed enough, or the risk settings sized every one of
        them below the minimum lot.
      </p>
    );
  }

  return (
    <div>
      <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
        Trade history ({result.trades.length})
      </h4>
      <div className="do-scroll overflow-x-auto rounded-2xl border-2 border-[var(--border)]">
        <table className="w-full min-w-[720px] text-xs font-semibold tabular-nums">
          <thead className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Side</th>
              <th className="px-3 py-2">Opened</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">Exit</th>
              <th className="px-3 py-2">Why it closed</th>
              <th className="px-3 py-2">Lots</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">R</th>
              <th className="px-3 py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5 text-[var(--muted)]">{trade.id}</td>
                <td className="px-3 py-1.5 font-extrabold">{trade.direction === "long" ? "Buy" : "Sell"}</td>
                <td className="px-3 py-1.5 text-[var(--muted)]">{formatBarTime(trade.entryTime, series.timeframe)}</td>
                <td className="px-3 py-1.5">{formatPrice(trade.entryPrice, instrument)}</td>
                <td className="px-3 py-1.5">{formatPrice(trade.exitPrice, instrument)}</td>
                <td className="px-3 py-1.5 text-[var(--muted)]">{trade.exitReason}</td>
                <td className="px-3 py-1.5">{trade.lots.toFixed(2)}</td>
                <td className={`px-3 py-1.5 font-extrabold ${trade.pnl >= 0 ? "text-[var(--grass-dark)] dark:text-[var(--grass)]" : "text-[var(--cherry-dark)] dark:text-[var(--cherry)]"}`}>
                  {formatSignedMoney(trade.pnl)}
                </td>
                <td className="px-3 py-1.5">{trade.rMultiple.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-[var(--muted)]">{trade.scoreAtEntry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.trades.length > 12 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-extrabold underline"
        >
          {expanded ? "Show fewer" : `Show all ${result.trades.length} trades`}
        </button>
      ) : null}
    </div>
  );
}
