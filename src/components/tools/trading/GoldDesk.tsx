"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatMoney, formatPercent, formatPips, formatPrice } from "@/lib/trading/format";
import { MT5_BRIDGE_SCRIPT, MT5_DEFAULT_PORT, MT5_SCRIPT_NAME } from "@/lib/trading/mt5";
import { analyseSessions, dailyRangeInPips, SESSIONS } from "@/lib/trading/sessions";
import { valuePerPipPerLot } from "@/lib/trading/risk";
import { instrumentOf, type Series } from "@/lib/trading/types";
import { MetricTile, Panel } from "./shared";

/**
 * The gold desk.
 *
 * Gold is the reason this tool exists, and it behaves unlike a currency pair:
 * a contract is 100 ounces, a "pip" is a cent, the daily range is measured in
 * whole dollars, and almost all of that range happens in two of the twenty-four
 * hours' worth of sessions. None of that is asserted here — it is measured
 * from whatever bars are loaded, and the panel says how many.
 */
export function GoldDesk({ series }: { series: Series | null }) {
  return (
    <div className="space-y-4">
      {series ? <GoldFacts series={series} /> : null}
      {series ? <SessionBreakdown series={series} /> : null}
      <BridgeSetup />
    </div>
  );
}

function GoldFacts({ series }: { series: Series }) {
  const instrument = instrumentOf(series);
  const analysis = analyseSessions(series);
  const rangePips = dailyRangeInPips(series, analysis.averageDailyRange);
  const perPip = valuePerPipPerLot(instrument);
  const last = series.candles.at(-1);
  const isGold = instrument.kind === "metal" || /XAU|GOLD/i.test(series.symbol);

  return (
    <Panel
      title={isGold ? "This instrument, in the units risk is actually measured in" : "Contract details for this instrument"}
      icon="🥇"
      subtitle={`Measured from the ${series.candles.length.toLocaleString()} bars loaded — ${analysis.daysCovered} day${analysis.daysCovered === 1 ? "" : "s"} of history.`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="Last price" value={last ? formatPrice(last.close, instrument) : "—"} />
        <MetricTile
          label="Average daily range"
          value={analysis.averageDailyRange === null ? "—" : formatPrice(analysis.averageDailyRange, instrument)}
          hint={rangePips === null ? undefined : formatPips(rangePips)}
        />
        <MetricTile label="One standard lot" value={`${instrument.contractSize.toLocaleString()} ${instrument.base === "XAU" ? "oz" : "units"}`} hint={`one pip = ${formatMoney(perPip)}`} />
        <MetricTile
          label="Spread assumption"
          value={formatPips(series.liveSpreadPips ?? instrument.typicalSpreadPips)}
          hint={series.liveSpreadPips !== undefined ? "live, from your broker" : "typical retail"}
        />
      </div>

      {isGold ? (
        <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
          A standard lot of gold is {instrument.contractSize} ounces, so a one-dollar move is{" "}
          {formatMoney(instrument.contractSize)} per lot. With an average daily range of{" "}
          {analysis.averageDailyRange === null ? "the amount shown above" : formatPrice(analysis.averageDailyRange, instrument)},
          a single lot moves {analysis.averageDailyRange === null ? "several hundred dollars" : formatMoney(analysis.averageDailyRange * instrument.contractSize)} on
          an ordinary day — which is why gold positions are sized in hundredths of a lot far more often than
          currency positions are.
        </p>
      ) : null}
    </Panel>
  );
}

function SessionBreakdown({ series }: { series: Series }) {
  const analysis = analyseSessions(series);
  const instrument = instrumentOf(series);

  if (analysis.tooCoarse) {
    return (
      <Panel title="When it moves" icon="🕰️">
        <p className="text-xs font-semibold text-[var(--muted)]">
          Session analysis needs intraday bars. Load a 15-minute or hourly chart to see which hours of the day
          this instrument actually moves in.
        </p>
      </Panel>
    );
  }

  const peak = Math.max(...analysis.byHour.map((h) => h.averageRange), 0.0001);

  return (
    <Panel
      title="When it moves"
      icon="🕰️"
      subtitle="Average bar range by hour, UTC, measured from your loaded bars — not from a rule of thumb."
    >
      <div className="space-y-4">
        <div className="do-scroll overflow-x-auto">
          <div className="flex min-w-[620px] items-end gap-1" style={{ height: 120 }} role="img" aria-label={sessionSummary(analysis.byHour, instrument.digits)}>
            {analysis.byHour.map((hour) => {
              const session = SESSIONS.find((s) => hour.hour >= s.from && hour.hour < s.to);
              const height = hour.bars === 0 ? 0 : (hour.averageRange / peak) * 100;
              return (
                <div key={hour.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${height}%`,
                      background:
                        session?.id === "overlap"
                          ? "var(--fire)"
                          : session?.id === "london" || session?.id === "newyork"
                            ? "var(--sky)"
                            : "var(--border-strong)",
                    }}
                    title={`${String(hour.hour).padStart(2, "0")}:00 UTC — average range ${hour.averageRange.toFixed(instrument.digits)} over ${hour.bars} bars`}
                  />
                  <span className="text-[9px] font-extrabold tabular-nums text-[var(--muted)]">{hour.hour}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="do-scroll overflow-x-auto rounded-2xl border-2 border-[var(--border)]">
          <table className="w-full min-w-[560px] text-xs font-semibold tabular-nums">
            <thead className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Session (UTC)</th>
                <th className="px-3 py-2">Average bar range</th>
                <th className="px-3 py-2">Against the day</th>
                <th className="px-3 py-2">Bars closed up</th>
                <th className="px-3 py-2">Bars measured</th>
              </tr>
            </thead>
            <tbody>
              {analysis.stats.map((stat) => (
                <tr key={stat.session.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5">
                    <span className="font-extrabold">{stat.session.label}</span>
                    <span className="ml-1 text-[var(--muted)]">
                      {String(stat.session.from).padStart(2, "0")}–{String(stat.session.to).padStart(2, "0")}
                    </span>
                    <span className="block text-[11px] font-semibold text-[var(--muted)]">{stat.session.blurb}</span>
                  </td>
                  <td className="px-3 py-1.5">{stat.averageRange.toFixed(instrument.digits)}</td>
                  <td className={`px-3 py-1.5 font-extrabold ${stat.relative >= 1.15 ? "text-[var(--fire-dark)] dark:text-[var(--fire)]" : ""}`}>
                    {stat.relative.toFixed(2)}×
                  </td>
                  <td className="px-3 py-1.5 text-[var(--muted)]">{formatPercent(stat.upShare * 100, 0)}</td>
                  <td className="px-3 py-1.5 text-[var(--muted)]">{stat.bars.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {analysis.busiest && analysis.quietest ? (
          <p className="text-xs font-semibold text-[var(--muted)]">
            In this history, the <strong>{analysis.busiest.session.label}</strong> window moved{" "}
            {(analysis.busiest.averageRange / Math.max(analysis.quietest.averageRange, 1e-9)).toFixed(1)}× as far
            per bar as <strong>{analysis.quietest.session.label}</strong>. That matters for a stop: one sized on
            the quiet hours gets hit by ordinary noise once London opens, and one sized on the busy hours is
            needlessly wide overnight. It is a description of the period you loaded, not a rule — reload a
            different stretch of history and check whether it still holds.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function sessionSummary(byHour: { hour: number; averageRange: number }[], digits: number): string {
  const busiest = [...byHour].sort((a, b) => b.averageRange - a.averageRange)[0];
  return `Average bar range by hour of day. Widest at ${String(busiest?.hour ?? 0).padStart(2, "0")}:00 UTC at ${busiest?.averageRange.toFixed(digits) ?? "0"}.`;
}

function BridgeSetup() {
  const [showScript, setShowScript] = React.useState(false);

  const download = () => {
    const blob = new Blob([MT5_BRIDGE_SCRIPT], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = MT5_SCRIPT_NAME;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      title="Use your own MetaTrader 5 gold feed"
      icon="🖥️"
      subtitle="Free, unlimited, no key — your broker's own XAUUSD candles, straight from your terminal."
    >
      <div className="space-y-4">
        <p className="text-xs font-semibold">
          MetaTrader publishes a free Python package that reads the history out of a running MT5 terminal. It
          talks to the terminal over a local connection on your own machine, so no web page can call it directly
          — including this one. The bridge below closes that gap: a small script you run next to MetaTrader,
          which serves the bars to this page on <code className="rounded bg-[var(--panel-2)] px-1">127.0.0.1</code>{" "}
          and nowhere else.
        </p>

        <ol className="space-y-2">
          {[
            ["Open MetaTrader 5 and log in", "On Windows. Open an XAUUSD chart once and scroll it back a few months, so the terminal downloads the history you want to test."],
            ["Install the package", "pip install MetaTrader5 — MetaTrader's own, free, no account or key."],
            ["Run the script", `Save the file below and run python ${MT5_SCRIPT_NAME}. Leave the window open; it prints the exact gold symbol names your broker uses.`],
            ["Press Connect", "In the Market data panel, choose MetaTrader 5 and press Connect. Your own bars, with your broker's contract size, digits and live spread."],
          ].map(([title, detail], index) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl bg-[var(--panel)] px-4 py-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--grass)] text-xs font-extrabold text-white">
                {index + 1}
              </span>
              <span className="min-w-0 text-xs font-semibold">
                <strong className="block">{title}</strong>
                <span className="text-[var(--muted)]">{detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border-2 border-[var(--cherry)] bg-[var(--cherry-soft)] px-4 py-3">
          <p className="text-xs font-extrabold">Read it before you run it — and know what it cannot do</p>
          <ul className="mt-1 space-y-0.5 text-xs font-semibold">
            <li>• It calls three MetaTrader functions: copy_rates_from_pos, symbol_info and symbols_get. That is the whole of its access.</li>
            <li>• There is no order function anywhere in it. It cannot open, change or close a position.</li>
            <li>• It never reads your account number, balance, equity or open positions.</li>
            <li>• It listens on 127.0.0.1 only, so nothing outside your own computer can reach it.</li>
            <li>• Stop it by closing the window. Nothing is installed and nothing runs in the background.</li>
          </ul>
          <p className="mt-1.5 text-xs font-semibold">
            That is what the code says, and you can check it yourself — which is the right habit for any script
            pointed at a terminal that is logged into a trading account.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button tone="panel" size="sm" onClick={() => setShowScript((v) => !v)}>
            {showScript ? "Hide the script" : "Show the script"}
          </Button>
          <CopyButton value={MT5_BRIDGE_SCRIPT} label="Copy the script" copiedLabel="Copied" />
          <Button tone="panel" size="sm" onClick={download}>
            Download {MT5_SCRIPT_NAME}
          </Button>
        </div>

        {showScript ? (
          <pre className="do-scroll max-h-[420px] overflow-auto rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4 text-[11px] leading-relaxed">
            <code>{MT5_BRIDGE_SCRIPT}</code>
          </pre>
        ) : null}

        <div className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
          <p className="font-extrabold text-[var(--ink)]">If it does not connect</p>
          <ul className="mt-1 space-y-0.5">
            <li>• The script and this page must run on the same computer — the bridge only listens on loopback.</li>
            <li>• MetaTrader 5 must be open and logged in. The package talks to the running terminal, not to the broker.</li>
            <li>• MetaTrader&rsquo;s Python package is Windows-only. On a Mac, run MT5 and the script in a Windows VM, or use the CSV route below.</li>
            <li>• Brokers name gold differently — XAUUSD, XAUUSD.m, GOLD, XAUUSDx. The script prints the names yours uses.</li>
            <li>• Port {MT5_DEFAULT_PORT} must be free. Something else already listening there will block it.</li>
          </ul>
          <p className="mt-2">
            <strong className="text-[var(--ink)]">No server, no problem.</strong> Run{" "}
            <code className="rounded bg-[var(--panel-2)] px-1">python {MT5_SCRIPT_NAME} --csv XAUUSD 15m 5000</code>{" "}
            and it writes a CSV of the same bars, ready to drop into the CSV importer. Same data, one file, no
            connection at all.
          </p>
        </div>

        <p className="text-xs font-semibold text-[var(--muted)]">
          Better data settles what the data can settle: these are your broker&rsquo;s real bars, your real
          contract size and your real spread, so a backtest on them is testing the strategy rather than an
          approximation of the market. It does not make the strategy work. A rule set that loses money on
          accurate gold data is simply being honest with you sooner.
        </p>
      </div>
    </Panel>
  );
}
