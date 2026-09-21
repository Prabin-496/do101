"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/Feedback";
import { DEFAULT_EXECUTION, runBacktest, type ExecutionConfig } from "@/lib/trading/backtest";
import type { TradeMarker } from "@/lib/trading/chart";
import { atr as atrOf, bollinger, movingAverage, macd as macdOf, pivots as pivotsOf, rsi as rsiOf, closes } from "@/lib/trading/indicators";
import { levelsAt } from "@/lib/trading/levels";
import { DEFAULT_ENGINE_SETTINGS, ENGINE_META, makeEngine, type EngineId, type EngineSettings } from "@/lib/trading/engines";
import { DEFAULT_SMART_MONEY, type SmartMoneyParams } from "@/lib/trading/smart-money";
import { buildPlan } from "@/lib/trading/plan";
import { EXECUTION_KNOBS, type Knob } from "@/lib/trading/optimize";
import type { Preset } from "@/lib/trading/presets";
import { DEFAULT_PARAMS, type StrategyParams } from "@/lib/trading/strategy";
import { instrumentOf, type Series, type Timeframe } from "@/lib/trading/types";
import { readLocal, writeLocal } from "@/lib/utils/storage";
import { useLocalValue } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";
import { BacktestPanel, type BacktestSettings } from "./BacktestPanel";
import { DataPanel } from "./DataPanel";
import { GoldDesk } from "./GoldDesk";
import { OptimizePanel } from "./OptimizePanel";
import { PaperPanel, type PaperTicket } from "./PaperPanel";
import { PriceChart } from "./PriceChart";
import { RiskPanel, type RiskInputs } from "./RiskPanel";
import { SignalPanel } from "./SignalPanel";
import { StrategyPanel } from "./StrategyPanel";
import { Chip, ChipRow, VerdictBadge } from "./shared";

const SETTINGS_KEY = "tradelens:settings";

interface Settings {
  choice: { sourceId: string; symbol: string; timeframe: Timeframe };
  engine: EngineId;
  params: StrategyParams;
  smartMoney: SmartMoneyParams;
  execution: ExecutionConfig;
  risk: RiskInputs;
  ticket: PaperTicket;
  overlays: {
    fastMa: boolean;
    slowMa: boolean;
    bands: boolean;
    levels: boolean;
    volume: boolean;
    rsi: boolean;
    macd: boolean;
    line: boolean;
  };
}

/** Gold, on a keyless source, is what a first visit sees. */
const DEFAULTS: Settings = {
  choice: { sourceId: "binance", symbol: "PAXGUSDT", timeframe: "1h" },
  engine: DEFAULT_ENGINE_SETTINGS.engine,
  params: DEFAULT_PARAMS,
  smartMoney: DEFAULT_SMART_MONEY,
  execution: { ...DEFAULT_EXECUTION, spreadPips: 30 },
  risk: {
    balance: 10_000,
    riskPercent: 1,
    entry: 2000,
    stop: 1990,
    target: 2020,
    leverage: 30,
    quoteToAccountRate: 1,
    instrumentId: "XAUUSD",
    roundLots: true,
  },
  ticket: { direction: "long", entry: 0, stop: 0, target: 0, riskPercent: 1, leverage: 30 },
  overlays: { fastMa: true, slowMa: true, bands: false, levels: true, volume: true, rsi: true, macd: true, line: false },
};

const TABS = [
  { id: "signal", label: "Signal" },
  { id: "strategy", label: "Strategy" },
  { id: "backtest", label: "Backtest" },
  { id: "optimize", label: "Optimise" },
  { id: "paper", label: "Paper trading" },
  { id: "risk", label: "Risk" },
  { id: "gold", label: "Gold desk" },
];

/**
 * TradeLens.
 *
 * Everything below this point runs in the visitor's browser: the indicators,
 * the rule engine, the backtester, the parameter search and the paper account.
 * The only network traffic is the price request itself, and that goes straight
 * from the browser to whichever source was chosen.
 */
export function TradingAnalyzer() {
  const saved = useLocalValue<Partial<Settings>>(SETTINGS_KEY, DEFAULTS);
  const settings = React.useMemo<Settings>(
    () => ({
      ...DEFAULTS,
      ...saved,
      params: { ...DEFAULT_PARAMS, ...saved.params, weights: { ...DEFAULT_PARAMS.weights, ...saved.params?.weights } },
      smartMoney: {
        ...DEFAULT_SMART_MONEY,
        ...saved.smartMoney,
        triggers: { ...DEFAULT_SMART_MONEY.triggers, ...saved.smartMoney?.triggers },
      },
      execution: { ...DEFAULTS.execution, ...saved.execution },
      risk: { ...DEFAULTS.risk, ...saved.risk },
      ticket: { ...DEFAULTS.ticket, ...saved.ticket },
      overlays: { ...DEFAULTS.overlays, ...saved.overlays },
      choice: { ...DEFAULTS.choice, ...saved.choice },
    }),
    [saved],
  );
  // Merged against what is stored *now*, not the snapshot this render saw, so
  // two updates in one click — switching engine and its stop mode together —
  // both land instead of the second quietly reverting the first.
  const update = (patch: Partial<Settings>) =>
    writeLocal(SETTINGS_KEY, { ...settings, ...readLocal<Partial<Settings>>(SETTINGS_KEY, {}), ...patch });

  const [series, setSeries] = React.useState<Series | null>(null);
  const [tab, setTab] = React.useState("signal");
  const [range, setRange] = React.useState<BacktestSettings>({
    holdOutShare: 0.3,
    useHoldOut: true,
    fromIndex: 0,
    toIndex: 0,
  });

  const { params, execution, overlays } = settings;

  /* ------------------------------- analysis ------------------------------- */

  const engineSettings = React.useMemo<EngineSettings>(
    () => ({ engine: settings.engine, weighted: settings.params, smartMoney: settings.smartMoney }),
    [settings.engine, settings.params, settings.smartMoney],
  );

  const engine = React.useMemo(
    () => (series ? makeEngine(series, engineSettings) : null),
    [series, engineSettings],
  );

  const signal = React.useMemo(
    () => (engine && engine.candles.length > 0 ? engine.evaluateAt(engine.candles.length - 1) : null),
    [engine],
  );

  // The chart draws whichever averages the running strategy is actually using.
  const studySpec = React.useMemo(
    () =>
      settings.engine === "smart-money"
        ? {
            fast: settings.smartMoney.fastEma,
            slow: settings.smartMoney.slowEma,
            maType: "ema" as const,
            rsiPeriod: settings.smartMoney.rsiPeriod,
            bbPeriod: params.bbPeriod,
            bbMultiplier: params.bbMultiplier,
            atrPeriod: settings.smartMoney.atrPeriod,
            pivotWindow: settings.smartMoney.liquidityPivot,
          }
        : {
            fast: params.fastMa,
            slow: params.slowMa,
            maType: params.maType,
            rsiPeriod: params.rsiPeriod,
            bbPeriod: params.bbPeriod,
            bbMultiplier: params.bbMultiplier,
            atrPeriod: params.atrPeriod,
            pivotWindow: params.pivotWindow,
          },
    [settings.engine, settings.smartMoney, params],
  );

  const plan = React.useMemo(
    () => (signal && series ? buildPlan(signal, series, execution, execution.initialBalance) : null),
    [signal, series, execution],
  );

  const studies = React.useMemo(() => {
    if (!series) return null;
    const price = closes(series.candles);
    return {
      fastMa: movingAverage(price, studySpec.fast, studySpec.maType),
      slowMa: movingAverage(price, studySpec.slow, studySpec.maType),
      bands: bollinger(price, studySpec.bbPeriod, studySpec.bbMultiplier),
      rsi: rsiOf(price, studySpec.rsiPeriod),
      macd: macdOf(price, params.macdFast, params.macdSlow, params.macdSignal),
    };
  }, [series, studySpec, params.macdFast, params.macdSlow, params.macdSignal]);

  const levels = React.useMemo(() => {
    if (!series) return [];
    const last = series.candles.length - 1;
    const found = pivotsOf(series.candles, studySpec.pivotWindow, studySpec.pivotWindow);
    const atr = atrOf(series.candles, studySpec.atrPeriod)[last] ?? series.candles[last].close * 0.002;
    return levelsAt(series.candles, found, last, atr * 0.75);
  }, [series, studySpec]);

  // The two halves of the backtest. Computed only on the tab that shows them,
  // so dragging a rule weight does not re-run the engine twice on every frame.
  const backtests = React.useMemo(() => {
    if (!engine || !series || (tab !== "backtest" && tab !== "optimize")) return null;
    const last = series.candles.length - 1;
    const to = range.toIndex > 0 ? Math.min(range.toIndex, last) : last;
    const from = Math.min(range.fromIndex, to - 50);
    if (!range.useHoldOut) {
      return { inSample: runBacktest(engine, execution, { from, to }), outOfSample: null };
    }
    const split = Math.floor(from + (to - from) * (1 - range.holdOutShare));
    return {
      inSample: runBacktest(engine, execution, { from, to: split }),
      outOfSample: runBacktest(engine, execution, { from: split + 1, to }),
    };
  }, [engine, series, execution, range, tab]);

  const markers = React.useMemo<TradeMarker[]>(() => {
    const trades = [...(backtests?.inSample.trades ?? []), ...(backtests?.outOfSample?.trades ?? [])];
    return trades.flatMap((trade) => [
      { index: trade.entryIndex, price: trade.entryPrice, kind: trade.direction === "long" ? ("entry-long" as const) : ("entry-short" as const) },
      { index: trade.exitIndex, price: trade.exitPrice, kind: trade.pnl >= 0 ? ("exit-win" as const) : ("exit-loss" as const) },
    ]);
  }, [backtests]);

  const chartOverlays = React.useMemo(
    () => ({
      fastMa: overlays.fastMa ? studies?.fastMa : undefined,
      slowMa: overlays.slowMa ? studies?.slowMa : undefined,
      bbUpper: overlays.bands ? studies?.bands.upper : undefined,
      bbLower: overlays.bands ? studies?.bands.lower : undefined,
      bbMiddle: overlays.bands ? studies?.bands.middle : undefined,
      levels: overlays.levels ? levels : undefined,
    }),
    [overlays, studies, levels],
  );

  const chartPanes = React.useMemo(
    () => ({
      volume: overlays.volume,
      rsi: overlays.rsi ? (studies?.rsi ?? null) : null,
      macd: overlays.macd ? (studies?.macd ?? null) : null,
    }),
    [overlays, studies],
  );

  /* -------------------------------- actions ------------------------------- */

  const onSeries = (loaded: Series) => {
    setSeries(loaded);
    setRange((current) => ({ ...current, fromIndex: 0, toIndex: loaded.candles.length - 1 }));
    track("tool_complete", { tool: "trading-analyzer", source: loaded.source.split(" ")[0] });
  };

  const applyPreset = (preset: Preset) => {
    update({ engine: "weighted", params: preset.params, execution: { ...execution, ...preset.execution } });
  };

  const applyOptimized = (values: Partial<Record<Knob, number>>) => {
    const nextParams = { ...params } as unknown as Record<string, number>;
    const nextSmartMoney = { ...settings.smartMoney } as unknown as Record<string, number>;
    const nextExecution = { ...execution } as unknown as Record<string, number>;
    const active = settings.engine === "smart-money" ? nextSmartMoney : nextParams;
    for (const [knob, value] of Object.entries(values)) {
      if ((EXECUTION_KNOBS as string[]).includes(knob)) nextExecution[knob] = value as number;
      else if (knob in active) active[knob] = value as number;
    }
    update({
      params: nextParams as unknown as StrategyParams,
      smartMoney: nextSmartMoney as unknown as SmartMoneyParams,
      execution: nextExecution as unknown as ExecutionConfig,
    });
    setTab("backtest");
  };

  const sendToPaper = () => {
    if (!plan || !series) return;
    const instrument = instrumentOf(series);
    update({
      ticket: {
        direction: plan.direction,
        entry: Number(plan.reference.toFixed(instrument.digits)),
        stop: Number(plan.stop.toFixed(instrument.digits)),
        target: Number(plan.target.toFixed(instrument.digits)),
        riskPercent: execution.riskPercent,
        leverage: execution.leverage,
      },
    });
    setTab("paper");
  };

  const instrument = series ? instrumentOf(series) : null;

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-xs font-semibold sm:text-sm">
        <strong>An analysis laboratory, not a prediction service.</strong> Every signal here is the output of
        rules you can read and change, applied to past prices — it can be wrong, and often will be. Nothing on
        this page is financial advice, nothing is tailored to your circumstances, and no part of it can place a
        real order. Past backtest performance does not predict future results.
      </p>

      <DataPanel
        series={series}
        onSeries={onSeries}
        onChoice={(choice) => update({ choice })}
        initial={settings.choice}
      />

      {series && instrument && studies ? (
        <>
          <section className="do-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg font-extrabold">
                  {series.symbol}
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    {series.timeframe} · {series.candles.length.toLocaleString()} bars ·{" "}
                    {ENGINE_META[settings.engine].label}
                  </span>
                </h2>
              </div>
              {signal ? <VerdictBadge verdict={signal.verdict} score={signal.score} /> : null}
            </div>

            <ChipRow ariaLabel="Chart studies">
              <Chip active={!overlays.line} onClick={() => update({ overlays: { ...overlays, line: false } })}>
                Candles
              </Chip>
              <Chip active={overlays.line} onClick={() => update({ overlays: { ...overlays, line: true } })}>
                Line
              </Chip>
              <Chip active={overlays.fastMa} onClick={() => update({ overlays: { ...overlays, fastMa: !overlays.fastMa } })}>
                {studySpec.maType.toUpperCase()} {studySpec.fast}
              </Chip>
              <Chip active={overlays.slowMa} onClick={() => update({ overlays: { ...overlays, slowMa: !overlays.slowMa } })}>
                {studySpec.maType.toUpperCase()} {studySpec.slow}
              </Chip>
              <Chip active={overlays.bands} onClick={() => update({ overlays: { ...overlays, bands: !overlays.bands } })}>
                Bollinger
              </Chip>
              <Chip active={overlays.levels} onClick={() => update({ overlays: { ...overlays, levels: !overlays.levels } })}>
                Support / resistance
              </Chip>
              <Chip active={overlays.volume} onClick={() => update({ overlays: { ...overlays, volume: !overlays.volume } })}>
                Volume
              </Chip>
              <Chip active={overlays.rsi} onClick={() => update({ overlays: { ...overlays, rsi: !overlays.rsi } })}>
                RSI
              </Chip>
              <Chip active={overlays.macd} onClick={() => update({ overlays: { ...overlays, macd: !overlays.macd } })}>
                MACD
              </Chip>
            </ChipRow>

            <div className="mt-3">
              <PriceChart
                candles={series.candles}
                instrument={instrument}
                timeframe={series.timeframe}
                overlays={chartOverlays}
                panes={chartPanes}
                markers={markers}
                rsiLevels={
                  settings.engine === "smart-money"
                    ? { oversold: 50, overbought: 50 }
                    : { oversold: params.rsiOversold, overbought: params.rsiOverbought }
                }
                style={overlays.line ? "line" : "candles"}
                source={`${series.source}${markers.length > 0 ? ` · ${markers.length / 2} backtest trades marked` : ""}`}
              />
            </div>
          </section>

          <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="Analysis panels" />

          {tab === "signal" ? (
            <SignalPanel signal={signal} series={series} plan={plan} onPaperTrade={sendToPaper} />
          ) : null}

          {tab === "strategy" ? (
            <StrategyPanel
              settings={engineSettings}
              onSettings={(next) =>
                update({ engine: next.engine, params: next.weighted, smartMoney: next.smartMoney })
              }
              execution={execution}
              onExecution={(next) => update({ execution: next })}
              onPreset={applyPreset}
            />
          ) : null}

          {tab === "backtest" ? (
            <BacktestPanel
              series={series}
              execution={execution}
              onExecution={(next) => update({ execution: next })}
              settings={range}
              onSettings={setRange}
              inSample={backtests?.inSample ?? null}
              outOfSample={backtests?.outOfSample ?? null}
              running={false}
            />
          ) : null}

          {tab === "optimize" ? (
            <OptimizePanel series={series} settings={engineSettings} execution={execution} onApply={applyOptimized} />
          ) : null}

          {tab === "paper" ? (
            <PaperPanel series={series} ticket={settings.ticket} onTicket={(next) => update({ ticket: next })} />
          ) : null}

          {tab === "risk" ? (
            <RiskPanel
              inputs={settings.risk}
              onInputs={(next) => update({ risk: next })}
              series={series}
              liveSpreadPips={series.liveSpreadPips}
            />
          ) : null}

          {tab === "gold" ? <GoldDesk series={series} /> : null}
        </>
      ) : (
        <>
          <EmptyState
            icon="🥇"
            title="Load a chart to begin"
            description="Gold and forex, from a free public source, your own MetaTrader 5 terminal or a CSV file you exported yourself. Nothing is fetched until you ask for it."
            action={
              <Button onClick={() => document.getElementById("tradelens-symbol")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                Choose a source above
              </Button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["🥇", "Built around gold", "XAU/USD sizing, session ranges and presets written for the way gold moves — plus every major forex pair."],
              ["🔍", "Every signal is auditable", "Each rule votes, each vote has a reason, and the exact rule book is printed on the page."],
              ["🧪", "Tested against held-back data", "Tune on one period, judge on a period the tuning never saw, with the overfitting checks shown."],
            ].map(([icon, title, blurb]) => (
              <div key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-sm font-extrabold">
                  <span aria-hidden className="mr-1.5">
                    {icon}
                  </span>
                  {title}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{blurb}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
