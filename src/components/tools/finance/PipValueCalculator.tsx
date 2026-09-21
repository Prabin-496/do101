"use client";

import * as React from "react";
import { Label, Select } from "@/components/ui/Field";
import { CURRENCIES, rate as rateOf } from "@/lib/currency/rates";
import { quoteToAccount, valuePerPipPerLot } from "@/lib/trading/risk";
import { getInstrument, INSTRUMENTS } from "@/lib/trading/types";
import { MetricTile, NumberField, Panel } from "../trading/shared";
import { useEcbRates } from "./use-ecb-rates";

const LOTS = [
  { label: "Standard", size: 1 },
  { label: "Mini", size: 0.1 },
  { label: "Micro", size: 0.01 },
];

/**
 * What one pip is worth.
 *
 * Contract size × pip size, converted into your own currency — which is the
 * part that differs between EUR/USD, USD/JPY and EUR/GBP, and the reason a
 * "pip is ten dollars" rule of thumb is only true for some of them.
 */
export function PipValueCalculator() {
  const [account, setAccount] = React.useState("USD");
  const [instrumentId, setInstrumentId] = React.useState("EURUSD");
  const [lots, setLots] = React.useState(1);
  const [pips, setPips] = React.useState(20);
  const [price, setPrice] = React.useState(0);

  const instrument = getInstrument(instrumentId);
  // The pair's own price is only needed when the account currency is its base.
  const needsPrice = instrument.base === account;
  const needsCross = instrument.quote !== account && !needsPrice;
  const { table, error } = useEcbRates(needsPrice || needsCross);

  const ecbPrice = table && instrument.kind === "forex" ? rateOf(instrument.base, instrument.quote, table) : null;
  const usedPrice = price > 0 ? price : ecbPrice ?? 0;
  const cross = table ? rateOf(instrument.quote, account, table) : null;
  const conversion = quoteToAccount(instrument, usedPrice, account, cross);

  const perLot = conversion.rate !== null ? valuePerPipPerLot(instrument, conversion.rate) : null;
  const fmt = (n: number | null) =>
    n === null ? "—" : `${n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 })} ${account}`;

  return (
    <div className="space-y-4">
      <Panel title="Pair and size" icon="📐">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="pv-instrument">Instrument</Label>
            <Select id="pv-instrument" value={instrumentId} onChange={(e) => { setInstrumentId(e.target.value); setPrice(0); }}>
              {INSTRUMENTS.filter((i) => i.id !== "GENERIC").map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="pv-account">Account currency</Label>
            <Select id="pv-account" value={account} onChange={(e) => setAccount(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <NumberField label="Position size" value={lots} min={0.01} step={0.01} onChange={setLots} suffix="lots" />
          <NumberField label="Price move" value={pips} min={0} step={1} onChange={setPips} suffix="pips" />
        </div>
        {needsPrice ? (
          <div className="mt-3 max-w-xs">
            <NumberField
              label={`${instrument.name} price`}
              value={price > 0 ? price : Number((ecbPrice ?? 0).toFixed(instrument.digits))}
              min={0}
              step={instrument.pip}
              hint={price > 0 ? "your price" : table ? `ECB reference, ${table.date}` : error ?? "loading…"}
              onChange={setPrice}
            />
          </div>
        ) : null}
      </Panel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="One pip, this position" value={fmt(perLot === null ? null : perLot * lots)} tone="grass" />
        <MetricTile label={`${pips} pips`} value={fmt(perLot === null ? null : perLot * lots * pips)} />
        <MetricTile label="Pip size" value={String(instrument.pip)} hint={`${instrument.digits} decimal places`} />
        <MetricTile label="Contract size" value={instrument.contractSize.toLocaleString()} hint={instrument.base === "XAU" ? "troy ounces per lot" : `${instrument.base} per lot`} />
      </div>

      <Panel title="By lot size" icon="📋">
        <table className="w-full text-xs font-semibold tabular-nums">
          <thead className="text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <tr><th className="py-1.5">Lot</th><th className="py-1.5">Units</th><th className="py-1.5">One pip</th><th className="py-1.5">{pips} pips</th></tr>
          </thead>
          <tbody>
            {LOTS.map((lot) => (
              <tr key={lot.label} className="border-t border-[var(--border)]">
                <td className="py-1.5 font-extrabold">{lot.label} ({lot.size})</td>
                <td className="py-1.5">{(instrument.contractSize * lot.size).toLocaleString()}</td>
                <td className="py-1.5">{fmt(perLot === null ? null : perLot * lot.size)}</td>
                <td className="py-1.5">{fmt(perLot === null ? null : perLot * lot.size * pips)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
          {conversion.how === "same"
            ? `${instrument.name} is priced in ${account}, so a pip is simply contract size × pip size: ${instrument.contractSize.toLocaleString()} × ${instrument.pip}.`
            : conversion.how === "inverted"
              ? `Your account currency is the base of ${instrument.name}, so the pip value in ${instrument.quote} is divided by the pair's price (${usedPrice}).`
              : conversion.how === "cross"
                ? `${instrument.name} is priced in ${instrument.quote}, so each pip is converted to ${account} at the ECB reference rate of ${cross?.toFixed(5)} (${table?.date}).`
                : error ?? "Loading the conversion rate…"}{" "}
          Contract sizes are the usual retail ones — check your broker&rsquo;s, especially for gold and silver.
        </p>
      </Panel>
    </div>
  );
}
