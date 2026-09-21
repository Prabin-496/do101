"use client";

import * as React from "react";
import Link from "next/link";
import { Label, Select } from "@/components/ui/Field";
import { CURRENCIES, rate as rateOf } from "@/lib/currency/rates";
import { quoteToAccount, sizePosition, valuePerPipPerLot } from "@/lib/trading/risk";
import { getInstrument, INSTRUMENTS } from "@/lib/trading/types";
import { Chip, ChipRow, MetricTile, NumberField, Panel } from "../trading/shared";
import { useEcbRates } from "./use-ecb-rates";

const money = (n: number, currency: string) =>
  Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}` : "—";

/**
 * Forex and gold position size.
 *
 * The size comes from the stop, not the other way round: decide where the
 * trade is wrong, decide what being wrong may cost, and the lot size is
 * whatever makes those two agree. Converts to any account currency, including
 * the cross pairs most calculators quietly get wrong.
 */
export function PositionSizeCalculator() {
  const [account, setAccount] = React.useState("USD");
  const [balance, setBalance] = React.useState(10_000);
  const [riskPercent, setRiskPercent] = React.useState(1);
  const [instrumentId, setInstrumentId] = React.useState("XAUUSD");
  // Prices typed per instrument, so switching from gold to EUR/GBP never
  // carries a gold price across to a pair that trades near 0.86.
  const [typedEntry, setTypedEntry] = React.useState<Record<string, number>>({ XAUUSD: 2000 });
  const [stopMode, setStopMode] = React.useState<"pips" | "price">("pips");
  const [stopPips, setStopPips] = React.useState(500);
  const [stopPrice, setStopPrice] = React.useState(1995);
  const [leverage, setLeverage] = React.useState(100);
  const [manualRate, setManualRate] = React.useState(0);

  const instrument = getInstrument(instrumentId);
  const isForex = instrument.kind === "forex";
  // Forex pairs get the ECB reference price until one is typed; metals are
  // not an ECB series, so they use whatever price was entered for them.
  const { table, error } = useEcbRates(isForex || instrument.quote !== account);
  const ecbPrice = table && isForex ? rateOf(instrument.base, instrument.quote, table) : null;
  const typed = typedEntry[instrumentId];
  const entry = typed ?? (ecbPrice !== null ? Number(ecbPrice.toFixed(instrument.digits)) : 0);
  const entrySource = typed !== undefined ? "typed" : ecbPrice !== null ? "ecb" : "none";
  const setEntry = (value: number) => setTypedEntry((current) => ({ ...current, [instrumentId]: value }));
  const stop = stopMode === "pips" ? entry - stopPips * instrument.pip : stopPrice;

  const ecbRate = table ? rateOf(instrument.quote, account, table) : null;
  const direct = quoteToAccount(instrument, entry, account);
  const conversion = quoteToAccount(instrument, entry, account, manualRate > 0 ? manualRate : ecbRate);

  const sizing =
    conversion.rate !== null && entry > 0
      ? sizePosition({
          balance, riskPercent, entry, stop, instrument, leverage,
          quoteToAccountRate: conversion.rate, roundLots: true, minLot: 0.01, lotStep: 0.01,
        })
      : null;

  return (
    <div className="space-y-4">
      <Panel title="Account and risk" icon="💼">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="ps-account">Account currency</Label>
            <Select id="ps-account" value={account} onChange={(e) => setAccount(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <NumberField label="Account balance" value={balance} min={1} step={100} onChange={setBalance} />
          <NumberField label="Risk per trade" value={riskPercent} min={0.01} max={100} step={0.1} onChange={setRiskPercent} suffix="%" />
          <NumberField label="Maximum leverage" value={leverage} min={1} max={3000} hint="your broker's ceiling" onChange={setLeverage} suffix=":1" />
        </div>
      </Panel>

      <Panel title="The trade" icon="🎯">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="ps-instrument">Instrument</Label>
            <Select
              id="ps-instrument"
              value={instrumentId}
              onChange={(e) => {
                setInstrumentId(e.target.value);
                setManualRate(0);
                // A stop price belongs to one instrument's scale; pips carry over.
                setStopMode("pips");
              }}
            >
              {INSTRUMENTS.filter((i) => i.id !== "GENERIC").map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </Select>
          </div>
          <NumberField
            label="Entry price"
            value={entry}
            min={0}
            step={instrument.pip}
            hint={
              entrySource === "ecb"
                ? `ECB reference, ${table?.date} — type your broker's price`
                : entrySource === "typed"
                  ? "use your broker's current price"
                  : isForex
                    ? "loading ECB price…"
                    : "enter your broker's price"
            }
            onChange={setEntry}
          />
          <div>
            <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Stop-loss as</p>
            <ChipRow ariaLabel="Stop-loss input">
              <Chip active={stopMode === "pips"} onClick={() => setStopMode("pips")}>Pips</Chip>
              <Chip active={stopMode === "price"} onClick={() => setStopMode("price")}>Price</Chip>
            </ChipRow>
          </div>
          {stopMode === "pips" ? (
            <NumberField label="Stop distance" value={stopPips} min={0.1} step={1} hint={`1 pip = ${instrument.pip}`} onChange={setStopPips} suffix="pips" />
          ) : (
            <NumberField label="Stop-loss price" value={stopPrice} min={0} step={instrument.pip} onChange={setStopPrice} />
          )}
        </div>

        {direct.how === "needed" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumberField
              label={`1 ${instrument.quote} in ${account}`}
              value={manualRate > 0 ? manualRate : Number((ecbRate ?? 0).toFixed(6))}
              min={0}
              step={0.0001}
              hint={manualRate > 0 ? "your rate" : table ? `ECB reference rate, ${table.date}` : error ?? "loading ECB rate…"}
              onChange={setManualRate}
            />
            <p className="self-end pb-2 text-xs font-semibold text-[var(--muted)]">
              {instrument.name} is priced in {instrument.quote}, so a pip&rsquo;s value has to be converted into {account}.
              The ECB&rsquo;s daily reference rate is filled in; type your broker&rsquo;s rate to use that instead.
            </p>
          </div>
        ) : null}
      </Panel>

      {sizing ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricTile
              label="Position size"
              value={sizing.lots > 0 ? `${sizing.lots.toFixed(2)} lots` : "—"}
              hint={sizing.lots > 0 ? `${Math.round(sizing.units).toLocaleString()} ${instrument.base === "XAU" ? "oz" : instrument.base}` : "below the 0.01 minimum"}
              tone="grass"
            />
            <MetricTile label="Money at risk" value={money(sizing.actualRisk, account)} hint={`${sizing.actualRiskPercent.toFixed(2)}% of the balance`} tone="cherry" />
            <MetricTile label="Stop distance" value={`${sizing.stopPips.toLocaleString(undefined, { maximumFractionDigits: 1 })} pips`} />
            <MetricTile label="One pip, this size" value={money(valuePerPipPerLot(instrument, conversion.rate!) * sizing.lots, account)} hint={`${money(valuePerPipPerLot(instrument, conversion.rate!), account)} per standard lot`} />
          </div>
          {sizing.note ? (
            <p className="rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-xs font-semibold">{sizing.note}</p>
          ) : null}
          <p className="text-xs font-semibold text-[var(--muted)]">
            Lots are rounded <em>down</em> to the nearest 0.01, so the money at risk can only come out at or under
            your limit. Margin needed at {leverage}:1 is {money(sizing.marginRequired, account)}. Leverage here is a
            ceiling you set — it caps how big a position can be, and never changes what the stop costs. For a full
            strategy backtest, see <Link href="/tools/trading-analyzer" className="underline">TradeLens</Link>.
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold text-[var(--muted)]">
          {error ?? (entry > 0 ? "Waiting for a conversion rate…" : "Enter an entry price to size the position.")}
        </p>
      )}
    </div>
  );
}
