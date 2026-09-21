"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { formatMoney, formatPercent, formatPips, formatPrice, formatRatio } from "@/lib/trading/format";
import { rewardProfile, sizePosition, valuePerPipPerLot } from "@/lib/trading/risk";
import { getInstrument, instrumentOf, INSTRUMENTS, type Instrument, type Series } from "@/lib/trading/types";
import { MetricTile, NumberField, Panel } from "./shared";

export interface RiskInputs {
  balance: number;
  riskPercent: number;
  entry: number;
  stop: number;
  target: number;
  leverage: number;
  quoteToAccountRate: number;
  instrumentId: string;
  roundLots: boolean;
}

/**
 * The risk calculator.
 *
 * It answers "how big can this position be" from the stop, and deliberately
 * does not answer "what leverage should I use". Leverage here is a ceiling the
 * visitor sets, shown alongside what it does to the margin and how little room
 * it leaves — never a suggestion.
 */
export function RiskPanel({
  inputs,
  onInputs,
  series,
  liveSpreadPips,
}: {
  inputs: RiskInputs;
  onInputs: (next: RiskInputs) => void;
  series: Series | null;
  liveSpreadPips?: number;
}) {
  const instrument: Instrument =
    series && inputs.instrumentId === "chart" ? instrumentOf(series) : getInstrument(inputs.instrumentId);

  const set = <K extends keyof RiskInputs>(key: K, value: RiskInputs[K]) =>
    onInputs({ ...inputs, [key]: value });

  const sizing = sizePosition({
    balance: inputs.balance,
    riskPercent: inputs.riskPercent,
    entry: inputs.entry,
    stop: inputs.stop,
    instrument,
    leverage: inputs.leverage,
    quoteToAccountRate: inputs.quoteToAccountRate,
    roundLots: inputs.roundLots,
    minLot: 0.01,
    lotStep: 0.01,
  });
  const reward = rewardProfile(inputs.entry, inputs.stop, inputs.target, sizing.units, inputs.quoteToAccountRate);
  const perPip = valuePerPipPerLot(instrument, inputs.quoteToAccountRate);
  const marginShare = inputs.balance > 0 ? (sizing.marginRequired / inputs.balance) * 100 : 0;
  const distanceToWipeout =
    sizing.units > 0 ? inputs.balance / (sizing.units * inputs.quoteToAccountRate) : null;

  const prefill = () => {
    if (!series) return;
    const last = series.candles.at(-1);
    if (!last) return;
    const tick = instrumentOf(series);
    const stopDistance = Math.max(tick.pip * 50, last.close * 0.004);
    onInputs({
      ...inputs,
      instrumentId: "chart",
      entry: Number(last.close.toFixed(tick.digits)),
      stop: Number((last.close - stopDistance).toFixed(tick.digits)),
      target: Number((last.close + stopDistance * 2).toFixed(tick.digits)),
    });
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Risk calculator"
        icon="🧮"
        subtitle="Position size from the stop, not from a feeling about how strong the setup looks."
        right={
          series ? (
            <Button tone="panel" size="sm" onClick={prefill}>
              Use the chart&rsquo;s last price
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="risk-instrument">Instrument</Label>
            <Select
              id="risk-instrument"
              value={inputs.instrumentId}
              onChange={(event) => set("instrumentId", event.target.value)}
            >
              {series ? <option value="chart">From the chart — {instrumentOf(series).name}</option> : null}
              {INSTRUMENTS.filter((i) => i.id !== "GENERIC").map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
              <option value="GENERIC">Other / custom</option>
            </Select>
          </div>
          <NumberField label="Account balance" value={inputs.balance} min={1} step={100} onChange={(v) => set("balance", v)} suffix="$" />
          <NumberField label="Risk per trade" value={inputs.riskPercent} min={0.01} max={100} step={0.1} onChange={(v) => set("riskPercent", v)} suffix="%" />
          <NumberField label="Entry price" value={inputs.entry} min={0} step={instrument.pip} onChange={(v) => set("entry", v)} />
          <NumberField label="Stop-loss" value={inputs.stop} min={0} step={instrument.pip} onChange={(v) => set("stop", v)} />
          <NumberField label="Target" value={inputs.target} min={0} step={instrument.pip} onChange={(v) => set("target", v)} />
          <NumberField
            label="Maximum leverage"
            value={inputs.leverage}
            min={1}
            max={2000}
            hint="your account's ceiling"
            onChange={(v) => set("leverage", v)}
            suffix=":1"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Quote → account rate"
            value={inputs.quoteToAccountRate}
            min={0.0001}
            step={0.01}
            hint="1 when the pair is priced in your account currency"
            onChange={(v) => set("quoteToAccountRate", v)}
          />
          <Toggle
            checked={inputs.roundLots}
            onChange={(v) => set("roundLots", v)}
            label="Round to whole 0.01 lots"
            description="Rounded down, so the risk can only come out under your limit — never over."
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricTile label="Most you can lose" value={formatMoney(sizing.riskMoney)} hint={`${formatPercent(inputs.riskPercent)} of the balance`} tone="cherry" />
          <MetricTile
            label="Position size"
            value={sizing.lots === 0 ? "—" : `${sizing.lots.toFixed(2)} lots`}
            hint={sizing.lots === 0 ? "below the 0.01 minimum" : `${Math.round(sizing.units).toLocaleString()} ${instrument.base === "XAU" ? "oz" : "units"}`}
          />
          <MetricTile label="Stop distance" value={formatPips(sizing.stopPips)} hint={formatPrice(sizing.stopDistance, instrument)} />
          <MetricTile label="Reward : risk" value={formatRatio(reward.ratio)} hint={reward.breakEvenWinRate === null ? undefined : `${formatPercent(reward.breakEvenWinRate)} of trades must win to break even`} />
          <MetricTile label="If the stop is hit" value={formatMoney(-reward.potentialLoss)} tone="cherry" />
          <MetricTile label="If the target is hit" value={formatMoney(reward.potentialProfit)} tone="grass" />
          <MetricTile label="Value of one pip" value={formatMoney(perPip * sizing.lots)} hint={`${formatMoney(perPip)} per standard lot`} />
          <MetricTile label="Face value" value={formatMoney(sizing.notional)} hint={`margin ${formatMoney(sizing.marginRequired)}`} />
        </div>

        {sizing.note ? (
          <p className="mt-3 rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-xs font-semibold">
            {sizing.note}
          </p>
        ) : null}

        {liveSpreadPips !== undefined && liveSpreadPips > 0 ? (
          <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
            Your broker&rsquo;s spread on this symbol right now is about {formatPips(liveSpreadPips)}, which costs{" "}
            {formatMoney(perPip * sizing.lots * liveSpreadPips)} on this position size before the trade has moved.
          </p>
        ) : null}
      </Panel>

      <Panel title="What that leverage actually means" icon="⚠️">
        <div className="space-y-2 text-xs font-semibold">
          <p>
            Leverage does not change how much you lose when the stop is hit — the stop and the position size do
            that, and both are above. What it changes is the <strong>size you are allowed to hold</strong>, and
            therefore how little the market has to move before the account is gone.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricTile label="Margin used" value={formatPercent(marginShare)} hint="of the balance" tone={marginShare > 50 ? "cherry" : "ink"} />
            <MetricTile
              label="Free margin left"
              value={formatMoney(Math.max(0, inputs.balance - sizing.marginRequired))}
              tone={inputs.balance - sizing.marginRequired < 0 ? "cherry" : "ink"}
            />
            <MetricTile
              label="Move that wipes the account"
              value={distanceToWipeout === null ? "—" : formatPips(distanceToWipeout / instrument.pip)}
              hint="against this position, ignoring margin calls"
              tone="cherry"
            />
          </div>
          <p className="text-[var(--muted)]">
            DO101 does not suggest a leverage figure and there is no correct one to suggest: it depends on the
            account, the instrument, the broker&rsquo;s margin rules and a tolerance for loss that a web page
            cannot know. What it can tell you is the arithmetic above. Note that the same {inputs.leverage}:1
            ceiling on a larger balance is a far larger position.
          </p>
        </div>
      </Panel>
    </div>
  );
}
