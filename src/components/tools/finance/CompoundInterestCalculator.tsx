"use client";

import * as React from "react";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { compound, COMPOUNDING_LABELS, type Compounding } from "@/lib/calculators/compound";
import { MetricTile, NumberField, Panel } from "../trading/shared";

const money = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 2 }) : "—";

/**
 * Compound interest with monthly deposits.
 *
 * The chart splits each year's balance into what was paid in and what the
 * interest added, because the point of compounding only lands when you can see
 * the second band overtake the first.
 */
export function CompoundInterestCalculator() {
  const [principal, setPrincipal] = React.useState(10_000);
  const [rate, setRate] = React.useState(7);
  const [years, setYears] = React.useState(20);
  const [compounding, setCompounding] = React.useState<Compounding>(12);
  const [monthly, setMonthly] = React.useState(200);
  const [atStart, setAtStart] = React.useState(false);
  const [inflation, setInflation] = React.useState(0);

  const result = compound({
    principal,
    annualRate: rate,
    years,
    compounding,
    monthlyContribution: monthly,
    contributeAtStart: atStart,
    inflation,
  });

  const peak = Math.max(...result.years.map((y) => y.balance), 1);
  const interestOvertakes = result.years.find((y) => y.interest > y.contributed);

  return (
    <div className="space-y-4">
      <Panel title="Your numbers" icon="🧮">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Starting amount" value={principal} min={0} step={100} onChange={setPrincipal} />
          <NumberField label="Monthly deposit" value={monthly} min={0} step={10} onChange={setMonthly} />
          <NumberField label="Annual interest rate" value={rate} min={0} max={100} step={0.1} onChange={setRate} suffix="%" />
          <NumberField label="Years" value={years} min={1} max={100} onChange={setYears} />
          <div>
            <Label htmlFor="ci-compounding">Compounded</Label>
            <Select
              id="ci-compounding"
              value={compounding}
              onChange={(e) => setCompounding(Number(e.target.value) as Compounding)}
            >
              {(Object.keys(COMPOUNDING_LABELS) as unknown as Compounding[]).map((n) => (
                <option key={n} value={n}>
                  {COMPOUNDING_LABELS[n]}
                </option>
              ))}
            </Select>
          </div>
          <NumberField label="Inflation (optional)" value={inflation} min={0} max={50} step={0.1} hint="for today's money" onChange={setInflation} suffix="%" />
          <div className="sm:col-span-2">
            <Toggle
              checked={atStart}
              onChange={setAtStart}
              label="Deposit at the start of each month"
              description="Each deposit then earns that month's interest too."
            />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="Final balance" value={money(result.finalBalance)} tone="grass" />
        <MetricTile label="You paid in" value={money(result.totalContributed)} />
        <MetricTile label="Interest earned" value={money(result.totalInterest)} tone="grass" />
        <MetricTile
          label={result.realBalance !== null ? "In today's money" : "Effective annual rate"}
          value={result.realBalance !== null ? money(result.realBalance) : `${result.effectiveAnnualRate.toFixed(3)}%`}
          hint={result.realBalance !== null ? `after ${inflation}% inflation a year` : `${rate}% compounded ${COMPOUNDING_LABELS[compounding].toLowerCase()}`}
        />
      </div>

      <Panel
        title="How it grows"
        icon="📈"
        subtitle={
          interestOvertakes
            ? `From year ${interestOvertakes.year}, interest has added more than you paid in.`
            : "Over this period, your deposits stay larger than the interest they earn."
        }
      >
        <div
          className="flex h-48 items-end gap-[2px]"
          role="img"
          aria-label={`Balance grows from ${money(principal)} to ${money(result.finalBalance)} over ${years} years.`}
        >
          {result.years.map((y) => (
            <div key={y.year} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Year ${y.year}: ${money(y.balance)}`}>
              <div className="w-full rounded-t bg-[var(--grass)]" style={{ height: `${(Math.max(0, y.interest) / peak) * 100}%` }} />
              <div className="w-full bg-[var(--sky)]" style={{ height: `${(y.contributed / peak) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs font-extrabold text-[var(--muted)]">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sky)] align-middle" />Paid in</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--grass)] align-middle" />Interest</span>
          {result.doublingYears !== null ? (
            <span>At this rate, money doubles in about {result.doublingYears.toFixed(1)} years.</span>
          ) : null}
        </div>
      </Panel>

      <Panel title="Year by year" icon="📋">
        <div className="do-scroll max-h-80 overflow-auto rounded-2xl border-2 border-[var(--border)]">
          <table className="w-full min-w-[520px] text-xs font-semibold tabular-nums">
            <thead className="sticky top-0 bg-[var(--panel)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Paid in</th>
                <th className="px-3 py-2">Interest that year</th>
                <th className="px-3 py-2">Total interest</th>
                <th className="px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {result.years.map((y) => (
                <tr key={y.year} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5 font-extrabold">{y.year}</td>
                  <td className="px-3 py-1.5">{money(y.contributed)}</td>
                  <td className="px-3 py-1.5">{money(y.interestThisYear)}</td>
                  <td className="px-3 py-1.5">{money(y.interest)}</td>
                  <td className="px-3 py-1.5 font-extrabold">{money(y.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
          This assumes the rate stays fixed for the whole period and ignores tax and fees. Real returns on
          anything other than a fixed deposit go up and down, and past returns do not predict future ones.
        </p>
      </Panel>
    </div>
  );
}
