"use client";

import * as React from "react";
import { Toggle } from "@/components/ui/Field";
import { Slider } from "@/components/ui/Field";
import { PRESETS, type Preset } from "@/lib/trading/presets";
import { describeStrategy, RULE_IDS, RULE_LABELS, type RuleId, type StrategyParams } from "@/lib/trading/strategy";
import { ENGINE_META, type EngineId, type EngineSettings } from "@/lib/trading/engines";
import { TRIGGER_LABELS, type SmartMoneyParams, type TriggerId } from "@/lib/trading/smart-money";
import type { ExecutionConfig } from "@/lib/trading/backtest";
import { Chip, ChipRow, NumberField, Panel } from "./shared";

/**
 * The rule book, open for editing.
 *
 * Weights are the honest control here: a weight of zero removes a rule from
 * the arithmetic entirely rather than hiding it, so what the score is made of
 * is always visible. The full text of every active rule is printed at the
 * bottom, because a signal you cannot audit is just an opinion with a number
 * next to it.
 */
export function StrategyPanel({
  settings,
  onSettings,
  execution,
  onExecution,
  onPreset,
}: {
  settings: EngineSettings;
  onSettings: (next: EngineSettings) => void;
  execution: ExecutionConfig;
  onExecution: (next: ExecutionConfig) => void;
  onPreset: (preset: Preset) => void;
}) {
  const params = settings.weighted;
  const onParams = (next: StrategyParams) => onSettings({ ...settings, weighted: next });
  const [activePreset, setActivePreset] = React.useState<string | null>(null);
  const set = <K extends keyof StrategyParams>(key: K, value: StrategyParams[K]) => {
    onParams({ ...params, [key]: value });
    setActivePreset(null);
  };
  const setWeight = (id: RuleId, weight: number) => {
    onParams({ ...params, weights: { ...params.weights, [id]: weight } });
    setActivePreset(null);
  };

  const rules = describeStrategy(params);
  const chosen = PRESETS.find((p) => p.id === activePreset) ?? null;

  return (
    <div className="space-y-4">
      <Panel
        title="Which strategy is running"
        icon="🔀"
        subtitle="Two different shapes of rule set. Running a market through both is more informative than trusting either."
      >
        <ChipRow ariaLabel="Strategy engine">
          {(Object.keys(ENGINE_META) as EngineId[]).map((id) => (
            <Chip
              key={id}
              active={settings.engine === id}
              onClick={() => {
                onSettings({ ...settings, engine: id });
                // Deep Smart Money's stop is part of its rules, so it is tested
                // with that stop; switching away puts back an ATR stop.
                if (id === "smart-money" && execution.stopMode !== "signal") {
                  onExecution({ ...execution, stopMode: "signal" });
                } else if (id === "weighted" && execution.stopMode === "signal") {
                  onExecution({ ...execution, stopMode: "atr" });
                }
              }}
            >
              {ENGINE_META[id].label}
            </Chip>
          ))}
        </ChipRow>
        <div className="mt-3 space-y-1.5 rounded-2xl bg-[var(--panel)] px-4 py-3 text-xs font-semibold">
          <p className="font-extrabold">{ENGINE_META[settings.engine].shape}</p>
          <p>{ENGINE_META[settings.engine].blurb}</p>
          <p className="text-[var(--muted)]">
            <strong className="text-[var(--fire-dark)] dark:text-[var(--fire)]">Where it does badly.</strong>{" "}
            {ENGINE_META[settings.engine].caveat}
          </p>
        </div>
      </Panel>

      {settings.engine === "smart-money" ? (
        <SmartMoneyControls
          params={settings.smartMoney}
          onParams={(next) => onSettings({ ...settings, smartMoney: next })}
          execution={execution}
          onExecution={onExecution}
        />
      ) : (
      <>
      <Panel title="Starting points" icon="🧭" subtitle="Each one says what it is trying to catch and where it does badly.">
        <ChipRow ariaLabel="Strategy presets">
          {PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              active={activePreset === preset.id}
              onClick={() => {
                onPreset(preset);
                setActivePreset(preset.id);
              }}
            >
              {preset.gold ? "🥇 " : ""}
              {preset.label}
            </Chip>
          ))}
        </ChipRow>
        {chosen ? (
          <div className="mt-3 space-y-1.5 rounded-2xl bg-[var(--panel)] px-4 py-3 text-xs font-semibold">
            <p>
              <strong>What it is for.</strong> {chosen.intent}
            </p>
            <p className="text-[var(--muted)]">
              <strong className="text-[var(--fire-dark)] dark:text-[var(--fire)]">Where it does badly.</strong>{" "}
              {chosen.weakness}
            </p>
            <p className="text-[var(--muted)]">
              Written for the {chosen.designedFor} chart. It will run on any timeframe, but it was not tested on
              yours until you test it.
            </p>
          </div>
        ) : null}
      </Panel>

      <Panel title="Rule weights" icon="⚖️" subtitle="Zero switches a rule off completely.">
        <div className="space-y-2.5">
          {RULE_IDS.map((id) => (
            <div key={id} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-xs font-extrabold">{RULE_LABELS[id]}</span>
              <Slider
                min={0}
                max={5}
                step={1}
                value={params.weights[id]}
                aria-label={`${RULE_LABELS[id]} weight`}
                onChange={(event) => setWeight(id, Number(event.target.value))}
              />
              <span className="w-10 shrink-0 text-right text-xs font-extrabold tabular-nums text-[var(--muted)]">
                {params.weights[id] === 0 ? "off" : params.weights[id]}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Rule settings" icon="🔧">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Fast MA" value={params.fastMa} min={2} max={200} onChange={(v) => set("fastMa", v)} />
          <NumberField label="Slow MA" value={params.slowMa} min={3} max={400} onChange={(v) => set("slowMa", v)} />
          <div>
            <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">MA type</p>
            <ChipRow ariaLabel="Moving average type">
              <Chip active={params.maType === "ema"} onClick={() => set("maType", "ema")}>
                EMA
              </Chip>
              <Chip active={params.maType === "sma"} onClick={() => set("maType", "sma")}>
                SMA
              </Chip>
            </ChipRow>
          </div>
          <NumberField label="RSI period" value={params.rsiPeriod} min={2} max={100} onChange={(v) => set("rsiPeriod", v)} />
          <NumberField label="RSI oversold" value={params.rsiOversold} min={5} max={49} onChange={(v) => set("rsiOversold", v)} />
          <NumberField label="RSI overbought" value={params.rsiOverbought} min={51} max={95} onChange={(v) => set("rsiOverbought", v)} />
          <NumberField label="MACD fast" value={params.macdFast} min={2} max={50} onChange={(v) => set("macdFast", v)} />
          <NumberField label="MACD slow" value={params.macdSlow} min={3} max={100} onChange={(v) => set("macdSlow", v)} />
          <NumberField label="MACD signal" value={params.macdSignal} min={2} max={50} onChange={(v) => set("macdSignal", v)} />
          <NumberField label="Bollinger period" value={params.bbPeriod} min={5} max={100} onChange={(v) => set("bbPeriod", v)} />
          <NumberField label="Bollinger σ" value={params.bbMultiplier} min={0.5} max={4} step={0.1} onChange={(v) => set("bbMultiplier", v)} />
          <NumberField label="ATR period" value={params.atrPeriod} min={2} max={100} onChange={(v) => set("atrPeriod", v)} />
          <NumberField label="Breakout lookback" value={params.donchianPeriod} min={3} max={200} onChange={(v) => set("donchianPeriod", v)} />
          <NumberField label="Swing window" value={params.pivotWindow} min={1} max={20} hint="bars each side" onChange={(v) => set("pivotWindow", v)} />
          <NumberField label="Momentum period" value={params.momentumPeriod} min={2} max={100} onChange={(v) => set("momentumPeriod", v)} />
          <NumberField label="Minimum ADX" value={params.adxMinimum} min={0} max={60} hint="below this, the score is cut" onChange={(v) => set("adxMinimum", v)} />
          <NumberField label="Higher timeframe" value={params.htfSteps} min={0} max={4} hint="steps up the ladder" onChange={(v) => set("htfSteps", v)} />
          <NumberField label="Minimum score" value={params.minScore} min={0} max={100} hint="below this, NEUTRAL" onChange={(v) => set("minScore", v)} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={params.requireHtfAgreement}
            onChange={(v) => set("requireHtfAgreement", v)}
            label="Require the higher timeframe to agree"
            description="A signal against the higher-timeframe trend is downgraded to neutral."
          />
          <Toggle
            checked={execution.exitOnOppositeSignal}
            onChange={(v) => onExecution({ ...execution, exitOnOppositeSignal: v })}
            label="Close on an opposite signal"
            description="Otherwise a trade runs to its stop, its target or the end of the data."
          />
        </div>
      </Panel>

      <Panel
        title="The exact rules behind every signal"
        icon="📜"
        subtitle="What each active rule tests, in words, at your current settings."
      >
        <ol className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.label} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
              <p className="text-xs font-extrabold">
                {rule.label}
                <span className="ml-2 rounded bg-[var(--panel-2)] px-1.5 text-[10px] tabular-nums text-[var(--muted)]">
                  weight {rule.weight}
                </span>
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{rule.rule}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
          The score is the weight of the rules pointing one way, over the weight of every active rule, as a
          percentage. A failed volatility or ADX filter multiplies it by 0.75 and is listed as a caution. It is a
          measure of agreement, and it says nothing about how often such a setup has worked.
        </p>
      </Panel>
      </>
      )}
    </div>
  );
}

/**
 * Deep Smart Money's controls.
 *
 * Laid out as the strategy is built — the filters that can veto, then the
 * triggers that can fire — rather than as a flat list of numbers, because the
 * order is the whole point of this rule set.
 */
function SmartMoneyControls({
  params,
  onParams,
  execution,
  onExecution,
}: {
  params: SmartMoneyParams;
  onParams: (next: SmartMoneyParams) => void;
  execution: ExecutionConfig;
  onExecution: (next: ExecutionConfig) => void;
}) {
  const set = <K extends keyof SmartMoneyParams>(key: K, value: SmartMoneyParams[K]) =>
    onParams({ ...params, [key]: value });

  return (
    <>
      <Panel
        title="Filters — every one of these must pass"
        icon="🚧"
        subtitle="One failed filter vetoes the trade, however good the rest looks."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Trend average" value={params.trendMa} min={5} max={400} hint="the above/below filter" onChange={(v) => set("trendMa", v)} />
          <div>
            <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Trend average type</p>
            <ChipRow ariaLabel="Trend average type">
              <Chip active={params.trendMaType === "ema"} onClick={() => set("trendMaType", "ema")}>EMA</Chip>
              <Chip active={params.trendMaType === "sma"} onClick={() => set("trendMaType", "sma")}>SMA</Chip>
            </ChipRow>
          </div>
          <NumberField label="Fast EMA" value={params.fastEma} min={2} max={100} onChange={(v) => set("fastEma", v)} />
          <NumberField label="Slow EMA" value={params.slowEma} min={3} max={200} onChange={(v) => set("slowEma", v)} />
          <NumberField label="RSI period" value={params.rsiPeriod} min={2} max={100} hint="must be the right side of 50" onChange={(v) => set("rsiPeriod", v)} />
          <NumberField label="Candle body share" value={params.strongBodyShare} min={0} max={1} step={0.05} hint="body ÷ range" onChange={(v) => set("strongBodyShare", v)} />
          <NumberField label="Volume average" value={params.volumeMa} min={2} max={200} onChange={(v) => set("volumeMa", v)} />
          <NumberField label="Volume multiple" value={params.volumeMultiple} min={0.1} max={10} step={0.1} hint="above its own average" onChange={(v) => set("volumeMultiple", v)} suffix="×" />
          <NumberField label="Cooldown" value={params.cooldownBars} min={0} max={500} hint="bars between signals per side" onChange={(v) => set("cooldownBars", v)} />
        </div>

        <div className="mt-3">
          <Toggle
            checked={params.requireHighVolume}
            onChange={(v) => set("requireHighVolume", v)}
            label="Require volume above its average"
            description="Spot forex and metals have no real volume. On a source that publishes none this filter cannot run, and the signal panel says so rather than passing it quietly."
          />
        </div>
      </Panel>

      <Panel title="Triggers — any one of these can fire" icon="⚡" subtitle="Only once every filter above has passed.">
        <ChipRow ariaLabel="Entry triggers">
          {(Object.keys(TRIGGER_LABELS) as TriggerId[]).map((id) => (
            <Chip
              key={id}
              active={params.triggers[id]}
              onClick={() => set("triggers", { ...params.triggers, [id]: !params.triggers[id] })}
            >
              {TRIGGER_LABELS[id]}
            </Chip>
          ))}
        </ChipRow>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Box lookback" value={params.boxLookback} min={3} max={200} hint="bars in the range" onChange={(v) => set("boxLookback", v)} />
          <NumberField label="Box width limit" value={params.boxMaxRangeAtr} min={0.2} max={10} step={0.1} hint="× ATR, to count as consolidation" onChange={(v) => set("boxMaxRangeAtr", v)} />
          <NumberField label="Liquidity swing window" value={params.liquidityPivot} min={1} max={20} hint="bars either side" onChange={(v) => set("liquidityPivot", v)} />
          <NumberField label="Structure-break lookback" value={params.bosLookback} min={2} max={200} onChange={(v) => set("bosLookback", v)} />
          <NumberField label="Order block valid for" value={params.orderBlockValidBars} min={1} max={200} hint="bars after the break" onChange={(v) => set("orderBlockValidBars", v)} />
        </div>
      </Panel>

      <Panel title="The stop this strategy sets for itself" icon="🛑">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Reward to risk" value={params.rr} min={0.2} max={20} step={0.1} onChange={(v) => set("rr", v)} suffix=": 1" />
          <NumberField label="Stop-hunt padding" value={params.huntStopAtrPad} min={0} max={2} step={0.05} hint="× ATR below the sweep" onChange={(v) => set("huntStopAtrPad", v)} suffix="×" />
          <NumberField label="Minimum stop" value={params.minStopAtr} min={0} max={5} step={0.05} hint="× ATR — 0 for exact parity" onChange={(v) => set("minStopAtr", v)} suffix="×" />
        </div>
        <div className="mt-3 space-y-2 text-xs font-semibold">
          <p>
            The stop goes at the signal bar&rsquo;s low for a buy and its high for a sell, padded by{" "}
            {params.huntStopAtrPad} × ATR when a liquidity sweep is what fired. The target is that distance
            multiplied by {params.rr}.
          </p>
          <p className="text-[var(--muted)]">
            On a small candle that stop can be a few pips wide, which stops being a risk decision and becomes a
            leverage cap — so a floor of {params.minStopAtr} × ATR is applied and reported whenever it binds.
            Set it to zero to run exactly what the rules say, and watch the position sizes.
          </p>
          <p className="text-[var(--muted)]">
            For the backtester to use this stop rather than its own, set{" "}
            <strong>Stop-loss from → the strategy&rsquo;s own stop</strong> in the Backtest tab.
            {execution.stopMode === "signal" ? " That is what it is set to." : " It is not set to that right now."}
          </p>
          {execution.stopMode !== "signal" ? (
            <button
              type="button"
              onClick={() => onExecution({ ...execution, stopMode: "signal" })}
              className="do-btn rounded-xl px-4 py-2 text-xs [--btn-bg:var(--panel)] [--btn-fg:var(--ink)] [--btn-shadow:var(--border-strong)]"
            >
              Use the strategy&rsquo;s own stop in the backtest
            </button>
          ) : null}
        </div>
      </Panel>
    </>
  );
}
